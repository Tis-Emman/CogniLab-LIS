import { NextResponse } from 'next/server';
import { findAuthUserByEmail, requireAdmin } from '@/lib/serverAdmin';
import { ilikeLiteral } from '@/lib/roles';

const STAFF_ROLES = ['member', 'senior_medtech', 'faculty', 'admin'];

/**
 * POST /api/admin/users — create a staff member WITH a login.
 * Body: { full_name, email, role, department, password }
 * The password is temporary: the user must change it on first sign-in.
 * (Doctors are created from Admin → Doctors instead.)
 */
export async function POST(req: Request) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;
  const { admin } = auth;

  const body = await req.json().catch(() => ({}));
  const full_name = String(body.full_name ?? '').trim();
  const email = String(body.email ?? '').trim().toLowerCase();
  const role = String(body.role ?? '');
  const department = String(body.department ?? '').trim();
  const password = String(body.password ?? '');

  if (!full_name || !email || !department) return NextResponse.json({ error: 'Name, email and department are required.' }, { status: 400 });
  if (!STAFF_ROLES.includes(role)) return NextResponse.json({ error: 'Choose a staff role. Doctors are added under Admin → Doctors.' }, { status: 400 });
  if (password.length < 8) return NextResponse.json({ error: 'The temporary password must be at least 8 characters.' }, { status: 400 });

  const { data: existing } = await admin.from('users').select('id').ilike('email', ilikeLiteral(email)).limit(1).maybeSingle();
  if (existing) return NextResponse.json({ error: 'A user with this email already exists.' }, { status: 409 });

  // Create the login (or reuse an orphan login that has no profile yet)
  let authId: string | undefined;
  const created = await admin.auth.admin.createUser({
    email, password, email_confirm: true, user_metadata: { must_change_password: true },
  });
  if (created.data.user) {
    authId = created.data.user.id;
  } else {
    const orphan = await findAuthUserByEmail(admin, email);
    if (!orphan) return NextResponse.json({ error: created.error?.message || 'Could not create the login.' }, { status: 500 });
    authId = orphan.id;
    const upd = await admin.auth.admin.updateUserById(authId, {
      password, email_confirm: true, user_metadata: { must_change_password: true },
    });
    if (upd.error) return NextResponse.json({ error: upd.error.message }, { status: 500 });
  }

  const { data: row, error } = await admin
    .from('users')
    .insert([{
      id: authId,
      full_name,
      email,
      role,
      department,
      encryption_key: `ENC_KEY_${Math.random().toString(36).slice(2, 11).toUpperCase()}`,
    }])
    .select()
    .single();
  if (error) {
    // Don't leave a login behind without a profile
    if (created.data.user) await admin.auth.admin.deleteUser(authId);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ user: row });
}

/**
 * DELETE /api/admin/users — remove a staff member's profile AND their login.
 * Body: { userId }
 * You can't delete yourself, and the last administrator can't be removed.
 */
export async function DELETE(req: Request) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;
  const { admin, caller } = auth;

  const { userId } = await req.json().catch(() => ({}));
  if (!userId) return NextResponse.json({ error: 'userId is required.' }, { status: 400 });
  if (userId === caller.id) return NextResponse.json({ error: "You can't delete your own account." }, { status: 400 });

  const { data: target } = await admin.from('users').select('id, email, role').eq('id', userId).maybeSingle();
  if (!target) return NextResponse.json({ error: 'User not found.' }, { status: 404 });
  if (target.role === 'doctor') return NextResponse.json({ error: 'Doctor accounts are managed under Admin → Doctors.' }, { status: 400 });

  if (target.role === 'admin') {
    const { count } = await admin.from('users').select('id', { head: true, count: 'exact' }).eq('role', 'admin');
    if ((count ?? 0) <= 1) return NextResponse.json({ error: 'The system must keep at least one administrator.' }, { status: 400 });
  }

  const { error } = await admin.from('users').delete().eq('id', userId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // The login may have a different id than the profile row, so match by email
  const login = await findAuthUserByEmail(admin, target.email);
  if (login) await admin.auth.admin.deleteUser(login.id);

  return NextResponse.json({ ok: true });
}

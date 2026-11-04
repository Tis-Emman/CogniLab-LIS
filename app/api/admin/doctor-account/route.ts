import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { ilikeLiteral } from '@/lib/roles';
import { findAuthUserByEmail, requireAdmin } from '@/lib/serverAdmin';

/**
 * POST /api/admin/doctor-account
 * Body: { doctorId: string, password: string }
 * Header: Authorization: Bearer <admin access token>
 *
 * Creates a Supabase Auth login for a predefined doctor (or resets its password),
 * makes sure a users row with role 'doctor' exists, and links it to the doctor.
 * Runs server-side only, because it needs SUPABASE_SERVICE_ROLE_KEY.
 */
export async function POST(req: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return NextResponse.json({ error: 'Server is missing Supabase service credentials.' }, { status: 500 });
  }
  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

  // ── 1. Caller must be a signed-in admin ─────────────────────────────────────
  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });

  const { data: caller, error: callerErr } = await admin.auth.getUser(token);
  if (callerErr || !caller.user?.email) return NextResponse.json({ error: 'Invalid session.' }, { status: 401 });

  const { data: callerRow } = await admin.from('users').select('role').ilike('email', ilikeLiteral(caller.user.email)).limit(1).maybeSingle();
  if (callerRow?.role !== 'admin') return NextResponse.json({ error: 'Only administrators can do this.' }, { status: 403 });

  // ── 2. Validate input ───────────────────────────────────────────────────────
  const { doctorId, password } = await req.json().catch(() => ({}));
  if (!doctorId) return NextResponse.json({ error: 'doctorId is required.' }, { status: 400 });
  if (typeof password !== 'string' || password.length < 8) {
    return NextResponse.json({ error: 'Password must be at least 8 characters.' }, { status: 400 });
  }

  const { data: doctor } = await admin.from('doctors').select('*').eq('id', doctorId).maybeSingle();
  if (!doctor) return NextResponse.json({ error: 'Doctor not found.' }, { status: 404 });
  if (!doctor.email) return NextResponse.json({ error: 'Add an email to this doctor first.' }, { status: 400 });
  const email = String(doctor.email).toLowerCase();

  // Don't turn an existing staff account into a doctor account.
  const { data: existingRow } = await admin.from('users').select('id, role').ilike('email', ilikeLiteral(email)).limit(1).maybeSingle();
  if (existingRow && existingRow.role !== 'doctor') {
    return NextResponse.json({ error: `That email already belongs to a ${existingRow.role} account.` }, { status: 409 });
  }

  // ── 3. Create the auth user, or reset its password if it exists ─────────────
  let authUserId: string | undefined;
  // The admin's password is temporary: the doctor must replace it on first sign-in.
  const created = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { must_change_password: true },
  });
  if (created.data.user) {
    authUserId = created.data.user.id;
  } else {
    // Already registered: find it and set the new password.
    let page = 1;
    while (!authUserId && page <= 20) {
      const { data: list, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
      if (error || !list?.users.length) break;
      authUserId = list.users.find(u => u.email?.toLowerCase() === email)?.id;
      page++;
    }
    if (!authUserId) {
      return NextResponse.json({ error: created.error?.message || 'Could not create the login.' }, { status: 500 });
    }
    const upd = await admin.auth.admin.updateUserById(authUserId, {
      password,
      email_confirm: true,
      user_metadata: { must_change_password: true },
    });
    if (upd.error) return NextResponse.json({ error: upd.error.message }, { status: 500 });
  }

  // ── 4. users row with role 'doctor' ─────────────────────────────────────────
  let userRowId = existingRow?.id as string | undefined;
  if (!userRowId) {
    const { data: inserted, error } = await admin
      .from('users')
      .insert([{
        id: authUserId,
        email,
        full_name: doctor.full_name,
        role: 'doctor',
        department: doctor.specialization || 'Doctor',
        encryption_key: `ENC_KEY_${Math.random().toString(36).slice(2, 11).toUpperCase()}`,
      }])
      .select('id')
      .single();
    if (error) {
      const hint = /check constraint/i.test(error.message)
        ? ' Run database/migrations/001_doctors_admin.sql in Supabase first.'
        : '';
      return NextResponse.json({ error: error.message + hint }, { status: 500 });
    }
    userRowId = inserted.id;
  }

  // ── 5. Link doctor → user ───────────────────────────────────────────────────
  const { error: linkErr } = await admin.from('doctors').update({ user_id: userRowId }).eq('id', doctorId);
  if (linkErr) return NextResponse.json({ error: linkErr.message }, { status: 500 });

  return NextResponse.json({ email, reset: !created.data.user });
}

/**
 * DELETE /api/admin/doctor-account
 * Body: { doctorId }
 * Deletes a doctor and, if they have one, their login and users row.
 * Doctors with test requests can't be deleted (mark them Inactive instead),
 * so request history keeps pointing at a real doctor.
 */
export async function DELETE(req: Request) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;
  const { admin } = auth;

  const { doctorId } = await req.json().catch(() => ({}));
  if (!doctorId) return NextResponse.json({ error: 'doctorId is required.' }, { status: 400 });

  const { data: doctor } = await admin.from('doctors').select('id, full_name, email, user_id').eq('id', doctorId).maybeSingle();
  if (!doctor) return NextResponse.json({ error: 'Doctor not found.' }, { status: 404 });

  const { count } = await admin.from('test_requests').select('id', { head: true, count: 'exact' }).eq('doctor_id', doctorId);
  if ((count ?? 0) > 0) {
    return NextResponse.json({ error: `${doctor.full_name} has ${count} test request(s). Set the doctor to Inactive instead of deleting.` }, { status: 409 });
  }

  const { error } = await admin.from('doctors').delete().eq('id', doctorId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Remove the doctor's login and profile so they can't sign in to an empty portal
  if (doctor.user_id) {
    const { data: row } = await admin.from('users').select('email, role').eq('id', doctor.user_id).maybeSingle();
    if (row?.role === 'doctor') {
      await admin.from('users').delete().eq('id', doctor.user_id);
      const login = await findAuthUserByEmail(admin, row.email);
      if (login) await admin.auth.admin.deleteUser(login.id);
    }
  }
  return NextResponse.json({ ok: true });
}

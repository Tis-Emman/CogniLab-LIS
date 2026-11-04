// Server-only: import this from app/api route handlers, never from client components.
import { NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { ilikeLiteral } from '@/lib/roles';

/**
 * Server-only helpers for admin API routes. They use the service-role key,
 * which must never reach the browser.
 */
export const serviceClient = (): SupabaseClient | null => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
};

/** Verifies the caller is a signed-in administrator. Returns an error response otherwise. */
export const requireAdmin = async (
  req: Request,
): Promise<{ admin: SupabaseClient; caller: { id: string; email: string } } | NextResponse> => {
  const admin = serviceClient();
  if (!admin) return NextResponse.json({ error: 'Server is missing Supabase service credentials.' }, { status: 500 });

  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });

  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user?.email) return NextResponse.json({ error: 'Invalid session.' }, { status: 401 });

  const { data: row } = await admin
    .from('users')
    .select('id, role')
    .ilike('email', ilikeLiteral(data.user.email))
    .limit(1)
    .maybeSingle();
  if (row?.role !== 'admin') return NextResponse.json({ error: 'Only administrators can do this.' }, { status: 403 });

  return { admin, caller: { id: row.id as string, email: data.user.email.toLowerCase() } };
};

/** Finds a Supabase Auth user by email (listUsers is paged). */
export const findAuthUserByEmail = async (admin: SupabaseClient, email: string) => {
  const target = email.trim().toLowerCase();
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error || !data?.users.length) return null;
    const hit = data.users.find((u) => u.email?.toLowerCase() === target);
    if (hit) return hit;
  }
  return null;
};

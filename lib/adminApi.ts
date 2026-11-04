import { supabase } from './supabaseClient';

/** Calls an /api/admin/* route with the signed-in admin's session token. */
const callAdminApi = async (path: string, method: 'POST' | 'DELETE', body: unknown) => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('Your session expired. Please sign in again.');
  const res = await fetch(path, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || 'Request failed.');
  return json;
};

/** Creates a staff member with a login. The password is temporary (changed on first sign-in). */
export const createStaffAccount = (input: {
  full_name: string; email: string; role: string; department: string; password: string;
}) => callAdminApi('/api/admin/users', 'POST', input);

/** Deletes a staff member's profile and login. */
export const deleteStaffAccount = (userId: string) => callAdminApi('/api/admin/users', 'DELETE', { userId });

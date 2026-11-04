/**
 * Role helpers. users.role values: member, faculty, senior_medtech, admin, doctor.
 */

export const isAdmin = (user: { role?: string } | null | undefined): boolean =>
  user?.role === 'admin';

export const isDoctor = (user: { role?: string } | null | undefined): boolean =>
  user?.role === 'doctor';

/** Senior MedTechs and faculty may perform Quality Checking (from users.role, not names). */
export const isSeniorMedtech = (user: { role?: string } | null | undefined): boolean =>
  user?.role === 'senior_medtech' || user?.role === 'faculty';

/** Lab staff who work in the lab dashboard. Admins and doctors have their own portals. */
export const isLabStaff = (user: { role?: string } | null | undefined): boolean =>
  ['member', 'senior_medtech', 'faculty'].includes(user?.role ?? '');

/** Where a user should land after signing in. */
export const homePathForRole = (role?: string): string => {
  if (role === 'admin') return '/admin';
  if (role === 'doctor') return '/doctor';
  return '/dashboard';
};

export const ROLE_LABELS: Record<string, string> = {
  member: 'MedTech',
  senior_medtech: 'Senior MedTech',
  faculty: 'Faculty',
  admin: 'Administrator',
  doctor: 'Doctor',
};

export const roleLabel = (role?: string): string =>
  (role && ROLE_LABELS[role]) || role || 'User';

/** Escapes % and _ so an email can be matched literally with ilike. */
export const ilikeLiteral = (s: string) => s.trim().replace(/[\\%_]/g, (c) => '\\' + c);

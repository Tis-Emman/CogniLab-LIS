'use client';

import { useState } from 'react';
import { Eye, EyeOff, KeyRound, CheckCircle2, AlertCircle, Loader } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/lib/authContext';
import { logActivity } from '@/lib/database';

interface Props {
  /** First sign-in with an admin-issued temporary password */
  forced?: boolean;
  onDone?: () => void;
}

const RULES: { test: (p: string) => boolean; label: string }[] = [
  { test: p => p.length >= 8, label: 'At least 8 characters' },
  { test: p => /[A-Z]/.test(p), label: 'An uppercase letter' },
  { test: p => /[a-z]/.test(p), label: 'A lowercase letter' },
  { test: p => /\d/.test(p), label: 'A number' },
];

const inputCls =
  'w-full px-4 py-2 pr-11 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#3B6255] outline-none text-gray-800 bg-white';

function PasswordInput({ value, onChange, placeholder, autoFocus }: {
  value: string; onChange: (v: string) => void; placeholder?: string; autoFocus?: boolean;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input
        type={show ? 'text' : 'password'}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        autoComplete="new-password"
        className={inputCls}
      />
      <button
        type="button"
        onClick={() => setShow(!show)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-[#3B6255]"
        aria-label={show ? 'Hide password' : 'Show password'}
      >
        {show ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
      </button>
    </div>
  );
}

export default function ChangePasswordForm({ forced = false, onDone }: Props) {
  const { user } = useAuth();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const rulesOk = RULES.every(r => r.test(next));
  const matches = next.length > 0 && next === confirm;
  const canSubmit = !busy && current.length > 0 && rulesOk && matches && next !== current;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || !user) return;
    setBusy(true);
    setError(null);
    try {
      // Confirm the current (or temporary) password before changing it.
      const check = await supabase.auth.signInWithPassword({ email: user.email, password: current });
      if (check.error) throw new Error(forced ? 'The temporary password is incorrect.' : 'Your current password is incorrect.');

      const { error: updErr } = await supabase.auth.updateUser({
        password: next,
        data: { must_change_password: false },
      });
      if (updErr) throw new Error(updErr.message);

      await logActivity({
        user_id: user.id,
        user_name: user.full_name,
        encryption_key: user.encryption_key,
        action: 'edit',
        resource: 'Account Password',
        resource_type: 'Account',
        description: forced
          ? `${user.full_name} replaced their temporary password on first sign-in`
          : `${user.full_name} changed their password`,
      });

      setDone(true);
      setCurrent(''); setNext(''); setConfirm('');
      onDone?.();
    } catch (err: any) {
      setError(err.message || 'Could not change the password.');
    } finally {
      setBusy(false);
    }
  };

  if (done && !forced) {
    return (
      <div className="p-4 rounded-lg bg-green-50 border border-green-200 text-green-800 flex items-center gap-3">
        <CheckCircle2 className="w-5 h-5" /> Password changed. Use the new password next time you sign in.
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">
          {forced ? 'Temporary password (from the administrator)' : 'Current password'}
        </label>
        <PasswordInput value={current} onChange={setCurrent} autoFocus />
      </div>

      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">New password</label>
        <PasswordInput value={next} onChange={setNext} />
        <ul className="mt-2 grid grid-cols-2 gap-1 text-xs">
          {RULES.map(r => (
            <li key={r.label} className={r.test(next) ? 'text-green-700' : 'text-gray-400'}>
              {r.test(next) ? '✓' : '•'} {r.label}
            </li>
          ))}
          {next && current && next === current && (
            <li className="text-red-600 col-span-2">Must be different from the current password</li>
          )}
        </ul>
      </div>

      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">Confirm new password</label>
        <PasswordInput value={confirm} onChange={setConfirm} />
        {confirm && !matches && <p className="text-xs text-red-600 mt-1">Passwords don&apos;t match</p>}
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-800 text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" /> {error}
        </div>
      )}

      <button
        type="submit"
        disabled={!canSubmit}
        className="w-full px-6 py-3 bg-gradient-to-r from-[#3B6255] to-green-900 text-white rounded-lg font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {busy ? <Loader className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
        {busy ? 'Saving…' : forced ? 'Set my password' : 'Change password'}
      </button>
    </form>
  );
}

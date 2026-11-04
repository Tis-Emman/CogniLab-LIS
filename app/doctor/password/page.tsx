'use client';

import { KeyRound } from 'lucide-react';
import ChangePasswordForm from '@/components/ChangePasswordForm';

export default function DoctorPasswordPage() {
  return (
    <div className="max-w-lg">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-2">
          <KeyRound className="w-7 h-7 text-[#3B6255]" /> Change Password
        </h1>
        <p className="text-gray-600 text-sm mt-1">Only you know this password. The administrator cannot see it.</p>
      </div>
      <div className="bg-white rounded-lg shadow-lg p-6 border-l-4 border-[#3B6255]">
        <ChangePasswordForm />
      </div>
    </div>
  );
}

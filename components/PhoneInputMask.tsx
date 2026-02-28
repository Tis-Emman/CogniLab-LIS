import React, { useState } from 'react';

interface PhoneInputMaskProps {
  value: string;
  onChange: (value: string) => void;
  error?: string;
  className?: string;
}

// Philippine mobile number mask: +63 999 999 9999
function formatPhoneNumber(value: string) {
  // Remove all non-digit characters
  let digits = value.replace(/\D/g, '');
  if (digits.startsWith('0')) digits = '63' + digits.slice(1);
  if (digits.startsWith('63')) digits = digits;
  if (digits.startsWith('9')) digits = '63' + digits;
  if (digits.startsWith('639')) digits = digits;
  if (digits.startsWith('63') && digits.length > 2) {
    digits = digits.slice(0, 12); // +63 + 9 digits
  }
  let formatted = '+63';
  if (digits.length > 2) {
    formatted += ' ' + digits.slice(2, 5);
  }
  if (digits.length > 5) {
    formatted += ' ' + digits.slice(5, 8);
  }
  if (digits.length > 8) {
    formatted += ' ' + digits.slice(8, 12);
  }
  return formatted;
}

const PhoneInputMask: React.FC<PhoneInputMaskProps> = ({ value, onChange, error, className }) => {
  const [focused, setFocused] = useState(false);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, '');
    let normalized = raw;
    if (raw.startsWith('0')) normalized = '63' + raw.slice(1);
    if (raw.startsWith('9')) normalized = '63' + raw;
    if (raw.startsWith('63')) normalized = raw;
    if (raw.startsWith('639')) normalized = raw;
    if (normalized.length > 12) normalized = normalized.slice(0, 12);
    onChange('+' + normalized);
  };

  return (
    <div className={`relative ${className || ''}`}>
      <input
        type="tel"
        value={formatPhoneNumber(value)}
        onChange={handleInputChange}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[#3B6255] focus:border-transparent outline-none transition text-gray-800 placeholder-gray-500 bg-white ${
          error ? 'border-red-500 bg-red-50' : 'border-gray-300'
        }`}
        placeholder="e.g., +63 917 123 4567"
        maxLength={16}
        autoComplete="tel"
      />
      {focused && (
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-500 bg-white px-1 rounded shadow">Format: +63 917 123 4567</span>
      )}
      {error && <p className="text-red-500 text-sm mt-1">{error}</p>}
    </div>
  );
};

export default PhoneInputMask;

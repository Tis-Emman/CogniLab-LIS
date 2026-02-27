// PhoneInputMask.tsx
import React from 'react';


interface PhoneInputMaskProps {
  value: string;
  onChange: (value: string) => void;
  error?: string;
  inputRef?: React.RefObject<HTMLInputElement | null>;
}

// Accepts PH mobile numbers: 0917 123 4567 or 09171234567
export default function PhoneInputMask({ value, onChange, error, inputRef }: PhoneInputMaskProps) {
  // Only allow numbers, auto-format as (0917) 123-4567
  function handleInput(e: React.ChangeEvent<HTMLInputElement>) {
    let raw = e.target.value.replace(/\D/g, '');
    if (raw.length > 11) raw = raw.slice(0, 11);
    let formatted = raw;
    if (raw.length > 4) {
      formatted = `(${raw.slice(0, 4)}) ${raw.slice(4, 7)}`;
      if (raw.length > 7) {
        formatted += '-' + raw.slice(7);
      }
    }
    onChange(formatted);
  }

  return (
    <input
      type="tel"
      ref={inputRef}
      value={value}
      onChange={handleInput}
      className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[#3B6255] focus:border-transparent outline-none transition text-gray-800 placeholder-gray-500 bg-white ${error ? 'border-red-500 bg-red-50' : 'border-gray-300'}`}
      placeholder="e.g., (0917) 123-4567"
      maxLength={17}
      inputMode="numeric"
      autoComplete="tel"
      aria-invalid={!!error}
      aria-describedby="error-contact-no"
    />
  );
}

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/authContext';
import { AlertCircle, LogIn, Loader, Eye, EyeOff } from 'lucide-react';
import Image from 'next/image';

export default function LoginPage() {
  const router = useRouter();
  const { signIn, user, loading: authLoading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [hasRememberedEmail, setHasRememberedEmail] = useState(false);

  // Load remembered email from localStorage on mount
  useEffect(() => {
    const savedEmail = localStorage.getItem('cognilab_remembered_email');
    if (savedEmail) {
      setEmail(savedEmail);
      setRememberMe(true);
      setHasRememberedEmail(true);
    }
  }, []);

  // Redirect to dashboard if already logged in
  useEffect(() => {
    if (!authLoading && user) {
      router.push('/dashboard');
    }
  }, [user, authLoading, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await signIn(email, password);
      
      // Save email if Remember Me is checked
      if (rememberMe) {
        localStorage.setItem('cognilab_remembered_email', email);
      } else {
        localStorage.removeItem('cognilab_remembered_email');
      }
      
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgetDevice = () => {
    localStorage.removeItem('lis_remembered_email');
    setEmail('');
    setRememberMe(false);
    setHasRememberedEmail(false);
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#3B6255] to-green-900 flex items-center justify-center">
        <Loader className="w-8 h-8 animate-spin text-white" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex">
      {/* Left Column - Logo with Background */}
      <div className="hidden md:flex md:w-1/2 flex-col items-center justify-center p-12 relative" style={{
        backgroundImage: 'url(/images/background-login.jpg)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}>
        {/* Overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#3B6255] to-green-900 opacity-50"></div>
        
        {/* Content */}
        <div className="relative z-10">
          <div className="bg-white rounded-2xl p-16 shadow-2xl">
            <Image
              src="/images/logo.png"
              alt="CogniLab Logo"
              width={400}
              height={400}
              priority
              className="object-contain"
            />
          </div>
        </div>
      </div>

      {/* Right Column - Login Form */}
      <div className="w-full md:w-1/2 bg-white flex flex-col items-center justify-center p-6 md:p-8">
        <div className="w-full max-w-md">
          {/* Mobile Logo */}
          <div className="md:hidden flex justify-center mb-6">
            <div className="bg-gradient-to-br from-[#3B6255] to-green-900 rounded-xl p-4">
              <Image
                src="/images/logo.png"
                alt="CogniLab Logo"
                width={120}
                height={120}
                priority
                className="object-contain"
              />
            </div>
          </div>

          {/* Form Header */}
          <div className="mb-8 text-center md:text-left">
            <h2 className="text-3xl font-bold text-gray-800 mb-2">Welcome Back</h2>
            <p className="text-gray-600">Sign in to your CogniLab account</p>
          </div>

          {/* Error Alert */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-5 mb-8">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Email Address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your.email@cognilab.com"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#3B6255] focus:border-transparent outline-none transition text-gray-800 placeholder-gray-500 bg-white"
                required
                disabled={loading}
              />
            </div>

            <div className="relative">
              <label className="block text-sm font-semibold text-gray-700 mb-2">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#3B6255] focus:border-transparent outline-none transition text-gray-800 placeholder-gray-500 bg-white pr-12"
                  required
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={loading}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-[#3B6255] transition disabled:opacity-50"
                >
                  {showPassword ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </button>
              </div>
            </div>

            {/* Remember Me Checkbox */}
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#3B6255] cursor-pointer"
                  disabled={loading}
                />
                <span className="text-sm text-gray-700 font-medium">Remember me on this device</span>
              </label>
              {hasRememberedEmail && (
                <button
                  type="button"
                  onClick={handleForgetDevice}
                  className="text-xs text-gray-500 hover:text-gray-700 font-medium hover:underline transition"
                  disabled={loading}
                >
                  Forget this device
                </button>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full px-6 py-3 bg-gradient-to-r from-[#3B6255] to-green-900 text-white rounded-lg hover:shadow-lg transition font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader className="w-4 h-4 animate-spin" />
                  Logging in...
                </>
              ) : (
                <>
                  <LogIn className="w-4 h-4" />
                  Sign In
                </>
              )}
            </button>
          </form>

          {/* Security Message */}
          <p className="text-xs text-gray-600 text-center mt-8 pt-6 border-t border-gray-200">
            🔒 This Laboratory Information System uses encrypted authentication to ensure secure access and data protection. © 2026 KRRAX-JAM Inc
          </p>
        </div>
      </div>
    </div>
  );
}

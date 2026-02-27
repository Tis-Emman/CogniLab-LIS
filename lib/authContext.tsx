'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from './supabaseClient';
import { MOCK_AUTH_USER, MOCK_USERS } from './mockData';

const USE_MOCK_DATA = process.env.NEXT_PUBLIC_USE_MOCK_DATA === 'true';

interface User {
  id: string;
  email: string;
  full_name: string;
  role: string;
  department: string;
  encryption_key: string;
  join_date?: string;
}

interface AuthContextType {
  user: User | null;
  authUser: any;
  loading: boolean;
  signUp: (email: string, password: string, fullName: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [authUser, setAuthUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Check if user is logged in on mount
  useEffect(() => {
    let isEffectActive = true;

    const checkAuth = async () => {
      try {
        // MOCK MODE: Use mock data
        if (USE_MOCK_DATA) {
          console.log('🎭 Using MOCK authentication');
          if (isEffectActive) {
            setUser(MOCK_AUTH_USER);
            setAuthUser({ id: MOCK_AUTH_USER.id, email: MOCK_AUTH_USER.email });
            setLoading(false);
          }
          return;
        }

        // TEST MODE: Bypass login
        if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('testMode') === 'true') {
          if (isEffectActive) {
            setUser({
              id: 'test-user-id',
              email: 'test@lis.com',
              full_name: 'Test User',
              role: 'member',
              department: 'Testing',
              encryption_key: 'TEST_KEY_001',
            });
            setAuthUser({ id: 'test-user-id', email: 'test@lis.com' });
            setLoading(false);
          }
          return;
        }

        // Get the current session (this will restore from storage if available)
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (session?.user) {
          if (isEffectActive) {
            setAuthUser(session.user);
          }
          // Fetch user profile from custom users table - pass email to avoid extra call
          await fetchUserProfile(session.user.id, session.user.email);
          if (isEffectActive) {
            setLoading(false);
          }
        } else {
          if (isEffectActive) {
            setLoading(false);
          }
        }
      } catch (error) {
        console.error('Error checking auth:', error);
        if (isEffectActive) {
          setLoading(false);
        }
      }
    };

    checkAuth();

    // Listen for auth changes (mainly for new logins during the session)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!isEffectActive) return;
      
      if (session?.user) {
        setAuthUser(session.user);
        // Skip if this is initial session, checkAuth is handling it
        if (event !== 'INITIAL_SESSION') {
          await fetchUserProfile(session.user.id, session.user.email);
        }
      } else {
        setAuthUser(null);
        setUser(null);
        setLoading(false);
      }
    });

    return () => {
      isEffectActive = false;
      subscription?.unsubscribe();
    };
  }, []);

  const fetchUserProfile = async (authUserId: string, email?: string) => {
    try {
      // Use provided email, otherwise get from auth user
      let userEmail = email;
      
      if (!userEmail) {
        const {
          data: { user: authUser },
        } = await supabase.auth.getUser();

        if (!authUser?.email) {
          console.error('No auth user email found');
          return;
        }
        userEmail = authUser.email;
      }

      console.log('Looking up user with email:', userEmail);

      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('email', userEmail)
        .maybeSingle();

      if (error) {
        console.error('Database query error:', error.message, error.details);
        throw error;
      }

      if (data) {
        console.log('User profile found:', data);
        setUser({
          id: data.id,
          email: data.email,
          full_name: data.full_name,
          role: data.role,
          department: data.department,
          encryption_key: data.encryption_key,
        });
      } else {
        console.warn('No user profile found for email:', userEmail);
        setUser(null);
      }
    } catch (error) {
      console.error('Error fetching user profile:', error);
      setUser(null);
    }
  };

  const signUp = async (email: string, password: string, fullName: string) => {
    try {
      // Sign up with Supabase Auth
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      });

      if (error) throw error;

      if (data.user) {
        // Create user profile in custom users table
        const encryptionKey = `ENC_KEY_${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

        const { error: profileError } = await supabase.from('users').insert([
          {
            id: data.user.id,
            email,
            full_name: fullName,
            role: 'member',
            department: 'General',
            encryption_key: encryptionKey,
          },
        ]);

        if (profileError) throw profileError;

        await fetchUserProfile(data.user.id);
      }
    } catch (error) {
      console.error('Sign up error:', error);
      throw error;
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      // Use Supabase Auth for real authentication
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        console.error('Supabase Auth error:', error.message);
        throw new Error('Invalid email or password');
      }

      if (!data.user) {
        throw new Error('Authentication failed');
      }

      console.log('✓ Authenticated with Supabase, fetching user profile...');
      setAuthUser(data.user);

      // Fetch user profile from custom users table
      const { data: userData, error: profileError } = await supabase
        .from('users')
        .select('*')
        .eq('email', email)
        .maybeSingle();

      if (profileError) {
        console.error('Profile lookup error:', profileError);
        throw new Error('Failed to fetch user profile');
      }

      if (userData) {
        setUser({
          id: userData.id,
          email: userData.email,
          full_name: userData.full_name,
          role: userData.role,
          department: userData.department,
          encryption_key: userData.encryption_key,
        });
      } else {
        throw new Error('User not found in system');
      }
    } catch (error) {
      console.error('Sign in error:', error);
      throw error;
    }
  };

  const signOut = async () => {
    try {
      // TEST MODE: Clear test user
      if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('testMode') === 'true') {
        setUser(null);
        setAuthUser(null);
        window.location.href = '/login';
        return;
      }

      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      setUser(null);
      setAuthUser(null);
    } catch (error) {
      console.error('Sign out error:', error);
      throw error;
    }
  };

  return (
    <AuthContext.Provider value={{ user, authUser, loading, signUp, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

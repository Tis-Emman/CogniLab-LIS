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
    const checkAuth = async () => {
      try {
        // MOCK MODE: Use mock data
        if (USE_MOCK_DATA) {
          console.log('🎭 Using MOCK authentication');
          setUser(MOCK_AUTH_USER);
          setAuthUser({ id: MOCK_AUTH_USER.id, email: MOCK_AUTH_USER.email });
          setLoading(false);
          return;
        }

        // TEST MODE: Bypass login
        if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('testMode') === 'true') {
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
          return;
        }

        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (session?.user) {
          setAuthUser(session.user);
          // Fetch user profile from custom users table
          await fetchUserProfile(session.user.id);
        }
      } catch (error) {
        console.error('Error checking auth:', error);
      } finally {
        setLoading(false);
      }
    };

    checkAuth();

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        setAuthUser(session.user);
        await fetchUserProfile(session.user.id);
      } else {
        setAuthUser(null);
        setUser(null);
      }
    });

    return () => subscription?.unsubscribe();
  }, []);

  const fetchUserProfile = async (authUserId: string) => {
    try {
      // Get the auth user's email to look up in custom users table
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser();

      if (!authUser?.email) {
        console.error('No auth user email found');
        return;
      }

      console.log('Looking up user with email:', authUser.email);

      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('email', authUser.email)
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
        console.warn('No user profile found for email:', authUser.email);
        setUser(null);
      }
    } catch (error) {
      console.error('Error fetching user profile:', error);
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
      // MOCK MODE: Accept only authorized credentials
      if (USE_MOCK_DATA) {
        console.log('🎭 MOCK MODE LOGIN:', email);
        
        // ALL AUTHORIZED USERS CAN ACCESS THE SYSTEM
        const authorizedCredentials = [
          // Medtech Members
          { email: '2410685CogniLab@gmail.com', password: 'RAlvaran685' },
          { email: '2410584CogniLab@gmail.com', password: 'KBuenaventura584' },
          { email: '2410390CogniLab@gmail.com', password: 'MHernandez390' },
          { email: '2410702CogniLab@gmail.com', password: 'AGautane702' },
          { email: '2410436CogniLab@gmail.com', password: 'ronron67' },
          { email: '2410937CogniLab@gmail.com', password: 'RSuarez937' },
          { email: '2410577CogniLab@gmail.com', password: 'BeiBiBoy20!' },
          { email: '2410236Cognilab@gmail.com', password: 'Javon036' },
          // Faculty
          { email: 'bsmtCogniLab2026@gmail.com', password: 'BSMT2026LIS' },
        ];

        const isValid = authorizedCredentials.some(
          (cred) => cred.email === email && cred.password === password
        );

        if (!isValid) {
          throw new Error('Invalid email or password');
        }

        // Find the user in mock data
        const userInMock = MOCK_USERS.find((u) => u.email === email);
        if (!userInMock) {
          throw new Error('User not found in system');
        }

        setUser(userInMock);
        setAuthUser({ id: userInMock.id, email: userInMock.email });
        return;
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      if (data.user) {
        setAuthUser(data.user);
        await fetchUserProfile(data.user.id);
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

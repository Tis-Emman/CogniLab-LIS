'use client';

import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { supabase } from './supabaseClient';
import { MOCK_USERS } from './mockData';
import { ilikeLiteral } from './roles';

/**
 * Finds the signed-in user's profile. Emails are compared case-insensitively
 * (Supabase Auth lowercases them, but some users rows were saved with capitals).
 * If several rows share the email, prefer the one whose id is the login's id.
 */
const findProfileRow = async (authUserId: string, email: string) => {
  const { data, error } = await supabase.from('users').select('*').ilike('email', ilikeLiteral(email));
  if (error) throw error;
  const rows = data || [];
  return rows.find((r: any) => r.id === authUserId) ?? rows.find((r: any) => r.signatory_name) ?? rows[0] ?? null;
};

const sameEmail = (a?: string | null, b?: string | null) => !!a && !!b && a.toLowerCase() === b.toLowerCase();

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
  // Email whose profile is currently loaded, so token refreshes don't refetch it.
  const profileEmailRef = useRef<string | null>(null);

  // Check if user is logged in on mount
  useEffect(() => {
    let isEffectActive = true;

    // MOCK MODE: Don't auto-login, just stop loading so the login page shows
    if (USE_MOCK_DATA) {
      console.log('🎭 Using MOCK authentication');
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

    // REAL MODE: Rely on onAuthStateChange for session restore on refresh.
    // It fires INITIAL_SESSION with the persisted localStorage token,
    // so we don't need a separate getSession() call that can race with it.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      // IMPORTANT: this callback must not await Supabase calls. Supabase runs it
      // while holding its auth lock (e.g. during a token refresh when the tab
      // becomes visible again); awaiting a query here deadlocks every later
      // request. Do the profile fetch on the next tick instead.
      if (!isEffectActive) return;

      if (!session?.user) {
        profileEmailRef.current = null;
        setAuthUser(null);
        setUser(null);
        setLoading(false);
        return;
      }

      setAuthUser(session.user);

      // A token refresh doesn't change who is signed in; keep the loaded profile.
      if (sameEmail(profileEmailRef.current, session.user.email)) {
        setLoading(false);
        return;
      }

      const { id, email } = session.user;
      setTimeout(async () => {
        if (!isEffectActive) return;
        await fetchUserProfile(id, email);
        setLoading(false);
      }, 0);
    });

    // A saved login can become invalid (password changed/reset, signed out
    // elsewhere). Supabase then reports "Invalid Refresh Token". Clear the stale
    // login locally so the user is simply sent back to the login page.
    supabase.auth.getSession().then(({ error }) => {
      if (error && /refresh token/i.test(error.message)) {
        console.warn('Saved login expired; signing out locally.');
        supabase.auth.signOut({ scope: 'local' }).finally(() => {
          if (!isEffectActive) return;
          profileEmailRef.current = null;
          setAuthUser(null);
          setUser(null);
          setLoading(false);
        });
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

      const data = await findProfileRow(authUserId, userEmail);

      if (data) {
        console.log('User profile found:', data);
        profileEmailRef.current = data.email;
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
      // A network hiccup (e.g. right after the tab wakes up) must not log the
      // user out. Only clear the user if no profile was loaded yet.
      console.error('Error fetching user profile:', error);
      if (!profileEmailRef.current) setUser(null);
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
      let userData: any = null;
      try {
        userData = await findProfileRow(data.user.id, data.user.email ?? email);
      } catch (profileError) {
        console.error('Profile lookup error:', profileError);
        throw new Error('Failed to fetch user profile');
      }

      if (userData) {
        profileEmailRef.current = userData.email;
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
      profileEmailRef.current = null;
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
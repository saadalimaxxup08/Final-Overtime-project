'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

interface EmployeeProfile {
  id: string;
  emp_id: string;
  name: string;
  email: string;
  created_at?: string;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: EmployeeProfile | null;
  isAdmin: boolean;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  profile: null,
  isAdmin: false,
  loading: true,
  signOut: async () => {},
  refreshProfile: async () => {},
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<EmployeeProfile | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);

  const checkAdminStatus = async (email: string): Promise<boolean> => {
    try {
      const { data, error } = await supabase
        .from('admins')
        .select('email')
        .eq('email', email)
        .maybeSingle();

      if (error) {
        console.error('Error checking admin status (it is safe if table is empty):', error);
        return false;
      }
      return !!data;
    } catch (err) {
      console.warn('Admins table check failed (e.g. table empty/not found):', err);
      return false;
    }
  };

  const fetchProfile = async (userId: string): Promise<EmployeeProfile | null> => {
    try {
      const { data, error } = await supabase
        .from('employees')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        console.error('Error fetching employee profile:', error);
        return null;
      }
      return data;
    } catch (err) {
      console.error('Profile fetch failed:', err);
      return null;
    }
  };

  const refreshProfile = async () => {
    if (user) {
      const prof = await fetchProfile(user.id);
      setProfile(prof);
    }
  };

  const handleAuthStateChange = async (currSession: Session | null) => {
    setLoading(true);
    setSession(currSession);
    const currUser = currSession?.user ?? null;
    setUser(currUser);

    if (currUser && currUser.email) {
      // Run profile fetch and admin check in parallel
      const [profResult, adminResult] = await Promise.all([
        fetchProfile(currUser.id),
        checkAdminStatus(currUser.email),
      ]);

      setProfile(profResult);
      setIsAdmin(adminResult);
    } else {
      setProfile(null);
      setIsAdmin(false);
    }
    setLoading(false);
  };

  useEffect(() => {
    // Check initial session
    supabase.auth.getSession().then(({ data: { session: initSession } }) => {
      handleAuthStateChange(initSession);
    });

    // Subscribe to auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, newSession) => {
      handleAuthStateChange(newSession);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    setLoading(true);
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.error('Error signing out:', error);
    } finally {
      setUser(null);
      setSession(null);
      setProfile(null);
      setIsAdmin(false);
      setLoading(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        isAdmin,
        loading,
        signOut,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);

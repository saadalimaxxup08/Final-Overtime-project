'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { createClient } from '@/utils/supabase/client';

interface EmployeeProfile {
  id: string;
  emp_id: string;
  name: string;
  email: string;
  role?: string;
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
  const supabase = createClient();

  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<EmployeeProfile | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);

  const checkAdminStatus = async (userId: string): Promise<boolean> => {
    try {
      const { data, error } = await supabase
       .from('employees')
       .select('role')
       .eq('id', userId)
       .maybeSingle();

      if (error) {
        console.error('Error checking admin status:', error);
        return false;
      }
      return data?.role === 'admin';
    } catch (err) {
      console.warn('Admin check failed:', err);
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
    setSession(currSession);
    const currUser = currSession?.user ?? null;
    setUser(currUser);

    if (currUser) {
      const [profResult, adminResult] = await Promise.all([
        fetchProfile(currUser.id),
        checkAdminStatus(currUser.id),
      ]);

      setProfile(profResult);
      setIsAdmin(adminResult);
    } else {
      setProfile(null);
      setIsAdmin(false);
    }
  };

  useEffect(() => {
    let mounted = true;

    const initAuth = async () => {
      try {
        const { data: { session: initSession } } = await supabase.auth.getSession();
        
        if (mounted) {
          await handleAuthStateChange(initSession);
          setLoading(false);
        }
      } catch (error) {
        console.error('Auth init error:', error);
        if (mounted) setLoading(false);
      }
    };

    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, newSession) => {
        if (mounted) {
          setLoading(true);
          await handleAuthStateChange(newSession);
          setLoading(false);
        }
      }
    );

    return () => {
      mounted = false;
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

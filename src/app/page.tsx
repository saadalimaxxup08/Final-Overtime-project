'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Mail, Lock, LogIn, Key, Loader2, Sparkles } from 'lucide-react';
import GlassCard from '@/components/GlassCard';

export default function LoginPage() {
  const { user, loading } = useAuth();
  const { showToast } = useToast();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<'password' | 'magic-link'>('password');
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  // Redirect to dashboard if already logged in
  useEffect(() => {
    if (!loading && user) {
      router.push('/dashboard');
    }
  }, [user, loading, router]);

  const handlePasswordAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      showToast('Please fill in all fields.', 'warning');
      return;
    }

    setAuthLoading(true);
    try {
      if (isSignUp) {
        // Sign Up
        const { error } = await supabase.auth.signUp({
          email,
          password,
        });
        if (error) throw error;
        showToast('Registration successful! Please check your email or log in.', 'success');
        setIsSignUp(false);
      } else {
        // Log In
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        showToast('Successfully logged in!', 'success');
        router.push('/dashboard');
      }
    } catch (err: any) {
      showToast(err.message || 'Authentication failed.', 'error');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleMagicLinkAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      showToast('Please enter your email address.', 'warning');
      return;
    }

    setAuthLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/dashboard`,
        },
      });
      if (error) throw error;
      showToast('Magic Link sent! Please check your email inbox.', 'success');
    } catch (err: any) {
      showToast(err.message || 'Error sending magic link.', 'error');
    } finally {
      setAuthLoading(false);
    }
  };

  if (loading || user) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[#060911]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-10 w-10 text-cyan-500 animate-spin" />
          <p className="text-slate-400 text-sm tracking-wider">Securing connection...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 relative overflow-hidden bg-[#060911]">
      {/* Background light glow effects */}
      <div className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full bg-cyan-500/10 blur-[120px] pointer-events-none animate-float" />
      <div className="absolute bottom-1/4 right-1/4 translate-x-1/2 translate-y-1/2 w-96 h-96 rounded-full bg-violet-500/10 blur-[120px] pointer-events-none" style={{ animationDelay: '3s' }} />

      <div className="w-full max-w-md relative z-10">
        {/* App Title */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-xs font-semibold tracking-wider uppercase mb-3 shadow-[0_0_15px_rgba(6,182,212,0.1)]">
            <Sparkles className="h-3 w-3" />
            Overtime Tracker Pro
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
            Enterprise Clocking
          </h1>
          <p className="text-slate-400 mt-2 text-sm">
            Log, calculate and manage overtime with VIP interface
          </p>
        </div>

        {/* Auth Glass Card */}
        <GlassCard hoverGlow glowColor="cyan" className="p-8">
          {/* Tabs header */}
          <div className="flex border-b border-white/10 mb-6 pb-0.5">
            <button
              onClick={() => {
                setActiveTab('password');
                setIsSignUp(false);
              }}
              className={`flex-1 pb-3 text-sm font-semibold border-b-2 transition-all duration-300 ${
                activeTab === 'password'
                  ? 'border-cyan-500 text-cyan-400 glow-text-cyan'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              Password
            </button>
            <button
              onClick={() => setActiveTab('magic-link')}
              className={`flex-1 pb-3 text-sm font-semibold border-b-2 transition-all duration-300 ${
                activeTab === 'magic-link'
                  ? 'border-cyan-500 text-cyan-400 glow-text-cyan'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              Magic Link
            </button>
          </div>

          {/* Form */}
          {activeTab === 'password' ? (
            <form onSubmit={handlePasswordAuth} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                  <input
                    type="email"
                    placeholder="you@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-900/50 border border-white/10 focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50 text-slate-200 placeholder-slate-500 transition-all duration-300 outline-none text-sm"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                  <input
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-900/50 border border-white/10 focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50 text-slate-200 placeholder-slate-500 transition-all duration-300 outline-none text-sm"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={authLoading}
                className="w-full flex items-center justify-center gap-2 py-3 mt-2 rounded-xl bg-gradient-to-r from-cyan-500 to-violet-600 hover:from-cyan-400 hover:to-violet-500 text-white font-semibold text-sm transition-all duration-300 shadow-[0_0_15px_rgba(6,182,212,0.2)] hover:shadow-[0_0_20px_rgba(6,182,212,0.4)] disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-[1.01]"
              >
                {authLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : isSignUp ? (
                  <>
                    <Key className="h-4 w-4" /> Create Account
                  </>
                ) : (
                  <>
                    <LogIn className="h-4 w-4" /> Sign In
                  </>
                )}
              </button>

              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={() => setIsSignUp(!isSignUp)}
                  className="text-xs text-slate-400 hover:text-cyan-400 transition-colors underline underline-offset-4"
                >
                  {isSignUp
                    ? 'Already have an account? Sign In'
                    : "Don't have an account? Create one"}
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleMagicLinkAuth} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                  <input
                    type="email"
                    placeholder="you@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-900/50 border border-white/10 focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50 text-slate-200 placeholder-slate-500 transition-all duration-300 outline-none text-sm"
                  />
                </div>
              </div>

              <div className="bg-cyan-500/5 border border-cyan-500/20 rounded-xl p-3 text-xs text-slate-400 leading-relaxed">
                We will email you a passwordless sign-in link (Magic Link) that logs you in instantly. No password required.
              </div>

              <button
                type="submit"
                disabled={authLoading}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-violet-600 hover:from-cyan-400 hover:to-violet-500 text-white font-semibold text-sm transition-all duration-300 shadow-[0_0_15px_rgba(6,182,212,0.2)] hover:shadow-[0_0_20px_rgba(6,182,212,0.4)] disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-[1.01]"
              >
                {authLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Mail className="h-4 w-4" /> Send Magic Link
                  </>
                )}
              </button>
            </form>
          )}
        </GlassCard>
      </div>
    </div>
  );
}

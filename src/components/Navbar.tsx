'use client';

import React from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter, usePathname } from 'next/navigation';
import { Clock, LogOut, ShieldAlert, LayoutDashboard, User } from 'lucide-react';
import Link from 'next/link';

export const Navbar = () => {
  const { user, profile, isAdmin, signOut } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const handleSignOut = async () => {
    await signOut();
    router.push('/');
  };

  if (!user) return null;

  return (
    <nav className="border-b border-white/10 bg-[#060911]/70 backdrop-blur-md sticky top-0 z-40 transition-all duration-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo / Title */}
          <div className="flex items-center gap-2">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-cyan-500 to-violet-600 flex items-center justify-center glow-cyan">
              <Clock className="h-5 w-5 text-white animate-pulse" />
            </div>
            <span className="font-bold text-lg tracking-tight bg-gradient-to-r from-cyan-400 to-violet-400 bg-clip-text text-transparent">
              Overtime Tracker Pro
            </span>
            {isAdmin && (
              <span className="ml-2 inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-cyan-400/10 text-cyan-400 border border-cyan-400/20 shadow-[0_0_10px_rgba(6,182,212,0.1)]">
                <ShieldAlert className="h-3 w-3" />
                Admin
              </span>
            )}
          </div>

          {/* Navigation Controls */}
          <div className="flex items-center gap-4">
            {profile && (
              <div className="hidden md:flex flex-col text-right mr-2">
                <span className="text-sm font-semibold text-slate-200">{profile.name}</span>
                <span className="text-xs text-slate-400">ID: {profile.emp_id}</span>
              </div>
            )}

            {/* Navigation Button */}
            {isAdmin && (
              pathname === '/admin' ? (
                <Link
                  href="/dashboard"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-slate-300 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 transition-all duration-300"
                >
                  <LayoutDashboard className="h-4 w-4" />
                  Employee Panel
                </Link>
              ) : (
                <Link
                  href="/admin"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 border border-cyan-500/20 shadow-[0_0_15px_rgba(6,182,212,0.2)] hover:shadow-[0_0_20px_rgba(6,182,212,0.4)] transition-all duration-300 transform hover:scale-[1.02]"
                >
                  <ShieldAlert className="h-4 w-4" />
                  Admin Panel
                </Link>
              )
            )}

            {/* Profile Avatar / Icon */}
            <div className="h-9 w-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-slate-300">
              <User className="h-4 w-4" />
            </div>

            {/* Logout Button */}
            <button
              onClick={handleSignOut}
              className="inline-flex items-center justify-center p-2 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20 transition-all duration-300 cursor-pointer"
              title="Sign Out"
            >
              <LogOut className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
};
export default Navbar;

'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { calculateHours } from '@/lib/utils';
import { generateOvertimePDF } from '@/lib/pdf-generator';
import Navbar from '@/components/Navbar';
import GlassCard from '@/components/GlassCard';
import dayjs from 'dayjs';
import {
  Clock,
  Play,
  Square,
  FileSpreadsheet,
  PlusCircle,
  TrendingUp,
  Briefcase,
  History,
  Trash2,
  Calendar,
  Loader2,
  Download,
  AlertCircle,
  FileText,
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface OvertimeLog {
  id: string;
  emp_id: string;
  employee_name: string;
  date: string;
  check_in: string | null;
  check_out: string | null;
  total_hours: number;
  overtime_hours: number;
  notes: string | null;
}

export default function DashboardPage() {
  const { user, profile, loading, refreshProfile } = useAuth();
  const { showToast } = useToast();
  const router = useRouter();

  // Route protection
  useEffect(() => {
    if (!loading && !user) {
      router.push('/');
    }
  }, [user, loading, router]);

  // Clock state
  const [currentTime, setCurrentTime] = useState('');
  useEffect(() => {
    setCurrentTime(dayjs().format('hh:mm:ss A'));
    const interval = setInterval(() => {
      setCurrentTime(dayjs().format('hh:mm:ss A'));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Profile setup states
  const [profileName, setProfileName] = useState('');
  const [profileEmpId, setProfileEmpId] = useState('');
  const [profileSaving, setProfileSaving] = useState(false);

  // Dashboard logs and clock-in states
  const [logs, setLogs] = useState<OvertimeLog[]>([]);
  const [activeLog, setActiveLog] = useState<OvertimeLog | null>(null);
  const [logsLoading, setLogsLoading] = useState(true);
  const [clockNotes, setClockNotes] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  // Manual entry states
  const [manualDate, setManualDate] = useState(dayjs().format('YYYY-MM-DD'));
  const [manualCheckIn, setManualCheckIn] = useState('09:00');
  const [manualCheckOut, setManualCheckOut] = useState('17:00');
  const [manualNotes, setManualNotes] = useState('');

  // Fetch logs from database
  const fetchLogs = async () => {
    if (!profile) return;
    setLogsLoading(true);
    try {
      const { data, error } = await supabase
        .from('overtime_logs')
        .select('*')
        .eq('emp_id', profile.emp_id)
        .order('date', { ascending: false });

      if (error) throw error;
      
      const typedLogs = (data || []) as OvertimeLog[];
      setLogs(typedLogs);

      // Check for active clock-in (where check_out is null)
      const active = typedLogs.find((log) => !log.check_out);
      setActiveLog(active || null);
    } catch (err: any) {
      showToast(err.message || 'Error loading logs.', 'error');
    } finally {
      setLogsLoading(false);
    }
  };

  useEffect(() => {
    if (profile) {
      fetchLogs();
    }
  }, [profile]);

  // Handle Profile Creation
  const handleCreateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !user.email) return;

    if (!profileName.trim() || !profileEmpId.trim()) {
      showToast('Please enter both Name and Employee ID.', 'warning');
      return;
    }

    setProfileSaving(true);
    try {
      const { error } = await supabase.from('employees').insert({
        id: user.id,
        name: profileName.trim(),
        emp_id: profileEmpId.trim(),
        email: user.email,
      });

      if (error) {
        if (error.code === '23505') {
          throw new Error('Employee ID already taken. Please contact admin or use another ID.');
        }
        throw error;
      }

      showToast('Profile created successfully!', 'success');
      await refreshProfile();
    } catch (err: any) {
      showToast(err.message || 'Error setting up profile.', 'error');
    } finally {
      setProfileSaving(false);
    }
  };

  // Clock In Action
  const handleClockIn = async () => {
    if (!profile) return;
    setActionLoading(true);
    try {
      const todayStr = dayjs().format('YYYY-MM-DD');
      const nowIso = dayjs().toISOString();

      // Insert log
      const { data, error } = await supabase
        .from('overtime_logs')
        .insert({
          emp_id: profile.emp_id,
          employee_name: profile.name,
          date: todayStr,
          check_in: nowIso,
          check_out: null,
          total_hours: 0,
          overtime_hours: 0,
          notes: '',
        })
        .select()
        .single();

      if (error) throw error;

      showToast('Clocked in successfully!', 'success');
      setActiveLog(data as OvertimeLog);
      fetchLogs();
    } catch (err: any) {
      showToast(err.message || 'Error clocking in.', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Clock Out Action
  const handleClockOut = async () => {
    if (!profile || !activeLog) return;
    setActionLoading(true);
    try {
      const nowIso = dayjs().toISOString();
      const checkInIso = activeLog.check_in!;
      
      const { totalHours, overtimeHours } = calculateHours(checkInIso, nowIso);

      const { error } = await supabase
        .from('overtime_logs')
        .update({
          check_out: nowIso,
          total_hours: totalHours,
          overtime_hours: overtimeHours,
          notes: clockNotes.trim() || null,
        })
        .eq('id', activeLog.id);

      if (error) throw error;

      // Confetti celebration
      confetti({
        particleCount: 120,
        spread: 80,
        origin: { y: 0.6 },
        colors: ['#06b6d4', '#8b5cf6', '#ec4899'],
      });

      showToast('Clocked out successfully!', 'success');
      setClockNotes('');
      setActiveLog(null);
      fetchLogs();
    } catch (err: any) {
      showToast(err.message || 'Error clocking out.', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Manual Log Submission
  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;

    // Combine date + time
    const checkInDateTime = dayjs(`${manualDate}T${manualCheckIn}`).toISOString();
    const checkOutDateTime = dayjs(`${manualDate}T${manualCheckOut}`).toISOString();

    if (dayjs(checkOutDateTime).isBefore(dayjs(checkInDateTime))) {
      showToast('Check-out time must be after check-in time.', 'error');
      return;
    }

    setActionLoading(true);
    try {
      const { totalHours, overtimeHours } = calculateHours(checkInDateTime, checkOutDateTime);

      const { error } = await supabase.from('overtime_logs').insert({
        emp_id: profile.emp_id,
        employee_name: profile.name,
        date: manualDate,
        check_in: checkInDateTime,
        check_out: checkOutDateTime,
        total_hours: totalHours,
        overtime_hours: overtimeHours,
        notes: manualNotes.trim() || null,
      });

      if (error) throw error;

      showToast('Manual log added successfully!', 'success');
      setManualNotes('');
      fetchLogs();
    } catch (err: any) {
      showToast(err.message || 'Error adding manual log.', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Delete log entry
  const handleDeleteLog = async (id: string) => {
    if (!confirm('Are you sure you want to delete this log?')) return;
    
    try {
      const { error } = await supabase.from('overtime_logs').delete().eq('id', id);
      if (error) throw error;
      
      showToast('Log deleted successfully.', 'success');
      fetchLogs();
    } catch (err: any) {
      showToast(err.message || 'Error deleting log.', 'error');
    }
  };

  // Generate User PDF
  const handleDownloadPDF = () => {
    if (!profile || logs.length === 0) {
      showToast('No log data available to export.', 'warning');
      return;
    }
    
    // Pass only completed logs to PDF
    const completedLogs = logs.filter(l => l.check_out !== null);
    if (completedLogs.length === 0) {
      showToast('No completed logs to download.', 'warning');
      return;
    }

    generateOvertimePDF({
      employeeName: profile.name,
      empId: profile.emp_id,
      logs: completedLogs,
    });
    showToast('PDF exported successfully!', 'success');
  };

  // Calc Statistics
  const totalLogs = logs.filter(l => l.check_out).length;
  const totalHours = logs.reduce((sum, log) => sum + Number(log.total_hours || 0), 0);
  const totalOvertime = logs.reduce((sum, log) => sum + Number(log.overtime_hours || 0), 0);
  const avgHours = totalLogs > 0 ? (totalHours / totalLogs).toFixed(2) : '0.00';

  if (loading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[#060911]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-10 w-10 text-cyan-500 animate-spin" />
          <p className="text-slate-400 text-sm">Loading dashboard data...</p>
        </div>
      </div>
    );
  }

  // PROFILE GUARD: If user has no employee entry, they must fill it in first.
  if (user && !profile) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center p-4 relative overflow-hidden bg-[#060911]">
        <div className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full bg-violet-500/10 blur-[120px] pointer-events-none" />
        <div className="absolute bottom-1/4 right-1/4 translate-x-1/2 translate-y-1/2 w-96 h-96 rounded-full bg-cyan-500/10 blur-[120px] pointer-events-none" />
        
        <div className="w-full max-w-md relative z-10">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-extrabold tracking-tight text-white">
              Complete Profile
            </h1>
            <p className="text-slate-400 mt-2 text-sm">
              Enter your professional details to access the tracker
            </p>
          </div>

          <GlassCard hoverGlow glowColor="violet" className="p-8">
            <div className="flex items-center gap-3 mb-6 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs">
              <AlertCircle className="h-5 w-5 flex-shrink-0" />
              <span>
                To proceed, you must associate your account with an Employee ID and Name. This cannot be changed later.
              </span>
            </div>

            <form onSubmit={handleCreateProfile} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Full Name
                </label>
                <input
                  type="text"
                  placeholder="John Doe"
                  value={profileName}
                  onChange={(e) => setProfileName(e.target.value)}
                  required
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-900/50 border border-white/10 focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/50 text-slate-200 placeholder-slate-500 transition-all duration-300 outline-none text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Employee ID
                </label>
                <input
                  type="text"
                  placeholder="EMP-4929"
                  value={profileEmpId}
                  onChange={(e) => setProfileEmpId(e.target.value)}
                  required
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-900/50 border border-white/10 focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/50 text-slate-200 placeholder-slate-500 transition-all duration-300 outline-none text-sm"
                />
              </div>

              <button
                type="submit"
                disabled={profileSaving}
                className="w-full flex items-center justify-center gap-2 py-3 mt-4 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-semibold text-sm transition-all duration-300 shadow-[0_0_15px_rgba(139,92,246,0.2)] hover:shadow-[0_0_20px_rgba(139,92,246,0.4)] disabled:opacity-50 transform hover:scale-[1.01]"
              >
                {profileSaving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  'Save & Continue'
                )}
              </button>
            </form>
          </GlassCard>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#060911] flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        
        {/* Top welcome banner */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-white/5 pb-6">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-white">
              Welcome Back, <span className="gradient-text">{profile?.name}</span>
            </h1>
            <p className="text-slate-400 text-sm mt-1">
              Verify logs, check work status and export invoices.
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            <span className="text-slate-400 text-sm font-medium">Local time:</span>
            <div className="px-4 py-2 rounded-xl bg-slate-900/60 border border-white/10 text-cyan-400 font-bold text-sm glow-text-cyan flex items-center gap-2">
              <Clock className="h-4 w-4" />
              {currentTime || '--:--:-- --'}
            </div>
          </div>
        </div>

        {/* Top metrics grids */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <GlassCard className="flex items-center gap-4 p-5">
            <div className="p-3.5 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
              <FileSpreadsheet className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Logs</p>
              <h3 className="text-2xl font-bold text-slate-100 mt-1">{totalLogs}</h3>
            </div>
          </GlassCard>

          <GlassCard className="flex items-center gap-4 p-5">
            <div className="p-3.5 rounded-xl bg-violet-500/10 border border-violet-500/20 text-violet-400">
              <Clock className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Hours</p>
              <h3 className="text-2xl font-bold text-slate-100 mt-1">{totalHours.toFixed(2)}h</h3>
            </div>
          </GlassCard>

          <GlassCard className="flex items-center gap-4 p-5">
            <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              <TrendingUp className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Overtime Hours</p>
              <h3 className="text-2xl font-bold text-emerald-400 glow-text-emerald mt-1">{totalOvertime.toFixed(2)}h</h3>
            </div>
          </GlassCard>

          <GlassCard className="flex items-center gap-4 p-5">
            <div className="p-3.5 rounded-xl bg-pink-500/10 border border-pink-500/20 text-pink-400">
              <Briefcase className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Average Hours/Day</p>
              <h3 className="text-2xl font-bold text-slate-100 mt-1">{avgHours}h</h3>
            </div>
          </GlassCard>
        </div>

        {/* Middle action areas */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Card 1: Live clock in/out */}
          <GlassCard hoverGlow glowColor="cyan" className="lg:col-span-1 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between border-b border-white/5 pb-4 mb-4">
                <h2 className="font-bold text-lg text-slate-200 flex items-center gap-2">
                  <Clock className="h-5 w-5 text-cyan-400" />
                  Clock Puncher
                </h2>
                <span className={`h-2.5 w-2.5 rounded-full ${activeLog ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
              </div>

              <div className="text-center py-6">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Current Punch Status</p>
                {activeLog ? (
                  <div className="mt-2">
                    <span className="px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold">
                      CLOCKED IN
                    </span>
                    <p className="text-slate-300 text-sm mt-3">
                      Punch started at {dayjs(activeLog.check_in).format('hh:mm A')}
                    </p>
                  </div>
                ) : (
                  <div className="mt-2">
                    <span className="px-3 py-1 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-semibold">
                      CLOCKED OUT
                    </span>
                    <p className="text-slate-500 text-sm mt-3">Ready to record shift hours</p>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-4">
              {activeLog && (
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    Shift Notes (Optional)
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Enter what you accomplished today..."
                    value={clockNotes}
                    onChange={(e) => setClockNotes(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-900/50 border border-white/10 text-slate-200 placeholder-slate-500 outline-none focus:border-cyan-500/50 transition-all text-xs"
                  />
                </div>
              )}

              {activeLog ? (
                <button
                  onClick={handleClockOut}
                  disabled={actionLoading}
                  className="w-full py-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-sm transition-all duration-300 flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(239,68,68,0.2)] cursor-pointer"
                >
                  {actionLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Square className="h-4 w-4 fill-white" /> Clock Out Now
                    </>
                  )}
                </button>
              ) : (
                <button
                  onClick={handleClockIn}
                  disabled={actionLoading}
                  className="w-full py-3 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-sm transition-all duration-300 flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(6,182,212,0.2)] cursor-pointer"
                >
                  {actionLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Play className="h-4 w-4 fill-white" /> Clock In Now
                    </>
                  )}
                </button>
              )}
            </div>
          </GlassCard>

          {/* Card 2: Manual Logger */}
          <GlassCard hoverGlow glowColor="violet" className="lg:col-span-2">
            <div className="flex items-center justify-between border-b border-white/5 pb-4 mb-4">
              <h2 className="font-bold text-lg text-slate-200 flex items-center gap-2">
                <PlusCircle className="h-5 w-5 text-violet-400" />
                Manual Log Entry
              </h2>
            </div>

            <form onSubmit={handleManualSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5 md:col-span-2">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5" /> Date
                </label>
                <input
                  type="date"
                  value={manualDate}
                  onChange={(e) => setManualDate(e.target.value)}
                  required
                  className="w-full px-4 py-2 rounded-xl bg-slate-900/50 border border-white/10 text-slate-200 outline-none focus:border-violet-500/50 transition-all text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Check-in Time
                </label>
                <input
                  type="time"
                  value={manualCheckIn}
                  onChange={(e) => setManualCheckIn(e.target.value)}
                  required
                  className="w-full px-4 py-2 rounded-xl bg-slate-900/50 border border-white/10 text-slate-200 outline-none focus:border-violet-500/50 transition-all text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Check-out Time
                </label>
                <input
                  type="time"
                  value={manualCheckOut}
                  onChange={(e) => setManualCheckOut(e.target.value)}
                  required
                  className="w-full px-4 py-2 rounded-xl bg-slate-900/50 border border-white/10 text-slate-200 outline-none focus:border-violet-500/50 transition-all text-sm"
                />
              </div>

              <div className="space-y-1.5 md:col-span-2">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Notes
                </label>
                <input
                  type="text"
                  placeholder="Task overview (e.g. Server Migration, Client meeting)"
                  value={manualNotes}
                  onChange={(e) => setManualNotes(e.target.value)}
                  className="w-full px-4 py-2 rounded-xl bg-slate-900/50 border border-white/10 text-slate-200 placeholder-slate-500 outline-none focus:border-violet-500/50 transition-all text-sm"
                />
              </div>

              <div className="md:col-span-2 pt-2">
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="w-full py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-bold text-sm transition-all duration-300 shadow-[0_0_15px_rgba(139,92,246,0.2)] disabled:opacity-50 transform hover:scale-[1.01] cursor-pointer"
                >
                  {actionLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    'Add Log Entry'
                  )}
                </button>
              </div>
            </form>
          </GlassCard>
        </div>

        {/* Bottom table area */}
        <GlassCard className="w-full">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-white/5 pb-4 mb-4 gap-4">
            <h2 className="font-bold text-lg text-slate-200 flex items-center gap-2">
              <History className="h-5 w-5 text-indigo-400" />
              Clocking & Overtime History
            </h2>
            
            {logs.length > 0 && (
              <button
                onClick={handleDownloadPDF}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold text-slate-200 transition-all cursor-pointer"
              >
                <Download className="h-3.5 w-3.5" />
                Export PDF Invoice
              </button>
            )}
          </div>

          {logsLoading ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3 text-slate-400">
              <Loader2 className="h-8 w-8 text-cyan-500 animate-spin" />
              <span className="text-sm">Retrieving clock records...</span>
            </div>
          ) : logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <FileText className="h-12 w-12 text-slate-600 mb-4" />
              <h3 className="font-semibold text-slate-300">No shift records found</h3>
              <p className="text-slate-500 text-sm max-w-xs mt-1">
                You haven't recorded any clock sessions or manual entries yet.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[600px]">
                <thead>
                  <tr className="border-b border-white/10 text-xs text-slate-400 font-semibold uppercase tracking-wider">
                    <th className="pb-3 pt-2">Date</th>
                    <th className="pb-3 pt-2">Clock In</th>
                    <th className="pb-3 pt-2">Clock Out</th>
                    <th className="pb-3 pt-2 text-right">Total Hours</th>
                    <th className="pb-3 pt-2 text-right">Overtime Hours</th>
                    <th className="pb-3 pt-2 pl-6">Notes</th>
                    <th className="pb-3 pt-2 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-sm text-slate-300">
                  {logs.map((log) => {
                    const checkInStr = log.check_in
                      ? dayjs(log.check_in).format('hh:mm A')
                      : '-';
                    const checkOutStr = log.check_out
                      ? dayjs(log.check_out).format('hh:mm A')
                      : (
                        <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 text-xs font-semibold animate-pulse border border-emerald-500/20">
                          Active Shift
                        </span>
                      );

                    return (
                      <tr key={log.id} className="hover:bg-white/[0.02] transition-all duration-150">
                        <td className="py-4 font-medium">{dayjs(log.date).format('YYYY-MM-DD')}</td>
                        <td className="py-4">{checkInStr}</td>
                        <td className="py-4">{checkOutStr}</td>
                        <td className="py-4 text-right font-medium">
                          {log.check_out ? `${Number(log.total_hours).toFixed(2)}h` : '-'}
                        </td>
                        <td className={`py-4 text-right font-semibold ${log.overtime_hours > 0 ? 'text-cyan-400 glow-text-cyan' : 'text-slate-400'}`}>
                          {log.check_out ? `${Number(log.overtime_hours).toFixed(2)}h` : '-'}
                        </td>
                        <td className="py-4 pl-6 text-slate-400 max-w-xs truncate" title={log.notes || ''}>
                          {log.notes || '-'}
                        </td>
                        <td className="py-4 text-right">
                          <button
                            onClick={() => handleDeleteLog(log.id)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20 transition-all cursor-pointer"
                            title="Delete Log"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </GlassCard>
      </main>
    </div>
  );
}

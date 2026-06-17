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
  Loader2,
  Download,
  AlertCircle,
  FileText,
  X,
  Edit3,
  Save,
  ChevronDown,
  ChevronUp,
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

const CURRENCIES = [
  { code: 'PKR', symbol: 'Rs', name: 'Pakistani Rupee' },
  { code: 'USD', symbol: '$', name: 'US Dollar' },
  { code: 'SAR', symbol: '﷼', name: 'Saudi Riyal' },
  { code: 'INR', symbol: '₹', name: 'Indian Rupee' },
  { code: 'EUR', symbol: '€', name: 'Euro' },
  { code: 'GBP', symbol: '£', name: 'British Pound' },
  { code: 'AED', symbol: 'د.إ', name: 'UAE Dirham' },
  { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar' },
];

export default function DashboardPage() {
  const { user, profile, loading, refreshProfile } = useAuth();
  const { showToast } = useToast();
  const router = useRouter();

  // LINE 1: Sirf ye add ki hai
  const [showAllLogs, setShowAllLogs] = useState(false);

  useEffect(() => {
    if (!loading &&!user) {
      router.replace('/');
    }
  }, [user, loading, router]);

  const [currentTime, setCurrentTime] = useState('');
  useEffect(() => {
    setCurrentTime(dayjs().format('hh:mm:ss A'));
    const interval = setInterval(() => {
      setCurrentTime(dayjs().format('hh:mm:ss A'));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const [profileName, setProfileName] = useState('');
  const [profileEmpId, setProfileEmpId] = useState('');
  const [profileSaving, setProfileSaving] = useState(false);

  const [logs, setLogs] = useState<OvertimeLog[]>([]);
  const [activeLog, setActiveLog] = useState<OvertimeLog | null>(null);
  const [logsLoading, setLogsLoading] = useState(true);
  const [clockNotes, setClockNotes] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [showNotesModal, setShowNotesModal] = useState(false);

  const [showEditModal, setShowEditModal] = useState(false);
  const [editingLog, setEditingLog] = useState<OvertimeLog | null>(null);
  const [editCheckIn, setEditCheckIn] = useState('');
  const [editCheckOut, setEditCheckOut] = useState('');
  const [editNotes, setEditNotes] = useState('');

  const [elapsedTime, setElapsedTime] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const [manualDate, setManualDate] = useState(dayjs().format('YYYY-MM-DD'));
  const [manualCheckIn, setManualCheckIn] = useState('09:00');
  const [manualCheckOut, setManualCheckOut] = useState('17:00');
  const [manualNotes, setManualNotes] = useState('');

  const [hourlyRate, setHourlyRate] = useState<number>(0);
  const [currency, setCurrency] = useState<string>('PKR');
  const [showCurrencyDropdown, setShowCurrencyDropdown] = useState(false);

  // LINE 2: Sirf ye add ki hai
  const displayedLogs = showAllLogs? logs : logs.slice(0, 5);

  useEffect(() => {
    const savedRate = localStorage.getItem('hourlyRate');
    const savedCurrency = localStorage.getItem('currency');
    if (savedRate) {
      setHourlyRate(parseFloat(savedRate));
    }
    if (savedCurrency) {
      setCurrency(savedCurrency);
    }
  }, []);

  const handleRateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value) || 0;
    setHourlyRate(value);
    localStorage.setItem('hourlyRate', value.toString());
  };

  const handleCurrencyChange = (code: string) => {
    setCurrency(code);
    localStorage.setItem('currency', code);
    setShowCurrencyDropdown(false);
  };

  const selectedCurrency = CURRENCIES.find((c) => c.code === currency) || CURRENCIES[0];

  useEffect(() => {
    if (activeLog && activeLog.check_in) {
      const startTime = dayjs(activeLog.check_in);
      timerRef.current = setInterval(() => {
        const now = dayjs();
        const diff = now.diff(startTime, 'second');
        setElapsedTime(diff);
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      setElapsedTime(0);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [activeLog]);

  const formatStopwatch = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

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

      const active = typedLogs.find((log) =>!log.check_out);
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

  const handleCreateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user ||!user.email) return;

    if (!profileName.trim() ||!profileEmpId.trim()) {
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

  const handleClockIn = async () => {
    if (!profile) return;
    setActionLoading(true);
    try {
      const todayStr = dayjs().format('YYYY-MM-DD');
      const nowIso = dayjs().toISOString();

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

  const handleClockOutClick = () => {
    if (!activeLog) return;

    if (!clockNotes.trim()) {
      setShowNotesModal(true);
      showToast('Please add notes before clocking out', 'warning');
      return;
    }

    handleClockOut();
  };

  const handleClockOut = async () => {
    if (!profile ||!activeLog) return;
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
          notes: clockNotes.trim(),
        })
    .eq('id', activeLog.id);

      if (error) throw error;

      confetti({
        particleCount: 120,
        spread: 80,
        origin: { y: 0.6 },
        colors: ['#06b6d4', '#8b5cf6', '#ec4899'],
      });

      showToast('Clocked out successfully!', 'success');
      setClockNotes('');
      setActiveLog(null);
      setShowNotesModal(false);
      fetchLogs();
    } catch (err: any) {
      showToast(err.message || 'Error clocking out.', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;

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

  const handleEditClick = (log: OvertimeLog) => {
    setEditingLog(log);
    setEditCheckIn(log.check_in? dayjs(log.check_in).format('HH:mm') : '');
    setEditCheckOut(log.check_out? dayjs(log.check_out).format('HH:mm') : '');
    setEditNotes(log.notes || '');
    setShowEditModal(true);
  };

  const handleSaveEdit = async () => {
    if (!editingLog ||!profile) return;

    if (!editCheckIn ||!editCheckOut) {
      showToast('Both check-in and check-out times are required', 'error');
      return;
    }

    const checkInDateTime = dayjs(`${editingLog.date}T${editCheckIn}`).toISOString();
    const checkOutDateTime = dayjs(`${editingLog.date}T${editCheckOut}`).toISOString();

    if (dayjs(checkOutDateTime).isBefore(dayjs(checkInDateTime))) {
      showToast('Check-out time must be after check-in time.', 'error');
      return;
    }

    setActionLoading(true);
    try {
      const { totalHours, overtimeHours } = calculateHours(checkInDateTime, checkOutDateTime);

      const { error } = await supabase
    .from('overtime_logs')
    .update({
          check_in: checkInDateTime,
          check_out: checkOutDateTime,
          total_hours: totalHours,
          overtime_hours: overtimeHours,
          notes: editNotes.trim() || null,
        })
    .eq('id', editingLog.id);

      if (error) throw error;

      showToast('Log updated successfully!', 'success');
      setShowEditModal(false);
      setEditingLog(null);
      fetchLogs();
    } catch (err: any) {
      showToast(err.message || 'Error updating log.', 'error');
    } finally {
      setActionLoading(false);
    }
  };

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

  const handleDownloadPDF = () => {
    if (!profile || logs.length === 0) {
      showToast('No log data available to export.', 'warning');
      return;
    }

    const completedLogs = logs.filter((l) => l.check_out!== null);
    if (completedLogs.length === 0) {
      showToast('No completed logs to download.', 'warning');
      return;
    }

    generateOvertimePDF({
      employeeName: profile.name,
      empId: profile.emp_id,
      logs: completedLogs,
      hourlyRate: hourlyRate,
      currencySymbol: selectedCurrency.symbol,
      currencyCode: selectedCurrency.code,
    });
    showToast('PDF exported successfully!', 'success');
  };

  const totalLogs = logs.filter((l) => l.check_out).length;
  const totalHours = logs.reduce((sum, log) => sum + Number(log.total_hours || 0), 0);
  const totalOvertime = logs.reduce((sum, log) => sum + Number(log.overtime_hours || 0), 0);
  const avgHours = totalLogs > 0? (totalHours / totalLogs).toFixed(2) : '0.00';
  const totalAmount = (totalOvertime * hourlyRate).toFixed(2);

  if (loading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[#060911]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-10 w-10 text-cyan-500 animate-spin" />
          <p className="text-slate-400 text-sm">Verifying session...</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  if (user &&!profile) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center p-4 relative overflow-hidden bg-[#060911]">
        <div className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full bg-violet-500/10 blur-[120px] pointer-events-none" />
        <div className="absolute bottom-1/4 right-1/4 translate-x-1/2 translate-y-1/2 w-96 h-96 rounded-full bg-cyan-500/10 blur-[120px] pointer-events-none" />

        <div className="w-full max-w-md relative z-10">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-extrabold tracking-tight text-white">Complete Profile</h1>
            <p className="text-slate-400 mt-2 text-sm">
              Enter your professional details to access the tracker
            </p>
          </div>

          <GlassCard hoverGlow glowColor="violet" className="p-8">
            <div className="flex items-center gap-3 mb-6 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs">
              <AlertCircle className="h-5 w-5 flex-shrink-0" />
              <span>
                To proceed, you must associate your account with an Employee ID and Name. This cannot
                be changed later.
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
                {profileSaving? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save & Continue'}
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
        {/* Clock Puncher Section - SAME AS BEFORE */}
        <GlassCard className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-cyan-400" />
              <h2 className="text-xl font-bold text-white">Clock Puncher</h2>
            </div>
            <div className="text-sm text-slate-400">{currentTime}</div>
          </div>

          {activeLog? (
            <div className="space-y-4">
              <div className="text-center">
                <div className="text-4xl font-bold text-cyan-400 mb-2">
                  {formatStopwatch(elapsedTime)}
                </div>
                <p className="text-slate-400 text-sm">Clocked in at {dayjs(activeLog.check_in).format('hh:mm A')}</p>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Notes (Required for Clock Out)
                </label>
                <textarea
                  value={clockNotes}
                  onChange={(e) => setClockNotes(e.target.value)}
                  placeholder="What did you work on today?"
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-900/50 border border-white/10 focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50 text-slate-200 placeholder-slate-500 transition-all duration-300 outline-none text-sm"
                  rows={3}
                />
              </div>

              <button
                onClick={handleClockOutClick}
                disabled={actionLoading}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white font-semibold text-sm transition-all duration-300 shadow-[0_0_15px_rgba(244,63,94,0.2)] hover:shadow-[0_0_20px_rgba(244,63,94,0.4)] disabled:opacity-50"
              >
                {actionLoading? <Loader2 className="h-4 w-4 animate-spin" /> : <Square className="h-4 w-4" />}
                Clock Out
              </button>
            </div>
          ) : (
            <button
              onClick={handleClockIn}
              disabled={actionLoading}
              className="w-full flex items-center justify-center gap-2 py-4 rounded-xl bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white font-semibold text-sm transition-all duration-300 shadow-[0_0_15px_rgba(16,185,129,0.2)] hover:shadow-[0_0_20px_rgba(16,185,129,0.4)] disabled:opacity-50"
            >
              {actionLoading? <Loader2 className="h-5 w-5 animate-spin" /> : <Play className="h-5 w-5" />}
              Clock In
            </button>
          )}
        </GlassCard>

        {/* Stats Cards - SAME AS BEFORE */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <GlassCard className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-cyan-500/10">
                <Briefcase className="h-5 w-5 text-cyan-400" />
              </div>
              <div>
                <p className="text-xs text-slate-400">Total Logs</p>
                <p className="text-xl font-bold text-white">{totalLogs}</p>
              </div>
            </div>
          </GlassCard>

          <GlassCard className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-violet-500/10">
                <Clock className="h-5 w-5 text-violet-400" />
              </div>
              <div>
                <p className="text-xs text-slate-400">Total Hours</p>
                <p className="text-xl font-bold text-white">{totalHours.toFixed(1)}</p>
              </div>
            </div>
          </GlassCard>

          <GlassCard className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/10">
                <TrendingUp className="h-5 w-5 text-amber-400" />
              </div>
              <div>
                <p className="text-xs text-slate-400">Overtime</p>
                <p className="text-xl font-bold text-white">{totalOvertime.toFixed(1)}</p>
              </div>
            </div>
          </GlassCard>

          <GlassCard className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/10">
                <FileSpreadsheet className="h-5 w-5 text-emerald-400" />
              </div>
              <div>
                <p className="text-xs text-slate-400">Amount</p>
                <p className="text-xl font-bold text-white">{selectedCurrency.symbol}{totalAmount}</p>
              </div>
            </div>
          </GlassCard>
        </div>

        {/* Manual Entry - SAME AS BEFORE */}
        <GlassCard className="p-6">
          <div className="flex items-center gap-2 mb-6">
            <PlusCircle className="h-5 w-5 text-violet-400" />
            <h2 className="text-xl font-bold text-white">Manual Entry</h2>
          </div>

          <form onSubmit={handleManualSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Date</label>
                <input
                  type="date"
                  value={manualDate}
                  onChange={(e) => setManualDate(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-900/50 border border-white/10 focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/50 text-slate-200 transition-all duration-300 outline-none text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Check In</label>
                <input
                  type="time"
                  value={manualCheckIn}
                  onChange={(e) => setManualCheckIn(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-900/50 border border-white/10 focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/50 text-slate-200 transition-all duration-300 outline-none text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Check Out</label>
                <input
                  type="time"
                  value={manualCheckOut}
                  onChange={(e) => setManualCheckOut(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-900/50 border border-white/10 focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/50 text-slate-200 transition-all duration-300 outline-none text-sm"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Notes</label>
              <textarea
                value={manualNotes}
                onChange={(e) => setManualNotes(e.target.value)}
                placeholder="Optional notes about this entry"
                className="w-full px-4 py-2.5 rounded-xl bg-slate-900/50 border border-white/10 focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/50 text-slate-200 placeholder-slate-500 transition-all duration-300 outline-none text-sm"
                rows={2}
              />
            </div>

            <button
              type="submit"
              disabled={actionLoading}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-semibold text-sm transition-all duration-300 shadow-[0_0_15px_rgba(139,92,246,0.2)] hover:shadow-[0_0_20px_rgba(139,92,246,0.4)] disabled:opacity-50"
            >
              {actionLoading? <Loader2 className="h-4 w-4 animate-spin" /> : <PlusCircle className="h-4 w-4" />}
              Add Manual Entry
            </button>
          </form>
        </GlassCard>

        {/* History Log Section - LINE 3: Sirf yahan displayedLogs use kiya */}
        <GlassCard className="p-6">
          <div className="flex items-center gap-2 mb-6">
            <History className="h-5 w-5 text-cyan-400" />
            <h2 className="text-xl font-bold text-white">History Log</h2>
          </div>

          {logsLoading? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 text-cyan-500 animate-spin" />
            </div>
          ) : logs.length === 0? (
            <div className="text-center py-8 text-slate-500">
              <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No logs found. Clock in to get started!</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-4 gap-4 text-xs text-slate-400 pb-3 border-b border-white/10 mb-3">
                <div>Date</div>
                <div>Check In</div>
                <div>Check Out</div>
                <div>Total</div>
              </div>

              <div className="space-y-3">
                {displayedLogs.map((log) => (
                  <div key={log.id} className="grid grid-cols-4 gap-4 items-center text-sm py-2 border-b border-white/5 last:border-0">
                    <div className="text-slate-300">
                      {dayjs(log.date).format('DD MMM YYYY')}
                    </div>
                    <div className="text-amber-400 font-semibold">
                      {log.check_in? dayjs(log.check_in).format('hh:mm A') : '-'}
                    </div>
                    <div className="text-slate-400">
                      {log.check_out? dayjs(log.check_out).format('hh:mm A') : 'Active'}
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-cyan-400 font-bold">{log.total_hours}h</span>
                      <button
                        onClick={() => handleEditClick(log)}
                        className="text-cyan-400 hover:text-cyan-300"
                      >
                        <Edit3 size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Show More Button */}
              {logs.length > 5 && (
                <button
                  onClick={() => setShowAllLogs(!showAllLogs)}
                  className="w-full mt-4 py-3 rounded-xl bg-gradient-to-r from-cyan-500/10 to-violet-500/10 hover:from-cyan-500/20 hover:to-violet-500/20 border border-cyan-500/20 text-cyan-400 text-sm font-semibold flex items-center justify-center gap-2 transition-all duration-300"
                >
                  {showAllLogs? (
                    <>
                      <ChevronUp size={18} />
                      Show Less
                    </>
                  ) : (
                    <>
                      <ChevronDown size={18} />
                      Show More ({logs.length - 5} more)
                    </>
                  )}
                </button>
              )}
            </>
          )}
        </GlassCard>
      </main>

      {/* Modals same as before - Notes Modal, Edit Modal */}
      {showNotesModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <GlassCard className="w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-white">Add Notes</h3>
              <button onClick={() => setShowNotesModal(false)} className="text-slate-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>
            <textarea
              value={clockNotes}
              onChange={(e) => setClockNotes(e.target.value)}
              placeholder="What did you work on today?"
              className="w-full px-4 py-2.5 rounded-xl bg-slate-900/50 border border-white/10 focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50 text-slate-200 placeholder-slate-500 transition-all duration-300 outline-none text-sm mb-4"
              rows={4}
            />
            <button
              onClick={handleClockOut}
              disabled={!clockNotes.trim() || actionLoading}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white font-semibold text-sm transition-all duration-300 disabled:opacity-50"
            >
              {actionLoading? <Loader2 className="h-4 w-4 animate-spin" /> : 'Clock Out'}
            </button>
          </GlassCard>
        </div>
      )}

      {showEditModal && editingLog && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <GlassCard className="w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-white">Edit Log</h3>
              <button onClick={() => setShowEditModal(false)} className="text-slate-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Check In</label>
                <input        ) : (
            <button
              onClick={handleClockIn}
              disabled={actionLoading}
              className="w-full flex items-center justify-center gap-2 py-4 rounded-xl bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white font-semibold text-sm transition-all duration-300 shadow-[0_0_15px_rgba(16,185,129,0.2)] hover:shadow-[0_0_20px_rgba(16,185,129,0.4)] disabled:opacity-50"
            >
              {actionLoading? <Loader2 className="h-5 w-5 animate-spin" /> : <Play className="h-5 w-5" />}
              Clock In
            </button>
          )}
        </GlassCard>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <GlassCard className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-cyan-500/10">
                <Briefcase className="h-5 w-5 text-cyan-400" />
              </div>
              <div>
                <p className="text-xs text-slate-400">Total Logs</p>
                <p className="text-xl font-bold text-white">{totalLogs}</p>
              </div>
            </div>
          </GlassCard>

          <GlassCard className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-violet-500/10">
                <Clock className="h-5 w-5 text-violet-400" />
              </div>
              <div>
                <p className="text-xs text-slate-400">Total Hours</p>
                <p className="text-xl font-bold text-white">{totalHours.toFixed(1)}</p>
              </div>
            </div>
          </GlassCard>

          <GlassCard className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/10">
                <TrendingUp className="h-5 w-5 text-amber-400" />
              </div>
              <div>
                <p className="text-xs text-slate-400">Overtime</p>
                <p className="text-xl font-bold text-white">{totalOvertime.toFixed(1)}</p>
              </div>
            </div>
          </GlassCard>

          <GlassCard className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/10">
                <FileSpreadsheet className="h-5 w-5 text-emerald-400" />
              </div>
              <div>
                <p className="text-xs text-slate-400">Amount</p>
                <p className="text-xl font-bold text-white">{selectedCurrency.symbol}{totalAmount}</p>
              </div>
            </div>
          </GlassCard>
        </div>

        {/* Manual Entry */}
        <GlassCard className="p-6">
          <div className="flex items-center gap-2 mb-6">
            <PlusCircle className="h-5 w-5 text-violet-400" />
            <h2 className="text-xl font-bold text-white">Manual Entry</h2>
          </div>

          <form onSubmit={handleManualSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Date</label>
                <input
                  type="date"
                  value={manualDate}
                  onChange={(e) => setManualDate(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-900/50 border border-white/10 focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/50 text-slate-200 transition-all duration-300 outline-none text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Check In</label>
                <input
                  type="time"
                  value={manualCheckIn}
                  onChange={(e) => setManualCheckIn(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-900/50 border border-white/10 focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/50 text-slate-200 transition-all duration-300 outline-none text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Check Out</label>
                <input
                  type="time"
                  value={manualCheckOut}
                  onChange={(e) => setManualCheckOut(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-900/50 border border-white/10 focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/50 text-slate-200 transition-all duration-300 outline-none text-sm"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Notes</label>
              <textarea
                value={manualNotes}
                onChange={(e) => setManualNotes(e.target.value)}
                placeholder="Optional notes about this entry"
                className="w-full px-4 py-2.5 rounded-xl bg-slate-900/50 border border-white/10 focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/50 text-slate-200 placeholder-slate-500 transition-all duration-300 outline-none text-sm"
                rows={2}
              />
            </div>

            <button
              type="submit"
              disabled={actionLoading}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-semibold text-sm transition-all duration-300 shadow-[0_0_15px_rgba(139,92,246,0.2)] hover:shadow-[0_0_20px_rgba(139,92,246,0.4)] disabled:opacity-50"
            >
              {actionLoading? <Loader2 className="h-4 w-4 animate-spin" /> : <PlusCircle className="h-4 w-4" />}
              Add Manual Entry
            </button>
          </form>
        </GlassCard>

        {/* History Log Section - Sirf yahan displayedLogs use kiya */}
        <GlassCard className="p-6">
          <div className="flex items-center gap-2 mb-6">
            <History className="h-5 w-5 text-cyan-400" />
            <h2 className="text-xl font-bold text-white">History Log</h2>
          </div>

          {logsLoading? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 text-cyan-500 animate-spin" />
            </div>
          ) : logs.length === 0? (
            <div className="text-center py-8 text-slate-500">
              <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No logs found. Clock in to get started!</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-4 gap-4 text-xs text-slate-400 pb-3 border-b border-white/10 mb-3">
                <div>Date</div>
                <div>Check In</div>
                <div>Check Out</div>
                <div>Total</div>
              </div>

              <div className="space-y-3">
                {displayedLogs.map((log) => (
                  <div key={log.id} className="grid grid-cols-4 gap-4 items-center text-sm py-2 border-b border-white/5 last:border-0">
                    <div className="text-slate-300">
                      {dayjs(log.date).format('DD MMM YYYY')}
                    </div>
                    <div className="text-amber-400 font-semibold">
                      {log.check_in? dayjs(log.check_in).format('hh:mm A') : '-'}
                    </div>
                    <div className="text-slate-400">
                      {log.check_out? dayjs(log.check_out).format('hh:mm A') : 'Active'}
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-cyan-400 font-bold">{log.total_hours}h</span>
                      <button
                        onClick={() => handleEditClick(log)}
                        className="text-cyan-400 hover:text-cyan-300"
                      >
                        <Edit3 size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Show More Button */}
              {logs.length > 5 && (
                <button
                  onClick={() => setShowAllLogs(!showAllLogs)}
                  className="w-full mt-4 py-3 rounded-xl bg-gradient-to-r from-cyan-500/10 to-violet-500/10 hover:from-cyan-500/20 hover:to-violet-500/20 border border-cyan-500/20 text-cyan-400 text-sm font-semibold flex items-center justify-center gap-2 transition-all duration-300"
                >
                  {showAllLogs? (
                    <>
                      <ChevronUp size={18} />
                      Show Less
                    </>
                  ) : (
                    <>
                      <ChevronDown size={18} />
                      Show More ({logs.length - 5} more)
                    </>
                  )}
                </button>
              )}
            </>
          )}
        </GlassCard>
      </main>

      {/* Notes Modal */}
      {showNotesModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <GlassCard className="w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-white">Add Notes</h3>
              <button onClick={() => setShowNotesModal(false)} className="text-slate-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>
            <textarea
              value={clockNotes}
              onChange={(e) => setClockNotes(e.target.value)}
              placeholder="What did you work on today?"
              className="w-full px-4 py-2.5 rounded-xl bg-slate-900/50 border border-white/10 focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50 text-slate-200 placeholder-slate-500 transition-all duration-300 outline-none text-sm mb-4"
              rows={4}
            />
            <button
              onClick={handleClockOut}
              disabled={!clockNotes.trim() || actionLoading}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white font-semibold text-sm transition-all duration-300 disabled:opacity-50"
            >
              {actionLoading? <Loader2 className="h-4 w-4 animate-spin" /> : 'Clock Out'}
            </button>
          </GlassCard>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && editingLog && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <GlassCard className="w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-white">Edit Log</h3>
              <button onClick={() => setShowEditModal(false)} className="text-slate-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Check In</label>
                <input
                  type="time"
                  value={editCheckIn}
                  onChange={(e) => setEditCheckIn(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-900/50 border border-white/10 focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50 text-slate-200 transition-all duration-300 outline-none text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Check Out</label>
                <input
                  type="time"
                  value={editCheckOut}
                  onChange={(e) => setEditCheckOut(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-900/50 border border-white/10 focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50 text-slate-200 transition-all duration-300 outline-none text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Notes</label>
                <textarea
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-900/50 border border-white/10 focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50 text-slate-200 placeholder-slate-500 transition-all duration-300 outline-none text-sm"
                  rows={3}
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleSaveEdit}
                  disabled={actionLoading}
                  className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-semibold text-sm transition-all duration-300 disabled:opacity-50"
                >
                  {actionLoading? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Save
                </button>
                <button
                  onClick={() => handleDeleteLog(editingLog.id)}
                  className="px-4 py-3 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-rose-400 transition-all duration-300"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          </GlassCard>
        </div>
      )}
    </div>
  );
}
                  type="time"
                  value={editCheckIn}
                  onChange={(e) => setEditCheckIn(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-900/50 border border-white/10 focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50 text-slate-200 transition-all duration-300 outline-none text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Check Out</label>
                <input
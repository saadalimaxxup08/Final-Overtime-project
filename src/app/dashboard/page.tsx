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
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-white/5 pb-6">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-white">
              Welcome Back, <span className="gradient-text">{profile?.name}</span>
            </h1>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2">
              <div className="flex items-center gap-1.5 text-sm">
                <span className="text-slate-500">Name:</span>
                <span className="text-cyan-400 font-semibold">{profile?.name}</span>
              </div>
              <div className="flex items-center gap-1.5 text-sm">
                <span className="text-slate-500">Employee ID:</span>
                <span className="text-violet-400 font-semibold">{profile?.emp_id}</span>
              </div>
            </div>

            <p className="text-slate-400 text-sm mt-3">
              Verify logs, check work status and export invoices.
            </p>
          </div>

          <div className="flex items-center gap-3 flex-wrap justify-end">
            <div className="flex items-center gap-2">
              <span className="text-slate-400 text-sm font-medium">Hourly Rate:</span>
              <div className="relative">
                <button
                  onClick={() => setShowCurrencyDropdown(!showCurrencyDropdown)}
                  className="absolute left-0 top-0 bottom-0 px-3 flex items-center gap-1 text-emerald-400 hover:bg-emerald-500/10 rounded-l-xl transition-all z-10"
                >
                  <span className="font-bold text-sm">{selectedCurrency.symbol}</span>
                  <ChevronDown className="h-3 w-3" />
                </button>
                <input
                  type="number"
                  placeholder="0"
                  value={hourlyRate || ''}
                  onChange={handleRateChange}
                  className="w-32 pl-14 pr-3 py-2 rounded-xl bg-slate-900/60 border border-white/10 focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 text-emerald-400 font-bold text-sm outline-none transition-all"
                />
                {showCurrencyDropdown && (
                  <div className="absolute top-full left-0 mt-2 w-48 bg-slate-900 border border-white/10 rounded-xl shadow-xl z-50 max-h-64 overflow-y-auto">
                    {CURRENCIES.map((curr) => (
                      <button
                        key={curr.code}
                        onClick={() => handleCurrencyChange(curr.code)}
                        className={`w-full px-4 py-2.5 text-left hover:bg-white/5 transition-all flex items-center justify-between ${
                          currency === curr.code? 'bg-emerald-500/10 text-emerald-400' : 'text-slate-300'
                        }`}
                      >
                        <span className="text-sm">{curr.name}</span>
                        <span className="font-bold">{curr.symbol}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-slate-400 text-sm font-medium">Local time:</span>
              <div className="px-4 py-2 rounded-xl bg-slate-900/60 border border-white/10 text-cyan-400 font-bold text-sm glow-text-cyan flex items-center gap-2">
                <Clock className="h-4 w-4" />
                {currentTime || '--:-- --'}
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <GlassCard hoverGlow glowColor="cyan" className="lg:col-span-1 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between border-b border-white/5 pb-4 mb-4">
                <h2 className="font-bold text-lg text-slate-200 flex items-center gap-2">
                  <Clock className="h-5 w-5 text-cyan-400" />
                  Clock Puncher
                </h2>
                <span
                  className={`h-2.5 w-2.5 rounded-full ${
                    activeLog? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'
                  }`}
                />
              </div>

              <div className="text-center py-4 mb-4">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-2">
                  Elapsed Time
                </p>
                <div className="text-4xl font-extrabold text-cyan-400 glow-text-cyan font-mono">
                  {formatStopwatch(elapsedTime)}
                </div>
              </div>

              <div className="text-center py-4">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest">
                  Current Punch Status
                </p>
                {activeLog? (
                  <div className="mt-2">
                    <span className="px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold">
                      CLOCKED IN
                    </span>
                    <p className="text-slate-300 text-sm mt-3">
                      Started at {dayjs(activeLog.check_in).format('hh:mm A')}
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
                    Shift Notes (Required)
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

              {activeLog? (
                <button
                  onClick={handleClockOutClick}
                  disabled={actionLoading}
                  className="w-full py-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-sm transition-all duration-300 flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(239,68,68,0.2)] cursor-pointer"
                >
                  {actionLoading? (
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
                  {actionLoading? (
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

          <GlassCard hoverGlow glowColor="violet" className="lg:col-span-1">
            <h2 className="font-bold text-lg text-slate-200 border-b border-white/5 pb-4 mb-4 flex items-center gap-2">
              <PlusCircle className="h-5 w-5 text-violet-400" />
              Manual Log Entry
            </h2>

            <form onSubmit={handleManualSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Date
                </label>
                <input
                  type="date"
                  value={manualDate}
                  onChange={(e) => setManualDate(e.target.value)}
                  required
                  className="w-full px-3 py-2 rounded-xl bg-slate-900/50 border border-white/10 text-slate-200 outline-none focus:border-violet-500/50 transition-all text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    Check In
                  </label>
                  <input
                    type="time"
                    value={manualCheckIn}
                    onChange={(e) => setManualCheckIn(e.target.value)}
                    required
                    className="w-full px-3 py-2 rounded-xl bg-slate-900/50 border border-white/10 text-slate-200 outline-none focus:border-violet-500/50 transition-all text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    Check Out
                  </label>
                  <input
                    type="time"
                    value={manualCheckOut}
                    onChange={(e) => setManualCheckOut(e.target.value)}
                    required
                    className="w-full px-3 py-2 rounded-xl bg-slate-900/50 border border-white/10 text-slate-200 outline-none focus:border-violet-500/50 transition-all text-sm"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Notes (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Overtime for project X"
                  value={manualNotes}
                  onChange={(e) => setManualNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-900/50 border border-white/10 text-slate-200 placeholder-slate-500 outline-none focus:border-violet-500/50 transition-all text-sm"
                />
              </div>

              <button
                type="submit"
                disabled={actionLoading}
                className="w-full py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-bold text-sm transition-all duration-300 flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(139,92,246,0.2)] cursor-pointer"
              >
                {actionLoading? <Loader2 className="h-4 w-4 animate-spin" /> : 'Add Log'}
              </button>
            </form>
          </GlassCard>

          <GlassCard hoverGlow glowColor="violet" className="lg:col-span-1">
            <h2 className="font-bold text-lg text-slate-200 border-b border-white/5 pb-4 mb-4 flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-amber-400" />
              Summary Stats
            </h2>

            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-slate-400 text-sm">Total Logs</span>
                <span className="text-cyan-400 font-bold text-lg">{totalLogs}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400 text-sm">Total Hours</span>
                <span className="text-violet-400 font-bold text-lg">{totalHours.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400 text-sm">Total Overtime</span>
                <span className="text-amber-400 font-bold text-lg">{totalOvertime.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400 text-sm">Avg Hours/Day</span>
                <span className="text-emerald-400 font-bold text-lg">{avgHours}</span>
              </div>
              <div className="flex justify-between items-center pt-2 border-t border-white/5">
                <span className="text-slate-400 text-sm">Total Amount</span>
                <span className="text-emerald-400 font-bold text-xl">{selectedCurrency.symbol} {totalAmount}</span>
              </div>
            </div>

            <button
              onClick={handleDownloadPDF}
              className="w-full mt-6 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-sm transition-all duration-300 flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(245,158,11,0.2)] cursor-pointer"
            >
              <Download className="h-4 w-4" /> Export PDF
            </button>
          </GlassCard>
        </div>

        <GlassCard hoverGlow glowColor="cyan">
          <h2 className="font-bold text-lg text-slate-200 border-b border-white/5 pb-4 mb-4 flex items-center gap-2">
            <History className="h-5 w-5 text-cyan-400" />
            History Log
          </h2>

          {logsLoading? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 text-cyan-500 animate-spin" />
            </div>
          ) : logs.length === 0? (
            <div className="text-center py-8 text-slate-500 text-sm">
              No logs found. Start by clocking in or adding a manual log.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/5">
                    <th className="text-left py-3 px-2 text-slate-400 font-semibold">Date</th>
                    <th className="text-left py-3 px-2 text-slate-400 font-semibold">Check In</th>
                    <th className="text-left py-3 px-2 text-slate-400 font-semibold">Check Out</th>
                    <th className="text-left py-3 px-2 text-slate-400 font-semibold">Total</th>
                    <th className="text-left py-3 px-2 text-slate-400 font-semibold">Overtime</th>
                    <th className="text-left py-3 px-2 text-slate-400 font-semibold">Notes</th>
                    <th className="text-right py-3 px-2 text-slate-400 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log.id} className="border-b border-white/5 hover:bg-white/5">
                      <td className="py-3 px-2 text-slate-300">
                        {dayjs(log.date).format('DD MMM YYYY')}
                                            </td>
                      <td className="py-3 px-2 text-amber-400 font-semibold">
                        {log.overtime_hours.toFixed(2)}h
                      </td>
                      <td className="py-3 px-2 text-slate-400 text-xs max-w-xs truncate">
                        {log.notes || '-'}
                      </td>
                      <td className="py-3 px-2 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleEditClick(log)}
                            disabled={!log.check_out}
                            className="p-1.5 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                            title={log.check_out? 'Edit log' : 'Cannot edit active log'}
                          >
                            <Edit3 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteLog(log.id)}
                            className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 transition-all"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </GlassCard>
      </main>

      {showNotesModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <GlassCard className="w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <FileText className="h-5 w-5 text-amber-400" />
                Add Shift Notes
              </h3>
              <button
                onClick={() => setShowNotesModal(false)}
                className="p-1 rounded-lg hover:bg-white/10 text-slate-400"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="text-slate-400 text-sm mb-4">
              Notes are required before clocking out. What did you accomplish today?
            </p>
            <textarea
              rows={4}
              placeholder="e.g. Completed project X, Fixed bugs..."
              value={clockNotes}
              onChange={(e) => setClockNotes(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-900/50 border border-white/10 text-slate-200 placeholder-slate-500 outline-none focus:border-amber-500/50 transition-all text-sm"
            />
            <div className="flex gap-3 mt-4">
              <button
                onClick={() => setShowNotesModal(false)}
                className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-sm transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleClockOut}
                disabled={!clockNotes.trim() || actionLoading}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold text-sm transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {actionLoading? <Loader2 className="h-4 w-4 animate-spin" /> : 'Clock Out'}
              </button>
            </div>
          </GlassCard>
        </div>
      )}

      {showEditModal && editingLog && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <GlassCard className="w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Edit3 className="h-5 w-5 text-cyan-400" />
                Edit Log
              </h3>
              <button
                onClick={() => setShowEditModal(false)}
                className="p-1 rounded-lg hover:bg-white/10 text-slate-400"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="text-slate-400 text-sm mb-4">
              {dayjs(editingLog.date).format('DD MMM YYYY')}
            </p>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    Check In
                  </label>
                  <input
                    type="time"
                    value={editCheckIn}
                    onChange={(e) => setEditCheckIn(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-900/50 border border-white/10 text-slate-200 outline-none focus:border-cyan-500/50 transition-all text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    Check Out
                  </label>
                  <input
                    type="time"
                    value={editCheckOut}
                    onChange={(e) => setEditCheckOut(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-900/50 border border-white/10 text-slate-200 outline-none focus:border-cyan-500/50 transition-all text-sm"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Notes
                </label>
                <textarea
                  rows={3}
                  placeholder="Shift notes..."
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-900/50 border border-white/10 text-slate-200 placeholder-slate-500 outline-none focus:border-cyan-500/50 transition-all text-sm"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowEditModal(false)}
                className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-sm transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={actionLoading}
                className="flex-1 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-sm transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {actionLoading? <Loader2 className="h-4 w-4 animate-spin" /> : (
                  <>
                    <Save className="h-4 w-4" /> Save Changes
                  </>
                )}
              </button>
            </div>
          </GlassCard>
        </div>
      )}
    </div>
  );
}
'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { generateOvertimePDF } from '@/lib/pdf-generator';
import Navbar from '@/components/Navbar';
import GlassCard from '@/components/GlassCard';
import dayjs from 'dayjs';
import {
  ShieldAlert,
  Users,
  FileSpreadsheet,
  Clock,
  UserCheck,
  Search,
  Eye,
  Download,
  X,
  Loader2,
  AlertCircle,
  FileText,
} from 'lucide-react';

interface EmployeeProfile {
  id: string;
  emp_id: string;
  name: string;
  email: string;
  created_at: string;
}

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

interface EmployeeStats {
  profile: EmployeeProfile;
  totalLogs: number;
  totalHours: number;
  totalOvertime: number;
  lastActive: string;
  logs: OvertimeLog[];
}

export default function AdminDashboardPage() {
  const { user, isAdmin, loading } = useAuth();
  const { showToast } = useToast();
  const router = useRouter();

  // Route protection: non-admins are redirected to dashboard
  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.push('/');
      } else if (!isAdmin) {
        showToast('Access Denied. Admin privileges required.', 'error');
        router.push('/dashboard');
      }
    }
  }, [user, isAdmin, loading, router, showToast]);

  const [employees, setEmployees] = useState<EmployeeProfile[]>([]);
  const [logs, setLogs] = useState<OvertimeLog[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Selected employee modal state
  const [selectedEmp, setSelectedEmp] = useState<EmployeeStats | null>(null);

  // Fetch admin data (all employees and all logs)
  const fetchData = async () => {
    setDataLoading(true);
    try {
      // Fetch employees
      const { data: empData, error: empError } = await supabase
        .from('employees')
        .select('*');

      if (empError) throw empError;

      // Fetch overtime logs
      const { data: logData, error: logError } = await supabase
        .from('overtime_logs')
        .select('*')
        .order('date', { ascending: false });

      if (logError) throw logError;

      setEmployees((empData || []) as EmployeeProfile[]);
      setLogs((logData || []) as OvertimeLog[]);
    } catch (err: any) {
      showToast(err.message || 'Error fetching database records.', 'error');
    } finally {
      setDataLoading(false);
    }
  };

  useEffect(() => {
    if (user && isAdmin) {
      fetchData();
    }
  }, [user, isAdmin]);

  // Aggregate stats per employee
  const employeeStatsList: EmployeeStats[] = employees.map((profile) => {
    const empLogs = logs.filter((l) => l.emp_id === profile.emp_id);
    const completedLogs = empLogs.filter((l) => l.check_out !== null);
    
    const totalLogsCount = completedLogs.length;
    const totalHoursSum = completedLogs.reduce((sum, l) => sum + Number(l.total_hours || 0), 0);
    const totalOvertimeSum = completedLogs.reduce((sum, l) => sum + Number(l.overtime_hours || 0), 0);
    
    // Find last active date (latest check_in or created_at)
    let lastActive = 'Never';
    if (empLogs.length > 0) {
      const activeTimestamps = empLogs
        .map((l) => (l.check_in ? dayjs(l.check_in) : dayjs(l.date)))
        .sort((a, b) => b.unix() - a.unix());
      lastActive = activeTimestamps[0].format('YYYY-MM-DD hh:mm A');
    }

    return {
      profile,
      totalLogs: totalLogsCount,
      totalHours: Number(totalHoursSum.toFixed(2)),
      totalOvertime: Number(totalOvertimeSum.toFixed(2)),
      lastActive,
      logs: empLogs,
    };
  });

  // Filter employees by search query (name or emp_id)
  const filteredEmployeeStats = employeeStatsList.filter((emp) => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) return true;
    return (
      emp.profile.name.toLowerCase().includes(query) ||
      emp.profile.emp_id.toLowerCase().includes(query)
    );
  });

  // Calculate high-level global stats
  const totalEmployeesCount = employees.length;
  
  const startOfMonth = dayjs().startOf('month');
  const endOfMonth = dayjs().endOf('month');
  const totalLogsThisMonth = logs.filter((log) => {
    const logDate = dayjs(log.date);
    return logDate.isAfter(startOfMonth.subtract(1, 'day')) && logDate.isBefore(endOfMonth.add(1, 'day'));
  }).length;

  const totalOvertimeAllUsers = logs
    .filter((l) => l.check_out !== null)
    .reduce((sum, log) => sum + Number(log.overtime_hours || 0), 0);

  // Active Users Today: distinct emp_id in check_ins matching today
  const todayStr = dayjs().format('YYYY-MM-DD');
  const activeUsersToday = new Set(
    logs.filter((log) => log.date === todayStr).map((log) => log.emp_id)
  ).size;

  // Trigger admin PDF download on behalf of selected employee
  const handleDownloadEmployeePDF = (emp: EmployeeStats) => {
    const completedLogs = emp.logs.filter((l) => l.check_out !== null);
    
    if (completedLogs.length === 0) {
      showToast(`No completed logs available for ${emp.profile.name}.`, 'warning');
      return;
    }

    generateOvertimePDF({
      employeeName: emp.profile.name,
      empId: emp.profile.emp_id,
      logs: completedLogs,
    });
    showToast(`PDF exported for ${emp.profile.name}.`, 'success');
  };

  if (loading || !isAdmin) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[#060911]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-10 w-10 text-cyan-500 animate-spin" />
          <p className="text-slate-400 text-sm">Authorizing admin access...</p>
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
            <h1 className="text-3xl font-extrabold tracking-tight text-white flex items-center gap-2.5">
              <ShieldAlert className="h-8 w-8 text-cyan-500 glow-text-cyan animate-pulse" />
              Admin Control Panel
            </h1>
            <p className="text-slate-400 text-sm mt-1">
              Real-time workspace clocking summary, metrics, and report extraction.
            </p>
          </div>
        </div>

        {/* Global Statistics */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <GlassCard className="flex items-center gap-4 p-5">
            <div className="p-3.5 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
              <Users className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Employees</p>
              <h3 className="text-2xl font-bold text-slate-100 mt-1">{totalEmployeesCount}</h3>
            </div>
          </GlassCard>

          <GlassCard className="flex items-center gap-4 p-5">
            <div className="p-3.5 rounded-xl bg-violet-500/10 border border-violet-500/20 text-violet-400">
              <FileSpreadsheet className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Logs This Month</p>
              <h3 className="text-2xl font-bold text-slate-100 mt-1">{totalLogsThisMonth}</h3>
            </div>
          </GlassCard>

          <GlassCard className="flex items-center gap-4 p-5">
            <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              <Clock className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total OT Hours</p>
              <h3 className="text-2xl font-bold text-emerald-400 glow-text-emerald mt-1">
                {totalOvertimeAllUsers.toFixed(2)}h
              </h3>
            </div>
          </GlassCard>

          <GlassCard className="flex items-center gap-4 p-5">
            <div className="p-3.5 rounded-xl bg-pink-500/10 border border-pink-500/20 text-pink-400">
              <UserCheck className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Active Today</p>
              <h3 className="text-2xl font-bold text-slate-100 mt-1">{activeUsersToday}</h3>
            </div>
          </GlassCard>
        </div>

        {/* Directory & Search */}
        <GlassCard className="w-full">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between border-b border-white/5 pb-4 mb-6 gap-4">
            <div>
              <h2 className="font-bold text-lg text-slate-200">Employee Directory</h2>
              <p className="text-xs text-slate-400">Search and audit employee clock activity</p>
            </div>

            {/* Search Input */}
            <div className="relative max-w-sm w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
              <input
                type="text"
                placeholder="Search by name or emp id..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-900/50 border border-white/10 text-slate-200 placeholder-slate-500 text-sm outline-none focus:border-cyan-500/50 transition-all duration-300"
              />
            </div>
          </div>

          {dataLoading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-slate-400">
              <Loader2 className="h-8 w-8 text-cyan-500 animate-spin" />
              <span className="text-sm">Synthesizing database records...</span>
            </div>
          ) : filteredEmployeeStats.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Users className="h-12 w-12 text-slate-600 mb-4" />
              <h3 className="font-semibold text-slate-300">No employees found</h3>
              <p className="text-slate-500 text-sm mt-1">
                Try modifying your query or ensure profiles are registered.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[750px]">
                <thead>
                  <tr className="border-b border-white/10 text-xs text-slate-400 font-semibold uppercase tracking-wider">
                    <th className="pb-3 pt-2">Name</th>
                    <th className="pb-3 pt-2">Emp ID</th>
                    <th className="pb-3 pt-2">Email</th>
                    <th className="pb-3 pt-2 text-right">Logs</th>
                    <th className="pb-3 pt-2 text-right">Total Hours</th>
                    <th className="pb-3 pt-2 text-right">OT Hours</th>
                    <th className="pb-3 pt-2 pl-6">Last Active</th>
                    <th className="pb-3 pt-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-sm text-slate-300">
                  {filteredEmployeeStats.map((emp) => (
                    <tr key={emp.profile.id} className="hover:bg-white/[0.02] transition-all duration-150">
                      <td className="py-4 font-semibold text-slate-200">{emp.profile.name}</td>
                      <td className="py-4 text-xs font-mono">{emp.profile.emp_id}</td>
                      <td className="py-4 text-slate-400">{emp.profile.email}</td>
                      <td className="py-4 text-right">{emp.totalLogs}</td>
                      <td className="py-4 text-right">{emp.totalHours.toFixed(2)}h</td>
                      <td className={`py-4 text-right font-semibold ${emp.totalOvertime > 0 ? 'text-cyan-400 glow-text-cyan' : 'text-slate-400'}`}>
                        {emp.totalOvertime.toFixed(2)}h
                      </td>
                      <td className="py-4 pl-6 text-xs text-slate-400">{emp.lastActive}</td>
                      <td className="py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => setSelectedEmp(emp)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/20 text-xs font-semibold text-cyan-400 transition-all cursor-pointer"
                            title="View Log Details"
                          >
                            <Eye className="h-3.5 w-3.5" />
                            Details
                          </button>
                          
                          <button
                            onClick={() => handleDownloadEmployeePDF(emp)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 bg-white/5 hover:bg-white/10 border border-white/10 transition-all cursor-pointer"
                            title="Download PDF Log"
                          >
                            <Download className="h-3.5 w-3.5" />
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

      {/* SELECTED EMPLOYEE MODAL */}
      {selectedEmp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-4xl relative z-10 animate-slide-in">
            <GlassCard className="max-h-[85vh] flex flex-col p-6 overflow-hidden">
              
              {/* Modal Header */}
              <div className="flex items-start justify-between border-b border-white/10 pb-4 mb-4">
                <div>
                  <h2 className="text-xl font-bold text-slate-100">{selectedEmp.profile.name}</h2>
                  <p className="text-xs text-slate-400 mt-1">
                    ID: {selectedEmp.profile.emp_id} | Email: {selectedEmp.profile.email}
                  </p>
                </div>
                
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => handleDownloadEmployeePDF(selectedEmp)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-slate-200 transition-all cursor-pointer"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Download PDF
                  </button>

                  <button
                    onClick={() => setSelectedEmp(null)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 bg-white/5 hover:bg-white/10 border border-white/10 transition-all cursor-pointer"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Modal Body: Scrollable Logs */}
              <div className="flex-1 overflow-y-auto pr-1">
                {selectedEmp.logs.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <FileText className="h-10 w-10 text-slate-600 mb-3" />
                    <h3 className="font-semibold text-slate-400">No shift records</h3>
                  </div>
                ) : (
                  <table className="w-full text-left border-collapse min-w-[500px]">
                    <thead>
                      <tr className="border-b border-white/5 text-xs text-slate-400 font-semibold uppercase tracking-wider">
                        <th className="pb-3 pt-2">Date</th>
                        <th className="pb-3 pt-2">Clock In</th>
                        <th className="pb-3 pt-2">Clock Out</th>
                        <th className="pb-3 pt-2 text-right">Total Hours</th>
                        <th className="pb-3 pt-2 text-right">OT Hours</th>
                        <th className="pb-3 pt-2 pl-6">Notes</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 text-sm text-slate-300">
                      {selectedEmp.logs.map((log) => {
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
                          <tr key={log.id} className="hover:bg-white/[0.01]">
                            <td className="py-3 font-medium">{dayjs(log.date).format('YYYY-MM-DD')}</td>
                            <td className="py-3">{checkInStr}</td>
                            <td className="py-3">{checkOutStr}</td>
                            <td className="py-3 text-right font-medium">
                              {log.check_out ? `${Number(log.total_hours).toFixed(2)}h` : '-'}
                            </td>
                            <td className={`py-3 text-right font-semibold ${log.overtime_hours > 0 ? 'text-cyan-400 glow-text-cyan' : 'text-slate-400'}`}>
                              {log.check_out ? `${Number(log.overtime_hours).toFixed(2)}h` : '-'}
                            </td>
                            <td className="py-3 pl-6 text-slate-400 text-xs truncate max-w-xs" title={log.notes || ''}>
                              {log.notes || '-'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Modal Footer */}
              <div className="border-t border-white/10 pt-4 mt-4 flex items-center justify-between text-xs text-slate-400">
                <div className="flex gap-4">
                  <span>Completed Sessions: <strong className="text-slate-200">{selectedEmp.totalLogs}</strong></span>
                  <span>OT Accumulated: <strong className="text-cyan-400">{selectedEmp.totalOvertime}h</strong></span>
                </div>
                
                <button
                  onClick={() => setSelectedEmp(null)}
                  className="px-4 py-2 rounded-lg bg-slate-900 border border-white/10 text-slate-200 font-semibold hover:bg-slate-800 transition-all cursor-pointer"
                >
                  Close Panel
                </button>
              </div>

            </GlassCard>
          </div>
        </div>
      )}
    </div>
  );
}

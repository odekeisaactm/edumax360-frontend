'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import { api, academicCalendarAPI } from '@/lib/api';
import { billingLedgerAPI } from '@/lib/fee.service';
import { Mail, Check, AlertCircle, AlertTriangle, Loader2, Search, FilterX, Users, X, Send } from 'lucide-react';

let _toastId = 0;
function showToast(set: React.Dispatch<React.SetStateAction<any[]>>, type: 'success' | 'error', message: string) {
  const id = ++_toastId;
  set(prev => [...prev, { id, type, message }]);
  setTimeout(() => set(prev => prev.filter(t => t.id !== id)), 4000);
}

function formatCurrency(amount: string | number | undefined): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : (amount || 0);
  return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(num);
}

export default function FeeRemindersPage() {
  const { hasPermission, user } = useAuth();
  const canManageFees = user?.is_superuser || hasPermission('fee_management.manage_fees');

  const [toasts, setToasts] = useState<any[]>([]);
  const [celeryStatus, setCeleryStatus] = useState<boolean | null>(null);

  const [sessions, setSessions] = useState<any[]>([]);
  const [periods, setPeriods] = useState<any[]>([]);
  
  const [sessionId, setSessionId] = useState('');
  const [periodId, setPeriodId] = useState('');
  const [minDebt, setMinDebt] = useState('0');
  const [debtorsOnly, setDebtorsOnly] = useState(true);
  
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 50;

  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [actionLoading, setActionLoading] = useState(false);

  // Initialize
  useEffect(() => {
    // Check celery status
    api.get('/api/school_config/celery-status/').then(res => {
      setCeleryStatus(res.data.alive);
    }).catch(() => setCeleryStatus(false));

    // Fetch sessions
    academicCalendarAPI.listSessions().then(s => setSessions(Array.isArray(s) ? s : s.results || []));
  }, []);

  useEffect(() => {
    if (sessionId) {
      academicCalendarAPI.listSessionPeriods({ session_id: Number(sessionId) })
        .then(p => setPeriods(Array.isArray(p) ? p : p.results || []));
    } else {
      setPeriods([]);
      setPeriodId('');
    }
  }, [sessionId]);

  const fetchLedger = useCallback(async () => {
    if (!sessionId || !periodId) return;
    setLoading(true);
    try {
      const res = await billingLedgerAPI.get({
        session_id: sessionId,
        period_id: periodId,
        mode: 'parent',
        page,
        debtors_only: debtorsOnly,
      } as any);
      const results = Array.isArray(res) ? res : res?.results ?? [];
      setData(results);
      setTotalCount(res.count || results.length);
      setSelectedIds([]);
    } catch (err: any) {
      showToast(setToasts, 'error', err.response?.data?.detail || err.message || 'Failed to fetch ledger');
    } finally {
      setLoading(false);
    }
  }, [sessionId, periodId, page, debtorsOnly]);

  useEffect(() => {
    fetchLedger();
  }, [fetchLedger]);

  // Bulk actions
  const handleBulkAction = async (actionType: 'send_reminders' | 'send_summaries', scope: 'all' | 'selected') => {
    if (!sessionId || !periodId) return showToast(setToasts, 'error', 'Select Session and Term first.');
    if (scope === 'selected' && selectedIds.length === 0) return showToast(setToasts, 'error', 'No recipients selected.');
    
    setActionLoading(true);
    try {
      let target_ids: number[] | undefined = undefined;
      let send_to_all = false;
      
      if (scope === 'selected') {
        target_ids = selectedIds.map(id => data.find(d => d.id === id)?.parent_id || id);
      } else {
        send_to_all = true;
      }

      await billingLedgerAPI.bulkAction({
        action: actionType,
        target_type: 'parent',
        target_ids,
        send_to_all,
        session_id: Number(sessionId),
        period_id: Number(periodId),
        debtors_only: debtorsOnly,
        min_debt: Number(minDebt) || 0,
      });

      showToast(setToasts, 'success', `${actionType === 'send_reminders' ? 'Reminders' : 'Statements'} queued successfully.`);
      if (scope === 'selected') setSelectedIds([]);
    } catch (err: any) {
      showToast(setToasts, 'error', err.response?.data?.detail || err.message || 'Action failed');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSingleAction = async (id: number, actionType: 'send_reminders' | 'send_summaries') => {
    const parentId = data.find(d => d.id === id)?.parent_id || id;
    try {
      await billingLedgerAPI.bulkAction({
        action: actionType,
        target_type: 'parent',
        target_ids: [parentId],
        session_id: Number(sessionId),
        period_id: Number(periodId),
      });
      showToast(setToasts, 'success', 'Action queued successfully.');
    } catch (err: any) {
      showToast(setToasts, 'error', err.response?.data?.detail || err.message || 'Action failed');
    }
  };

  if (!canManageFees) return <div className="p-16 text-center text-red-600 font-bold">Access Denied</div>;

  return (
    <div className="min-h-screen bg-slate-50 p-6 pb-28 animate-in fade-in">
      {/* Toast notifications */}
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2">
        {toasts.map(t => (
          <div key={t.id} className={`flex items-start gap-3 px-4 py-3 rounded-xl shadow-lg border max-w-sm ${t.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-red-50 border-red-200 text-red-900'}`}>
            <p className="text-sm font-medium flex-1">{t.message}</p>
          </div>
        ))}
      </div>

      <div className="max-w-7xl mx-auto space-y-6">
        
        {celeryStatus === false && (
          <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl flex items-start gap-3 shadow-sm">
            <AlertTriangle className="h-5 w-5 text-amber-500 mt-0.5" />
            <div>
              <h3 className="font-bold text-amber-800 text-sm">Background Workers Offline</h3>
              <p className="text-amber-700 text-sm mt-1">⚠️ Background task workers are offline. Emails may be queued but not delivered until workers are restarted.</p>
            </div>
          </div>
        )}

        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Fee Reminders & Statements</h1>
            <p className="text-sm text-slate-500 mt-1">Communicate outstanding balances and account summaries to parents.</p>
          </div>
          <div className="flex gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase">Session</label>
              <select value={sessionId} onChange={e => {setSessionId(e.target.value); setPeriodId('');}} className="w-full min-w-[150px] px-3 py-2 text-sm font-medium border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none bg-slate-50">
                <option value="">Select Session...</option>
                {sessions.map(s => <option key={s.id} value={s.id}>{s.name || `${s.start_year}/${s.end_year}`}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase">Term</label>
              <select value={periodId} onChange={e => setPeriodId(e.target.value)} disabled={!sessionId} className="w-full min-w-[150px] px-3 py-2 text-sm font-medium border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none bg-slate-50 disabled:opacity-50">
                <option value="">Select Term...</option>
                {periods.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Reminder Card */}
          <div className="bg-rose-50 p-6 rounded-2xl border border-rose-100 shadow-sm">
            <h2 className="text-lg font-bold text-rose-800 flex items-center gap-2 mb-2">
              <Mail className="h-5 w-5" /> Send Payment Reminders
            </h2>
            <p className="text-rose-600 text-sm mb-6">Send automated payment reminder emails to parents with outstanding balances.</p>
            
            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-xs font-bold text-rose-700 mb-1">Minimum Debt Threshold (₦)</label>
                <input type="number" min="0" value={minDebt} onChange={e => setMinDebt(e.target.value)} className="w-full px-3 py-2 text-sm border border-rose-200 rounded-xl outline-none focus:ring-2 focus:ring-rose-500 bg-white" />
              </div>
              <label className="flex items-center gap-2 text-sm font-semibold text-rose-800 cursor-pointer w-fit">
                <input type="checkbox" checked={debtorsOnly} onChange={e => setDebtorsOnly(e.target.checked)} className="rounded text-rose-600 focus:ring-rose-500 h-4 w-4" />
                Debtors Only
              </label>
            </div>
            
            <button onClick={() => handleBulkAction('send_reminders', 'all')} disabled={actionLoading || !sessionId || !periodId} className="w-full py-3 bg-rose-600 text-white font-bold text-sm rounded-xl hover:bg-rose-700 disabled:opacity-50 transition-colors shadow-md shadow-rose-200 flex items-center justify-center gap-2">
              {actionLoading ? <Loader2 className="h-4 w-4 animate-spin"/> : <Send className="h-4 w-4" />}
              Send to All Matching Parents
            </button>
          </div>

          {/* Statement Card */}
          <div className="bg-indigo-50 p-6 rounded-2xl border border-indigo-100 shadow-sm flex flex-col">
            <div>
              <h2 className="text-lg font-bold text-indigo-800 flex items-center gap-2 mb-2">
                <AlertCircle className="h-5 w-5" /> Send Account Statements
              </h2>
              <p className="text-indigo-600 text-sm mb-6">Send detailed, consolidated account statements to parents summarizing all their wards' fees.</p>
            </div>
            
            <div className="mt-auto pt-6">
              <button onClick={() => handleBulkAction('send_summaries', 'all')} disabled={actionLoading || !sessionId || !periodId} className="w-full py-3 bg-indigo-600 text-white font-bold text-sm rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-colors shadow-md shadow-indigo-200 flex items-center justify-center gap-2">
                {actionLoading ? <Loader2 className="h-4 w-4 animate-spin"/> : <Send className="h-4 w-4" />}
                Send to All Parents
              </button>
            </div>
          </div>
        </div>

        {/* Floating Bulk Action Bar */}
        {selectedIds.length > 0 && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-white border border-slate-200 shadow-2xl rounded-full px-6 py-4 flex items-center gap-6 animate-in slide-in-from-bottom-5">
            <div className="flex items-center gap-2 border-r border-slate-200 pr-6">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-100 text-indigo-600 text-xs font-bold">
                {selectedIds.length}
              </span>
              <span className="text-sm font-bold text-slate-700">Selected</span>
            </div>
            <button onClick={() => setSelectedIds([])} className="text-sm font-semibold text-slate-500 hover:text-slate-800">Clear</button>
            <div className="flex gap-2">
              <button onClick={() => handleBulkAction('send_reminders', 'selected')} disabled={actionLoading} className="px-5 py-2 bg-rose-600 text-white text-sm font-bold rounded-full shadow hover:bg-rose-700 flex items-center gap-2 transition-all">
                Send Reminders
              </button>
              <button onClick={() => handleBulkAction('send_summaries', 'selected')} disabled={actionLoading} className="px-5 py-2 bg-indigo-600 text-white text-sm font-bold rounded-full shadow hover:bg-indigo-700 flex items-center gap-2 transition-all">
                Send Statements
              </button>
            </div>
          </div>
        )}

        {/* Targets Table */}
        {sessionId && periodId && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h3 className="font-bold text-slate-800 text-sm">Target Recipients List ({totalCount})</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 border-b border-slate-100 text-xs font-bold text-slate-500 uppercase tracking-wide">
                  <tr>
                    <th className="px-4 py-3 w-12 text-center">
                      <input type="checkbox" className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                        checked={data.length > 0 && selectedIds.length === data.length}
                        onChange={(e) => setSelectedIds(e.target.checked ? data.map(d => d.id) : [])}
                      />
                    </th>
                    <th className="px-4 py-3">Parent Name</th>
                    <th className="px-4 py-3">Phone</th>
                    <th className="px-4 py-3 text-right">Owing Balance</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading ? (
                    <tr><td colSpan={5} className="py-12 text-center"><Loader2 className="h-6 w-6 animate-spin text-indigo-600 mx-auto" /></td></tr>
                  ) : data.length === 0 ? (
                    <tr><td colSpan={5} className="py-12 text-center text-slate-400">No recipients found for these criteria.</td></tr>
                  ) : (
                    data.map((row) => {
                      const isChecked = selectedIds.includes(row.id);
                      const toggleCheck = () => setSelectedIds(prev => isChecked ? prev.filter(id => id !== row.id) : [...prev, row.id]);
                      return (
                        <tr key={row.id} className={`transition-colors ${isChecked ? 'bg-indigo-50/30' : 'hover:bg-slate-50'}`}>
                          <td className="px-4 py-3 text-center">
                            <input type="checkbox" className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer" checked={isChecked} onChange={toggleCheck} />
                          </td>
                          <td className="px-4 py-3 font-semibold text-slate-800">{row.__str__}</td>
                          <td className="px-4 py-3 text-slate-500">{row.mobile || '—'}</td>
                          <td className="px-4 py-3 text-right font-bold text-rose-600">{formatCurrency(row.grand_total_outstanding)}</td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button onClick={() => handleSingleAction(row.id, 'send_reminders')} className="px-2 py-1 text-xs font-semibold bg-rose-50 text-rose-600 hover:bg-rose-100 rounded transition-colors" title="Send Reminder">Reminder</button>
                              <button onClick={() => handleSingleAction(row.id, 'send_summaries')} className="px-2 py-1 text-xs font-semibold bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded transition-colors" title="Send Statement">Statement</button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
            
            {/* Pagination controls can be added here if needed */}
          </div>
        )}

      </div>
    </div>
  );
}

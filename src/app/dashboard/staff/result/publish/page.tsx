'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { resultPublishAPI } from '@/lib/result.service';
import { api } from '@/lib/api';
import { ResultPublish, PublishStats } from '@/lib/result.types';
import {
  CheckCircle2, AlertCircle, Loader2, Globe, Layers,
  ArrowLeft, Info, Send, XCircle, BarChart3,
  ExternalLink, AlertTriangle, RefreshCcw,
  History, Calendar, Users, Eye, Mail
} from 'lucide-react';

const formatDate = (dateStr: string) => {
  try {
    const d = new Date(dateStr);
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    }).format(d);
  } catch (e) {
    return '—';
  }
};

// ─── Modals ──────────────────────────────────────────────────────────────

function ErrorModal({ message, onClose }: { message: string; onClose: () => void; }) {
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-3">
          <div className="w-10 h-10 bg-red-50 text-red-600 rounded-xl flex items-center justify-center">
            <AlertCircle className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900">Something Went Wrong</h3>
            <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Action could not be completed</p>
          </div>
        </div>
        <div className="p-6">
          <p className="text-sm text-slate-600 leading-relaxed">{message}</p>
        </div>
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end">
          <button onClick={onClose} className="px-6 py-2 rounded-xl text-sm font-bold text-white bg-red-600 hover:bg-red-700 shadow-lg shadow-red-200 transition-all">
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}

function SuccessModal({ message, onClose }: { message: string; onClose: () => void; }) {
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-3">
          <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center">
            <CheckCircle2 className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900">Success</h3>
            <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Action completed</p>
          </div>
        </div>
        <div className="p-6">
          <p className="text-sm text-slate-600 leading-relaxed">{message}</p>
        </div>
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end">
          <button onClick={onClose} className="px-6 py-2 rounded-xl text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-200 transition-all">
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

function PublisherModal({ record, onClose }: { record: ResultPublish; onClose: () => void; }) {
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center">
            <Users className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900">Publisher Details</h3>
            <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Result Visibility</p>
          </div>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-slate-400 font-bold mb-1">Published By</p>
            <p className="text-sm font-bold text-slate-700">{record.published_by_name || 'System'}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-widest text-slate-400 font-bold mb-1">Date & Time</p>
            <p className="text-sm font-bold text-slate-700">{record.published_at ? formatDate(record.published_at) : '—'}</p>
          </div>
        </div>
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end">
          <button onClick={onClose} className="px-6 py-2 rounded-xl text-sm font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 transition-all">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function PublishProgressModal({
  record,
  onConfirm,
  onClose
}: {
  record: ResultPublish;
  onConfirm: (sendEmail: boolean) => Promise<void>;
  onClose: () => void;
}) {
  const [stats, setStats] = useState<PublishStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [sendEmail, setSendEmail] = useState(false);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    try {
      const data = await resultPublishAPI.stats({
        period_id: record.academic_period,
        result_type: record.result_type,
        section_id: record.school_section
      });
      setStats(data);
    } catch (err) {
      console.error('Failed to fetch stats', err);
    } finally {
      setLoading(false);
    }
  }, [record]);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  const handlePublish = async () => {
    setPublishing(true);
    try {
      await onConfirm(sendEmail);
      onClose();
    } finally {
      setPublishing(false);
    }
  };

  const isLowProgress = stats && stats.percentage < 70;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center">
              <Send className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">Publish Results</h3>
              <p className="text-xs text-slate-500 uppercase font-semibold tracking-wider">
                {record.session_name} · {record.period_name} · {record.result_type === 'midterm' ? 'Mid Term' : 'End of Term'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 rounded-lg">
            <XCircle className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="p-6 space-y-6 overflow-y-auto max-h-[55vh]">
          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
              <p className="text-sm text-slate-500">Checking upload progress...</p>
            </div>
          ) : stats ? (
            <>
              {/* Progress Bar */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-slate-700 font-semibold">
                    <BarChart3 className="h-4 w-4 text-slate-400" />
                    Upload Readiness
                  </div>
                  <span className={`text-lg font-bold ${isLowProgress ? 'text-amber-600' : 'text-emerald-600'}`}>
                    {stats.percentage}%
                  </span>
                </div>

                <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-1000 ${isLowProgress ? 'bg-amber-500' : 'bg-emerald-500'}`}
                    style={{ width: `${stats.percentage}%` }}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <p className="text-[10px] text-slate-400 uppercase font-bold mb-1">Total Expected</p>
                    <p className="text-xl font-bold text-slate-700">{stats.total_students}</p>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <p className="text-[10px] text-slate-400 uppercase font-bold mb-1">Fully Uploaded</p>
                    <p className="text-xl font-bold text-slate-700">{stats.computed_results}</p>
                  </div>
                </div>
              </div>

              {/* Warning */}
              {isLowProgress ? (
                <div className="flex gap-4 bg-amber-50 border border-amber-200 p-4 rounded-xl">
                  <div className="w-10 h-10 bg-amber-100 text-amber-600 rounded-full flex-shrink-0 flex items-center justify-center">
                    <AlertTriangle className="h-5 w-5" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-bold text-amber-900">Low Upload Progress</p>
                    <p className="text-xs text-amber-700 leading-relaxed">
                      It is highly recommended to have at least <b>70%</b> of results computed before publishing.
                      Publishing now will make results visible to parents even if incomplete.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex gap-4 bg-emerald-50 border border-emerald-200 p-4 rounded-xl">
                  <div className="w-10 h-10 bg-emerald-100 text-emerald-600 rounded-full flex-shrink-0 flex items-center justify-center">
                    <CheckCircle2 className="h-5 w-5" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-bold text-emerald-900">Ready to Publish</p>
                    <p className="text-xs text-emerald-700 leading-relaxed">
                      Upload progress is healthy. Publishing will make these results visible to parents and students on their portals.
                    </p>
                  </div>
                </div>
              )}

              {/* Email Option */}
              <div className="flex items-center gap-3 p-4 bg-indigo-50/50 border border-indigo-100 rounded-xl">
                <input
                  type="checkbox"
                  id="sendEmail"
                  checked={sendEmail}
                  onChange={(e) => setSendEmail(e.target.checked)}
                  className="w-5 h-5 rounded border-indigo-300 text-indigo-600 focus:ring-indigo-600 cursor-pointer flex-shrink-0"
                />
                <label htmlFor="sendEmail" className="text-sm font-semibold text-indigo-900 cursor-pointer select-none leading-snug">
                  ✉️ Also email result PDFs to parents upon publishing
                </label>
              </div>

              {/* Link to Tracking */}
              <button
                onClick={() => window.open('/dashboard/staff/result/tracking', '_blank')}
                className="w-full flex items-center justify-center gap-2 py-2 text-sm text-indigo-600 font-semibold hover:bg-indigo-50 rounded-lg transition-colors border border-dashed border-indigo-200"
              >
                <Eye className="h-4 w-4" /> View Detailed Tracking <ExternalLink className="h-3 w-3 opacity-60" />
              </button>
            </>
          ) : null}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-3 flex-shrink-0">
          <button onClick={onClose} disabled={publishing} className="px-4 py-2 text-sm font-semibold text-slate-600 hover:text-slate-800">
            Cancel
          </button>
          <button
            onClick={handlePublish}
            disabled={loading || publishing}
            className={`px-6 py-2 rounded-xl text-sm font-bold text-white shadow-lg transition-all flex items-center gap-2
              ${isLowProgress ? 'bg-amber-600 hover:bg-amber-700 shadow-amber-200' : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200'}`}
          >
            {publishing ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            {isLowProgress ? 'Publish Anyways' : 'Publish Results'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function ResultPublishPage() {
  const router = useRouter();
  const { user } = useAuth();

  const [records, setRecords] = useState<ResultPublish[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [activeModal, setActiveModal] = useState<{ type: 'publish' | 'split' | 'merge', record: ResultPublish } | null>(null);
  const [errorModalMessage, setErrorModalMessage] = useState<string | null>(null);
  const [successModalMessage, setSuccessModalMessage] = useState<string | null>(null);
  const [publisherModalRecord, setPublisherModalRecord] = useState<ResultPublish | null>(null);
  const [resendingId, setResendingId] = useState<number | null>(null);

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    try {
      const data = await resultPublishAPI.list();
      setRecords(data);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to load publish records');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchRecords(); }, [fetchRecords]);

  const handleToggle = async (id: number, sendEmail: boolean = false) => {
    try {
      await api.post(`/api/result/publish/${id}/toggle-publish/`, { send_email: sendEmail });
      fetchRecords();
    } catch (err: any) {
      setErrorModalMessage(err.response?.data?.detail || 'Failed to update status');
    }
  };

  const handleSplit = async (id: number) => {
    try {
      await resultPublishAPI.split(id);
      fetchRecords();
    } catch (err: any) {
      setErrorModalMessage(err.response?.data?.detail || 'Failed to split sections');
    }
  };

  const handleMerge = async (id: number) => {
    try {
      await resultPublishAPI.merge(id);
      fetchRecords();
    } catch (err: any) {
      setErrorModalMessage(err.response?.data?.detail || 'Failed to merge sections');
    }
  };

  const handleResendEmails = async (id: number) => {
    setResendingId(id);
    try {
      await api.post(`/api/result/publish/${id}/resend-emails/`);
      setSuccessModalMessage("Bulk email dispatch has been queued and is running in the background.");
    } catch (err: any) {
      setErrorModalMessage(err.response?.data?.detail || 'Failed to resend emails');
    } finally {
      setResendingId(null);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-20">

      {/* ── Header ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button onClick={() => router.back()} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400 hover:text-slate-600">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-3">
              <div className="w-10 h-10 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-200">
                <Send className="h-5 w-5 text-white" />
              </div>
              Publish Results
            </h1>
            <p className="text-sm text-slate-400 font-medium mt-1">Control visibility of results for parents and students</p>
          </div>
        </div>

        <div className="flex items-center gap-2 bg-indigo-50 border border-indigo-100 px-4 py-2 rounded-2xl">
          <Info className="h-4 w-4 text-indigo-500" />
          <p className="text-xs text-indigo-700 font-medium leading-snug max-w-[300px]">
            Publishing makes results visible on portals. Staff can only edit results for the current active term.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="min-h-[400px] flex flex-col items-center justify-center gap-4 bg-white rounded-3xl border border-slate-100">
          <Loader2 className="h-10 w-10 animate-spin text-indigo-600" />
          <p className="text-slate-400 font-medium">Initializing terminal publish system...</p>
        </div>
      ) : error ? (
        <div className="min-h-[400px] flex flex-col items-center justify-center gap-4 bg-white rounded-3xl border border-red-100">
          <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center">
            <XCircle className="h-8 w-8" />
          </div>
          <p className="text-slate-700 font-bold">{error}</p>
          <button onClick={fetchRecords} className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-bold shadow-md shadow-indigo-200">
            Retry Connection
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {records.length === 0 ? (
            <div className="p-20 text-center space-y-4 bg-white rounded-3xl border border-slate-100 shadow-sm">
              <History className="h-12 w-12 text-slate-200 mx-auto" />
              <p className="text-slate-400 font-medium uppercase tracking-widest text-xs">No Active Term Found</p>
              <p className="text-slate-500 max-w-sm mx-auto">Publishing is only available for active academic sessions. Please check your school configuration.</p>
            </div>
          ) : (
            <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-50/50 border-b border-slate-100">
                    <th className="px-6 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400 min-w-[240px]">Term / Session</th>
                    <th className="px-6 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">Result Type</th>
                    <th className="px-6 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">School Section</th>
                    <th className="px-6 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">Status</th>
                    <th className="px-6 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">Published By</th>
                    <th className="px-6 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {records.map((rec) => {
                    const isGlobal = rec.school_section === null;
                    return (
                      <tr key={rec.id} className="hover:bg-slate-50/50 transition-colors group">
                        <td className="px-6 py-5">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors">
                              <Calendar className="h-4 w-4" />
                            </div>
                            <div>
                              <p className="text-sm font-bold text-slate-700">{rec.period_name || 'Unknown Term'}</p>
                              <p className="text-[11px] text-slate-400 font-bold">
                                {rec.session_name || '—'}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-5">
                           <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider
                             ${rec.result_type === 'midterm' ? 'bg-amber-100 text-amber-700' : 'bg-indigo-100 text-indigo-700'}`}>
                             {rec.result_type === 'midterm' ? 'Mid Term' : 'End of Term'}
                           </span>
                        </td>
                        <td className="px-6 py-5">
                          <div className="flex items-center gap-2">
                             {isGlobal ? <Globe className="h-4 w-4 text-indigo-400" /> : <Layers className="h-4 w-4 text-slate-400" />}
                             <span className={`text-sm font-semibold ${isGlobal ? 'text-indigo-600' : 'text-slate-600'}`}>
                               {rec.section_name}
                             </span>
                             {!rec.is_published && (
                               <button
                                 onClick={() => isGlobal ? handleSplit(rec.id) : handleMerge(rec.id)}
                                 className="opacity-0 group-hover:opacity-100 p-1 hover:bg-white rounded-md border border-slate-100 text-[10px] font-bold text-slate-400 hover:text-indigo-600 transition-all flex items-center gap-1 ml-1"
                                 title={isGlobal ? "Split into Sections" : "Merge into Global"}
                               >
                                 <RefreshCcw className="h-3 w-3" /> {isGlobal ? 'Split' : 'Merge'}
                               </button>
                             )}
                          </div>
                        </td>
                        <td className="px-6 py-5 text-center">
                           <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-2xl text-[11px] font-bold border-2
                             ${rec.is_published
                               ? 'bg-emerald-50 border-emerald-100 text-emerald-700'
                               : 'bg-slate-50 border-slate-100 text-slate-400'}`}>
                             <div className={`w-1.5 h-1.5 rounded-full ${rec.is_published ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`} />
                             {rec.is_published ? 'Published' : 'Hidden'}
                           </div>
                        </td>
                        <td className="px-6 py-5 text-center">
                           {rec.is_published ? (
                             <button
                               onClick={() => setPublisherModalRecord(rec)}
                               className="p-2 bg-slate-100 text-slate-500 hover:bg-indigo-50 hover:text-indigo-600 rounded-lg transition-colors"
                               title="View Publisher Details"
                             >
                               <Users className="h-4 w-4" />
                             </button>
                           ) : (
                             <span className="text-slate-300 text-xs italic">—</span>
                           )}
                        </td>
                        <td className="px-6 py-5">
                           <div className="flex items-center justify-end gap-2">
                             {rec.is_published && (
                               <button
                                 onClick={() => handleResendEmails(rec.id)}
                                 disabled={resendingId === rec.id}
                                 className="w-9 h-9 rounded-xl flex items-center justify-center bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors disabled:opacity-50"
                                 title="Resend Emails"
                               >
                                 {resendingId === rec.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                               </button>
                             )}
                             <button
                               onClick={() => rec.is_published ? handleToggle(rec.id, false) : setActiveModal({ type: 'publish', record: rec })}
                               className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all shadow-sm
                                 ${rec.is_published
                                   ? 'bg-red-50 text-red-600 hover:bg-red-100 border border-red-100'
                                   : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-200'}`}
                               title={rec.is_published ? "Unpublish Results" : "Publish Results"}
                             >
                               {rec.is_published ? <XCircle className="h-4 w-4" /> : <Send className="h-4 w-4" />}
                             </button>
                           </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Modals ── */}
      {activeModal && activeModal.type === 'publish' && (
        <PublishProgressModal
          record={activeModal.record}
          onConfirm={(sendEmail) => handleToggle(activeModal.record.id, sendEmail)}
          onClose={() => setActiveModal(null)}
        />
      )}

      {publisherModalRecord && (
        <PublisherModal
          record={publisherModalRecord}
          onClose={() => setPublisherModalRecord(null)}
        />
      )}

      {errorModalMessage && (
        <ErrorModal
          message={errorModalMessage}
          onClose={() => setErrorModalMessage(null)}
        />
      )}

      {successModalMessage && (
        <SuccessModal
          message={successModalMessage}
          onClose={() => setSuccessModalMessage(null)}
        />
      )}

    </div>
  );
}
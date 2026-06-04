'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { 
  examsAPI, 
  resultFieldsAPI, 
  resultTransferAPI, 
  academicAPI 
} from '@/lib/api';
import { 
  Exam, 
  ResultField, 
  ClassConfiguration 
} from '@/lib/types';
import {
  RefreshCw,
  ArrowRight,
  ShieldCheck,
  History,
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  Settings, X,
  Filter,
  Users,
  BookOpen,
  ArrowLeft,
  Loader2,
  Table,
  Zap,
} from 'lucide-react';

// ─── Style constants ─────────────────────────────────────────────────────────

const cardCls = "bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden";
const headerCls = "px-6 py-4 border-b border-slate-50 bg-slate-50/50 flex items-center justify-between";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function extractError(err: any): string {
  if (!err) return 'An unknown error occurred';
  if (err.response?.data) {
    const d = err.response.data;
    if (typeof d === 'string') return d;
    if (d.detail) return d.detail;
    if (d.error) return d.error;
    if (d.message) return d.message;
    return JSON.stringify(d);
  }
  return err.message || 'An error occurred';
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ResultTransferPage() {
  const { hasPermission, user } = useAuth();
  
  // Tabs
  const [activeTab, setActiveTab] = useState<'new' | 'history'>('new');

  // New Transfer State
  const [exams, setExams] = useState<Exam[]>([]);
  const [selectedExamId, setSelectedExamId] = useState<number | null>(null);
  const [selectedExam, setSelectedExam] = useState<Exam | null>(null);
  
  const [resultFields, setResultFields] = useState<ResultField[]>([]);
  const [selectedFieldId, setSelectedFieldId] = useState<number | null>(null);
  
  const [examClasses, setExamsClasses] = useState<any[]>([]);
  const [exemptedIds, setExemptedIds] = useState<number[]>([]);
  const [classOverrides, setClassOverrides] = useState<Record<number, { scale: boolean }>>({});
  
  const [loading, setLoading] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewData, setPreviewData] = useState<any[] | null>(null);
  const [executing, setExecuting] = useState(false);
  
  // History State
  const [history, setHistory] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const canManage = user?.is_superuser || hasPermission('assessment_center.change_examresulttransferconfigmodel');

  // ── Fetch Initial ──────────────────────────────────────────────────────────

  const fetchExams = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch exams that haven't been transferred yet
      const list = await examsAPI.list({ is_published: true });
      setExams(list.filter(e => !(e as any).last_transfer_date));
      
      const fields = await resultFieldsAPI.list();
      setResultFields(fields);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const data = await resultTransferAPI.list();
      setHistory(data);
    } catch (err) {
      console.error(err);
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'new') fetchExams();
    else fetchHistory();
  }, [activeTab, fetchExams, fetchHistory]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleExamSelect = async (id: number) => {
    setSelectedExamId(id);
    const exam = exams.find(e => e.id === id);
    setSelectedExam(exam || null);
    setPreviewData(null);
    setExemptedIds([]);
    
    // Fetch classes for this exam (from schedules)
    if (exam) {
        // Normally we'd fetch specific classes, but for now we'll derive from schedules
        // or just let the user toggle all available classes in the system if needed.
        // The instruction says: "List all classes in the exam"
        try {
            const res = await academicAPI.listClassConfigurations();
            setExamsClasses(res);
        } catch (e) {}
    }
  };

  const toggleExempt = (classId: number) => {
    setExemptedIds(prev => 
      prev.includes(classId) ? prev.filter(id => id !== classId) : [...prev, classId]
    );
  };

  const toggleScale = (classId: number, current: boolean) => {
    setClassOverrides(prev => ({
        ...prev,
        [classId]: { ...prev[classId], scale: !current }
    }));
  };

  const handlePreview = async () => {
  if (!selectedExamId || !selectedFieldId) return;
  setPreviewLoading(true);
  try {
    const res = await examsAPI.getSchedulesStatus(selectedExamId);
    setPreviewData((res as any).schedules);
  } catch (err) {
    alert(extractError(err));
  } finally {
    setPreviewLoading(false);
  }
};

  const handleExecute = async () => {
    if (!selectedExamId || !selectedFieldId) return;
    
    setExecuting(true);
    try {
      // 1: Ensure Config exists
      let config = (await resultTransferAPI.list({ exam: selectedExamId }))[0];
      if (!config) {
        config = await resultTransferAPI.create({
            exam: selectedExamId,
            result_field: selectedFieldId,
        });
      } else {
        // Update target field if changed
        if (config.result_field !== selectedFieldId) {
            await resultTransferAPI.update(config.id, { result_field: selectedFieldId });
        }
      }

      // 2: Execute
      const res = await resultTransferAPI.executeTransfer(config.id, {
        exempted_class_ids: exemptedIds,
        class_overrides: classOverrides
      });

      alert(`Transfer Complete!\n${res.transferred} scores moved successfully.`);
      setSelectedExamId(null);
      setPreviewData(null);
      fetchExams();
    } catch (err) {
      alert(extractError(err));
    } finally {
      setExecuting(false);
    }
  };

  if (!canManage) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-6">
        <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mb-4">
          <ShieldCheck className="h-10 w-10 text-red-500" />
        </div>
        <h2 className="text-2xl font-bold text-slate-900">Access Denied</h2>
        <p className="text-slate-500 mt-2 max-w-md">
          You do not have the required permissions to perform result transfers. 
          Please contact your administrator.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-20">
      {/* ── Page Header ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-violet-600 to-indigo-600 rounded-[1.25rem] flex items-center justify-center shadow-xl shadow-violet-200">
               <RefreshCw className="h-6 w-6 text-white" />
            </div>
            Result Transfer
          </h1>
          <p className="text-slate-500 font-medium mt-1 pl-15">Migrate exam scores to student report cards</p>
        </div>

        <div className="flex bg-slate-100 p-1.5 rounded-2xl border border-slate-200 shadow-inner">
           <button 
             onClick={() => setActiveTab('new')}
             className={`px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'new' ? 'bg-white text-violet-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
           >
             New Transfer
           </button>
           <button 
             onClick={() => setActiveTab('history')}
             className={`px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'history' ? 'bg-white text-violet-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
           >
             Transfer History
           </button>
        </div>
      </div>

      {activeTab === 'new' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start animate-in fade-in slide-in-from-bottom-4 duration-500">
           {/* ── Step 1: Configuration ── */}
           <div className="lg:col-span-1 space-y-6">
              <div className={cardCls}>
                 <div className={headerCls}>
                    <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                       <Settings className="h-4 w-4 text-violet-500" />
                       1. Configure
                    </h3>
                 </div>
                 <div className="p-6 space-y-6">
                    <div>
                       <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Select Exam</label>
                       <select 
                         value={selectedExamId ?? ''} 
                         onChange={e => handleExamSelect(Number(e.target.value))}
                         className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold outline-none focus:ring-2 focus:ring-violet-500"
                       >
                          <option value="">-- Select Exam --</option>
                          {exams.map(e => (
                            <option key={e.id} value={e.id}>{e.name}</option>
                          ))}
                       </select>
                    </div>

                    {selectedExam && (
                      <div className="p-4 bg-violet-50 border border-violet-100 rounded-2xl space-y-2">
                         <p className="text-xs font-bold text-violet-700 flex items-center gap-2">
                            <BookOpen className="h-3 w-3" />
                            {selectedExam.exam_type} Exam
                         </p>
                         <p className="text-[10px] font-black text-violet-400 uppercase">
                            {selectedExam.start_date} → {selectedExam.end_date}
                         </p>
                      </div>
                    )}

                    <div>
                       <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Target Result Field</label>
                       <select 
                         value={selectedFieldId ?? ''} 
                         onChange={e => setSelectedFieldId(Number(e.target.value))}
                         className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold outline-none focus:ring-2 focus:ring-violet-500"
                       >
                          <option value="">-- Select Field --</option>
                          {resultFields.map(f => (
                            <option key={f.id} value={f.id}>{f.name} ({f.max_mark}mk)</option>
                          ))}
                       </select>
                       <p className="text-[10px] text-slate-400 mt-2 font-medium">Scores will be scaled to match this field's maximum marks.</p>
                    </div>

                    <button 
                      onClick={handlePreview}
                      disabled={!selectedExamId || !selectedFieldId || previewLoading}
                      className="w-full h-[52px] bg-slate-900 hover:bg-black text-white rounded-2xl text-xs font-black uppercase tracking-widest shadow-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                       {previewLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4 text-amber-400" />}
                       Preview Conversion
                    </button>
                 </div>
              </div>
           </div>

           {/* ── Step 2: Class Management & Execution ── */}
           <div className="lg:col-span-2 space-y-6">
              {selectedExamId ? (
                <div className={cardCls}>
                   <div className={headerCls}>
                      <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                         <Users className="h-4 w-4 text-violet-500" />
                         2. Class Exemptions
                      </h3>
                      <span className="text-[10px] font-black text-slate-400 bg-white px-3 py-1 rounded-full border border-slate-100 shadow-sm">
                         {examClasses.length} CLASSES TOTAL
                      </span>
                   </div>
                   <div className="p-0">
                      <table className="w-full">
                         <thead className="bg-slate-50/50 border-b border-slate-100">
                            <tr>
                               <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Class Arm</th>
                               <th className="px-6 py-4 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                               <th className="px-6 py-4 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">Actions</th>
                            </tr>
                         </thead>
                         <tbody className="divide-y divide-slate-50">
                            {examClasses.map(cls => (
                               <tr key={cls.id} className={`transition-colors ${exemptedIds.includes(cls.id) ? 'bg-slate-50/50 grayscale' : 'hover:bg-slate-50/30'}`}>
                                  <td className="px-6 py-4">
                                     <p className="font-bold text-slate-800 text-sm">{cls.student_class_name} {cls.class_section_name}</p>
                                     <p className="text-[10px] font-bold text-slate-400">{cls.student_count || 0} students</p>
                                  </td>
                                  <td className="px-6 py-4 text-center">
                                     {exemptedIds.includes(cls.id) ? (
                                       <span className="px-3 py-1 bg-red-50 text-red-600 text-[10px] font-black uppercase rounded-lg border border-red-100">Exempted</span>
                                     ) : (
                                       <span className="px-3 py-1 bg-emerald-50 text-emerald-600 text-[10px] font-black uppercase rounded-lg border border-emerald-100">Active</span>
                                     )}
                                  </td>
                                  <td className="px-6 py-4 text-right">
                                     <div className="flex items-center justify-end gap-4">
                                        <label className="flex items-center gap-2 cursor-pointer group">
                                           <span className="text-[10px] font-black text-slate-400 group-hover:text-slate-600 transition-colors uppercase">Scale Score</span>
                                           <div 
                                             onClick={() => toggleScale(cls.id, classOverrides[cls.id]?.scale ?? true)}
                                             className={`w-10 h-5 rounded-full p-1 transition-all ${ (classOverrides[cls.id]?.scale ?? true) ? 'bg-violet-600' : 'bg-slate-200' }`}
                                           >
                                              <div className={`w-3 h-3 bg-white rounded-full transition-all ${ (classOverrides[cls.id]?.scale ?? true) ? 'translate-x-5' : 'translate-x-0' }`} />
                                           </div>
                                        </label>
                                        <button 
                                          onClick={() => toggleExempt(cls.id)}
                                          className={`p-2 rounded-xl transition-all ${exemptedIds.includes(cls.id) ? 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100' : 'bg-red-50 text-red-500 hover:bg-red-100'}`}
                                        >
                                           {exemptedIds.includes(cls.id) ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                                        </button>
                                     </div>
                                  </td>
                               </tr>
                            ))}
                         </tbody>
                      </table>
                   </div>
                   <div className="p-8 bg-slate-900 border-t border-slate-800">
                      <div className="flex items-center justify-between mb-6">
                         <div className="text-white">
                            <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Final Confirmation</p>
                            <p className="text-sm font-bold opacity-80 leading-relaxed">
                               You are about to transfer scores for <span className="text-white underline decoration-violet-500 underline-offset-4">{selectedExam?.name}</span>.<br/>
                               Exempted: {exemptedIds.length} classes.
                            </p>
                         </div>
                         <div className="text-right">
                            <p className="text-3xl font-black text-white tracking-tighter">
                               {examClasses.length - exemptedIds.length}<span className="text-lg opacity-40 ml-1">/ {examClasses.length}</span>
                            </p>
                            <p className="text-[10px] font-black text-violet-400 uppercase tracking-widest">Classes to process</p>
                         </div>
                      </div>
                      <button 
                        onClick={handleExecute}
                        disabled={executing || (examClasses.length - exemptedIds.length) === 0}
                        className="w-full h-[64px] bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white rounded-2xl text-sm font-black uppercase tracking-[0.2em] shadow-2xl shadow-indigo-500/20 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
                      >
                         {executing ? <Loader2 className="h-5 w-5 animate-spin" /> : <RefreshCw className="h-5 w-5" />}
                         Execute Full Migration
                      </button>
                   </div>
                </div>
              ) : (
                <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-[2.5rem] p-20 text-center">
                   <div className="w-20 h-20 bg-white rounded-[2rem] flex items-center justify-center mx-auto mb-6 shadow-sm border border-slate-100">
                      <ArrowLeft className="h-8 w-8 text-slate-300" />
                   </div>
                   <h3 className="text-xl font-bold text-slate-900 mb-2">Select an exam to start</h3>
                   <p className="text-sm text-slate-500 font-medium max-w-xs mx-auto">Choose a published exam from the configuration panel to begin the transfer process.</p>
                </div>
              )}
           </div>
        </div>
      ) : (
        <div className={cardCls + " animate-in fade-in slide-in-from-bottom-4 duration-500"}>
           <div className={headerCls}>
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                 <History className="h-4 w-4 text-violet-500" />
                 Migration History
              </h3>
           </div>
           <div className="p-0">
              {historyLoading ? (
                <div className="p-20 text-center"><Loader2 className="h-8 w-8 animate-spin text-violet-500 mx-auto" /></div>
              ) : history.length === 0 ? (
                <div className="p-20 text-center text-slate-400 italic">No past transfers found.</div>
              ) : (
                <table className="w-full">
                   <thead className="bg-slate-50 border-b border-slate-100">
                      <tr>
                         <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Date</th>
                         <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Exam</th>
                         <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Result Field</th>
                         <th className="px-6 py-4 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest">Students</th>
                         <th className="px-6 py-4 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">Action</th>
                      </tr>
                   </thead>
                   <tbody className="divide-y divide-slate-50">
                      {history.map(h => (
                        <tr key={h.id} className="hover:bg-slate-50/50 transition-colors">
                           <td className="px-6 py-4 text-sm font-bold text-slate-600">
                              {new Date(h.last_transfer_date).toLocaleDateString()}
                           </td>
                           <td className="px-6 py-4">
                              <p className="font-bold text-slate-800 text-sm">{h.exam_name}</p>
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{h.exam_type}</p>
                           </td>
                           <td className="px-6 py-4 text-sm font-bold text-slate-700">
                              {h.result_field_name}
                           </td>
                           <td className="px-6 py-4 text-center">
                              <span className="px-3 py-1 bg-violet-50 text-violet-700 text-xs font-black rounded-lg border border-violet-100">
                                 {h.students_transferred}
                              </span>
                           </td>
                           <td className="px-6 py-4 text-right">
                              <button 
                                onClick={() => { setActiveTab('new'); handleExamSelect(h.exam); }}
                                className="p-2 text-slate-400 hover:text-violet-600 hover:bg-violet-50 rounded-xl transition-all"
                                title="Re-transfer"
                              >
                                 <RefreshCw className="h-4 w-4" />
                              </button>
                           </td>
                        </tr>
                      ))}
                   </tbody>
                </table>
              )}
           </div>
        </div>
      )}
    </div>
  );
}

// Stub for Missing Icons in imports
function XCircle(props: any) { return <X {...props} className="h-4 w-4 text-red-500" />; }

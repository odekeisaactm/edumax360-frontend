'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { scannedExamsAPI, academicAPI } from '@/lib/api';
import {
  ArrowLeft,
  ScanText,
  Upload,
  CheckCircle2,
  ChevronRight,
  ChevronDown,
  Users,
  Settings,
  BrainCircuit,
  Eye,
  FileText,
  Save,
  Loader2,
  AlertCircle,
  Clock,
  Search,
  Plus,
  Zap,
} from 'lucide-react';

// ─── Style constants ─────────────────────────────────────────────────────────

const tabCls = "flex-1 py-4 text-xs font-black uppercase tracking-[0.2em] border-b-2 transition-all";
const activeTabCls = "border-emerald-600 text-emerald-600 bg-emerald-50/30";
const inactiveTabCls = "border-transparent text-slate-400 hover:text-slate-600 hover:bg-slate-50";

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ScannedSchedulePage() {
  const router = useRouter();
  const params = useParams();
  const { user } = useAuth();
  
  const examId = Number(params.id);
  const scheduleId = Number(params.scheduleId);
  
  const [activeTab, setActiveTab] = useState<'setup' | 'submissions' | 'marking'>('setup');
  
  const [schedule, setSchedule] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Tab 1: Setup
  const [questionFiles, setQuestionFiles] = useState<File[]>([]);
  const [uploadingQuestions, setUploadingQuestions] = useState(false);
  const [questionStatus, setQuestionStatus] = useState<any | null>(null);
  const [pollingQuestions, setPollingQuestions] = useState(false);
  
  // Tab 2: Submissions
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [subsLoading, setSubmissionsLoading] = useState(false);
  
  // Tab 3: Marking
  const [markingSummary, setMarkingSummary] = useState<any | null>(null);
  const [executingMarking, setExecutingMarking] = useState(false);

  const fetchSchedule = useCallback(async () => {
    setLoading(true);
    try {
      const data = await scannedExamsAPI.getSchedule(scheduleId);
      setSchedule(data);
      
      // If questions are uploaded but not ready, start polling
      if (data.question_setup_status === 'uploaded') setPollingQuestions(true);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [scheduleId]);

  const fetchSubmissions = useCallback(async () => {
    setSubmissionsLoading(true);
    try {
      const [subs, stds] = await Promise.all([
        scannedExamsAPI.getSubmissions(scheduleId),
        academicAPI.listStudentClassHistory(schedule?.class_configuration || 0),
      ]);
      setSubmissions(subs);
      setStudents(stds);
    } catch (err) {
      console.error(err);
    } finally {
      setSubmissionsLoading(false);
    }
  }, [scheduleId, schedule?.class_configuration]);

  useEffect(() => { fetchSchedule(); }, [fetchSchedule]);

  useEffect(() => {
    if (activeTab === 'submissions') fetchSubmissions();
    if (activeTab === 'setup' && schedule?.question_setup_status !== 'pending') {
        scannedExamsAPI.getQuestionStatus(scheduleId).then(setQuestionStatus);
    }
  }, [activeTab, fetchSubmissions, scheduleId, schedule?.question_setup_status]);

  // Polling for questions
  useEffect(() => {
    if (!pollingQuestions) return;
    const interval = setInterval(async () => {
        try {
            const res = await scannedExamsAPI.getQuestionStatus(scheduleId);
            setQuestionStatus(res);
            if (res.setup_status === 'verified') {
                setPollingQuestions(false);
                fetchSchedule();
            }
        } catch (e) {}
    }, 3000);
    return () => clearInterval(interval);
  }, [pollingQuestions, scheduleId, fetchSchedule]);

  const handleQuestionUpload = async () => {
    if (questionFiles.length === 0) return;
    setUploadingQuestions(true);
    try {
      await scannedExamsAPI.uploadQuestionFile(scheduleId, questionFiles);
      setPollingQuestions(true);
      fetchSchedule();
    } catch (err) {
      alert('Failed to upload question file');
    } finally {
      setUploadingQuestions(false);
    }
  };

  const handleConfirmQuestions = async () => {
    try {
        await scannedExamsAPI.confirmQuestions(scheduleId);
        fetchSchedule();
    } catch (e) {
        alert('Failed to confirm questions');
    }
  };

  const handleMarkingStart = async () => {
    try {
        const res = await scannedExamsAPI.publishMarking(scheduleId);
        setMarkingSummary(res);
    } catch (e) {}
  };

  const handleExecuteMarking = async () => {
    setExecutingMarking(true);
    try {
        await scannedExamsAPI.publishMarking(scheduleId, true);
        alert('AI Marking has been initiated for all ready submissions.');
        fetchSchedule();
    } catch (e) {
        alert('Failed to start marking');
    } finally {
        setExecutingMarking(false);
    }
  };

  if (loading) return null;

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-20">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => router.back()} className="p-3 bg-white border border-slate-100 text-slate-400 hover:text-slate-900 rounded-2xl transition-all shadow-sm">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-xl font-black text-slate-900 tracking-tight uppercase">
               {schedule.subject_name} · {schedule.class_name} {schedule.section_name}
            </h1>
            <p className="text-slate-500 text-xs font-bold uppercase tracking-wider">{schedule.scanned_exam_name}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
           <div className={`px-4 py-2 rounded-xl border flex items-center gap-2 ${
             schedule.marking_status === 'completed' ? 'bg-emerald-50 border-emerald-100 text-emerald-600' : 'bg-slate-50 border-slate-100 text-slate-400'
           }`}>
              <BrainCircuit className="h-4 w-4" />
              <span className="text-[10px] font-black uppercase tracking-widest">
                 Marking: {schedule.marking_status}
              </span>
           </div>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden flex">
         <button onClick={() => setActiveTab('setup')} className={`${tabCls} ${activeTab === 'setup' ? activeTabCls : inactiveTabCls}`}>1. Question Setup</button>
         <button onClick={() => setActiveTab('submissions')} className={`${tabCls} ${activeTab === 'submissions' ? activeTabCls : inactiveTabCls}`}>2. Student Submissions</button>
         <button onClick={() => setActiveTab('marking')} className={`${tabCls} ${activeTab === 'marking' ? activeTabCls : inactiveTabCls}`}>3. AI Marking</button>
      </div>

      {/* ── Tab Content ── */}
      <div className="animate-in fade-in duration-300">
         {activeTab === 'setup' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-start">
               <div className="md:col-span-1 space-y-6">
                  <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm p-8 space-y-6">
                     <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                        <Upload className="h-4 w-4 text-emerald-500" />
                        Upload Paper
                     </h3>
                     <p className="text-xs text-slate-500 font-medium leading-relaxed">Scan the final question paper and upload it here. AI will extract questions and marks.</p>
                     
                     <div className="border-2 border-dashed border-slate-200 rounded-[1.5rem] p-8 text-center bg-slate-50/50">
                        <input type="file" multiple id="q-files" className="hidden" onChange={e => setQuestionFiles(Array.from(e.target.files || []))} />
                        <label htmlFor="q-files" className="cursor-pointer">
                           <FileText className="h-10 w-10 text-slate-200 mx-auto mb-3" />
                           <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Select PDF or Images</p>
                        </label>
                     </div>

                     {questionFiles.length > 0 && (
                        <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-100 flex items-center justify-between">
                           <span className="text-xs font-bold text-emerald-700">{questionFiles.length} files selected</span>
                           <button onClick={handleQuestionUpload} disabled={uploadingQuestions} className="px-4 py-1.5 bg-emerald-600 text-white rounded-lg text-[10px] font-black uppercase tracking-widest disabled:opacity-50">
                              {uploadingQuestions ? 'Uploading...' : 'Process Now'}
                           </button>
                        </div>
                     )}
                  </div>

                  {questionStatus?.clarity_score !== null && (
                    <div className="bg-slate-900 rounded-[2rem] p-8 text-center space-y-4">
                       <div className="relative w-24 h-24 mx-auto">
                          <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                             <circle cx="50" cy="50" r="45" fill="transparent" stroke="#1e293b" strokeWidth="10" />
                             <circle cx="50" cy="50" r="45" fill="transparent" stroke="#10b981" strokeWidth="10" strokeDasharray={`${questionStatus.clarity_score * 283} 283`} />
                          </svg>
                          <div className="absolute inset-0 flex flex-col items-center justify-center">
                             <span className="text-2xl font-black text-white leading-none">{Math.round(questionStatus.clarity_score * 100)}%</span>
                             <span className="text-[8px] font-black text-slate-400 uppercase tracking-tighter">Clarity</span>
                          </div>
                       </div>
                       <p className="text-xs font-bold text-slate-400">
                          {questionStatus.clarity_score >= 0.7 ? 'AI successfully verified extraction.' : 'Clarity low. Manual review required.'}
                       </p>
                    </div>
                  )}
               </div>

               <div className="md:col-span-2">
                  <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
                     <div className="px-8 py-4 border-b border-slate-50 bg-slate-50/30 flex items-center justify-between">
                        <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">Extracted Questions</h3>
                        {questionStatus?.questions?.length > 0 && schedule.question_setup_status !== 'ready' && (
                          <button onClick={handleConfirmQuestions} className="px-6 py-2 bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-black transition-all">
                             Confirm & Lock Questions
                          </button>
                        )}
                     </div>
                     <div className="p-8">
                        {pollingQuestions ? (
                           <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
                              <Loader2 className="h-12 w-12 text-emerald-500 animate-spin" />
                              <h4 className="text-lg font-black text-slate-900 uppercase tracking-tight">AI Vision Processing...</h4>
                              <p className="text-sm text-slate-400 font-medium max-w-xs mx-auto">Our specialized engine is analyzing your paper to extract question text and scoring rules.</p>
                           </div>
                        ) : !questionStatus?.questions?.length ? (
                           <div className="py-20 text-center text-slate-300 italic font-medium uppercase tracking-widest text-xs">No questions extracted yet</div>
                        ) : (
                           <div className="space-y-4">
                              {questionStatus.questions.map((q: any) => (
                                 <div key={q.id} className="p-4 border border-slate-100 rounded-2xl flex items-start gap-4 hover:border-emerald-200 transition-all">
                                    <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center font-black text-sm text-slate-600 shrink-0">{q.question_number}</div>
                                    <div className="flex-1">
                                       <p className="text-sm font-bold text-slate-700 leading-relaxed">{q.question_text}</p>
                                       <div className="flex items-center gap-3 mt-2">
                                          <span className="text-[10px] font-black text-slate-400 uppercase">Max Mark: {q.max_mark}</span>
                                          {q.ai_detected && <span className="flex items-center gap-1 text-[8px] font-black text-emerald-500 bg-emerald-50 px-1.5 py-0.5 rounded uppercase tracking-tighter"><Zap className="h-2 w-2" /> AI Extracted</span>}
                                       </div>
                                    </div>
                                    <button className="p-2 text-slate-300 hover:text-slate-600"><Settings className="h-4 w-4" /></button>
                                 </div>
                              ))}
                           </div>
                        )}
                     </div>
                  </div>
               </div>
            </div>
         )}

         {activeTab === 'submissions' && (
            <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
               <div className="px-8 py-6 border-b border-slate-50 flex items-center justify-between bg-slate-50/30">
                  <div className="flex items-center gap-6">
                     <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">Student Submissions</h3>
                     <div className="h-8 w-px bg-slate-200" />
                     <div className="flex items-center gap-2">
                        <span className="text-2xl font-black text-slate-900">{submissions.length}</span>
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">/ {students.length} UPLOADED</span>
                     </div>
                  </div>
                  <button className="h-[42px] px-6 bg-emerald-600 text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100 flex items-center gap-2">
                     <Upload className="h-4 w-4" /> Bulk Upload Sheets
                  </button>
               </div>
               <div className="overflow-x-auto">
                  <table className="w-full">
                     <thead className="bg-slate-50/50 border-b border-slate-100">
                        <tr>
                           <th className="px-8 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Student Details</th>
                           <th className="px-8 py-4 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest">Upload Status</th>
                           <th className="px-8 py-4 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest">AI Marking</th>
                           <th className="px-8 py-4 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">Action</th>
                        </tr>
                     </thead>
                     <tbody className="divide-y divide-slate-50">
                        {students.map(std => {
                           const sub = submissions.find(s => s.student === std.id);
                           return (
                             <tr key={std.id} className="hover:bg-slate-50/30 transition-colors">
                                <td className="px-8 py-5">
                                   <p className="font-black text-slate-800 text-sm">{std.first_name} {std.last_name}</p>
                                   <p className="text-[10px] font-bold text-slate-400">{std.registration_number}</p>
                                </td>
                                <td className="px-8 py-5 text-center">
                                   {sub ? (
                                     <span className="px-3 py-1 bg-emerald-50 text-emerald-600 text-[10px] font-black uppercase rounded-lg border border-emerald-100">Uploaded</span>
                                   ) : (
                                     <span className="px-3 py-1 bg-slate-50 text-slate-400 text-[10px] font-black uppercase rounded-lg border border-slate-100">Pending</span>
                                   )}
                                </td>
                                <td className="px-8 py-5 text-center">
                                   {sub ? (
                                      <span className={`px-3 py-1 text-[10px] font-black uppercase rounded-lg border ${
                                         sub.ai_marking_status === 'completed' ? 'bg-blue-50 text-blue-600 border-blue-100' : 'bg-amber-50 text-amber-600 border-amber-100'
                                      }`}>
                                         {sub.ai_marking_status}
                                      </span>
                                   ) : '—'}
                                </td>
                                <td className="px-8 py-5 text-right">
                                   <button className="p-2 bg-slate-50 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all">
                                      <Upload className="h-4 w-4" />
                                   </button>
                                </td>
                             </tr>
                           );
                        })}
                     </tbody>
                  </table>
               </div>
            </div>
         )}

         {activeTab === 'marking' && (
            <div className="max-w-2xl mx-auto space-y-8 py-10">
               <div className="bg-slate-900 rounded-[2.5rem] p-10 text-center space-y-8 shadow-2xl">
                  <div className="w-20 h-20 bg-emerald-500 rounded-[2rem] flex items-center justify-center mx-auto shadow-2xl shadow-emerald-500/20">
                     <BrainCircuit className="h-10 w-10 text-white" />
                  </div>
                  <div className="space-y-2">
                     <h3 className="text-2xl font-black text-white uppercase tracking-tight">AI Grading Center</h3>
                     <p className="text-slate-400 text-sm font-medium max-w-sm mx-auto">Finalize all student submissions and initiate the mass AI marking process.</p>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                     <div className="bg-white/5 rounded-2xl p-6 border border-white/10">
                        <p className="text-3xl font-black text-white">{submissions.length}</p>
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-1">Ready Sheets</p>
                     </div>
                     <div className="bg-white/5 rounded-2xl p-6 border border-white/10">
                        <p className="text-3xl font-black text-white">{schedule.total_marks}</p>
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-1">Max Marks</p>
                     </div>
                  </div>

                  <button 
                    onClick={handleMarkingStart}
                    disabled={schedule.marking_status === 'processing' || submissions.length === 0}
                    className="w-full py-5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl text-xs font-black uppercase tracking-[0.2em] transition-all transform active:scale-95 shadow-xl shadow-emerald-500/20 disabled:opacity-50"
                  >
                     {schedule.marking_status === 'processing' ? 'Processing...' : 'Initialize AI Grading'}
                  </button>
               </div>

               {markingSummary && (
                 <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm p-8 space-y-6 animate-in zoom-in-95 duration-500">
                    <div className="flex items-center justify-between">
                       <h4 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                          Ready for Deployment
                       </h4>
                    </div>
                    <div className="p-4 bg-slate-50 rounded-2xl space-y-3">
                       <div className="flex justify-between text-xs font-bold">
                          <span className="text-slate-500">Total Students</span>
                          <span className="text-slate-900">{markingSummary.total_students}</span>
                       </div>
                       <div className="flex justify-between text-xs font-bold text-emerald-600">
                          <span>Successfully Uploaded</span>
                          <span>{markingSummary.uploaded}</span>
                       </div>
                       <div className="flex justify-between text-xs font-bold text-red-500">
                          <span>Missing Submissions</span>
                          <span>{markingSummary.not_uploaded}</span>
                       </div>
                    </div>
                    <button 
                      onClick={handleExecuteMarking}
                      disabled={executingMarking}
                      className="w-full py-4 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] hover:bg-black transition-all"
                    >
                       {executingMarking ? 'Marking...' : 'Execute Marking Now'}
                    </button>
                 </div>
               )}
            </div>
         )}
      </div>
    </div>
  );
}

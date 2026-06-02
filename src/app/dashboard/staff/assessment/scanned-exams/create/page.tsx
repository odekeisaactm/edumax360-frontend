'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { 
  scannedExamsAPI, 
  academicCalendarAPI, 
  academicAPI 
} from '@/lib/api';
import {
  ArrowLeft,
  Save,
  Loader2,
  ScanText,
  Calendar,
  Layers,
  BookOpen,
  CheckCircle2,
} from 'lucide-react';

// ─── Style constants ─────────────────────────────────────────────────────────

const labelCls = "block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2";
const inputCls = "w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold outline-none focus:ring-2 focus:ring-emerald-500 transition-all";

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function CreateScannedExamPage() {
  const router = useRouter();
  const { user } = useAuth();
  
  const [sessions, setSessions] = useState<any[]>([]);
  const [periods, setPeriods] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  
  const [formData, setFormData] = useState({
    name: '',
    session: '',
    term: '',
    total_marks: '100',
    classes: [] as number[],
    subjects: [] as number[],
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [sess, cls, sub] = await Promise.all([
        academicCalendarAPI.listSessions(),
        academicAPI.listClasses(),
        academicAPI.listSubjects(),
      ]);
      setSessions(sess);
      setClasses(cls);
      setSubjects(sub);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSessionChange = async (sessionId: number) => {
    setFormData({ ...formData, session: sessionId.toString(), term: '' });
    try {
      const res = await academicCalendarAPI.listSessionPeriods(sessionId);
      setPeriods(res);
    } catch (e) {}
  };

  const toggleItem = (list: number[], id: number) => 
    list.includes(id) ? list.filter(x => x !== id) : [...list, id];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.classes.length === 0 || formData.subjects.length === 0) {
        alert('Please select at least one class and one subject');
        return;
    }

    setSaving(true);
    try {
      const res = await scannedExamsAPI.create(formData);
      // Auto-create schedules
      await scannedExamsAPI.createSchedules(res.id);
      router.push(`/dashboard/staff/assessment/scanned-exams/${res.id}`);
    } catch (err) {
      alert('Failed to create exam');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Loader2 className="h-10 w-10 text-emerald-500 animate-spin" />
        <p className="text-sm font-black text-slate-400 uppercase tracking-widest">Preparing engine...</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-20 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* ── Header ── */}
      <div className="flex items-center gap-4">
        <button 
          onClick={() => router.back()}
          className="p-3 bg-white border border-slate-100 text-slate-400 hover:text-slate-900 rounded-2xl transition-all shadow-sm"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight uppercase">New Scanned Exam</h1>
          <p className="text-slate-500 text-sm font-medium">Configure paper-based exam for AI processing</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-8">
         {/* ── Left Column: Basic Info ── */}
         <div className="space-y-6">
            <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-xl shadow-slate-200/40 p-8 space-y-6">
               <div>
                  <label className={labelCls}>Exam Name</label>
                  <input 
                    type="text" 
                    required 
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    className={inputCls}
                    placeholder="e.g., 2026 First Term Mock Exam"
                  />
               </div>

               <div className="grid grid-cols-2 gap-4">
                  <div>
                     <label className={labelCls}>Academic Session</label>
                     <select 
                       required 
                       value={formData.session}
                       onChange={e => handleSessionChange(Number(e.target.value))}
                       className={inputCls}
                     >
                        <option value="">-- Select --</option>
                        {sessions.map(s => (
                          <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                     </select>
                  </div>
                  <div>
                     <label className={labelCls}>Academic Term</label>
                     <select 
                       required 
                       value={formData.term}
                       disabled={!formData.session}
                       onChange={e => setFormData({ ...formData, term: e.target.value })}
                       className={inputCls}
                     >
                        <option value="">-- Select --</option>
                        {periods.map(p => (
                          <option key={p.id} value={p.id}>{p.period_name}</option>
                        ))}
                     </select>
                  </div>
               </div>

               <div>
                  <label className={labelCls}>Total Marks per Subject</label>
                  <input 
                    type="number" 
                    required 
                    value={formData.total_marks}
                    onChange={e => setFormData({ ...formData, total_marks: e.target.value })}
                    className={inputCls}
                  />
               </div>
            </div>

            <button 
              type="submit"
              disabled={saving}
              className="w-full h-[64px] bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-3xl text-sm font-black uppercase tracking-[0.2em] shadow-2xl shadow-emerald-500/20 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
            >
               {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
               Initialize Scanned Exam
            </button>
         </div>

         {/* ── Right Column: Targets ── */}
         <div className="space-y-6">
            <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-xl shadow-slate-200/40 p-8 space-y-8">
               <div className="space-y-4">
                  <div className="flex items-center justify-between">
                     <label className={labelCls}>Target Classes</label>
                     <span className="text-[10px] font-black text-emerald-500 bg-emerald-50 px-2 py-0.5 rounded-full">{formData.classes.length} selected</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto pr-2 custom-scrollbar">
                     {classes.map(c => (
                        <button 
                          key={c.id}
                          type="button"
                          onClick={() => setFormData({ ...formData, classes: toggleItem(formData.classes, c.id) })}
                          className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all ${formData.classes.includes(c.id) ? 'bg-emerald-600 border-emerald-600 text-white shadow-lg shadow-emerald-100' : 'bg-slate-50 border-slate-50 text-slate-500 hover:bg-slate-100'}`}
                        >
                           {c.name}
                        </button>
                     ))}
                  </div>
               </div>

               <div className="space-y-4">
                  <div className="flex items-center justify-between">
                     <label className={labelCls}>Target Subjects</label>
                     <span className="text-[10px] font-black text-emerald-500 bg-emerald-50 px-2 py-0.5 rounded-full">{formData.subjects.length} selected</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                     {subjects.map(s => (
                        <button 
                          key={s.id}
                          type="button"
                          onClick={() => setFormData({ ...formData, subjects: toggleItem(formData.subjects, s.id) })}
                          className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all ${formData.subjects.includes(s.id) ? 'bg-emerald-600 border-emerald-600 text-white shadow-lg shadow-emerald-100' : 'bg-slate-50 border-slate-50 text-slate-500 hover:bg-slate-100'}`}
                        >
                           {s.name}
                        </button>
                     ))}
                  </div>
               </div>
            </div>
         </div>
      </form>
    </div>
  );
}

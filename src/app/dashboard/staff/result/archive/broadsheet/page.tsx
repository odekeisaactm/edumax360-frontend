'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { api, resultViewAPI } from '@/lib/api';
import { 
  Columns, Search, Loader2, ArrowLeft, Download, Printer, Filter, Calendar, History, Layers, GraduationCap, Box, User, X, AlertCircle, CheckCircle2, AlertTriangle
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

let _toastId = 0;
interface ToastItem { id: number; type: 'success' | 'error' | 'warn'; message: string; }

function ToastStack({ toasts, onDismiss }: { toasts: ToastItem[]; onDismiss: (id: number) => void }) {
  return (
    <div className="fixed top-4 right-4 z-[70] flex flex-col gap-2 pointer-events-none">
      {toasts.map(t => (
        <div key={t.id} className={`pointer-events-auto flex items-start gap-3 px-4 py-3 rounded-xl shadow-lg border max-w-sm
          ${t.type === 'success' ? 'bg-green-50 border-green-200 text-green-900'
          : t.type === 'warn' ? 'bg-amber-50 border-amber-200 text-amber-900'
          : 'bg-red-50 border-red-200 text-red-900'}`}>
          {t.type === 'success' ? <CheckCircle2 className="h-4 w-4 flex-shrink-0 mt-0.5 text-green-600" />
          : t.type === 'warn' ? <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5 text-amber-500" />
          : <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5 text-red-500" />}
          <p className="text-sm font-medium flex-1 leading-snug">{t.message}</p>
          <button onClick={() => onDismiss(t.id)} className="opacity-50 hover:opacity-100 ml-2 flex-shrink-0">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}

// --- Shared Utility ---
const StudentSearch = ({ onSelect, placeholder = "Search student..." }: { onSelect: (s: any) => void, placeholder?: string }) => {
  const [query, setQuery] = useState('');
  const [results, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSearch = async (val: string) => {
    setQuery(val);
    if (val.length < 3) {
      setSearchResults([]);
      setShowDropdown(false);
      return;
    }
    setIsSearching(true);
    setShowDropdown(true);
    try {
      const res = await api.get('/api/student/students/', { params: { search: val } });
      const list = res.data.results?.data || res.data.data?.results || res.data.results || res.data.data || [];
      setSearchResults(Array.isArray(list) ? list : []);
    } catch (e) {
      console.error(e);
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className="relative w-full" ref={searchRef}>
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          value={query}
          onChange={e => handleSearch(e.target.value)}
          onFocus={() => query.length >= 3 && setShowDropdown(true)}
          placeholder={placeholder}
          className="w-full pl-11 pr-10 py-3 bg-white border border-slate-200 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-indigo-500 transition-all shadow-sm font-bold text-slate-700"
        />
        {query && (
          <button onClick={() => { setQuery(''); setSearchResults([]); setShowDropdown(false); }} className="absolute right-4 top-1/2 -translate-y-1/2">
            <X className="w-4 h-4 text-slate-400 hover:text-slate-600" />
          </button>
        )}
      </div>
      {showDropdown && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl border border-slate-100 shadow-xl z-[60] overflow-hidden max-h-80 overflow-y-auto animate-in fade-in slide-in-from-top-2">
          {isSearching ? (
            <div className="p-8 text-center text-slate-400"><Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" /> Searching...</div>
          ) : results.length > 0 ? (
            <div className="divide-y divide-slate-50">
              {results.map(s => (
                <button
                  key={s.id}
                  onClick={() => { onSelect(s); setQuery(s.full_name || `${s.first_name} ${s.last_name}`); setShowDropdown(false); }}
                  className="w-full flex items-center gap-3 p-4 text-left hover:bg-slate-50 transition-colors"
                >
                  <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center font-bold text-slate-500 overflow-hidden">
                    {s.image_url ? <img src={s.image_url} className="w-full h-full object-cover" /> : (s.full_name?.[0] || '')}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-800">{s.full_name || `${s.first_name} ${s.last_name}`}</p>
                    <p className="text-xs text-slate-500">{s.registration_number} · {s.current_class_name || 'No Class'}</p>
                  </div>
                </button>
              ))}
            </div>
          ) : <div className="p-8 text-center text-slate-400 font-medium">No students found.</div>}
        </div>
      )}
    </div>
  );
};

export default function BroadsheetArchivePage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'cumulative' | 'broadsheet'>('broadsheet');

  const [options, setOptions] = useState({
    sessions: [] as any[],
    periods: [] as any[],
    schoolSections: [] as any[],
    classLevels: [] as any[],
    classSections: [] as any[],
    classConfigs: [] as any[],
  });

  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const showToast = (type: 'success' | 'error' | 'warn', message: string) => {
    const id = ++_toastId;
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 5000);
  };

  useEffect(() => {
    const fetchOptions = async () => {
      try {
        const [sessRes, perRes, schSecRes, classLvlRes, classSecRes, classConfRes, currSessRes, currPerRes] = await Promise.all([
          api.get('/api/school/sessions/'),
          api.get('/api/school/session-periods/'),
          api.get('/api/school/sections/'),
          api.get('/api/academic/classes/'),
          api.get('/api/academic/class-sections/'),
          api.get('/api/academic/class-configurations/'),
          api.get('/api/school/sessions/current/'),
          api.get('/api/school/session-periods/current/')
        ]);
        setOptions({
          sessions: sessRes.data.data?.results || sessRes.data.data || [],
          periods: perRes.data.data?.results || perRes.data.data || [],
          schoolSections: schSecRes.data.data?.results || schSecRes.data.data || [],
          classLevels: classLvlRes.data.data?.results || classLvlRes.data.data || [],
          classSections: classSecRes.data.data?.results || classSecRes.data.data || [],
          classConfigs: classConfRes.data.data?.results || classConfRes.data.data || [],
        });
        
        // Default filters
        const curSessId = currSessRes.data.data?.id;
        const curPerId = currPerRes.data.data?.id;
        setBsFilters(prev => ({
          ...prev,
          session_id: curSessId ? String(curSessId) : prev.session_id,
          period_id: curPerId ? String(curPerId) : prev.period_id,
        }));
        setCumFilters(prev => ({
          ...prev,
          session_id: curSessId ? String(curSessId) : prev.session_id,
        }));
      } catch (err) {
        console.error('Failed to load filter options', err);
      }
    };
    fetchOptions();
  }, []);

  // --- CUMULATIVE TAB STATE ---
  const [cumFilters, setCumFilters] = useState({ student_id: '', session_id: '' });
  const [cumLoading, setCumLoading] = useState(false);
  const [cumData, setCumData] = useState<any>(null);
  const [selectedStudent, setSelectedStudent] = useState<any>(null);

  // --- BROADSHEET TAB STATE ---
  const [bsFilters, setBsFilters] = useState({
    session_id: '', period_id: '', school_section_id: '',
    class_level_id: '', class_section_id: '', class_config_id: '', mode: 'term'
  });
  const [bsLoading, setBsLoading] = useState(false);
  const [bsData, setBsData] = useState<any>(null);

  useEffect(() => {
    if (bsFilters.class_level_id) {
      const config = options.classConfigs.find(c => 
        String(c.student_class) === bsFilters.class_level_id && 
        (bsFilters.class_section_id ? String(c.class_section) === bsFilters.class_section_id : true)
      );
      setBsFilters(prev => ({ ...prev, class_config_id: config ? String(config.id) : '' }));
    }
  }, [bsFilters.class_level_id, bsFilters.class_section_id, options.classConfigs]);

  const fetchCumulative = async (student: any) => {
    if (!cumFilters.session_id) { showToast('warn', "Select session first"); return; }
    setCumLoading(true);
    setCumData(null);
    setSelectedStudent(student);
    try {
      const historyRes = await api.get('/api/result/archive/student-history/', { params: { student_id: student.id } });
      const record = historyRes.data.find((r: any) => r.session_id === Number(cumFilters.session_id));
      if (!record) { showToast('warn', "No results found for this student in the selected session."); setCumLoading(false); return; }
      
      const res = await resultViewAPI.cumulative({
        student_id: student.id,
        session_id: Number(cumFilters.session_id),
        class_config_id: record.class_config_id || 1
      });
      setCumData(res);
    } catch (err) { showToast('error', "Failed to load cumulative data."); } finally { setCumLoading(false); }
  };

  const fetchBroadsheet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bsFilters.session_id || !bsFilters.class_config_id) { showToast('warn', "Session and Class selection required"); return; }
    setBsLoading(true);
    setBsData(null);
    try {
      if (bsFilters.mode === 'term') {
        if (!bsFilters.period_id) { showToast('warn', "Term is required for Term Broadsheet"); setBsLoading(false); return; }
        const res = await resultViewAPI.fullClassSpreadsheet({
          class_config_id: Number(bsFilters.class_config_id),
          period_id: Number(bsFilters.period_id),
        });
        setBsData({ ...res, is_session: false });
      } else {
        const res = await resultViewAPI.sessionBroadsheet({
          class_config_id: Number(bsFilters.class_config_id),
          session_id: Number(bsFilters.session_id),
        });
        setBsData({ ...res, is_session: true });
      }
    } catch (err) { showToast('error', "Failed to load broadsheet."); } finally { setBsLoading(false); }
  };

  const downloadPDF = () => {
    if (!bsData) return;
    const doc = new jsPDF('landscape');
    const tableColumn = ["S/N", "Adm No", "Student Name", ...Object.values(bsData.rows[0]?.subjects || {}).map((s:any) => s.name?.substring(0, 3).toUpperCase()), "Total", "Average", "Pos"];
    const tableRows = bsData.rows.map((row: any, i: number) => [
        i + 1, row.reg_number, row.student_name, 
        ...Object.values(row.subjects || {}).map((s:any) => s.total || '-'),
        bsData.is_session ? row.overall_total : row.total_score,
        `${bsData.is_session ? row.overall_average : row.average_score}%`,
        row.position || '-'
    ]);
    doc.text(`${bsData.class_name} Broadsheet - ${bsData.is_session ? bsData.session_name : bsData.period_name}`, 14, 15);
    autoTable(doc, { head: [tableColumn], body: tableRows, startY: 20, styles: { fontSize: 8 } });
    doc.save(`Broadsheet_${bsData.class_name}.pdf`);
  };

  const downloadExcel = () => {
    if (!bsData) return;
    const wsData = bsData.rows.map((row: any, i: number) => {
      const rowData: any = { "S/N": i + 1, "Admission No": row.reg_number, "Student Name": row.student_name };
      Object.values(row.subjects || {}).forEach((s: any) => { rowData[s.name || 'Unknown'] = s.total || '-'; });
      rowData["Total"] = bsData.is_session ? row.overall_total : row.total_score;
      rowData["Average"] = `${bsData.is_session ? row.overall_average : row.average_score}%`;
      rowData["Position"] = row.position || '-';
      return rowData;
    });
    const ws = XLSX.utils.json_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Broadsheet");
    XLSX.writeFile(wb, `Broadsheet_${bsData.class_name}.xlsx`);
  };

  const filteredClasses = bsFilters.school_section_id 
    ? options.classLevels.filter(c => String(c.school_section) === bsFilters.school_section_id)
    : options.classLevels;

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-20 px-4">
      <ToastStack toasts={toasts} onDismiss={id => setToasts(prev => prev.filter(t => t.id !== id))} />

      <div className="flex items-center justify-between mt-4">
        <div className="flex items-center gap-4">
          <button onClick={() => router.back()} className="p-2 hover:bg-slate-100 rounded-full text-slate-500 transition-colors"><ArrowLeft className="w-5 h-5" /></button>
          <div className="w-12 h-12 bg-indigo-600 rounded-[1.25rem] flex items-center justify-center shadow-2xl shadow-indigo-200 transform -rotate-3"><Columns className="w-6 h-6 text-white" /></div>
          <div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight uppercase">Master Broadsheets</h1>
            <p className="text-sm text-slate-500 font-bold tracking-tight">Generate comprehensive session and term academic reports</p>
          </div>
        </div>
      </div>

      <div className="bg-white p-2 rounded-2xl border border-slate-100 flex flex-wrap shadow-sm w-max">
        <button onClick={() => setActiveTab('broadsheet')} className={`flex items-center gap-2 px-8 py-3 rounded-xl text-sm font-black transition-all ${activeTab === 'broadsheet' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-50'}`}>Class Broadsheet</button>
        <button onClick={() => setActiveTab('cumulative')} className={`flex items-center gap-2 px-8 py-3 rounded-xl text-sm font-black transition-all ${activeTab === 'cumulative' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-50'}`}>Student Cumulative</button>
      </div>

      {activeTab === 'broadsheet' && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
          <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-xl shadow-slate-200/40">
            <form onSubmit={fetchBroadsheet} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 items-end">
              <div className="space-y-1.5">
                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-1.5"><Layers className="w-3 h-3" /> Report Mode</label>
                 <select value={bsFilters.mode} onChange={e => setBsFilters({...bsFilters, mode: e.target.value})} className="w-full border border-slate-200 rounded-2xl px-4 py-3 text-sm font-bold bg-slate-50 outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-slate-700"><option value="term">Single Term</option><option value="session">Full Session</option></select>
              </div>
              <div className="space-y-1.5">
                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-1.5"><Calendar className="w-3 h-3" /> Session</label>
                 <select value={bsFilters.session_id} onChange={e => setBsFilters({...bsFilters, session_id: e.target.value})} className="w-full border border-slate-200 rounded-2xl px-4 py-3 text-sm font-bold bg-slate-50 outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-slate-700" required><option value="">Select Session</option>{options.sessions?.map(s => <option key={s.id} value={s.id}>{s.name || `${s.start_year}/${s.end_year}`}</option>)}</select>
              </div>
              {bsFilters.mode === 'term' && (
                <div className="space-y-1.5">
                   <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-1.5"><History className="w-3 h-3" /> Term</label>
                   <select value={bsFilters.period_id} onChange={e => setBsFilters({...bsFilters, period_id: e.target.value})} className="w-full border border-slate-200 rounded-2xl px-4 py-3 text-sm font-bold bg-slate-50 outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-slate-700" required><option value="">Select Term</option>{options.periods?.map(p => <option key={p.id} value={p.id}>{p.period?.name || p.name}</option>)}</select>
                </div>
              )}
              <div className="space-y-1.5">
                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-1.5"><Layers className="w-3 h-3" /> Sch. Section</label>
                 <select value={bsFilters.school_section_id} onChange={e => setBsFilters({...bsFilters, school_section_id: e.target.value, class_level_id: ''})} className="w-full border border-slate-200 rounded-2xl px-4 py-3 text-sm font-bold bg-slate-50 outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-slate-700"><option value="">Any Section</option>{options.schoolSections?.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
              </div>
              <div className="space-y-1.5">
                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-1.5"><GraduationCap className="w-3 h-3" /> Class Level</label>
                 <select value={bsFilters.class_level_id} onChange={e => setBsFilters({...bsFilters, class_level_id: e.target.value})} className="w-full border border-slate-200 rounded-2xl px-4 py-3 text-sm font-bold bg-slate-50 outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-slate-700" required><option value="">Select Class</option>{filteredClasses?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
              </div>
              <div className="space-y-1.5">
                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-1.5"><Box className="w-3 h-3" /> Class Arm</label>
                 <select value={bsFilters.class_section_id} onChange={e => setBsFilters({...bsFilters, class_section_id: e.target.value})} className="w-full border border-slate-200 rounded-2xl px-4 py-3 text-sm font-bold bg-slate-50 outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-slate-700"><option value="">All Arms</option>{options.classSections?.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
              </div>
              <div className="md:col-span-1 lg:col-span-1">
                 <button type="submit" disabled={bsLoading || !bsFilters.class_config_id} className="w-full h-[52px] bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-sm font-black shadow-xl shadow-indigo-200 transition-all flex items-center justify-center gap-2 transform active:scale-95 disabled:opacity-50 disabled:shadow-none">{bsLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />} GENERATE</button>
              </div>
            </form>
          </div>
          {bsData && (
            <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-2xl shadow-slate-200/40 overflow-hidden animate-in fade-in slide-in-from-bottom-6">
              <div className="px-8 py-6 bg-slate-50 border-b border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4">
                <div>
                  <h3 className="font-black text-slate-900 text-xl tracking-tight uppercase">Class Broadsheet - {bsData.class_name}</h3>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Session: {bsData.session_name} {bsData.is_session ? '' : `| Term: ${bsData.period_name}`}</p>
                </div>
                <div className="flex gap-3">
                  <button onClick={downloadExcel} className="flex items-center gap-2 px-6 py-2.5 bg-white border border-slate-200 text-emerald-600 hover:bg-emerald-50 hover:border-emerald-200 rounded-xl text-xs font-black uppercase transition-all shadow-sm"><Download className="w-4 h-4" /> Excel</button>
                  <button onClick={downloadPDF} className="flex items-center gap-2 px-6 py-2.5 bg-white border border-slate-200 text-rose-600 hover:bg-rose-50 hover:border-rose-200 rounded-xl text-xs font-black uppercase transition-all shadow-sm"><Printer className="w-4 h-4" /> PDF Report</button>
                </div>
              </div>
              <div className="overflow-x-auto pb-10">
                <table className="w-full text-center text-sm border-collapse">
                  <thead className="bg-slate-900 text-white">
                    <tr>
                      <th className="px-4 py-5 font-black uppercase tracking-widest text-[10px]">S/N</th>
                      <th className="px-4 py-5 font-black uppercase tracking-widest text-[10px] text-left">Adm No</th>
                      <th className="px-6 py-5 font-black uppercase tracking-widest text-[10px] text-left">Student Name</th>
                      {Object.values(bsData.rows[0]?.subjects || {}).map((s: any) => (<th key={s.name} className="px-3 py-5 font-black uppercase tracking-widest text-[10px] border-l border-slate-800">{s.name?.substring(0, 3)}</th>))}
                      <th className="px-4 py-5 font-black uppercase tracking-widest text-[10px] bg-slate-800 border-l border-slate-700">Total</th>
                      <th className="px-4 py-5 font-black uppercase tracking-widest text-[10px] bg-slate-800 border-l border-slate-700">Avg</th>
                      <th className="px-4 py-5 font-black uppercase tracking-widest text-[10px] bg-slate-800 border-l border-slate-700">Pos</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {bsData.rows.map((row: any, i: number) => { 
                      const valTotal = bsData.is_session ? row.overall_total : row.total_score; 
                      const valAvg = bsData.is_session ? row.overall_average : row.average_score; 
                      return (
                        <tr key={row.student_id} className="hover:bg-slate-50 transition-colors group">
                          <td className="px-4 py-5 text-slate-400 font-bold">{i + 1}</td>
                          <td className="px-4 py-5 text-left font-black text-[10px] text-slate-400 uppercase tracking-tighter">{row.reg_number}</td>
                          <td className="px-6 py-5 text-left font-black text-slate-800 whitespace-nowrap group-hover:text-indigo-600 transition-colors">{row.student_name}</td>
                          {Object.values(row.subjects || {}).map((s: any, idx: number) => (<td key={idx} className="px-3 py-5 text-slate-600 font-bold border-l border-slate-50">{s.total ?? '-'}</td>))}
                          <td className="px-4 py-5 font-black text-indigo-700 bg-indigo-50/20 border-l border-slate-50">{valTotal ?? '-'}</td>
                          <td className="px-4 py-5 font-black text-emerald-700 bg-emerald-50/20 border-l border-slate-50">{valAvg ? `${valAvg}%` : '-'}</td>
                          <td className="px-4 py-5 font-black text-slate-500 border-l border-slate-50">{row.position ?? '-'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'cumulative' && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
          <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-xl shadow-slate-200/40 grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-1.5"><Calendar className="w-3 h-3" /> Session</label>
              <select value={cumFilters.session_id} onChange={e => setCumFilters({...cumFilters, session_id: e.target.value})} className="w-full border border-slate-200 rounded-2xl px-4 py-3 text-sm font-bold bg-slate-50 outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-slate-700" required>
                <option value="">Select Session</option>
                {options.sessions.map(s => <option key={s.id} value={s.id}>{s.name || `${s.start_year}/${s.end_year}`}</option>)}
              </select>
            </div>
            <div className="md:col-span-2 space-y-1.5">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-1.5"><Search className="w-3 h-3" /> Search Student</label>
              <StudentSearch onSelect={fetchCumulative} placeholder="Find student for session cumulative..." />
            </div>
          </div>
          {cumLoading && <div className="h-64 flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-slate-400" /></div>}
          {cumData && !cumLoading && (
            <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-2xl shadow-slate-200/40 overflow-hidden p-10 animate-in fade-in slide-in-from-bottom-6">
              <div className="flex flex-col items-center text-center mb-12">
                <div className="w-24 h-24 rounded-[2rem] bg-indigo-600 flex items-center justify-center text-4xl font-black text-white shadow-2xl shadow-indigo-200 mb-6 uppercase overflow-hidden border-4 border-indigo-50">
                  {(selectedStudent?.image_url || selectedStudent?.image) ? <img src={selectedStudent.image_url || selectedStudent.image} className="w-full h-full object-cover" /> : cumData.student_name?.[0]}
                </div>
                <h2 className="text-3xl font-black text-slate-900 uppercase tracking-tight">{cumData.student_name}</h2>
                <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mt-2 bg-slate-50 px-4 py-1.5 rounded-full border border-slate-100">Cumulative Record · {cumData.session_name}</p>
              </div>
              <div className="overflow-x-auto pb-6">
                <table className="w-full text-center text-sm">
                  <thead className="bg-slate-50 text-slate-400 border-b border-slate-100">
                    <tr>
                      <th className="px-6 py-5 font-black uppercase tracking-widest text-[10px] text-left">Subject Area</th>
                      {cumData.periods?.map((p: any) => (<th key={p.order} className="px-4 py-5 font-black uppercase tracking-widest text-[10px]">{p.name}</th>))}
                      <th className="px-4 py-5 font-black uppercase tracking-widest text-[10px] bg-indigo-50/50 text-indigo-600">Total</th>
                      <th className="px-4 py-5 font-black uppercase tracking-widest text-[10px] bg-emerald-50/50 text-emerald-600">Avg</th>
                      <th className="px-4 py-5 font-black uppercase tracking-widest text-[10px]">Grade</th>
                      <th className="px-6 py-5 font-black uppercase tracking-widest text-[10px] text-left">Academic Remark</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {Object.values(cumData.subjects || {}).map((s: any, idx: number) => (
                      <tr key={idx} className="hover:bg-slate-50/50 transition-colors group">
                        <td className="px-6 py-5 font-black text-slate-800 text-left group-hover:text-indigo-600 transition-colors">{s.name}</td>
                        {cumData.periods?.map((p: any) => (<td key={p.order} className="px-4 py-5 font-bold text-slate-500">{s.terms[p.name] ?? '-'}</td>))}
                        <td className="px-4 py-5 font-black text-indigo-600 bg-indigo-50/10">{s.total}</td>
                        <td className="px-4 py-5 font-black text-emerald-600 bg-emerald-50/10">{s.average}%</td>
                        <td className="px-4 py-5"><div className="inline-block px-3 py-1 bg-slate-100 text-slate-600 rounded-lg text-[10px] font-black uppercase">{s.grade}</div></td>
                        <td className="px-6 py-5 text-slate-400 text-xs font-bold text-left italic">"{s.remark}"</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-slate-900 text-white font-black uppercase">
                    <tr>
                      <td colSpan={cumData.periods?.length + 1} className="px-6 py-6 text-right tracking-widest text-xs">Final Performance Index</td>
                      <td className="px-4 py-6 text-xl bg-indigo-600 shadow-inner">{cumData.overall_total}</td>
                      <td className="px-4 py-6 text-xl bg-emerald-600 shadow-inner">{cumData.overall_average}%</td>
                      <td className="px-4 py-6 text-lg">{cumData.overall_grade}</td>
                      <td className="px-6 py-6 text-xs text-left italic opacity-70">"{cumData.overall_remark}"</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

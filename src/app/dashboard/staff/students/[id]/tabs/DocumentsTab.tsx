// src/app/dashboard/staff/students/[id]/components/tabs/DocumentsTab.tsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { studentDocumentsAPI, studentsAPI } from '@/lib/api';
import { Student, SchoolInfo, StudentSettings, StudentDocument } from '@/lib/types';
import {
  FileText, Download, Upload, Trash2, CreditCard, Eye, X, Check,
  Loader2, File, Heart, BarChart2, Plus, CheckCircle2, AlertTriangle, XCircle, Barcode
} from 'lucide-react';

interface Props {
  student: Student;
  schoolInfo: SchoolInfo | null;
  settings: StudentSettings | null;
  refreshStudent: () => void;
}

const DOC_TYPES = [
  { value: 'birth_certificate', label: 'Birth Certificate', icon: FileText },
  { value: 'medical', label: 'Medical Record', icon: Heart },
  { value: 'report', label: 'Report Card', icon: BarChart2 },
  { value: 'id_card', label: 'ID Card', icon: CreditCard },
  { value: 'other', label: 'Other Document', icon: File },
];

// ─── Toast System ──────────────────────────────────────────────────────────
type ToastType = 'success' | 'error' | 'info';
interface ToastItem { id: number; message: string; type: ToastType; }

function useToasts() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const showToast = useCallback((message: string, type: ToastType = 'success') => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3500);
  }, []);

  const dismissToast = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return { toasts, showToast, dismissToast };
}

function ToastContainer({ toasts, dismissToast }: { toasts: ToastItem[]; dismissToast: (id: number) => void }) {
  if (toasts.length === 0) return null;

  const styles: Record<ToastType, { bg: string; border: string; text: string; icon: React.ReactNode }> = {
    success: {
      bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-800',
      icon: <CheckCircle2 className="h-5 w-5 text-emerald-500 flex-shrink-0" />
    },
    error: {
      bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-800',
      icon: <XCircle className="h-5 w-5 text-red-500 flex-shrink-0" />
    },
    info: {
      bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-800',
      icon: <AlertTriangle className="h-5 w-5 text-blue-500 flex-shrink-0" />
    },
  };

  return (
    <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 w-full max-w-sm pointer-events-none">
      {toasts.map(t => {
        const s = styles[t.type];
        return (
          <div
            key={t.id}
            className={`pointer-events-auto flex items-start gap-2.5 p-3.5 rounded-xl border shadow-lg ${s.bg} ${s.border} ${s.text} animate-toast-in`}
          >
            {s.icon}
            <p className="text-sm font-medium flex-1">{t.message}</p>
            <button
              onClick={() => dismissToast(t.id)}
              className="text-slate-400 hover:text-slate-600 transition-colors flex-shrink-0"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        );
      })}
      <style jsx global>{`
        @keyframes toast-in {
          from { opacity: 0; transform: translateX(16px); }
          to { opacity: 1; transform: translateX(0); }
        }
        .animate-toast-in {
          animation: toast-in 0.2s ease-out;
        }
      `}</style>
    </div>
  );
}

// ─── Confirm Dialog ────────────────────────────────────────────────────────
interface ConfirmDialogProps {
  title: string;
  message: string;
  confirmLabel?: string;
  tone?: 'danger' | 'primary';
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

function ConfirmDialog({ title, message, confirmLabel = 'Confirm', tone = 'danger', loading, onConfirm, onCancel }: ConfirmDialogProps) {
  const isDanger = tone === 'danger';
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <div className="flex items-start gap-3 mb-4">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${isDanger ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'}`}>
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">{title}</h3>
            <p className="text-sm text-slate-500 mt-1">{message}</p>
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-5">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="px-4 py-2.5 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={`px-4 py-2.5 text-sm font-semibold text-white rounded-xl transition-colors disabled:opacity-50 flex items-center gap-2 ${isDanger ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'}`}
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : (isDanger ? <Trash2 className="h-4 w-4" /> : <Check className="h-4 w-4" />)}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function DocumentsTab({ student, schoolInfo, settings, refreshStudent }: Props) {
  const [documents, setDocuments] = useState<StudentDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [showIdCard, setShowIdCard] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [filterType, setFilterType] = useState<string>('all');
  const { toasts, showToast, dismissToast } = useToasts();

  // Confirm dialog state
  const [deleteTarget, setDeleteTarget] = useState<StudentDocument | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [showBarcodeConfirm, setShowBarcodeConfirm] = useState(false);
  const [generatingBarcode, setGeneratingBarcode] = useState(false);

  // Upload Form State
  const [uploadForm, setUploadForm] = useState({
    document_type: 'other',
    title: '',
    description: '',
  });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  useEffect(() => {
    loadDocuments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [student.id]);

  const loadDocuments = async () => {
    setLoading(true);
    try {
      const data = await studentDocumentsAPI.list(student.id);
      setDocuments(data);
    } catch (e) {
      console.error('Failed to load documents', e);
      showToast('Failed to load documents', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateBarcode = async () => {
    setGeneratingBarcode(true);
    try {
      await (studentsAPI as any).generateBarcode(student.id);
      refreshStudent();
      showToast('Barcode generated successfully', 'success');
      setShowBarcodeConfirm(false);
    } catch (e) {
      showToast('Failed to generate barcode', 'error');
    } finally {
      setGeneratingBarcode(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await studentDocumentsAPI.delete(deleteTarget.id);
      setDocuments(prev => prev.filter(d => d.id !== deleteTarget.id));
      showToast('Document deleted successfully', 'success');
      setDeleteTarget(null);
    } catch (e) {
      showToast('Failed to delete document', 'error');
    } finally {
      setDeleting(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      showToast('File size must be under 10MB', 'error');
      return;
    }
    setSelectedFile(file);
    if (!uploadForm.title) {
      setUploadForm(prev => ({ ...prev, title: file.name.split('.')[0] }));
    }
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) return showToast('Please select a file', 'error');
    if (!uploadForm.title.trim()) return showToast('Title is required', 'error');

    setUploading(true);
    const formData = new FormData();
    formData.append('document', selectedFile);
    formData.append('title', uploadForm.title);
    formData.append('document_type', uploadForm.document_type);
    if (uploadForm.description) formData.append('description', uploadForm.description);

    try {
      await studentDocumentsAPI.upload(student.id, formData);
      setShowUploadModal(false);
      setUploadForm({ document_type: 'other', title: '', description: '' });
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      loadDocuments();
      showToast('Document uploaded successfully', 'success');
    } catch (err: any) {
      const msg = err?.response?.data?.detail || err?.message || 'Upload failed';
      showToast(msg, 'error');
    } finally {
      setUploading(false);
    }
  };

  const filteredDocs = filterType === 'all'
    ? documents
    : documents.filter(d => d.document_type === filterType);

  const getIconForType = (type: string) => {
    const found = DOC_TYPES.find(t => t.value === type);
    return found ? found.icon : File;
  };

  return (
    <div className="space-y-6">
      <ToastContainer toasts={toasts} dismissToast={dismissToast} />

      {/* SECTION 1: ID CARD (FULL WIDTH TOP) */}
      <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-2xl border border-slate-200 p-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm text-blue-600">
              <CreditCard className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Student ID Card</h3>
              <p className="text-xs text-slate-500">Official identity document</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {settings?.generate_barcode && !student.barcode_url && (
              <button onClick={() => setShowBarcodeConfirm(true)} className="text-xs bg-white border border-slate-300 px-3 py-1.5 rounded-lg hover:bg-slate-50 flex items-center gap-1">
                <Upload className="h-3 w-3" /> Gen Barcode
              </button>
            )}
            <button onClick={() => setShowIdCard(true)} className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 flex items-center gap-1 shadow-sm shadow-blue-200">
              <Eye className="h-3 w-3" /> Preview & Print
            </button>
          </div>
        </div>
      </div>

      {/* SECTION 2: DOCUMENT REPOSITORY (FULL WIDTH BOTTOM) */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Upload className="h-4 w-4 text-blue-600" /> Document Repository
            </h3>
            <p className="text-xs text-slate-500 mt-1">Upload and manage student files (Max 10MB)</p>
          </div>
          <button onClick={() => setShowUploadModal(true)} className="bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-blue-700 flex items-center gap-2 shadow-sm shadow-blue-200 transition-all whitespace-nowrap">
            <Plus className="h-4 w-4" /> Upload New
          </button>
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center gap-2 border-b border-slate-100 mb-4 overflow-x-auto">
          <button onClick={() => setFilterType('all')} className={`px-3 py-2 text-xs font-medium whitespace-nowrap border-b-2 transition-colors ${filterType === 'all' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
            All ({documents.length})
          </button>
          {DOC_TYPES.map(type => (
            <button key={type.value} onClick={() => setFilterType(type.value)} className={`px-3 py-2 text-xs font-medium whitespace-nowrap border-b-2 transition-colors ${filterType === type.value ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
              {type.label}
            </button>
          ))}
        </div>

        {/* Document List */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[400px] overflow-y-auto pr-1">
          {loading ? <div className="col-span-2 lg:col-span-3 flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-slate-300" /></div> :
          filteredDocs.length === 0 ? (
            <div className="col-span-2 lg:col-span-3 text-center py-8 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50">
              <FileText className="h-8 w-8 text-slate-300 mx-auto mb-2" />
              <p className="text-sm text-slate-500">No documents found.</p>
            </div>
          ) : (
            filteredDocs.map(doc => {
              const Icon = getIconForType(doc.document_type);
              // Note: doc.document_url will be null/undefined until you apply the Backend Fix below
              return (
                <div key={doc.id} className="group p-4 bg-slate-50 rounded-xl border border-slate-100 hover:border-blue-200 hover:bg-white transition-all">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-shrink-0">
                      <div className="w-10 h-10 bg-white rounded-lg border border-slate-200 flex items-center justify-center text-slate-500 group-hover:text-blue-600 group-hover:border-blue-200 transition-colors">
                        <Icon className="h-5 w-5" />
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-slate-900 truncate" title={doc.title}>{doc.title}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{doc.document_type_display}</p>
                      <div className="flex items-center gap-3 mt-2">
                        <button
                          onClick={() => doc.document_url && window.open(doc.document_url, '_blank')}
                          className="text-xs text-blue-600 hover:underline flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
                          disabled={!doc.document_url}
                        >
                          <Eye className="h-3 w-3" /> View
                        </button>
                        <button
                          onClick={() => doc.document_url && window.open(doc.document_url, '_blank')}
                          className="text-xs text-slate-500 hover:text-slate-700 flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
                          disabled={!doc.document_url}
                        >
                          <Download className="h-3 w-3" /> Download
                        </button>
                      </div>
                    </div>
                    <button
                      onClick={() => setDeleteTarget(doc)}
                      className="p-1.5 text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg transition-colors flex-shrink-0"
                      title="Delete document"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Upload Modal (Same as before) */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
              <h3 className="text-lg font-bold text-slate-900">Upload Document</h3>
              <button onClick={() => setShowUploadModal(false)}><X className="h-5 w-5 text-slate-400" /></button>
            </div>
            <form onSubmit={handleUploadSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1.5">Document Type</label>
                <select
                  value={uploadForm.document_type}
                  onChange={e => setUploadForm({...uploadForm, document_type: e.target.value})}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  {DOC_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1.5">Title <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={uploadForm.title}
                  onChange={e => setUploadForm({...uploadForm, title: e.target.value})}
                  required
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="e.g. Term 1 Report"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1.5">File <span className="text-red-500">*</span></label>
                <div className="relative border-2 border-dashed border-slate-200 rounded-xl p-4 text-center hover:border-blue-300 transition-colors bg-slate-50">
                  <input
                    ref={fileInputRef}
                    type="file"
                    onChange={handleFileChange}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  {selectedFile ? (
                    <div className="flex items-center justify-center gap-2 text-blue-600">
                      <FileText className="h-5 w-5" />
                      <span className="text-sm font-medium truncate">{selectedFile.name}</span>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <Upload className="h-6 w-6 text-slate-400 mx-auto" />
                      <p className="text-xs text-slate-500 font-medium">Click to select file</p>
                      <p className="text-[10px] text-slate-400">Max 10MB</p>
                    </div>
                  )}
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1.5">Description (Optional)</label>
                <textarea
                  value={uploadForm.description}
                  onChange={e => setUploadForm({...uploadForm, description: e.target.value})}
                  rows={2}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowUploadModal(false)} className="px-4 py-2 text-sm text-slate-600 bg-slate-100 rounded-xl hover:bg-slate-200">Cancel</button>
                <button type="submit" disabled={uploading} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2">
                  {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} Upload
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ID Card Preview Modal */}
      {showIdCard && (
        <div className="fixed inset-0 z-50 bg-slate-900/90 backdrop-blur-sm overflow-y-auto p-4 flex items-start justify-center pt-10">
          <div className="bg-white rounded-2xl p-8 max-w-4xl w-full relative animate-in fade-in zoom-in duration-300">
            <button onClick={() => setShowIdCard(false)} className="absolute top-4 right-4 p-2 bg-slate-100 rounded-full hover:bg-slate-200"><X className="h-5 w-5" /></button>

            <div className="text-center mb-6">
              <h2 className="text-xl font-bold text-slate-900">Identity Card</h2>
              <p className="text-sm text-slate-500">Use browser print (Ctrl+P) to save as PDF.</p>
              <button onClick={() => window.print()} className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 flex items-center gap-2 mx-auto">
                <Download className="h-4 w-4" /> Print / Save PDF
              </button>
            </div>

            <div className="flex flex-col md:flex-row gap-8 justify-center print:justify-start print:flex-col">
              <IDCardFront student={student} school={schoolInfo} />
              <IDCardBack student={student} school={schoolInfo} />
            </div>
          </div>
        </div>
      )}

      {/* Delete Document Confirmation */}
      {deleteTarget && (
        <ConfirmDialog
          title="Delete Document"
          message={`Are you sure you want to delete "${deleteTarget.title}"? This action cannot be undone.`}
          confirmLabel="Delete"
          tone="danger"
          loading={deleting}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      {/* Generate Barcode Confirmation */}
      {showBarcodeConfirm && (
        <ConfirmDialog
          title="Generate Barcode"
          message="Generate a barcode for this student? This will be used for ID card and attendance scanning."
          confirmLabel="Generate"
          tone="primary"
          loading={generatingBarcode}
          onConfirm={handleGenerateBarcode}
          onCancel={() => setShowBarcodeConfirm(false)}
        />
      )}
    </div>
  );
}

// ─── ID Card Front (Updated Website Logic) ───────────────────────────────────
function IDCardFront({ student, school }: { student: Student; school: SchoolInfo | null }) {
  return (
    <div className="w-[350px] h-[220px] bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden flex relative print:shadow-none print:border print:border-black">
      {/* Header */}
      <div className="absolute top-0 left-0 w-full h-16 bg-gradient-to-r from-blue-600 to-indigo-600 flex items-center px-4 justify-between">
        <div className="flex items-center gap-3">
          {school?.logo && <img src={school.logo} alt="Logo" className="h-10 w-10 rounded-full bg-white p-0.5 object-contain" />}
          <div>
            <h4 className="text-white font-bold text-sm leading-tight">{school?.name || 'SCHOOL NAME'}</h4>
            <p className="text-blue-100 text-[10px] uppercase tracking-wider">{school?.short_name || 'SCH'}</p>
          </div>
        </div>
        <div className="text-right"><p className="text-white/80 text-[10px] font-mono">STUDENT ID</p></div>
      </div>

      {/* Content */}
      <div className="mt-16 px-4 flex gap-4">
        <div className="flex-shrink-0">
           <div className="w-20 h-24 bg-slate-100 rounded-lg overflow-hidden border border-slate-200 shadow-sm">
             {student.image_url ? <img src={student.image_url} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-slate-300 text-2xl">?</div>}
           </div>
        </div>
        <div className="flex-1 pt-1">
          <h2 className="text-lg font-bold text-slate-900 uppercase">{student.full_name}</h2>
          <div className="mt-2 space-y-1">
            <p className="text-xs text-slate-600 flex justify-between"><span>Reg No:</span> <span className="font-mono font-semibold text-slate-800">{student.registration_number}</span></p>
            <p className="text-xs text-slate-600 flex justify-between"><span>Class:</span> <span className="font-semibold text-slate-800">{student.current_class_name || '-'}</span></p>
            <p className="text-xs text-slate-600 flex justify-between"><span>Gender:</span> <span className="capitalize text-slate-800">{student.gender}</span></p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="absolute bottom-0 w-full h-8 bg-slate-50 border-t border-slate-100 flex items-center justify-between px-4 text-[9px] text-slate-500">
        <span>{school?.address || 'School Address'}</span>
        {/* Conditional Website Render */}
        {school?.website && <span>{school.website}</span>}
      </div>
    </div>
  );
}

// ─── ID Card Back (Updated Header & Logo Background) ───────────────────────
function IDCardBack({ student, school }: { student: Student; school: SchoolInfo | null }) {
  return (
    <div
      className="w-[350px] h-[220px] bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden flex flex-col relative print:shadow-none print:border print:border-black bg-cover bg-center"
      style={{ backgroundImage: school?.logo ? `url(${school.logo})` : 'none' }}
    >
      {/* White Overlay to make text readable over the logo */}
      <div className="absolute inset-0 bg-white/90 z-0"></div>

      <div className="relative z-10 h-16 bg-slate-800/90 backdrop-blur-sm flex items-center justify-center border-b border-slate-700/50">
         {/* Updated Header Text */}
         <h4 className="text-white font-bold text-lg tracking-widest">Student ID Card</h4>
      </div>

      <div className="relative z-10 p-6 flex-1 flex flex-col items-center justify-center text-center">
        <p className="text-xs text-slate-500 mb-2">In case of loss, please return to:</p>
        <p className="text-sm font-bold text-slate-900">{school?.name}</p>
        <p className="text-xs text-slate-600 mt-1">{school?.address}</p>
        <p className="text-xs text-slate-600 mt-1">Tel: {school?.mobile_1}</p>
      </div>

      <div className="relative z-10 p-3 bg-white border-t border-slate-100">
        {student.barcode_url ? (
          <img src={student.barcode_url} alt="Barcode" className="h-12 mx-auto" />
        ) : (
          <div className="h-12 bg-slate-100 flex items-center justify-center text-[10px] text-slate-400">No Barcode Generated</div>
        )}
        {student.registration_number && <p className="text-center text-[10px] font-mono mt-1">{student.registration_number}</p>}
      </div>
    </div>
  );
}
'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import api from '@/lib/api';
import {templatesAPI} from '@/lib/communication.service';
import {
  Layout, Plus, Edit3, Trash2, Search, X, Check, HelpCircle,
  AlertCircle, AlertTriangle, Loader2, RefreshCw,
  Mail, Smartphone, MessageSquare, Radio, Wand2, Calculator, ShieldQuestion,
  Bold, Italic, Underline, Eye, Link2
} from 'lucide-react';

// ─── Variable Dictionary & Estimator ───────────────────────────────────────────

interface TemplateVar {
  tag: string;
  label: string;
  dummy: string;
}

const VARIABLE_MAP: Record<string, TemplateVar[]> = {
  fee_payment: [
    { tag: '{{parent_name}}', label: 'Parent Name', dummy: 'Mr. Olanrewaju' },
    { tag: '{{student_name}}', label: 'Student Name', dummy: 'Amina Adebayo' },
    { tag: '{{amount}}', label: 'Amount Paid', dummy: '₦50,000' },
    { tag: '{{receipt_no}}', label: 'Receipt No.', dummy: 'REC-8921' },
    { tag: '{{school_name}}', label: 'School Name', dummy: 'Greenfield Academy' },
  ],
  fee_reminder: [
    { tag: '{{parent_name}}', label: 'Parent Name', dummy: 'Mrs. Chukwu' },
    { tag: '{{student_name}}', label: 'Student Name', dummy: 'Emeka Chukwu' },
    { tag: '{{amount_due}}', label: 'Amount Due', dummy: '₦125,000' },
    { tag: '{{due_date}}', label: 'Due Date', dummy: 'Sept 5, 2026' },
  ],
  student_registration: [
    { tag: '{{student_name}}', label: 'Student Name', dummy: 'John Doe' },
    { tag: '{{admission_no}}', label: 'Admission No.', dummy: 'STD/2026/014' },
    { tag: '{{class_name}}', label: 'Class', dummy: 'JSS 1 A' },
    { tag: '{{school_name}}', label: 'School Name', dummy: 'Greenfield Academy' },
  ],
  result_published: [
    { tag: '{{parent_name}}', label: 'Parent Name', dummy: 'Mrs. Okafor' },
    { tag: '{{student_name}}', label: 'Student Name', dummy: 'Chinedu Okafor' },
    { tag: '{{term_name}}', label: 'Term/Session', dummy: 'Term 1, 2026/2027' },
    { tag: '{{portal_url}}', label: 'Portal Link', dummy: 'https://portal.school.com' },
  ],
  attendance_alert: [
    { tag: '{{parent_name}}', label: 'Parent Name', dummy: 'Mr. Abubakar' },
    { tag: '{{student_name}}', label: 'Student Name', dummy: 'Fatima Abubakar' },
    { tag: '{{time}}', label: 'Time', dummy: '08:15 AM' },
    { tag: '{{status}}', label: 'Status', dummy: 'Marked Absent' },
  ],
  custom: [
    { tag: '{{custom}}', label: 'Custom Brackets', dummy: 'Custom_Text_Here' },
  ]
};

const DEFAULT_VARS = [
  { tag: '{{recipient_name}}', label: 'Recipient Name', dummy: 'Valued Parent' },
  { tag: '{{school_name}}', label: 'School Name', dummy: 'Greenfield Academy' },
  { tag: '{{date}}', label: 'Current Date', dummy: 'Aug 15, 2026' },
];

function getVarsForEvent(event: string): TemplateVar[] {
  if (event === 'custom') return [...DEFAULT_VARS, { tag: '{{}}', label: 'Empty Brackets', dummy: '___' }];
  return VARIABLE_MAP[event] || DEFAULT_VARS;
}

// Function to replace tags with dummy data for length estimation / preview
function simulateTextLength(text: string, event: string): { simulatedText: string; length: number } {
  if (!text) return { simulatedText: '', length: 0 };
  let simulated = text;
  const vars = getVarsForEvent(event);

  vars.forEach(v => {
    // Regex to globally replace the tag with its dummy equivalent
    const regex = new RegExp(v.tag.replace(/\{/g, '\\{').replace(/\}/g, '\\}'), 'g');
    simulated = simulated.replace(regex, v.dummy);
  });

  // Replace any leftover unmapped tags with a generic 10-char string to prevent under-estimation
  simulated = simulated.replace(/\{\{.*?\}\}/g, 'XXXXXXXXXX');

  return { simulatedText: simulated, length: simulated.length };
}

function stripHtmlToText(html: string): string {
  const tmp = document.createElement("DIV");
  tmp.innerHTML = html;
  return (tmp.textContent || tmp.innerText || "").trim();
}

// ─── Types & API ───────────────────────────────────────────────────────────────

export type NotificationTemplateEventType = string;

export interface NotificationTemplate {
  id: number;
  event_type: NotificationTemplateEventType;
  name: string;
  email_subject?: string;
  email_body?: string;
  sms_message?: string;
  whatsapp_message?: string;
  send_email: boolean;
  send_sms: boolean;
  send_whatsapp: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface NotificationTemplateFormValues {
  event_type: NotificationTemplateEventType;
  name: string;
  email_subject?: string;
  email_body?: string;
  sms_message?: string;
  whatsapp_message?: string;
  send_email: boolean;
  send_sms: boolean;
  send_whatsapp: boolean;
  is_active: boolean;
}

const EVENT_TYPE_OPTIONS = [
  { value: 'student_registration', label: 'Student Registration' },
  { value: 'fee_payment', label: 'Fee Payment Received' },
  { value: 'fee_reminder', label: 'Fee Reminder' },
  { value: 'result_published', label: 'Result Published' },
  { value: 'attendance_alert', label: 'General Attendance Alert' },
  { value: 'exam_schedule', label: 'Exam Schedule' },
  { value: 'announcement', label: 'Announcement' },
  { value: 'attendance_late', label: 'Attendance: Arrived Late' },
  { value: 'attendance_absent', label: 'Attendance: Marked Absent' },
  { value: 'attendance_temp_exit_parent', label: 'Attendance: Unreturned Exit' },
  { value: 'attendance_left_campus', label: 'Attendance: Confirmed Departure' },
  { value: 'admission_enquiry_received', label: 'Admission Enquiry Received' },
  { value: 'low_platform_balance', label: 'Low Platform Balance' },
  { value: 'custom', label: 'Custom' },
];

function eventLabel(val: string): string {
  return EVENT_TYPE_OPTIONS.find(o => o.value === val)?.label ?? val;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

let _toastId = 0;
interface ToastItem { id: number; type: 'success' | 'error'; message: string; }

function extractError(err: any): string {
  const d = err?.response?.data;
  if (d) {
    if (typeof d === 'string') return d.slice(0, 150);
    if (d.detail) return String(d.detail).slice(0, 150);
    if (d.details) {
      const details = d.details;
      if (details.non_field_errors?.length) return details.non_field_errors[0];
      const fields = Object.entries(details)
        .map(([k, v]) => `${k.replace(/_/g, ' ')}: ${Array.isArray(v) ? v[0] : String(v)}`)
        .join('\n');
      if (fields) return fields.slice(0, 200);
    }
    if (d.message) return String(d.message).slice(0, 150);
    // Plain DRF serializer error shape: { field_name: ["msg", ...], non_field_errors: [...] }
    if (typeof d === 'object' && !Array.isArray(d)) {
      if (Array.isArray(d.non_field_errors) && d.non_field_errors.length) {
        return String(d.non_field_errors[0]).slice(0, 150);
      }
      const fields = Object.entries(d)
        .filter(([, v]) => Array.isArray(v) && v.length)
        .map(([k, v]) => `${k.replace(/_/g, ' ')}: ${(v as any[])[0]}`)
        .join('\n');
      if (fields) return fields.slice(0, 200);
    }
  }
  return err?.message || 'An unexpected error occurred.';
}

// ─── Shared UI Components ──────────────────────────────────────────────────────

function ToastStack({ toasts, onDismiss }: { toasts: ToastItem[]; onDismiss: (id: number) => void }) {
  return (
    <div className="fixed top-4 right-4 z-[80] flex flex-col gap-2 pointer-events-none w-[calc(100%-2rem)] sm:w-auto">
      {toasts.map(t => (
        <div key={t.id} className={`pointer-events-auto flex items-start gap-3 px-4 py-3 rounded-xl shadow-lg ring-1 sm:max-w-sm transition-all animate-[fadeIn_0.2s_ease-out]
          ${t.type === 'success' ? 'bg-emerald-50 ring-emerald-200 text-emerald-900' : 'bg-red-50 ring-red-200 text-red-900'}`}>
          {t.type === 'success' ? <Check className="h-4 w-4 flex-shrink-0 mt-0.5 text-emerald-600" /> : <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5 text-red-600" />}
          <p className="text-sm font-medium flex-1 leading-snug whitespace-pre-line">{t.message}</p>
          <button onClick={() => onDismiss(t.id)} className="opacity-50 hover:opacity-100 flex-shrink-0 ml-2"><X className="h-3.5 w-3.5" /></button>
        </div>
      ))}
    </div>
  );
}

function ConfirmModal({ open, template, isDeleting, onConfirm, onCancel }: {
  open: boolean; template: NotificationTemplate | null; isDeleting: boolean; onConfirm: () => void; onCancel: () => void;
}) {
  if (!open || !template) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl ring-1 ring-black/5 w-full max-w-md p-6">
        <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4 bg-red-100 text-red-600"><AlertTriangle className="h-6 w-6" /></div>
        <h3 className="text-lg font-bold text-slate-900 text-center mb-1">Delete Template</h3>
        <p className="text-sm text-slate-500 text-center mb-6 leading-relaxed">Are you sure you want to permanently delete <span className="font-semibold text-slate-700">"{template.name}"</span>? System events tied to this template will no longer fire notifications.</p>
        <div className="flex gap-3">
          <button onClick={onCancel} disabled={isDeleting} className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl font-medium text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50">Cancel</button>
          <button onClick={onConfirm} disabled={isDeleting} className="flex-1 px-4 py-2.5 rounded-xl font-semibold text-white bg-red-600 hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 shadow-md shadow-red-200">{isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />} Delete</button>
        </div>
      </div>
    </div>
  );
}

function VariablesHelpModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[65] bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl ring-1 ring-black/5 w-full max-w-lg h-[min(560px,calc(100vh-2rem))] flex flex-col overflow-hidden">
        <div className="bg-gradient-to-r from-violet-600 to-purple-600 px-6 py-4 flex items-center justify-between flex-shrink-0">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <span className="w-7 h-7 rounded-lg bg-white/15 flex items-center justify-center">
              <ShieldQuestion className="h-4 w-4" />
            </span>
            Template Variables Guide
          </h3>
          <button onClick={onClose} className="text-white/70 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto p-6 space-y-5">
          <div className="p-4 bg-violet-50/70 border border-violet-100 rounded-xl space-y-2">
            <p className="text-sm font-semibold text-slate-800">Dynamic Placeholders</p>
            <p className="text-xs text-slate-600 leading-relaxed">
              When writing messages, you can inject dynamic content using double curly braces: <span className="font-mono bg-white px-1 py-0.5 rounded border border-slate-200">{'{{variable_name}}'}</span>.
              The system will replace these with actual data when sending the notification.
            </p>
          </div>

          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3">Common Variables</p>
            <div className="space-y-3">
              {[
                { tag: '{{student_name}}', desc: "The student's full name" },
                { tag: '{{parent_name}}', desc: "The parent's full name" },
                { tag: '{{amount}}', desc: "Payment or invoice amount" },
                { tag: '{{school_name}}', desc: "Name of your institution" },
                { tag: '{{date}}', desc: "Date of the event" },
              ].map((v, i) => (
                <div key={i} className="flex items-start gap-3 p-3 border border-slate-100 rounded-lg bg-slate-50/50">
                  <span className="font-mono text-[11px] font-bold text-violet-700 bg-violet-100 px-2 py-1 rounded whitespace-nowrap">{v.tag}</span>
                  <span className="text-sm text-slate-600 pt-0.5">{v.desc}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="p-3.5 bg-amber-50 border border-amber-100 rounded-xl flex items-start gap-2">
            <AlertCircle className="h-3.5 w-3.5 text-amber-600 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-amber-800 leading-relaxed">Available variables depend entirely on the Event Type triggering the message. Using a variable that isn't provided by the event will leave it blank.</p>
          </div>
        </div>

        <div className="flex justify-end px-6 py-4 border-t border-slate-100 bg-slate-50/60 flex-shrink-0">
          <button onClick={onClose} className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors">
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Live Preview (phone/email simulator) ───────────────────────────────────
// Shared between the mobile overlay drawer and the persistent desktop side
// panel, so both stay in sync and there's only one place that renders the
// actual mockups.

type PreviewChannel = 'email' | 'sms' | 'whatsapp';

function getAvailableChannels(form: NotificationTemplateFormValues): { id: PreviewChannel; label: string; icon: any }[] {
  return [
    ...(form.send_email ? [{ id: 'email' as PreviewChannel, label: 'Email', icon: Mail }] : []),
    ...(form.send_sms ? [{ id: 'sms' as PreviewChannel, label: 'SMS', icon: Smartphone }] : []),
    ...(form.send_whatsapp ? [{ id: 'whatsapp' as PreviewChannel, label: 'WhatsApp', icon: MessageSquare }] : []),
  ];
}

function LivePreviewBody({ form, channel, setChannel, availableChannels }: {
  form: NotificationTemplateFormValues;
  channel: PreviewChannel;
  setChannel: (c: PreviewChannel) => void;
  availableChannels: { id: PreviewChannel; label: string; icon: any }[];
}) {
  const smsSim = simulateTextLength(form.sms_message || '', form.event_type);
  const waSim = simulateTextLength(form.whatsapp_message || '', form.event_type);
  const emailSubjectSim = simulateTextLength(form.email_subject || '', form.event_type);
  const emailBodySim = simulateTextLength(form.email_body || '', form.event_type);

  if (availableChannels.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-6 text-center">
        <p className="text-sm text-slate-400">Enable a delivery channel below to preview its message here.</p>
      </div>
    );
  }

  return (
    <>
      <div className="flex gap-1.5 px-4 pt-3 flex-shrink-0">
        {availableChannels.map(c => (
          <button key={c.id} type="button" onClick={() => setChannel(c.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${
              channel === c.id ? 'bg-violet-600 border-violet-600 text-white' : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
            }`}>
            <c.icon className="h-3.5 w-3.5" /> {c.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-5 flex items-start justify-center bg-slate-100/60">
        {channel === 'email' ? (
          <div className="w-full bg-white rounded-xl shadow-md ring-1 ring-slate-200 overflow-hidden">
            <div className="px-4 py-3 bg-slate-50 border-b border-slate-200">
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wide">Subject</p>
              <p className="text-sm font-semibold text-slate-800 mt-0.5">{emailSubjectSim.simulatedText || <span className="text-slate-300 italic font-normal">No subject yet</span>}</p>
            </div>
            <div className="p-4">
              {emailBodySim.simulatedText.trim() ? (
                <div className="text-sm text-slate-700 leading-relaxed prose-sm" dangerouslySetInnerHTML={{ __html: emailBodySim.simulatedText }} />
              ) : (
                <p className="text-sm text-slate-300 italic">No email body yet</p>
              )}
            </div>
          </div>
        ) : (
          // Phone mockup for SMS / WhatsApp
          <div className="w-64 bg-white rounded-[2.5rem] shadow-xl border-[6px] border-slate-800 overflow-hidden relative flex flex-col h-[420px]">
            <div className="absolute top-0 inset-x-0 h-5 flex justify-center z-10">
              <div className="w-24 h-4 bg-slate-800 rounded-b-xl"></div>
            </div>
            <div className={`${channel === 'whatsapp' ? 'bg-emerald-600' : 'bg-blue-500'} h-16 pt-5 px-4 flex items-center gap-2 shadow-sm text-white flex-shrink-0`}>
              <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
                {channel === 'whatsapp' ? <MessageSquare className="h-4 w-4" /> : <Smartphone className="h-4 w-4" />}
              </div>
              <div>
                <p className="text-xs font-bold leading-tight">School Update</p>
                <p className="text-[9px] text-white/80">Live Preview</p>
              </div>
            </div>
            <div className={`p-3 flex-1 flex flex-col justify-end pb-6 overflow-y-auto ${channel === 'whatsapp' ? 'bg-[#e5ddd5]' : 'bg-slate-50'}`}>
              {(channel === 'whatsapp' ? waSim.simulatedText : smsSim.simulatedText) ? (
                <div className={`p-2.5 rounded-2xl shadow-sm ml-4 relative mb-2 break-words ${channel === 'whatsapp' ? 'bg-white rounded-tl-sm' : 'bg-blue-100 text-blue-900 rounded-br-sm mr-2 ml-6'}`}>
                  <p className={`text-xs whitespace-pre-wrap font-sans leading-relaxed ${channel === 'whatsapp' ? 'text-slate-800' : 'text-blue-900'}`}>
                    {channel === 'whatsapp' ? waSim.simulatedText : smsSim.simulatedText}
                  </p>
                  <span className={`text-[8px] absolute bottom-1 right-2 block text-right mt-1 ${channel === 'whatsapp' ? 'text-slate-400' : 'text-blue-500/70'}`}>Now</span>
                </div>
              ) : (
                <div className="text-center text-xs font-semibold text-slate-400 bg-white/50 p-4 rounded-xl border border-slate-200">
                  Type a message to see the preview.
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}

// Mobile-only overlay — opened via the header "Preview" button, which is
// hidden on lg+ screens since the desktop side panel is always visible there.
function PreviewDrawer({ form, initialChannel, onClose }: {
  form: NotificationTemplateFormValues; initialChannel: PreviewChannel; onClose: () => void;
}) {
  const availableChannels = getAvailableChannels(form);
  const [channel, setChannel] = useState<PreviewChannel>(
    availableChannels.some(c => c.id === initialChannel) ? initialChannel : (availableChannels[0]?.id || 'sms')
  );

  return (
    <div className="fixed inset-0 z-[70] bg-slate-900/50 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4 lg:hidden">
      <div className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl shadow-2xl ring-1 ring-black/5 h-[85vh] sm:h-[min(640px,calc(100vh-2rem))] flex flex-col overflow-hidden">
        <div className="bg-gradient-to-r from-violet-600 to-purple-600 px-5 py-4 flex items-center justify-between flex-shrink-0">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Eye className="h-4 w-4" /> Live Preview
          </h3>
          <button onClick={onClose} className="text-white/70 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        <LivePreviewBody form={form} channel={channel} setChannel={setChannel} availableChannels={availableChannels} />

        <div className="flex justify-end px-5 py-3 border-t border-slate-100 bg-slate-50/60 flex-shrink-0">
          <button onClick={onClose} className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// Desktop-only persistent side panel — sits to the right of the form inside
// the (now wider) modal, so there's no need to click a Preview button on
// larger screens; it just stays in sync with whichever field has focus.
function DesktopPreviewPanel({ form, focusedChannel }: {
  form: NotificationTemplateFormValues; focusedChannel: PreviewChannel;
}) {
  const availableChannels = getAvailableChannels(form);
  const [channel, setChannel] = useState<PreviewChannel>(focusedChannel);

  // Follow the field the user is typing in, but only when that channel is
  // actually enabled — otherwise keep whatever tab they manually selected.
  useEffect(() => {
    if (availableChannels.some(c => c.id === focusedChannel)) {
      setChannel(focusedChannel);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusedChannel]);

  useEffect(() => {
    if (!availableChannels.some(c => c.id === channel) && availableChannels.length > 0) {
      setChannel(availableChannels[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.send_email, form.send_sms, form.send_whatsapp]);

  return (
    <div className="hidden lg:flex lg:flex-col lg:w-[380px] lg:flex-shrink-0 border-l border-slate-100 bg-white">
      <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2 flex-shrink-0">
        <span className="w-7 h-7 rounded-lg bg-violet-50 flex items-center justify-center text-violet-600">
          <Eye className="h-4 w-4" />
        </span>
        <div>
          <p className="text-sm font-bold text-slate-800 leading-tight">Live Preview</p>
          <p className="text-[11px] text-slate-400">Updates as you type</p>
        </div>
      </div>
      <div className="flex-1 min-h-0 flex flex-col bg-slate-50/40">
        <LivePreviewBody form={form} channel={channel} setChannel={setChannel} availableChannels={availableChannels} />
      </div>
    </div>
  );
}

// Read-only preview for an already-saved template — opened straight from the
// template card via the eye icon, no need to go through Edit first.
function TemplatePreviewModal({ template, onClose }: { template: NotificationTemplate; onClose: () => void }) {
  const form: NotificationTemplateFormValues = {
    event_type: template.event_type,
    name: template.name,
    email_subject: template.email_subject || '',
    email_body: template.email_body || '',
    sms_message: template.sms_message || '',
    whatsapp_message: template.whatsapp_message || '',
    send_email: template.send_email,
    send_sms: template.send_sms,
    send_whatsapp: template.send_whatsapp,
    is_active: template.is_active,
  };
  const availableChannels = getAvailableChannels(form);
  const [channel, setChannel] = useState<PreviewChannel>(availableChannels[0]?.id || 'sms');

  return (
    <div className="fixed inset-0 z-[70] bg-slate-900/50 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4">
      <div className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl shadow-2xl ring-1 ring-black/5 h-[85vh] sm:h-[min(640px,calc(100vh-2rem))] flex flex-col overflow-hidden">
        <div className="bg-gradient-to-r from-violet-600 to-purple-600 px-5 py-4 flex items-center justify-between flex-shrink-0 min-w-0">
          <h3 className="text-base font-bold text-white flex items-center gap-2 min-w-0">
            <Eye className="h-4 w-4 flex-shrink-0" /> <span className="truncate">{template.name}</span>
          </h3>
          <button onClick={onClose} className="text-white/70 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors flex-shrink-0">
            <X className="h-5 w-5" />
          </button>
        </div>

        <LivePreviewBody form={form} channel={channel} setChannel={setChannel} availableChannels={availableChannels} />

        <div className="flex justify-end px-5 py-3 border-t border-slate-100 bg-slate-50/60 flex-shrink-0">
          <button onClick={onClose} className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Template Registration Modal ───────────────────────────────────────────────

type BodyFieldKey = 'email_body' | 'sms_message' | 'whatsapp_message';
type FocusableFieldKey = 'email_subject' | BodyFieldKey;

const CHANNEL_FLAG_FOR_FIELD: Record<BodyFieldKey, 'send_email' | 'send_sms' | 'send_whatsapp'> = {
  email_body: 'send_email',
  sms_message: 'send_sms',
  whatsapp_message: 'send_whatsapp',
};

function TemplateModal({
  editing, isSaving, smsCharLimit, smsCostPerPage, onSave, onClose, showToast
}: {
  editing: NotificationTemplate | null; isSaving: boolean; smsCharLimit: number; smsCostPerPage: number;
  onSave: (data: NotificationTemplateFormValues) => Promise<void>; onClose: () => void;
  showToast: (type: 'success' | 'error', message: string) => void;
}) {
  const [form, setForm] = useState<NotificationTemplateFormValues>(
    editing ? {
      event_type: editing.event_type,
      name: editing.name,
      email_subject: editing.email_subject || '',
      email_body: editing.email_body || '',
      sms_message: editing.sms_message || '',
      whatsapp_message: editing.whatsapp_message || '',
      send_email: editing.send_email,
      send_sms: editing.send_sms,
      send_whatsapp: editing.send_whatsapp,
      is_active: editing.is_active,
    } : {
      event_type: '' as NotificationTemplateEventType,
      name: '',
      email_subject: '',
      email_body: '',
      sms_message: '',
      whatsapp_message: '',
      send_email: false,
      send_sms: true,
      send_whatsapp: false,
      is_active: true,
    }
  );

  const enabledBodyFields = (f: NotificationTemplateFormValues): BodyFieldKey[] =>
    (['email_body', 'sms_message', 'whatsapp_message'] as BodyFieldKey[]).filter(k => f[CHANNEL_FLAG_FOR_FIELD[k]]);

  const plainValueOf = (f: NotificationTemplateFormValues, key: BodyFieldKey): string =>
    key === 'email_body' ? stripHtmlToText(f.email_body || '').trim() : (f[key] || '').trim();

  // Sync toggle: default ON for new templates. For an existing template, only
  // default ON if every currently-enabled channel already holds the same
  // plain-text content — otherwise default OFF so we never silently blow away
  // content that was deliberately written differently per channel.
  const [syncEnabled, setSyncEnabled] = useState<boolean>(() => {
    if (!editing) return true;
    const fields = enabledBodyFields(form);
    if (fields.length <= 1) return true;
    const values = fields.map(f => plainValueOf(form, f));
    return values.every(v => v === values[0]);
  });

  // Focus Tracking for Variable Injection — defaults to the first enabled channel
  const [lastFocusedField, setLastFocusedField] = useState<FocusableFieldKey | null>(() => {
    if (form.send_sms) return 'sms_message';
    if (form.send_whatsapp) return 'whatsapp_message';
    if (form.send_email) return 'email_body';
    return null;
  });
  const smsRef = useRef<HTMLTextAreaElement>(null);
  const waRef = useRef<HTMLTextAreaElement>(null);
  const emailBodyRef = useRef<HTMLTextAreaElement>(null);
  const emailSubjRef = useRef<HTMLInputElement>(null);

  // Estimator State
  const [estimatedRecipients, setEstimatedRecipients] = useState<number>(100);
  const [showHelp, setShowHelp] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const set = <K extends keyof NotificationTemplateFormValues>(key: K, value: NotificationTemplateFormValues[K]) =>
    setForm(prev => ({ ...prev, [key]: value }));

  // Propagates a body field's plain-text value into every other *currently
  // enabled* body field. Email is only ever synced as plain text — inbound
  // formatting from SMS/WhatsApp has no equivalent, and outbound the HTML
  // gets stripped, so nobody loses formatting they didn't type themselves.
  const propagateSync = (sourceKey: BodyFieldKey, plainValue: string) => {
    if (!syncEnabled) return;
    setForm(prev => {
      const targets = enabledBodyFields(prev).filter(f => f !== sourceKey);
      if (targets.length === 0) return prev;
      const next = { ...prev };
      targets.forEach(f => { (next as any)[f] = plainValue; });
      return next;
    });
  };

  const updateBodyField = (key: BodyFieldKey, value: string) => {
    set(key, value);
    const plain = key === 'email_body' ? stripHtmlToText(value) : value;
    propagateSync(key, plain);
  };

  // Turning a channel on: if sync is active, seed it from whichever other
  // enabled channel already has content, so it doesn't start blank.
  const toggleChannel = (flagKey: 'send_email' | 'send_sms' | 'send_whatsapp', bodyKey: BodyFieldKey) => {
    const turningOn = !form[flagKey];
    set(flagKey, turningOn);
    if (turningOn && syncEnabled) {
      const others = enabledBodyFields(form);
      const sourceField = others.find(f => plainValueOf(form, f).length > 0);
      if (sourceField) {
        const plain = plainValueOf(form, sourceField);
        set(bodyKey, plain);
      }
      if (!lastFocusedField) setLastFocusedField(bodyKey);
    }
  };

  const insertVariable = (tag: string) => {
    if (!lastFocusedField) {
      showToast('error', 'Click inside a message field first to place a variable.');
      return;
    }

    let ref: React.RefObject<HTMLTextAreaElement | HTMLInputElement>;
    if (lastFocusedField === 'sms_message') ref = smsRef;
    else if (lastFocusedField === 'whatsapp_message') ref = waRef;
    else if (lastFocusedField === 'email_body') ref = emailBodyRef;
    else ref = emailSubjRef;

    const el = ref.current;
    if (!el) {
      showToast('error', 'Click inside a message field first to place a variable.');
      return;
    }

    const start = el.selectionStart || 0;
    const end = el.selectionEnd || 0;
    const currentVal = form[lastFocusedField] || '';
    const newVal = currentVal.substring(0, start) + tag + currentVal.substring(end);

    if (lastFocusedField === 'email_subject') set('email_subject', newVal);
    else updateBodyField(lastFocusedField, newVal);

    setTimeout(() => {
      el.focus();
      const newCursorPos = tag === '{{}}' ? start + 2 : start + tag.length;
      el.setSelectionRange(newCursorPos, newCursorPos);
    }, 0);
  };

  // Rich text toolbar for the email body — wraps the current selection in a
  // tag the same way insertVariable wraps a cursor position with a variable.
  // The field stays a plain textarea (so it shares the exact same selection
  // logic as variable insertion, with no contentEditable cursor quirks);
  // the tags become visible bold/italic/underline only in the Preview drawer.
  const wrapEmailSelection = (tagOpen: string, tagClose: string) => {
    const el = emailBodyRef.current;
    if (!el) {
      showToast('error', 'Click inside the email body first.');
      return;
    }
    const start = el.selectionStart || 0;
    const end = el.selectionEnd || 0;
    const currentVal = form.email_body || '';
    const selected = currentVal.substring(start, end);
    const newVal = currentVal.substring(0, start) + tagOpen + selected + tagClose + currentVal.substring(end);
    updateBodyField('email_body', newVal);
    setTimeout(() => {
      el.focus();
      el.setSelectionRange(start + tagOpen.length, start + tagOpen.length + selected.length);
    }, 0);
  };

  const copyEmailToSMS = () => {
    if (!form.email_body) return;
    const plainText = stripHtmlToText(form.email_body);
    set('sms_message', plainText);
    setLastFocusedField('sms_message');
    showToast('success', 'Email body converted to plain text and copied to SMS.');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.event_type) {
      showToast('error', 'Please provide a template name and select an event trigger.'); return;
    }
    if (!form.send_email && !form.send_sms && !form.send_whatsapp) {
       showToast('error', 'You must enable at least one delivery channel (Email, SMS, or WhatsApp).'); return;
    }
    if (form.send_email && (!form.email_subject?.trim() || !stripHtmlToText(form.email_body || '').trim())) {
      showToast('error', 'Email subject and body are required when Email channel is enabled.'); return;
    }
    if (form.send_sms && !form.sms_message?.trim()) {
      showToast('error', 'SMS message content is required when SMS channel is enabled.'); return;
    }
    if (form.send_whatsapp && !form.whatsapp_message?.trim()) {
      showToast('error', 'WhatsApp message content is required when WhatsApp channel is enabled.'); return;
    }

    try {
      await onSave(form);
    } catch (err) { showToast('error', extractError(err)); }
  };

  const inputCls = "w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-violet-500/40 focus:border-violet-400 outline-none bg-white font-medium text-slate-800 transition-shadow";
  const labelCls = "block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5";

  // SMS Estimation Math
  const sim = simulateTextLength(form.sms_message || '', form.event_type);
  const estimatedPages = Math.ceil(sim.length / (smsCharLimit || 160)) || 0;
  const totalEstimatedPages = estimatedPages * estimatedRecipients;
  const estimatedCost = totalEstimatedPages * smsCostPerPage;
  const isMultiPage = estimatedPages > 1;

  const previewInitialChannel: PreviewChannel =
    lastFocusedField === 'whatsapp_message' ? 'whatsapp' :
    lastFocusedField === 'email_subject' || lastFocusedField === 'email_body' ? 'email' : 'sms';

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center sm:p-4">
      {showHelp && <VariablesHelpModal onClose={() => setShowHelp(false)} />}
      {showPreview && <PreviewDrawer form={form} initialChannel={previewInitialChannel} onClose={() => setShowPreview(false)} />}

      <div className="bg-white w-full h-full sm:h-[min(880px,calc(100vh-2rem))] sm:max-w-3xl lg:max-w-6xl sm:rounded-2xl shadow-2xl ring-1 ring-black/5 flex flex-col overflow-hidden">

        {/* Header */}
        <div className="bg-gradient-to-r from-violet-600 to-purple-600 px-4 sm:px-6 py-4 flex items-center justify-between flex-shrink-0">
          <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2 min-w-0">
            <span className="w-7 h-7 rounded-lg bg-white/15 flex items-center justify-center flex-shrink-0">
              <Layout className="h-4 w-4" />
            </span>
            <span className="truncate">{editing ? 'Edit Notification Template' : 'Create Notification Template'}</span>
          </h3>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {/* Preview button: mobile/tablet only — on lg+ the live preview is
                always visible as a side panel, so the button would be redundant. */}
            <button type="button" onClick={() => setShowPreview(true)}
              className="lg:hidden inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-white/15 hover:bg-white/25 px-2.5 py-1.5 rounded-lg transition-colors">
              <Eye className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Preview</span>
            </button>
            <button onClick={onClose} disabled={isSaving} className="text-white/70 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Body: form column, plus a persistent live-preview column on lg+ */}
        <div className="flex-1 min-h-0 flex flex-col lg:flex-row overflow-hidden">
          <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6">
            <form id="template-form" onSubmit={handleSubmit} className="space-y-6 max-w-2xl mx-auto lg:mx-0">

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Event Trigger <span className="text-red-500">*</span></label>
                  <select value={form.event_type} onChange={e => set('event_type', e.target.value as NotificationTemplateEventType)} className={inputCls} disabled={!!editing}>
                    <option value="" disabled>Select an event...</option>
                    {EVENT_TYPE_OPTIONS.map(o => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                  {editing && <p className="text-[10px] text-slate-400 mt-1">Triggers cannot be changed after creation.</p>}
                </div>
                <div>
                  <label className={labelCls}>Template Name <span className="text-red-500">*</span></label>
                  <input required type="text" value={form.name} onChange={e => set('name', e.target.value)}
                    placeholder="e.g. Term 1 Fee Receipt" className={inputCls} />
                </div>
              </div>

              {/* Available Variables — placed right under the trigger so it's visible
                  without scrolling past the whole form on mobile */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className={labelCls + ' mb-0'}>Available Variables</label>
                  <button type="button" onClick={() => setShowHelp(true)}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-violet-600 hover:text-violet-700">
                    <HelpCircle className="h-3 w-3" /> Guide
                  </button>
                </div>
                <p className="text-[11px] text-slate-400 mb-2">
                  {form.event_type ? 'Click a variable to insert it wherever you last clicked below.' : 'Select an event trigger to see its available variables.'}
                </p>
                {form.event_type && (
                  <div className="flex flex-wrap gap-1.5">
                    {getVarsForEvent(form.event_type).map(v => (
                      <button key={v.tag} type="button" onClick={() => insertVariable(v.tag)}
                        className="inline-flex flex-col items-start px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg hover:border-violet-400 hover:shadow-sm transition-all text-left">
                        <span className="text-[10px] font-bold text-slate-700">{v.label}</span>
                        <span className="text-[9px] font-mono text-slate-400 mt-0.5">{v.tag}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="pt-2 border-t border-slate-100">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-1">
                  <p className="text-sm font-bold text-slate-800">Delivery Channels</p>
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <button type="button" role="switch" aria-checked={syncEnabled} onClick={() => setSyncEnabled(v => !v)}
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors flex-shrink-0 ${syncEnabled ? 'bg-violet-600' : 'bg-slate-200'}`}>
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${syncEnabled ? 'translate-x-4' : 'translate-x-0.5'}`} />
                    </button>
                    <span className="text-xs font-semibold text-slate-600 whitespace-nowrap">Keep channels in sync</span>
                  </label>
                </div>
                <p className="text-[11px] text-slate-400 mb-4 leading-relaxed">
                  While on, editing any enabled channel's message updates the others automatically as plain text. Turn off to write different wording per channel.
                </p>

                {/* Email Section */}
                <div className={`mb-4 p-3.5 sm:p-4 rounded-xl border transition-all duration-300 space-y-4 ${form.send_email ? 'bg-slate-50/50 border-violet-200' : 'bg-white border-slate-200'}`}>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-colors ${form.send_email ? 'bg-violet-600 border-violet-600' : 'border-slate-300 bg-white'}`}
                      onClick={(e) => { e.preventDefault(); toggleChannel('send_email', 'email_body'); }}>
                      {form.send_email && <Check className="h-3 w-3 text-white" />}
                    </div>
                    <div className="flex items-center gap-2" onClick={() => toggleChannel('send_email', 'email_body')}>
                      <Mail className={`h-4 w-4 ${form.send_email ? 'text-violet-600' : 'text-slate-400'}`} />
                      <span className={`font-bold ${form.send_email ? 'text-slate-900' : 'text-slate-500'}`}>Email Message</span>
                    </div>
                  </label>

                  {form.send_email && (
                    <div className="space-y-3 sm:pl-8 animate-[fadeIn_0.2s_ease-out]">
                      <div>
                        <label className={labelCls}>Subject Line</label>
                        <input type="text" required ref={emailSubjRef} value={form.email_subject} onChange={e => set('email_subject', e.target.value)}
                          onFocus={() => setLastFocusedField('email_subject')}
                          placeholder="e.g. Payment Received for {{student_name}}" className={inputCls} />
                      </div>
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label className={labelCls + ' mb-0'}>Email Body</label>
                          <button type="button" onClick={() => setShowPreview(true)}
                            className="lg:hidden inline-flex items-center gap-1 text-[11px] font-semibold text-violet-600 hover:text-violet-700">
                            <Eye className="h-3 w-3" /> Preview
                          </button>
                        </div>
                        {/* Rich text toolbar — wraps the selected text in HTML tags,
                            same selection-based mechanism as variable insertion */}
                        <div className="flex items-center gap-1 mb-1.5 p-1 bg-white border border-slate-200 rounded-lg w-fit">
                          <button type="button" onClick={() => wrapEmailSelection('<strong>', '</strong>')} title="Bold"
                            className="p-1.5 rounded-md text-slate-600 hover:bg-slate-100 hover:text-violet-700 transition-colors">
                            <Bold className="h-3.5 w-3.5" />
                          </button>
                          <button type="button" onClick={() => wrapEmailSelection('<em>', '</em>')} title="Italic"
                            className="p-1.5 rounded-md text-slate-600 hover:bg-slate-100 hover:text-violet-700 transition-colors">
                            <Italic className="h-3.5 w-3.5" />
                          </button>
                          <button type="button" onClick={() => wrapEmailSelection('<u>', '</u>')} title="Underline"
                            className="p-1.5 rounded-md text-slate-600 hover:bg-slate-100 hover:text-violet-700 transition-colors">
                            <Underline className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        <textarea rows={4} required ref={emailBodyRef} value={form.email_body} onChange={e => updateBodyField('email_body', e.target.value)}
                          onFocus={() => setLastFocusedField('email_body')}
                          placeholder="Dear {{parent_name}},&#10;We received your payment..." className={inputCls + ' font-mono text-xs'} />
                        <p className="text-[10px] text-slate-400 mt-1.5 leading-relaxed">
                          Select text and use the buttons above to bold/italicize/underline — tags are visible here as you type; use Preview to see it rendered.
                        </p>
                      </div>
                      <div className="flex justify-end">
                        <button type="button" onClick={copyEmailToSMS} className="inline-flex items-center gap-1.5 text-xs font-bold text-violet-600 hover:text-violet-700 bg-violet-50 hover:bg-violet-100 px-3 py-1.5 rounded-lg border border-violet-200 transition-colors">
                          <Wand2 className="h-3.5 w-3.5" /> Auto-Extract to Plain SMS
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* SMS Section */}
                <div className={`mb-4 p-3.5 sm:p-4 rounded-xl border transition-all duration-300 space-y-4 ${form.send_sms ? 'bg-slate-50/50 border-violet-200' : 'bg-white border-slate-200'}`}>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-colors ${form.send_sms ? 'bg-violet-600 border-violet-600' : 'border-slate-300 bg-white'}`}
                      onClick={(e) => { e.preventDefault(); toggleChannel('send_sms', 'sms_message'); }}>
                      {form.send_sms && <Check className="h-3 w-3 text-white" />}
                    </div>
                    <div className="flex items-center gap-2" onClick={() => toggleChannel('send_sms', 'sms_message')}>
                      <Smartphone className={`h-4 w-4 ${form.send_sms ? 'text-violet-600' : 'text-slate-400'}`} />
                      <span className={`font-bold ${form.send_sms ? 'text-slate-900' : 'text-slate-500'}`}>SMS Message</span>
                    </div>
                  </label>

                  {form.send_sms && (
                    <div className="space-y-3 sm:pl-8 animate-[fadeIn_0.2s_ease-out]">
                      <div>
                        <textarea rows={4} required ref={smsRef} value={form.sms_message} onChange={e => updateBodyField('sms_message', e.target.value)}
                          onFocus={() => setLastFocusedField('sms_message')}
                          placeholder="Plain text only..." className={inputCls} />
                      </div>
                      {/* Live Estimator Component */}
                      <div className={`p-3 rounded-xl space-y-3 border ${isMultiPage ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200'}`}>
                        <div className="flex items-center justify-between flex-wrap gap-1.5">
                          <span className={`text-xs font-bold flex items-center gap-1.5 ${isMultiPage ? 'text-red-900' : 'text-amber-900'}`}><Calculator className="h-3.5 w-3.5"/> Billing Estimator</span>
                          <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded border ${isMultiPage ? 'text-red-700 bg-red-100 border-red-200' : 'text-amber-700 bg-amber-100 border-amber-200'}`}>Simulated Char Length: {sim.length}</span>
                        </div>
                        {isMultiPage && (
                          <p className="text-[11px] font-semibold text-red-700 flex items-center gap-1.5">
                            <AlertTriangle className="h-3 w-3 flex-shrink-0" /> This message spans {estimatedPages} SMS pages per recipient — cost scales accordingly.
                          </p>
                        )}
                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4">
                          <div className="flex-1">
                            <label className={`text-[10px] font-bold uppercase tracking-wide ${isMultiPage ? 'text-red-800' : 'text-amber-800'}`}>Target Recipients</label>
                            <input type="number" min="1" value={estimatedRecipients} onChange={e => setEstimatedRecipients(Number(e.target.value) || 1)}
                              className={`w-full px-2.5 py-1.5 text-xs font-mono border rounded-lg focus:ring-2 outline-none mt-1 ${isMultiPage ? 'border-red-300 focus:ring-red-500' : 'border-amber-300 focus:ring-amber-500'}`} />
                          </div>
                          <div className="flex-1 text-left sm:text-right sm:border-l border-amber-200/70 sm:pl-3">
                            <p className={`text-[10px] font-bold uppercase tracking-wide ${isMultiPage ? 'text-red-800' : 'text-amber-800'}`}>
                              Est. Cost (₦{smsCostPerPage}/page)
                            </p>
                            <p className={`text-xl font-mono font-bold leading-none mt-1.5 ${isMultiPage ? 'text-red-950' : 'text-amber-950'}`}>
                              ₦{estimatedCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </p>
                            <p className={`text-[9px] font-bold mt-1.5 uppercase tracking-wide ${isMultiPage ? 'text-red-700' : 'text-amber-700'}`}>
                              {totalEstimatedPages} Total Pages Billed
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* WhatsApp Section */}
                <div className={`p-3.5 sm:p-4 rounded-xl border transition-all duration-300 space-y-4 ${form.send_whatsapp ? 'bg-slate-50/50 border-violet-200' : 'bg-white border-slate-200'}`}>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-colors ${form.send_whatsapp ? 'bg-violet-600 border-violet-600' : 'border-slate-300 bg-white'}`}
                      onClick={(e) => { e.preventDefault(); toggleChannel('send_whatsapp', 'whatsapp_message'); }}>
                      {form.send_whatsapp && <Check className="h-3 w-3 text-white" />}
                    </div>
                    <div className="flex items-center gap-2" onClick={() => toggleChannel('send_whatsapp', 'whatsapp_message')}>
                      <MessageSquare className={`h-4 w-4 ${form.send_whatsapp ? 'text-violet-600' : 'text-slate-400'}`} />
                      <span className={`font-bold ${form.send_whatsapp ? 'text-slate-900' : 'text-slate-500'}`}>WhatsApp Message</span>
                    </div>
                  </label>

                  {form.send_whatsapp && (
                    <div className="space-y-3 sm:pl-8 animate-[fadeIn_0.2s_ease-out]">
                      <textarea rows={4} required ref={waRef} value={form.whatsapp_message} onChange={e => updateBodyField('whatsapp_message', e.target.value)}
                        onFocus={() => setLastFocusedField('whatsapp_message')}
                        placeholder="Supports basic formatting (*bold*, _italic_)..." className={inputCls} />
                    </div>
                  )}
                </div>

              </div>
            </form>
          </div>

          {/* Persistent live preview — desktop/laptop only (lg+). On smaller
              screens use the "Preview" button instead, which opens PreviewDrawer. */}
          <DesktopPreviewPanel form={form} focusedChannel={previewInitialChannel} />
        </div>

        {/* Footer */}
        <div className="flex flex-col sm:flex-row sm:justify-end gap-3 px-4 sm:px-6 py-4 border-t border-slate-100 bg-white flex-shrink-0">
          <div className="sm:mr-auto flex items-center justify-between sm:justify-start">
             <label className="flex items-center gap-2 cursor-pointer">
              <span className="text-xs font-bold text-slate-600 uppercase tracking-wide">Template is Active</span>
              <button type="button" role="switch" aria-checked={form.is_active} onClick={() => set('is_active', !form.is_active)}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${form.is_active ? 'bg-emerald-600' : 'bg-slate-300'}`}>
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${form.is_active ? 'translate-x-4' : 'translate-x-0.5'}`} />
              </button>
            </label>
          </div>
          <div className="flex gap-3">
            <button type="button" onClick={onClose} disabled={isSaving} className="flex-1 sm:flex-none px-4 py-2 text-sm border border-slate-200 rounded-xl font-medium text-slate-600 hover:bg-slate-50 transition-colors">
              Cancel
            </button>
            <button type="submit" form="template-form" disabled={isSaving} className="flex-1 sm:flex-none px-5 py-2 text-sm bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white font-bold rounded-xl shadow-md flex items-center justify-center gap-2 transition-all">
              {isSaving ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving...</> : <><Check className="h-4 w-4" /> Save Template</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page Component ───────────────────────────────────────────────────────

export default function NotificationTemplatesPage() {
  const { hasPermission, user } = useAuth();
  const [templates, setTemplates] = useState<NotificationTemplate[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showActiveOnly, setShowActiveOnly] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<NotificationTemplate | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingTemplate, setDeletingTemplate] = useState<NotificationTemplate | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [previewingTemplate, setPreviewingTemplate] = useState<NotificationTemplate | null>(null);
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  // Fetch character limit and cost settings directly here
  const [smsCharLimit, setSmsCharLimit] = useState(160);
  const [smsCostPerPage, setSmsCostPerPage] = useState(0);

  const canManage = user?.is_superuser || hasPermission('communication.manage_communication_settings');

  const showToast = (type: 'success' | 'error', message: string) => {
    const id = ++_toastId;
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4500);
  };
  const dismissToast = (id: number) => setToasts(prev => prev.filter(t => t.id !== id));

  const fetchTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const data = await templatesAPI.list();
      setTemplates(data);
      // Fetch settings for estimator
      const settingsRes = await api.get('/api/communication/settings/');
      const settingsObj = Array.isArray(settingsRes.data?.results) ? settingsRes.data.results[0] : settingsRes.data[0] || settingsRes.data;
      if (settingsObj?.sms_page_character_length) {
        setSmsCharLimit(settingsObj.sms_page_character_length);
      }
      if (settingsObj?.platform_sms_cost_per_page) {
        setSmsCostPerPage(Number(settingsObj.platform_sms_cost_per_page));
      }
    } catch (err) { showToast('error', extractError(err)); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchTemplates(); }, [fetchTemplates]);

  const openCreate = () => { setEditingTemplate(null); setShowModal(true); };
  const openEdit = (template: NotificationTemplate) => { setEditingTemplate(template); setShowModal(true); };

  const handleSave = async (form: NotificationTemplateFormValues) => {
    setIsSaving(true);
    try {
      if (editingTemplate) {
        const updated = await templatesAPI.update(editingTemplate.id, form);
        setTemplates(prev => prev.map(t => t.id === updated.id ? updated : t));
        showToast('success', `"${updated.name}" updated successfully.`);
      } else {
        const created = await templatesAPI.create(form);
        setTemplates(prev => [created, ...prev]);
        showToast('success', `"${created.name}" created successfully.`);
      }
      setShowModal(false);
    } finally { setIsSaving(false); }
  };

  const handleDelete = async () => {
    if (!deletingTemplate) return;
    setIsDeleting(true);
    try {
      await templatesAPI.delete(deletingTemplate.id);
      setTemplates(prev => prev.filter(t => t.id !== deletingTemplate.id));
      showToast('success', `"${deletingTemplate.name}" removed successfully.`);
      setDeletingTemplate(null);
    } catch (err) { showToast('error', extractError(err)); setDeletingTemplate(null); }
    finally { setIsDeleting(false); }
  };

  const filteredTemplates = templates.filter(t => {
    const matchSearch = t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        eventLabel(t.event_type).toLowerCase().includes(searchTerm.toLowerCase());
    const matchActive = !showActiveOnly || t.is_active;
    return matchSearch && matchActive;
  });

  const activeCount = templates.filter(t => t.is_active).length;

  return (
    <div className="space-y-4 max-w-6xl mx-auto pb-12">
      <ToastStack toasts={toasts} onDismiss={dismissToast} />
      <ConfirmModal open={!!deletingTemplate} template={deletingTemplate} isDeleting={isDeleting} onConfirm={handleDelete} onCancel={() => setDeletingTemplate(null)} />
      {showModal && <TemplateModal editing={editingTemplate} isSaving={isSaving} smsCharLimit={smsCharLimit} smsCostPerPage={smsCostPerPage} onSave={handleSave} onClose={() => setShowModal(false)} showToast={showToast} />}
      {previewingTemplate && <TemplatePreviewModal template={previewingTemplate} onClose={() => setPreviewingTemplate(null)} />}

      {/* Top Hub Header */}
      <div className="bg-white rounded-xl ring-1 ring-slate-100 shadow-sm p-4">
        <div className="flex flex-col items-start sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-violet-600 to-purple-600 rounded-lg flex items-center justify-center text-white shadow-sm flex-shrink-0">
              <Layout className="h-4 w-4" />
            </div>
            <div>
              <h1 className="text-base font-bold text-slate-900 leading-tight">Notification Templates</h1>
              <p className="text-xs text-slate-400 mt-0.5">Define automated messages sent on specific system events</p>
            </div>
          </div>
          {canManage && (
            <button onClick={() => openCreate()} className="self-stretch sm:self-auto px-3.5 py-2 bg-gradient-to-r from-violet-600 to-purple-600 text-white text-xs font-bold rounded-lg shadow-sm flex items-center justify-center gap-1.5 hover:from-violet-700 hover:to-purple-700 transition-all flex-shrink-0">
              <Plus className="h-3.5 w-3.5" /> Create Template
            </button>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-xl ring-1 ring-slate-100 shadow-sm p-3.5 sm:p-4 flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[10px] sm:text-xs text-slate-400 font-bold uppercase tracking-wider truncate">Total Templates</p>
            <p className="text-xl sm:text-2xl font-bold font-mono text-slate-900 mt-0.5">
              {loading ? '—' : templates.length}
            </p>
          </div>
          <div className="w-9 h-9 sm:w-10 sm:h-10 bg-gradient-to-br from-slate-400 to-slate-500 rounded-xl flex items-center justify-center text-white shadow-sm flex-shrink-0">
            <Layout className="h-4 w-4 sm:h-5 sm:w-5" />
          </div>
        </div>
        <div className="bg-white rounded-xl ring-1 ring-slate-100 shadow-sm p-3.5 sm:p-4 flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[10px] sm:text-xs text-slate-400 font-bold uppercase tracking-wider truncate">Active Templates</p>
            <p className="text-xl sm:text-2xl font-bold font-mono text-slate-900 mt-0.5">
              {loading ? '—' : activeCount}
            </p>
          </div>
          <div className={`w-9 h-9 sm:w-10 sm:h-10 bg-gradient-to-br rounded-xl flex items-center justify-center text-white shadow-sm flex-shrink-0 ${activeCount > 0 ? 'from-emerald-500 to-teal-600' : 'from-amber-400 to-orange-500'}`}>
            {activeCount > 0 ? <Radio className="h-4 w-4 sm:h-5 sm:w-5" /> : <AlertTriangle className="h-4 w-4 sm:h-5 sm:w-5" />}
          </div>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="bg-white rounded-xl ring-1 ring-slate-100 shadow-sm p-3 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input type="text" placeholder="Search by template name or event type..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-violet-500/40 focus:border-violet-400 outline-none font-medium transition-shadow" />
        </div>
        <div className="flex items-center justify-between sm:justify-start gap-3 flex-shrink-0">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <button type="button" role="switch" aria-checked={showActiveOnly} onClick={() => setShowActiveOnly(v => !v)}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${showActiveOnly ? 'bg-violet-600' : 'bg-slate-200'}`}>
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${showActiveOnly ? 'translate-x-4' : 'translate-x-0.5'}`} />
            </button>
            <span className="text-xs sm:text-sm font-semibold text-slate-700 whitespace-nowrap">Active Only</span>
          </label>
          <button onClick={fetchTemplates} className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors flex-shrink-0" title="Refresh">
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Templates List Grid */}
      {loading ? (
        <div className="bg-white rounded-2xl ring-1 ring-slate-100 shadow-sm p-16 text-center">
          <Loader2 className="h-8 w-8 animate-spin text-violet-600 mx-auto" />
          <p className="mt-3 text-sm text-slate-400 font-medium">Loading templates...</p>
        </div>
      ) : filteredTemplates.length === 0 ? (
        <div className="bg-white rounded-2xl ring-1 ring-slate-100 p-16 text-center shadow-sm">
          <div className="w-16 h-16 bg-gradient-to-br from-violet-100 to-purple-100 rounded-2xl flex items-center justify-center mx-auto mb-4 text-violet-600">
            <Layout className="h-8 w-8" />
          </div>
          <h3 className="font-bold text-slate-800 text-base mb-1">
            {searchTerm ? 'No matching templates found' : 'No Templates Configured'}
          </h3>
          <p className="text-sm text-slate-400 mb-6 max-w-sm mx-auto leading-relaxed">
            {searchTerm ? 'Try adjusting your search query.' : 'Create notification templates to automate messages sent when specific events occur.'}
          </p>
          {!searchTerm && canManage && (
            <button onClick={() => openCreate()}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-violet-600 to-purple-600 text-white text-sm font-bold rounded-xl shadow-md shadow-violet-200 hover:from-violet-700 hover:to-purple-700 transition-all">
              <Plus className="h-4 w-4" /> Create First Template
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {filteredTemplates.map(template => (
            <div key={template.id} className="bg-white rounded-xl ring-1 ring-slate-100 shadow-sm hover:shadow-md transition-shadow overflow-hidden flex flex-col">
              <div className={`h-1 w-full bg-gradient-to-r ${template.is_active ? 'from-emerald-500 to-teal-500' : 'from-slate-300 to-slate-400'}`} />
              <div className="p-4 flex-1 flex flex-col justify-between space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <span className="inline-block px-2 py-0.5 bg-violet-50 text-violet-700 text-[10px] font-bold uppercase tracking-wider rounded border border-violet-100 mb-1.5">
                      {eventLabel(template.event_type)}
                    </span>
                    <h3 className="font-bold text-slate-900 truncate text-base leading-tight">{template.name}</h3>
                  </div>
                  <span className={`flex-shrink-0 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-bold mt-0.5 ${template.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500'}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${template.is_active ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                    {template.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>

                <div className="p-3 bg-slate-50/70 rounded-lg border border-slate-100">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Configured Channels</p>
                    {(template.send_email || template.send_sms || template.send_whatsapp) && (
                      <button onClick={() => setPreviewingTemplate(template)} title="Preview message"
                        className="inline-flex items-center gap-1 text-[10px] font-bold text-violet-600 hover:text-violet-700">
                        <Eye className="h-3 w-3" /> Preview
                      </button>
                    )}
                  </div>
                  <div className="flex gap-2.5 flex-wrap">
                    {template.send_email && (
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 px-2.5 py-1 rounded-md shadow-sm">
                        <Mail className="h-3 w-3 text-violet-600" /> Email
                      </div>
                    )}
                    {template.send_sms && (
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 px-2.5 py-1 rounded-md shadow-sm">
                        <Smartphone className="h-3 w-3 text-violet-600" /> SMS
                      </div>
                    )}
                    {template.send_whatsapp && (
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 px-2.5 py-1 rounded-md shadow-sm">
                        <MessageSquare className="h-3 w-3 text-violet-600" /> WhatsApp
                      </div>
                    )}
                    {!(template.send_email || template.send_sms || template.send_whatsapp) && (
                      <span className="text-xs text-red-500 font-medium italic">No channels enabled</span>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between pt-0.5 border-t border-slate-50">
                  <div className="text-[10px] text-slate-400 font-medium">
                    Updated: {new Date(template.updated_at).toLocaleDateString()}
                  </div>
                  <div className="flex gap-1.5">
                    {canManage && (
                      <button onClick={() => openEdit(template)} title="Edit Template"
                        className="p-1.5 rounded-lg text-slate-600 bg-slate-50 hover:bg-slate-100 border border-slate-200 transition-colors">
                        <Edit3 className="h-3.5 w-3.5" />
                      </button>
                    )}
                    {canManage && (
                      <button onClick={() => setDeletingTemplate(template)} title="Delete Template"
                        className="p-1.5 rounded-lg text-red-600 bg-red-50 hover:bg-red-100 border border-red-100 transition-colors">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
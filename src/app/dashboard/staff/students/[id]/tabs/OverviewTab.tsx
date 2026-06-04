import React from 'react';
import { Student, StudentSettings } from '@/lib/types';
import { User, MapPin, Mail, Phone, Calendar, Globe } from 'lucide-react';

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 py-2.5 border-b border-slate-50 last:border-0">
      <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">{label}</span>
      <span className="text-sm font-medium text-slate-800">{value || '—'}</span>
    </div>
  );
}

function InfoCard({ title, icon: Icon, iconGradient, children }: {
  title: string; icon: any; iconGradient: string; children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-50">
        <div className={`w-8 h-8 rounded-xl flex items-center justify-center bg-gradient-to-br ${iconGradient} shadow-sm flex-shrink-0`}>
          <Icon className="h-3.5 w-3.5 text-white" />
        </div>
        <p className="text-sm font-bold text-slate-900">{title}</p>
      </div>
      <div className="px-5 pb-2">{children}</div>
    </div>
  );
}

export default function OverviewTab({ student, settings }: { student: Student; settings: StudentSettings | null }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      <InfoCard title="Basic Info" icon={User} iconGradient="from-blue-500 to-blue-600">
        <InfoRow label="First Name" value={student.first_name} />
        <InfoRow label="Middle Name" value={student.middle_name} />
        <InfoRow label="Last Name" value={student.last_name} />
        <InfoRow label="Gender" value={student.gender} />
        <InfoRow label="Religion" value={student.religion} />
        <InfoRow label="Date of Birth" value={student.date_of_birth ? new Date(student.date_of_birth).toLocaleDateString() : ''} />
      </InfoCard>

      <InfoCard title="Contact" icon={Phone} iconGradient="from-teal-500 to-cyan-600">
        <InfoRow label="Email" value={student.email} />
        <InfoRow label="Mobile" value={student.mobile} />
      </InfoCard>

      <InfoCard title="Location" icon={MapPin} iconGradient="from-violet-500 to-purple-600">
        <InfoRow label="State" value={student.state} />
        <InfoRow label="LGA" value={student.lga} />
        <InfoRow label="Address" value={(student as any).address || 'N/A'} />
      </InfoCard>

      {/* Extra fields if needed */}
      {student.extra_fields && Object.keys(student.extra_fields).length > 0 && (
        <InfoCard title="Additional Info" icon={Globe} iconGradient="from-slate-500 to-slate-600">
          {Object.entries(student.extra_fields).map(([k, v]) => (
             <InfoRow key={k} label={k} value={String(v)} />
          ))}
        </InfoCard>
      )}
    </div>
  );
}
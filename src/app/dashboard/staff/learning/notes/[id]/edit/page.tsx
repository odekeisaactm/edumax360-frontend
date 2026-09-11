'use client';
export const dynamic = 'force-dynamic';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { lessonNotesAPI } from '@/lib/api';
import { Loader2, AlertCircle } from 'lucide-react';
import NoteFormShell from '@/components/learning/notes/NoteFormShell';

export default function EditNotePage() {
  const { id } = useParams() as { id: string };
  const router = useRouter();
  const [note, setNote] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    lessonNotesAPI.get(Number(id))
      .then(data => {
        const isEditable =
          data.status === 'draft' ||
          (data.status === 'approved' && !data.approved_by);
        if (!isEditable) {
          router.replace(`/dashboard/staff/learning/notes/${id}?reason=not_editable`);
          return;
        }
        setNote(data);
      })
      .catch((e: any) => setError(e?.response?.data?.message || 'Failed to load note.'))
      .finally(() => setLoading(false));
  }, [id, router]);

  if (loading) return (
    <div className="min-h-[600px] flex items-center justify-center">
      <Loader2 className="h-10 w-10 animate-spin text-emerald-600" />
    </div>
  );

  if (error || !note) return (
    <div className="max-w-lg mx-auto mt-20 text-center bg-white rounded-2xl border border-red-100 shadow-sm p-10">
      <AlertCircle className="h-10 w-10 text-red-400 mx-auto mb-4" />
      <h2 className="text-lg font-bold text-slate-800 mb-1">Failed to load note</h2>
      <p className="text-sm text-slate-500">{error || 'Unknown error.'}</p>
      <button onClick={() => router.back()} className="mt-5 text-sm text-blue-600 font-medium hover:underline">Go back</button>
    </div>
  );

  return <NoteFormShell mode="edit" initialNote={note} noteId={Number(id)} />;
}
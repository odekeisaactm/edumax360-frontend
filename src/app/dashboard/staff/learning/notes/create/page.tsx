'use client';
export const dynamic = 'force-dynamic';

import NoteFormShell from '@/components/learning/notes/NoteFormShell';

export default function CreateNotePage() {
  return <NoteFormShell mode="create" />;
}
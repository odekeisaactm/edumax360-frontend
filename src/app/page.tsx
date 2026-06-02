'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

export default function HomePage() {
  const router = useRouter();
  const { user, loading, authReady } = useAuth();

  useEffect(() => {
    // Wait for auth to initialize
    if (!authReady) return;

    if (user) {
      // Redirect based on user type
      switch (user.user_type) {
        case 'staff':
          router.replace('/dashboard/staff');
          break;
        case 'student':
          router.replace('/dashboard/student');
          break;
        case 'parent':
          router.replace('/dashboard/parent');
          break;
        default:
          router.replace('/login');
      }
    } else {
      router.replace('/login');
    }
  }, [authReady, user, router]);

  // Show loading spinner while redirecting
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
    </div>
  );
}
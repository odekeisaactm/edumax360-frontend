'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { StaffSidebar } from '@/components/layout/StaffSidebar';
import { StudentSidebar } from '@/components/layout/StudentSidebar';
import { ParentSidebar } from '@/components/layout/ParentSidebar';
import { Header } from '@/components/layout/Header';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading, authReady } = useAuth();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Auth has finished initializing and there's no user — send them to login.
  // Without this, an unauthenticated visit just spins here forever.
  useEffect(() => {
    if (authReady && !loading && !user) {
      router.replace('/login');
    }
  }, [authReady, loading, user, router]);

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const renderSidebar = () => {
    switch (user.user_type) {
      case 'staff':
        return <StaffSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />;
      case 'student':
        return <StudentSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />;
      case 'parent':
        return <ParentSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sidebar — fixed, handles its own mobile/desktop visibility */}
      <div className="print:hidden">
        {renderSidebar()}
      </div>

      {/* Header — fixed, offset from sidebar on desktop */}
      <div className="print:hidden">
        <Header onMenuClick={() => setSidebarOpen(true)} />
      </div>

      {/* Main content — offset by sidebar width (md:ml-64) AND header height (pt-16) */}
      <div className="md:ml-64 pt-16 min-h-screen flex flex-col print:ml-0 print:pt-0">
        <main className="flex-1 p-6 print:p-0">
          {children}
        </main>
      </div>
    </div>
  );
}
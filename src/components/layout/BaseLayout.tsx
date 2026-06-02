import React, { ReactNode } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Header } from './Header';

interface BaseLayoutProps {
  children: ReactNode;
  title?: string;
}

export const BaseLayout: React.FC<BaseLayoutProps> = ({ children, title }) => {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header - hidden when printing */}
      <div className="print:hidden">
        <Header title={title} />
      </div>

      {/* Main content area */}
      <main className="flex-1">
        {children}
      </main>
    </div>
  );
};
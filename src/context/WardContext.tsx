'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { api } from '@/lib/api';
import { useRouter, usePathContext } from 'next/navigation';

export interface Ward {
  id: number;
  first_name: string;
  last_name: string;
  registration_number: string;
  image?: string;
  current_class_name?: string;
  current_class_section_name?: string;
}

interface WardContextType {
  wards: Ward[];
  selectedWard: Ward | null;
  setSelectedWard: (ward: Ward) => void;
  loading: boolean;
  refreshWards: () => Promise<void>;
}

const WardContext = createContext<WardContextType | undefined>(undefined);

export function WardProvider({ children }: { children: ReactNode }) {
  const [wards, setWards] = useState<Ward[]>([]);
  const [selectedWard, setSelectedWardState] = useState<Ward | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const refreshWards = async () => {
    setLoading(true);
    try {
      const response = await api.get('/api/student/parents/my-wards/');
      const wardsList = response.data.data || [];
      setWards(wardsList);
      
      // Try to restore from localStorage
      const savedWardId = localStorage.getItem('selectedWardId');
      if (savedWardId) {
        const found = wardsList.find((w: Ward) => w.id === Number(savedWardId));
        if (found) {
          setSelectedWardState(found);
        } else if (wardsList.length > 0) {
          setSelectedWard(wardsList[0]);
        }
      } else if (wardsList.length > 0) {
        setSelectedWard(wardsList[0]);
      }
    } catch (err) {
      console.error("Failed to fetch wards", err);
    } finally {
      setLoading(false);
    }
  };

  const setSelectedWard = (ward: Ward) => {
    setSelectedWardState(ward);
    localStorage.setItem('selectedWardId', String(ward.id));
  };

  useEffect(() => {
    refreshWards();
  }, []);

  return (
    <WardContext.Provider value={{ wards, selectedWard, setSelectedWard, loading, refreshWards }}>
      {children}
    </WardContext.Provider>
  );
}

export function useWard() {
  const context = useContext(WardContext);
  if (context === undefined) {
    throw new Error('useWard must be used within a WardProvider');
  }
  return context;
}

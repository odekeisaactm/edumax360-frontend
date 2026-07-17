'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { api } from '@/lib/api';

export interface Ward {
  id: number;
  first_name: string;
  last_name: string;
  registration_number: string;
  image?: string;
  current_class_name?: string;
  current_class_section_name?: string;
  gender?: string;
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

  const refreshWards = useCallback(async () => {
    setLoading(true);
    try {
      // Use your exact endpoint
      const response = await api.get('/api/student/parents/my-wards/');
      const wardsList = response.data?.data || response.data || [];
      setWards(wardsList);

      const savedWardId = localStorage.getItem('selectedWardId');

      if (wardsList.length === 1) {
        // EXACTLY 1 WARD: Auto-select and bypass selection screen
        setSelectedWardState(wardsList[0]);
        localStorage.setItem('selectedWardId', String(wardsList[0].id));
      } else if (savedWardId) {
        // MULTIPLE WARDS: Try to restore previously selected
        const found = wardsList.find((w: Ward) => w.id === Number(savedWardId));
        setSelectedWardState(found || null);
      } else {
        // MULTIPLE WARDS & NO SAVED STATE: Force selection
        setSelectedWardState(null);
      }
    } catch (err) {
      console.error("Failed to fetch wards", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshWards();
  }, [refreshWards]);

  const setSelectedWard = (ward: Ward) => {
    setSelectedWardState(ward);
    localStorage.setItem('selectedWardId', String(ward.id));
  };

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
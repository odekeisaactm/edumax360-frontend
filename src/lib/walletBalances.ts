/**
 * Wallet Balances — list student/staff wallets with balances, detect ones that
 * don't tally with their ledger, and correct them (decrease-only).
 * Backed by /api/finance/wallet-balances/ and /api/finance/wallet-balances/correct/.
 */
import api from './api';

export type WalletKind = 'student' | 'staff';
export type WalletShow = 'with_balance' | 'out_of_sync' | 'negative' | 'all';
export type CorrectionMode = 'reset' | 'to_ledger' | 'reduce';

export interface StudentWalletRow {
  wallet_id: number;
  id: number;
  name: string;
  registration_number: string | null;
  class_name: string | null;
  section_name: string | null;
  parent_name: string | null;
  status: string | null;
  fee_balance: string;
  fee_ledger: string;
  fee_in_sync: boolean;
  canteen_balance: string;
  canteen_ledger: string;
  canteen_in_sync: boolean;
  last_activity: string | null;
}

export interface StaffWalletRow {
  wallet_id: number;
  id: number;
  name: string;
  staff_id: string | null;
  department_name: string | null;
  balance: string;
  ledger: string;
  in_sync: boolean;
  last_activity: string | null;
}

export interface WalletBalancesResponse<Row> {
  kind: WalletKind;
  show: WalletShow;
  count: number;
  page: number;
  page_size: number;
  summary: Record<string, string | number>;
  results: Row[];
}

export interface WalletCorrectionPayload {
  kind: WalletKind;
  id: number;
  wallet_field?: 'fee' | 'canteen';
  mode: CorrectionMode;
  amount?: string;
  reason: string;
}

function errorMessage(err: any): string {
  const d = err?.response?.data;
  if (d) {
    if (typeof d === 'string') return d;
    if (d.detail) return String(d.detail);
  }
  return err?.message || 'Something went wrong.';
}

export const walletBalancesAPI = {
  list: async <Row = StudentWalletRow | StaffWalletRow>(params: {
    kind: WalletKind; show?: WalletShow; search?: string; class_id?: string | number; page?: number; page_size?: number;
  }): Promise<WalletBalancesResponse<Row>> => {
    try {
      const response = await api.get('/api/finance/wallet-balances/', { params });
      return response.data;
    } catch (err) {
      throw new Error(errorMessage(err));
    }
  },
  correct: async (payload: WalletCorrectionPayload): Promise<{
    detail: string; reference: string; removed: string; new_balance: string; row: StudentWalletRow | StaffWalletRow;
  }> => {
    try {
      const response = await api.post('/api/finance/wallet-balances/correct/', payload);
      return response.data;
    } catch (err) {
      throw new Error(errorMessage(err));
    }
  },
};

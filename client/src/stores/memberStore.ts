import { create } from 'zustand';
import { api } from '../lib/api';
import type { Member, MembershipPlan } from '../types';

interface MemberPayload {
  fullName: string;
  phone: string;
  planId: number;
  paymentMethod: string;
}

interface MemberStore {
  members: Member[];
  plans: MembershipPlan[];
  loading: boolean;
  fetchAll: () => Promise<void>;
  add: (payload: MemberPayload) => Promise<void>;
  update: (memberId: number, payload: Pick<MemberPayload, 'fullName' | 'phone'>) => Promise<void>;
  renew: (memberId: number, planId: number, paymentMethod: string) => Promise<void>;
  archive: (memberId: number) => Promise<void>;
}

export const useMemberStore = create<MemberStore>((set, get) => ({
  members: [],
  plans: [],
  loading: false,
  fetchAll: async () => {
    set({ loading: true });
    try {
      const [members, plans] = await Promise.all([
        api.get<Member[]>('/members'),
        api.get<MembershipPlan[]>('/plans'),
      ]);
      set({ members: members.data, plans: plans.data });
    } finally {
      set({ loading: false });
    }
  },
  add: async (payload) => {
    await api.post('/members', payload);
    await get().fetchAll();
  },
  update: async (memberId, payload) => {
    await api.put(`/members/${memberId}`, payload);
    await get().fetchAll();
  },
  renew: async (memberId, planId, paymentMethod) => {
    await api.post('/renewals', { memberId, planId, paymentMethod });
    await get().fetchAll();
  },
  archive: async (memberId) => {
    await api.delete(`/members/${memberId}`);
    set((state) => ({ members: state.members.filter((member) => member.MemberID !== memberId) }));
  },
}));

import { create } from 'zustand';
import axios from 'axios';

export interface Member {
  MemberID: number;
  FullName: string;
  Phone: string;
  PlanName: string;
  EndDate: string;
  DaysLeft: number;
}

interface MemberStore {
  members: Member[];
  isLoading: boolean;
  fetchMembers: () => Promise<void>;
  addMember: (data: any) => Promise<boolean>;
  deleteMember: (id: number) => Promise<boolean>;
  editMember: (id: number, fullName: string, phone: string) => Promise<boolean>;
}


const API_URL = import.meta.env.VITE_API_URL;

export const useMemberStore = create<MemberStore>((set, get) => ({
  members: [],
  isLoading: false,

  fetchMembers: async () => {
    try {
        const response = await axios.get(`${API_URL}/api/members`);
        set({ members: response.data });
    } catch (e) { console.error(e) }
  },

  addMember: async (newItem) => {
    try {
        await axios.post(`${API_URL}/api/members`, newItem);
        get().fetchMembers();
        return true;
    } catch (e) { return false; }
  },

  deleteMember: async (id) => {
    if (!confirm('¿Estás seguro de eliminar este registro?')) return false;
    try {
        await axios.delete(`${API_URL}/api/members/${id}`);
        set(state => ({ members: state.members.filter(m => m.MemberID !== id) }));
        return true;
    } catch (error) {
        console.error(error);
        return false;
    }
  },

  editMember: async (id, fullName, phone) => {
    try {
        await axios.put(`${API_URL}/api/members/${id}`, { fullName, phone });
        get().fetchMembers();
        return true;
    } catch (error) {
        console.error(error);
        return false;
    }
  },
}));
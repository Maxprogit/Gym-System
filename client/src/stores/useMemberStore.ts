import { create } from 'zustand';
import axios from 'axios';
import { toast } from 'sonner';
import { confirmToast } from '../components/ui/ConfirmToast';

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
  renewMember: (data: {memberId: number, planId: number, amount: number, paymentMethod: string}) => Promise<boolean>;
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
        toast.success('Miembro agregado exitosamente');
        return true;
    } catch (e) { 
      toast.error('Error al agregar miembro');
      return false; 
    }
  },

  

  renewMember: async ({ memberId, planId, amount, paymentMethod }) => {
    try {
      await axios.post(`${API_URL}/api/renew`, { memberId, planId, amount, paymentMethod });
      get().fetchMembers();
      toast.success('Membresía renovada exitosamente', {position: 'top-right'});
      return true;
    } catch (error) {
      console.error(error);
      toast.error('Error al renovar membresía');
      return false;
    }
  },

  deleteMember: async (id) => {
    const confirmed = await confirmToast('¿Estás seguro de eliminar este miembro?');
    if (!confirmed) return false;
    // if (!confirm('¿Estás seguro de eliminar este registro?')) return false;
    try {
        await axios.delete(`${API_URL}/api/members/${id}`);
        set(state => ({ members: state.members.filter(m => m.MemberID !== id) }));
        toast.success('Miembro eliminado exitosamente');
        return true;
    } catch (error) {
        console.error(error);
        toast.error('Error al eliminar miembro');
        return false;
    }
  },

  editMember: async (id, fullName, phone) => {
    try {
        await axios.put(`${API_URL}/api/members/${id}`, { fullName, phone });
        get().fetchMembers();
        toast.success('Miembro editado exitosamente');
        return true;
    } catch (error) {
        console.error(error);
        toast.error('Error al editar miembro');
        return false;
    }
  },
}));
import { create } from 'zustand';
import axios from 'axios'; // Asegúrate de tener axios: npm install axios

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
  // NUEVAS ACCIONES
  deleteMember: (id: number) => Promise<boolean>;
  editMember: (id: number, fullName: string, phone: string) => Promise<boolean>;
}

export const useMemberStore = create<MemberStore>((set, get) => ({
  members: [],
  isLoading: false,

  fetchMembers: async () => {
    // ... (Tu código existente)
    try {
        const response = await axios.get('http://localhost:3001/api/members');
        set({ members: response.data });
    } catch (e) { console.error(e) }
  },

  addMember: async (newItem) => {
    // ... (Tu código existente)
    try {
        await axios.post('http://localhost:3001/api/members', newItem);
        get().fetchMembers();
        return true;
    } catch (e) { return false; }
  },

  // NUEVO: Borrar
  deleteMember: async (id) => {
    if (!confirm('¿Estás seguro de eliminar este registro? Esta acción no se puede deshacer.')) return false;
    try {
        await axios.delete(`http://localhost:3001/api/members/${id}`);
        set(state => ({ members: state.members.filter(m => m.MemberID !== id) })); // Actualización optimista
        return true;
    } catch (error) {
        console.error(error);
        return false;
    }
  },

  // NUEVO: Renovar
  editMember: async (id, fullName, phone) => {
    try {
        await axios.put(`http://localhost:3001/api/members/${id}`, { fullName, phone });
        get().fetchMembers(); // Recargar lista
        return true;
    } catch (error) {
        console.error(error);
        return false;
    }
  },
}));
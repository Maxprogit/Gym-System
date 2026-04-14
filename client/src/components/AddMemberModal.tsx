import { useState } from 'react';
import { X, Save, Loader2 } from 'lucide-react';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { useMemberStore } from '../stores/useMemberStore';
import { useEffect } from 'react';
import { API } from '../config/api';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface Plan {
  PlanID: number;
  PlanName: string;
  DurationDays: number;
  Price: number;
}

export function AddMemberModal({ isOpen, onClose }: ModalProps) {
  const { addMember } = useMemberStore();
  const [loading, setLoading] = useState(false);
  const [plans, setPlans] = useState<Plan[]>([]);
  
  // Estado del formulario
  const [formData, setFormData] = useState({
    fullName: '',
    phone: '521', // Prefijo por defecto para WhatsApp MX
    planId: 1 // Por defecto plan 1 (puedes hacerlo dinámico luego)
  });

  useEffect(() => {
    if (isOpen) {
      fetch(API.plans, { method: 'GET' })
      .then(res => res.json())
      .then(data => {
        setPlans(data);
        setFormData(prev => ({ ...prev, planId: data[0]?.PlanID || 0 }));
        console.log("Planes disponibles:", data);
      });
    }
  }, [isOpen]);


  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    const success = await addMember(formData);
    
    setLoading(false);
    if (success) {
      // Limpiar y cerrar
      setFormData({ fullName: '', phone: '521', planId: 1 });
      onClose();
    } else {
      alert("Error al guardar. Revisa que el backend esté corriendo.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-[#18181b] border border-[#27272a] rounded-xl p-6 shadow-[0_0_50px_rgba(0,0,0,0.5)]">
        
        {/* Header Modal */}
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-heading font-bold text-white">NUEVO ATLETA</h2>
          <button onClick={onClose} className="text-[#a1a1aa] hover:text-white transition-colors">
            <X size={24} />
          </button>
        </div>

        {/* Formulario */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input 
            label="Nombre Completo" 
            placeholder="Ej: Juan Pérez"
            required
            value={formData.fullName}
            onChange={(e) => setFormData({...formData, fullName: e.target.value})}
          />
          
          <div className="space-y-2">
             <label className="text-xs font-mono text-[#a1a1aa] uppercase tracking-wider">Teléfono (WhatsApp)</label>
             <Input 
                placeholder="521..."
                required
                value={formData.phone}
                onChange={(e) => setFormData({...formData, phone: e.target.value})}
             />
             <p className="text-[10px] text-[#a1a1aa] font-mono">Debe incluir código de país (Ej: 521 para México)</p>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-mono text-[#a1a1aa] uppercase tracking-wider">Plan</label>
            <select 
              className="flex h-11 w-full rounded-lg border border-[#27272a] bg-[#18181b] px-3 py-2 text-sm text-white focus:outline-none focus:border-[#D4FF00] transition-all font-mono"
              value={formData.planId}
              onChange={(e) => setFormData({...formData, planId: Number(e.target.value)})}
            >
              {plans.map(plan => (
                <option key={plan.PlanID} value={plan.PlanID}>
                  {plan.PlanName} - {plan.DurationDays} días - ${plan.Price}
                </option>
              ))}
              
            </select>
          </div>

          <div className="pt-4 flex justify-end gap-3">
            <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
            <Button className="bg-[#D4FF00] text-black font-extrabold hover:bg-[#b8dd00] hover:shadow-[0_0_20px_#D4FF00] transition-all" type="submit" isLoading={loading}>
              <Save className="mr-2 h-4 w-4" /> Guardar Atleta
            </Button>
          </div>
        </form>

      </div>
    </div>
  );
}
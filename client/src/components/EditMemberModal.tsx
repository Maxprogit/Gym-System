import { useState, useEffect } from 'react';
import { X, Save } from 'lucide-react';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { useMemberStore } from '../stores/useMemberStore';

interface EditModalProps {
  isOpen: boolean;
  onClose: () => void;
  member: { MemberID: number, FullName: string, Phone: string } | null;
}

export function EditMemberModal({ isOpen, onClose, member }: EditModalProps) {
  const { editMember } = useMemberStore();
  const [loading, setLoading] = useState(false);
  
  const [formData, setFormData] = useState({
    fullName: '',
    phone: ''
  });

  // Rellenar el formulario cuando se abre el modal
  useEffect(() => {
    if (member) {
      setFormData({
        fullName: member.FullName,
        phone: member.Phone.replace('521', '') 
      });
    }
  }, [member, isOpen]);

  if (!isOpen || !member) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    

    const success = await editMember(member.MemberID, formData.fullName, formData.phone);
    
    setLoading(false);
    if (success) onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in">
      <div className="w-full max-w-md bg-bg-[#18181b] border border-white/10 rounded-xl p-6 shadow-2xl">
        
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-heading font-bold text-white uppercase">Editar Datos</h2>
          <button onClick={onClose}><X className="text-[#a1a1aa] hover:text-white" /></button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input 
            label="Nombre Completo" 
            value={formData.fullName}
            onChange={(e) => setFormData({...formData, fullName: e.target.value})}
          />
          
          <div className="space-y-2">
             <label className="text-xs font-mono text-text-muted uppercase tracking-wider">Teléfono</label>
             <Input 
                value={formData.phone}
                onChange={(e) => setFormData({...formData, phone: e.target.value})}
                placeholder="10 dígitos"
             />
          </div>

          <div className="pt-4 flex justify-end gap-3">
            <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
            <Button className="bg-[#D4FF00] text-black font-extrabold hover:bg-[#b8dd00] hover:shadow-[0_0_20px_#D4FF00] transition-all" type="submit" isLoading={loading}>
              <Save className="mr-2 h-4 w-4" /> Guardar Cambios
            </Button>
          </div>
        </form>

      </div>
    </div>
  );
}
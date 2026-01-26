import { useState } from 'react';
import { X, CheckCircle, CreditCard, Banknote } from 'lucide-react';
import { Button } from './ui/Button';
import { useMemberStore } from '../stores/useMemberStore';

interface RenewModalProps {
  isOpen: boolean;
  onClose: () => void;
  memberId: number | null;
  memberName: string;
}

export function RenewModal({ isOpen, onClose, memberId, memberName }: RenewModalProps) {
  const { editMember } = useMemberStore();
  const [loading, setLoading] = useState(false);
  const [method, setMethod] = useState('Efectivo');

  if (!isOpen || !memberId) return null;

  const handleRenew = async () => {
    setLoading(true);
    // Hardcodeado $500 y Plan 1 por ahora (puedes hacerlo dinámico luego)
    const success = await editMember({
        memberId,
        planId: 1, 
        amount: 500,
        paymentMethod: method
    });
    setLoading(false);
    if (success) onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in">
      <div className="w-full max-w-md bg-bg-[#18181b] border border-[#D4FF00]/30 rounded-xl p-6 shadow-[0_0_50px_rgba(212,255,0,0.2)]">
        
        <div className="flex justify-between items-start mb-6">
          <div>
             <h2 className="text-xl font-heading font-bold text-white uppercase">Renovar Membresía</h2>
             <p className="text-[#D4FF00] font-mono text-sm mt-1">{memberName}</p>
          </div>
          <button onClick={onClose}><X className="text-[#a1a1aa] hover:text-white" /></button>
        </div>

        <div className="space-y-6">
            {/* Resumen del cobro */}
            <div className="bg-black/40 p-4 rounded-lg border border-white/5 flex justify-between items-center">
                <span className="text-[#a1a1aa] font-mono text-sm">Plan Mensual</span>
                <span className="text-2xl font-bold text-white">$500.00</span>
            </div>

            {/* Método de Pago */}
            <div className="space-y-3">
                <label className="text-xs font-mono text-[#a1a1aa] uppercase">Método de Pago</label>
                <div className="grid grid-cols-2 gap-3">
                    <button 
                        type="button"
                        onClick={() => setMethod('Efectivo')}
                        className={`p-3 rounded-lg border flex flex-col items-center gap-2 transition-all ${method === 'Efectivo' ? 'bg-[#D4FF00] text-black border-[#D4FF00]' : 'bg-transparent border-white/10 text-[#a1a1aa] hover:bg-white/5'}`}
                    >
                        <Banknote size={24} />
                        <span className="text-xs font-bold">Efectivo</span>
                    </button>
                    <button 
                        type="button"
                        onClick={() => setMethod('Tarjeta')}
                        className={`p-3 rounded-lg border flex flex-col items-center gap-2 transition-all ${method === 'Tarjeta' ? 'bg-[#D4FF00] text-black border-[#D4FF00]' : 'bg-transparent border-white/10 text-[#a1a1aa] hover:bg-white/5'}`}
                    >
                        <CreditCard size={24} />
                        <span className="text-xs font-bold">Tarjeta / Transf</span>
                    </button>
                </div>
            </div>

            <Button onClick={handleRenew} isLoading={loading} className="bg-[#D4FF00] text-black font-extrabold hover:bg-[#b8dd00] hover:shadow-[0_0_20px_#D4FF00] transition-all">
                <CheckCircle className="mr-2" /> CONFIRMAR PAGO
            </Button>
        </div>
      </div>
    </div>
  );
}
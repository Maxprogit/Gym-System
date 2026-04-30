import { useState } from 'react';
import { X, Save, Loader2 } from 'lucide-react';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { useMemberStore } from '../stores/useMemberStore';
import { useEffect } from 'react';
import { API } from '../config/api';
import { PaymentModal } from './PaymentModal';
import { toast } from 'sonner';


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

// ✅ NUEVO: interfaz de errores
interface FormErrors {
  fullName?: string;
  phone?: string;
}

export function AddMemberModal({ isOpen, onClose }: ModalProps) {
  const { addMember } = useMemberStore();
  const [loading, setLoading] = useState(false);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [showPaymentModal, setShowPayment] = useState(false);
  // ✅ NUEVO: estado de errores
  const [errors, setErrors] = useState<FormErrors>({});
  
  const [formData, setFormData] = useState({
    fullName: '',
    phone: '521',
    planId: 1,
    paymentMethod: 'Efectivo'
  });

  useEffect(() => {
    if (isOpen) {
      fetch(API.plans, { method: 'GET' })
      .then(res => res.json())
      .then(data => {
        setPlans(data);
        setFormData(prev => ({ ...prev, planId: data[0]?.PlanID || 0 }));
      });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const selectedPlan = plans.find(p => p.PlanID === formData.planId);
  const planPrice = selectedPlan?.Price ?? 0;

  
  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    const onlyNums = raw.replace(/\D/g, '');
    const value = onlyNums.startsWith('521') ? onlyNums : '521' + onlyNums.replace(/^521/, '');
  
    if (value.length <= 13) {
      setFormData({ ...formData, phone: value });
   
      if (value.length === 13) {
        setErrors(prev => ({ ...prev, phone: undefined }));
      }
    }
  };


  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    // Permitir letras, espacios, acentos y ñ
    const onlyLetters = value.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s]/g, '');
    setFormData({ ...formData, fullName: onlyLetters });
    if (onlyLetters.trim().length >= 3) {
      setErrors(prev => ({ ...prev, fullName: undefined }));
    }
  };


  const validate = (): boolean => {
    const newErrors: FormErrors = {};

    // Validar nombre
    if (formData.fullName.trim().length < 3) {
      newErrors.fullName = 'El nombre debe tener al menos 3 caracteres';
    }

    // Validar teléfono
    const phoneDigits = formData.phone.replace(/\D/g, '');
    if (phoneDigits.length !== 13) {
      newErrors.phone = `Número incompleto (${phoneDigits.length - 3}/10 dígitos después del 521)`;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();


    if (!validate()) return;

       if (formData.paymentMethod === 'Efectivo') {
      setLoading(true);
      const success = await addMember(formData);
      setLoading(false);
      if (success) {
        setFormData({ fullName: '', phone: '521', planId: 1, paymentMethod: 'Efectivo' });
        setErrors({});
        onClose();
      } else {
        toast.error("Error al guardar. Revisa que el backend esté corriendo.");
      }
      return;
    }

    // ✅ Tarjeta/Transferencia: abre el modal de pago PRIMERO, sin guardar aún
    setShowPayment(true);
  };

  const handlePaymentSuccess = async (transactionId: string) => {
    setLoading(true);
    const success = await addMember(formData);
    setLoading(false);

    if (success) {
      
      setShowPayment(false);
      setFormData({ fullName: '', phone: '521', planId: 1, paymentMethod: 'Efectivo' });
      setErrors({});
      onClose();
    } else {
      toast.error("Pago procesado pero error al guardar. Contacta al admin.");
    }
  };

  const handlePaymentClose = () => {
    toast.error("Pago cancelado o fallido. El miembro ha sido agregado sin pago.");
    setShowPayment(false);
  };


  const phoneDigitsEntered = formData.phone.replace(/\D/g, '').length - 3;

  return (
    <>
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-[#18181b] border border-[#27272a] rounded-xl p-6 shadow-[0_0_50px_rgba(0,0,0,0.5)]">
        
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-heading font-bold text-white">NUEVO ATLETA</h2>
          <button onClick={onClose} className="text-[#a1a1aa] hover:text-white transition-colors">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          
     
          <div className="space-y-1">
            <Input 
              label="Nombre Completo" 
              placeholder="Ej: Juan Pérez"
              required
              value={formData.fullName}
              onChange={handleNameChange}
              className={errors.fullName ? 'border-red-500 focus:border-red-500' : ''}
            />
            {errors.fullName && (
              <p className="text-[11px] text-red-400 font-mono flex items-center gap-1">
                ⚠ {errors.fullName}
              </p>
            )}
          </div>
      
          <div className="space-y-1">
            <label className="text-xs font-mono text-[#a1a1aa] uppercase tracking-wider">
              Teléfono (WhatsApp)
            </label>
            <Input 
              placeholder="5211234567890"
              required
              value={formData.phone}
              onChange={handlePhoneChange}
              inputMode="numeric"
              className={errors.phone ? 'border-red-500 focus:border-red-500' : ''}
            />
            {/* Contador dinámico */}
            <div className="flex justify-between items-center">
              <p className="text-[10px] text-[#a1a1aa] font-mono">
                Prefijo MX: 521 + 10 dígitos
              </p>
              <p className={`text-[10px] font-mono ${
                phoneDigitsEntered === 10 
                  ? 'text-[#D4FF00]' 
                  : phoneDigitsEntered > 0 
                    ? 'text-amber-400' 
                    : 'text-[#a1a1aa]'
              }`}>
                {phoneDigitsEntered}/10
              </p>
            </div>
            {errors.phone && (
              <p className="text-[11px] text-red-400 font-mono flex items-center gap-1">
                ⚠ {errors.phone}
              </p>
            )}
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

          <div className="space-y-2">
            <label className="text-xs font-mono text-[#a1a1aa] uppercase tracking-wider">Método de Pago</label>
            <select
              className="flex h-11 w-full rounded-lg border border-[#27272a] bg-[#18181b] px-3 py-2 text-sm text-white focus:outline-none focus:border-[#D4FF00] transition-all font-mono"
              value={formData.paymentMethod}
              onChange={(e) => setFormData({ ...formData, paymentMethod: e.target.value })}
            >
              <option value="Efectivo">Efectivo</option>
              <option value="Tarjeta">Tarjeta</option>
              <option value="Transferencia">Transferencia</option>
            </select>
          </div>

          <div className="pt-4 flex justify-end gap-3">
            <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
            <Button 
              className="bg-[#D4FF00] text-black font-extrabold hover:bg-[#b8dd00] hover:shadow-[0_0_20px_#D4FF00] transition-all" 
              type="submit" 
              isLoading={loading}
            >
              <Save className="mr-2 h-4 w-4" /> Guardar Atleta
            </Button>
          </div>
        </form>

      </div>
    </div>
    <PaymentModal
        isOpen={showPaymentModal}
        onClose={handlePaymentClose}
        amount={planPrice}
        method={formData.paymentMethod as 'Tarjeta' | 'Transferencia'}
        onPaymentSuccess={handlePaymentSuccess}
      />
    </>
  );
}
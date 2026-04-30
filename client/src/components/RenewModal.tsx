import { useState, useEffect } from 'react';
import { X, CheckCircle, CreditCard, Banknote, Smartphone } from 'lucide-react';
import { Button } from './ui/Button';
import { useMemberStore } from '../stores/useMemberStore';
import { PaymentModal } from './PaymentModal';
import { API } from '../config/api';
import { toast } from 'sonner';

interface Plan {
    PlanID: number;
    PlanName: string;
    Price: number;
    DurationDays: number;
}

interface RenewModalProps {
    isOpen: boolean;
    onClose: () => void;
    memberId: number | null;
    memberName: string;
}

export function RenewModal({ isOpen, onClose, memberId, memberName }: RenewModalProps) {
    const { renewMember } = useMemberStore();
    const [loading, setLoading] = useState(false);
    const [method, setMethod] = useState('Efectivo');
    const [plans, setPlans] = useState<Plan[]>([]);
    const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
    const [showPaymentModal, setShowPaymentModal] = useState(false);

    useEffect(() => {
        if (isOpen) {
            fetch(API.plans)
                .then(res => res.json())
                .then(data => {
                    setPlans(data);
                    setSelectedPlan(data[0] || null);
                });
        }
    }, [isOpen]);

    if (!isOpen || !memberId) return null;

    const handleConfirm = async () => {
        // Si es tarjeta o transferencia, abre el PaymentModal
        if (method === 'Tarjeta' || method === 'Transferencia') {
            setShowPaymentModal(true);
            return;
        }
        // Si es efectivo, renueva directo
        await processRenew();
    };

    const processRenew = async (transactionId?: string) => {
        if (!selectedPlan) {
            toast.error('Por favor, selecciona un plan válido.');
            return;
        } ;
        setLoading(true);
        const success = await renewMember({
            memberId: memberId!,
            planId: selectedPlan.PlanID,
            amount: selectedPlan.Price,
            paymentMethod: method
        });
        setLoading(false);
        if (success) onClose();
    };

    return (
        <>
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in">
                <div className="w-full max-w-md bg-[#18181b] border border-[#D4FF00]/30 rounded-xl p-6 shadow-[0_0_50px_rgba(212,255,0,0.2)]">

                    {/* Header */}
                    <div className="flex justify-between items-start mb-6">
                        <div>
                            <h2 className="text-xl font-heading font-bold text-white uppercase">Renovar Membresía</h2>
                            <p className="text-[#D4FF00] font-mono text-sm mt-1">{memberName}</p>
                        </div>
                        <button onClick={onClose}><X className="text-[#a1a1aa] hover:text-white" /></button>
                    </div>

                    <div className="space-y-5">

                        {/* Selector de Plan */}
                        <div className="space-y-2">
                            <label className="text-xs font-mono text-[#a1a1aa] uppercase tracking-wider">Plan</label>
                            <select
                                className="flex h-11 w-full rounded-lg border border-[#27272a] bg-[#18181b] px-3 py-2 text-sm text-white focus:outline-none focus:border-[#D4FF00] transition-all font-mono"
                                value={selectedPlan?.PlanID || ''}
                                onChange={(e) => {
                                    const plan = plans.find(p => p.PlanID === Number(e.target.value));
                                    setSelectedPlan(plan || null);
                                }}
                            >
                                {plans.map(plan => (
                                    <option key={plan.PlanID} value={plan.PlanID}>
                                        {plan.PlanName} - {plan.DurationDays} días - ${plan.Price}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Resumen del cobro */}
                        <div className="bg-black/40 p-4 rounded-lg border border-white/5 flex justify-between items-center">
                            <span className="text-[#a1a1aa] font-mono text-sm">Total a cobrar</span>
                            <span className="text-2xl font-bold text-[#D4FF00]">${selectedPlan?.Price || 0}</span>
                        </div>

                        {/* Método de Pago */}
                        <div className="space-y-3">
                            <label className="text-xs font-mono text-[#a1a1aa] uppercase">Método de Pago</label>
                            <div className="grid grid-cols-3 gap-3">
                                {['Efectivo', 'Tarjeta', 'Transferencia'].map((m) => (
                                    <button
                                        key={m}
                                        type="button"
                                        onClick={() => setMethod(m)}
                                        className={`p-3 rounded-lg border flex flex-col items-center gap-2 transition-all ${method === m ? 'bg-[#D4FF00] text-black border-[#D4FF00]' : 'bg-transparent border-white/10 text-[#a1a1aa] hover:bg-white/5'}`}
                                    >
                                        {m === 'Efectivo' && <Banknote size={20} />}
                                        {m === 'Tarjeta' && <CreditCard size={20} />}
                                        {m === 'Transferencia' && <Smartphone size={20} />}
                                        <span className="text-xs font-bold">{m}</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        <Button
                            onClick={handleConfirm}
                            isLoading={loading}
                            className="w-full bg-[#D4FF00] text-black font-extrabold hover:bg-[#b8dd00] hover:shadow-[0_0_20px_#D4FF00] transition-all"
                        >
                            <CheckCircle className="mr-2" size={18} />
                            {method === 'Efectivo' ? 'CONFIRMAR PAGO' : 'CONTINUAR AL PAGO'}
                        </Button>
                    </div>
                </div>
            </div>

            {/* Modal de pago para tarjeta/transferencia */}
            <PaymentModal
                isOpen={showPaymentModal}
                onClose={() => setShowPaymentModal(false)}
                amount={selectedPlan?.Price || 0}
                method={method as 'Tarjeta' | 'Transferencia'}
                onPaymentSuccess={(transactionId) => {
                    setShowPaymentModal(false);
                    processRenew(transactionId);
                }}
            />
        </>
    );
}
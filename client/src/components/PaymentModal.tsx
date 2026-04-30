import { useState } from 'react';
import { X, CreditCard, Smartphone, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { processPayment, PaymentData } from '../services/payments/PaymentService';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { toast } from 'sonner';

interface PaymentModalProps {
    isOpen: boolean;
    onClose: () => void;
    amount: number;
    method: 'Tarjeta' | 'Transferencia';
    onPaymentSuccess: (transactionId: string) => void;
}

export function PaymentModal({ isOpen, onClose, amount, method, onPaymentSuccess }: PaymentModalProps) {
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);
    const [cardData, setCardData] = useState({
        cardNumber: '',
        cardName: '',
        cardExpiry: '',
        cardCvv: ''
    });

    if (!isOpen) return null;

    const handleSubmit = async () => {
        setLoading(true);
        setResult(null);

        const paymentData: PaymentData = {
            amount,
            method,
            ...cardData
        };

        const response = await processPayment(paymentData);
        setLoading(false);

        if (response.success) {
            setResult({ success: true, message: `Pago aprobado. ID: ${response.transactionId}` });
            toast.success(`pago aprobado. ID: ${response.transactionId}`, { position: 'bottom-center' });
            setTimeout(() => {
                onPaymentSuccess(response.transactionId!);
                setResult(null);
                setCardData({ cardNumber: '', cardName: '', cardExpiry: '', cardCvv: '' });
            }, 2000);
        } else {
            setResult({ success: false, message: response.error || 'Error al procesar el pago' });
            toast.error(response.error || 'Error al procesar el pago', { position: 'bottom-center' });
        }
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="w-full max-w-md bg-[#18181b] border border-[#27272a] rounded-xl p-6 shadow-[0_0_50px_rgba(0,0,0,0.5)]">
                
                {/* Header */}
                <div className="flex justify-between items-center mb-6">
                    <div className="flex items-center gap-2">
                        {method === 'Tarjeta' ? <CreditCard className="text-[#D4FF00]" size={20} /> : <Smartphone className="text-[#D4FF00]" size={20} />}
                        <h2 className="text-xl font-heading font-bold text-white uppercase">
                            {method === 'Tarjeta' ? 'Pago con Tarjeta' : 'Transferencia SPEI'}
                        </h2>
                    </div>
                    <button onClick={onClose} className="text-[#a1a1aa] hover:text-white transition-colors">
                        <X size={24} />
                    </button>
                </div>

                {/* Monto */}
                <div className="bg-black/30 rounded-lg p-4 mb-6 text-center border border-[#27272a]">
                    <p className="text-[#a1a1aa] text-xs font-mono uppercase tracking-wider mb-1">Total a cobrar</p>
                    <p className="text-[#D4FF00] text-3xl font-bold font-mono">${amount}</p>
                </div>

                {/* Formulario Tarjeta */}
                {method === 'Tarjeta' && (
                    <div className="space-y-3">
                        <Input
                            label="Número de Tarjeta"
                            placeholder="0000 0000 0000 0000"
                            maxLength={19}
                            value={cardData.cardNumber}
                            onChange={(e) => {
                                // Formato automático con espacios
                                const val = e.target.value.replace(/\D/g, '').replace(/(.{4})/g, '$1 ').trim();
                                setCardData({...cardData, cardNumber: val});
                            }}
                        />
                        <Input
                            label="Nombre en la Tarjeta"
                            placeholder="JUAN PEREZ"
                            value={cardData.cardName}
                            onChange={(e) => setCardData({...cardData, cardName: e.target.value.toUpperCase()})}
                        />
                        <div className="grid grid-cols-2 gap-3">
                            <Input
                                label="Vencimiento"
                                placeholder="MM/AA"
                                maxLength={5}
                                value={cardData.cardExpiry}
                                onChange={(e) => {
                                    const val = e.target.value.replace(/\D/g, '').replace(/^(\d{2})(\d)/, '$1/$2');
                                    setCardData({...cardData, cardExpiry: val});
                                }}
                            />
                            <Input
                                label="CVV"
                                placeholder="123"
                                maxLength={3}
                                value={cardData.cardCvv}
                                onChange={(e) => setCardData({...cardData, cardCvv: e.target.value.replace(/\D/g, '')})}
                            />
                        </div>
                    </div>
                )}

                {/* Instrucciones Transferencia */}
                {method === 'Transferencia' && (
                    <div className="space-y-3 bg-black/30 rounded-lg p-4 border border-[#27272a]">
                        <p className="text-xs font-mono text-[#a1a1aa] uppercase tracking-wider">Datos para transferencia SPEI</p>
                        <div className="space-y-2 font-mono text-sm">
                            <div className="flex justify-between">
                                <span className="text-[#a1a1aa]">Banco:</span>
                                <span className="text-white">BBVA</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-[#a1a1aa]">CLABE:</span>
                                <span className="text-[#D4FF00]">012345678901234567</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-[#a1a1aa]">Beneficiario:</span>
                                <span className="text-white">GOLIAT GYM</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-[#a1a1aa]">Concepto:</span>
                                <span className="text-white">Membresía Gym</span>
                            </div>
                        </div>
                        <p className="text-[10px] text-[#a1a1aa] font-mono mt-2">
                            Una vez realizada la transferencia presiona confirmar
                        </p>
                    </div>
                )}

                {/* Resultado */}
                {result && (
                    <div className={`flex items-center gap-2 text-xs font-mono p-3 rounded-lg border mt-4 animate-in slide-in-from-top-2 ${
                        result.success 
                            ? 'text-green-400 bg-green-500/10 border-green-500/20' 
                            : 'text-red-400 bg-red-500/10 border-red-500/20'
                    }`}>
                        {result.success ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
                        <span>{result.message}</span>
                    </div>
                )}

                {/* Botones */}
                <div className="pt-4 flex justify-end gap-3">
                    <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
                    <Button
                        className="bg-[#D4FF00] text-black font-extrabold hover:bg-[#b8dd00] hover:shadow-[0_0_20px_#D4FF00] transition-all"
                        onClick={handleSubmit}
                        isLoading={loading}
                    >
                        {loading ? 'Procesando...' : method === 'Tarjeta' ? 'Pagar Ahora' : 'Confirmar Transferencia'}
                    </Button>
                </div>
            </div>
        </div>
    );
}
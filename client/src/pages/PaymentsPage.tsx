import { useEffect, useState } from 'react';
import axios from 'axios';
import { DollarSign, Calendar, CreditCard, Search } from 'lucide-react';
import { Input } from '../components/ui/Input';

interface Payment {
  PaymentID: number;
  Amount: number;
  PaymentMethod: string;
  PaymentDate: string;
  FullName: string;
  PlanName: string;
}

export default function PaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchPayments();
  }, []);

  const fetchPayments = async () => {
    try {
      const res = await axios.get(`${import.meta.env.VITE_API_URL}/api/payments`);
      setPayments(res.data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  // Filtro simple
  const filteredPayments = payments.filter(p => 
    p.FullName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.PaymentID.toString().includes(searchTerm)
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-end gap-4 border-b border-white/10 pb-6">
        <div>
          <h2 className="text-3xl font-heading font-bold text-white uppercase tracking-tight">Caja y Movimientos</h2>
          <p className="text-[#a1a1aa] font-mono text-sm">Historial financiero del gimnasio</p>
        </div>
        <div className="bg-[#121212] border border-[#D4FF00]/20 px-4 py-2 rounded-lg flex items-center gap-3">
            <div className="p-2 bg-[#D4FF00]/10 rounded-full text-[#D4FF00]"><DollarSign size={18} /></div>
            <div>
                <p className="text-[10px] text-[#a1a1aa] uppercase">Total Ingresos (Vista)</p>
                <p className="text-xl font-bold text-white font-mono">
                    ${filteredPayments.reduce((acc, curr) => acc + curr.Amount, 0).toLocaleString()}
                </p>
            </div>
        </div>
      </div>

      {/* Barra de Búsqueda */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#a1a1aa]" />
        <Input 
            placeholder="Buscar recibo por nombre..." 
            className="pl-10 bg-bg-[#18181b/50 border-white/10"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
        />
      </div>

      {/* Tabla de Pagos */}
      <div className="bg-bg-[#18181b/50 border border-white/10 rounded-xl overflow-hidden backdrop-blur-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-white/5 text-[#a1a1aa] font-mono uppercase text-xs">
              <tr>
                <th className="px-6 py-4">ID Recibo</th>
                <th className="px-6 py-4">Atleta</th>
                <th className="px-6 py-4">Concepto</th>
                <th className="px-6 py-4">Fecha</th>
                <th className="px-6 py-4">Método</th>
                <th className="px-6 py-4 text-right">Monto</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {loading ? (
                <tr><td colSpan={6} className="p-8 text-center text-[#a1a1aa] animate-pulse">Cargando movimientos...</td></tr>
              ) : filteredPayments.length === 0 ? (
                <tr><td colSpan={6} className="p-8 text-center text-[#a1a1aa]">No hay movimientos registrados.</td></tr>
              ) : (
                filteredPayments.map((payment) => (
                  <tr key={payment.PaymentID} className="hover:bg-white/5 transition-colors group">
                    <td className="px-6 py-4 font-mono text-[#a1a1aa]">#{payment.PaymentID.toString().padStart(6, '0')}</td>
                    <td className="px-6 py-4 font-bold text-white">{payment.FullName || 'Usuario Eliminado'}</td>
                    <td className="px-6 py-4 text-[#a1a1aa]">{payment.PlanName || 'Renovación'}</td>
                    <td className="px-6 py-4 font-mono text-[#a1a1aa] flex items-center gap-2">
                        <Calendar size={14} />
                        {new Date(payment.PaymentDate).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] font-bold uppercase border ${
                            payment.PaymentMethod === 'Efectivo' 
                            ? 'border-green-500/30 bg-green-500/10 text-green-500' 
                            : 'border-blue-500/30 bg-blue-500/10 text-blue-400'
                        }`}>
                            {payment.PaymentMethod === 'Tarjeta' && <CreditCard size={10} />}
                            {payment.PaymentMethod}
                        </span>
                    </td>
                    <td className="px-6 py-4 text-right font-mono font-bold text-[#D4FF00]">
                        +${payment.Amount}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
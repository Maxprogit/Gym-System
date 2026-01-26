import { useState } from 'react';
import { cn } from '../lib/utils';
import { MoreVertical, CheckCircle, AlertTriangle, Trash2, RefreshCcw, Edit } from 'lucide-react';

interface MemberProps {
  memberId: number; // Agregamos ID para saber a quien borrar/renovar
  name: string;
  plan: string;
  daysLeft: number;
  status: 'active' | 'expired';
  onRenew: () => void; // Callback
  onDelete: () => void; // Callback
  onEdit: () => void; // Callback
}

export function MemberCard({ name, plan, daysLeft, status, onRenew, onDelete, onEdit }: MemberProps) {
  const isDanger = daysLeft <= 3 || status === 'expired';
  const [showMenu, setShowMenu] = useState(false);

  return (
    <div className="relative group bg-bg-[#18181b]/50 backdrop-blur-md border border-white/10 rounded-xl p-5 transition-all duration-300 hover:border-[#D4FF00]/50 hover:shadow-[0_0_30px_rgba(212,255,0,0.15)] hover:-translate-y-1">
      {/* Indicador lateral */}
      <div className={cn(
        "absolute left-0 top-4 bottom-4 w-1 rounded-r-full shadow-[0_0_10px_currentColor]",
        isDanger ? "bg-red-500 text-red-500" : "bg-[#D4FF00] text-[#D4FF00]"
      )} />

      {/* Header con Menú */}
      <div className="flex justify-between items-start mb-4 pl-3 relative">
        <div>
          <h3 className="font-bold text-lg text-white tracking-tight truncate max-w-[150px]">{name}</h3>
          <p className="text-xs font-mono text-[#a1a1aa] uppercase tracking-widest">{plan}</p>
        </div>
        
        {/* Botón de Menú */}
        <div className="relative">
            <button 
                onClick={() => setShowMenu(!showMenu)}
                className="text-[#a1a1aa] hover:text-white p-1 rounded-md hover:bg-white/10 transition-colors"
            >
                <MoreVertical size={18} />
            </button>

            {/* Menú Desplegable */}
            {showMenu && (
                <>
                <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} /> {/* Cierra al clic fuera */}
                <div className="absolute right-0 mt-2 w-48 bg-[#121212] border border-white/10 rounded-lg shadow-xl z-20 py-1 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                    <button onClick={() => { setShowMenu(false); onRenew(); }} className="w-full text-left px-4 py-3 text-sm text-white hover:bg-[#D4FF00] hover:text-black flex items-center gap-2 transition-colors font-medium">
                        <RefreshCcw size={16} /> Renovar / Pagar
                    </button>
                    <button onClick={() => { setShowMenu(false); onEdit(); }} className="w-full text-left px-4 py-3 text-sm text-[#a1a1aa] hover:bg-white/10 flex items-center gap-2 transition-colors">
                        <Edit size={16} /> Editar Datos
                    </button>
                    <div className="h-px bg-white/10 my-1" />
                    <button onClick={() => { setShowMenu(false); onDelete(); }} className="w-full text-left px-4 py-3 text-sm text-red-500 hover:bg-red-900/20 flex items-center gap-2 transition-colors">
                        <Trash2 size={16} /> Eliminar
                    </button>
                </div>
                </>
            )}
        </div>
      </div>

      {/* Info Días */}
      <div className="pl-3 mt-4 flex items-end justify-between">
        <div>
          <span className="text-xs text-[#a1a1aa] block mb-1">Vence en:</span>
          <div className={cn("font-mono text-2xl font-bold flex items-center gap-2", isDanger ? "text-red-500" : "text-white")}>
            {daysLeft} <span className="text-xs font-sans font-normal text-[#a1a1aa]">días</span>
          </div>
        </div>
        <div className={cn("p-2 rounded-full bg-bg border border-accent", isDanger ? "text-red-500" : "text-[#D4FF00]")}>
          {isDanger ? <AlertTriangle size={20} /> : <CheckCircle size={20} />}
        </div>
      </div>
    </div>
  );
}
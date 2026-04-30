import { toast } from 'sonner';
import { AlertTriangle } from 'lucide-react';

export const confirmToast = (message: string): Promise<boolean> => {
    return new Promise((resolve) => {
        toast.custom((t) => (
            <div className="bg-[#18181b] border border-red-500/30 rounded-xl p-4 shadow-xl flex flex-col gap-3 w-[320px]">
                <div className="flex items-center gap-2">
                    <AlertTriangle size={16} className="text-red-500" />
                    <p className="text-white text-sm font-mono">{message}</p>
                </div>
                <div className="flex justify-end gap-2">
                    <button
                        onClick={() => { toast.dismiss(t); resolve(false); }}
                        className="px-3 py-1.5 text-xs font-mono text-[#a1a1aa] hover:text-white border border-[#27272a] rounded-lg transition-colors"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={() => { toast.dismiss(t); resolve(true); }}
                        className="px-3 py-1.5 text-xs font-mono bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors font-bold"
                    >
                        Eliminar
                    </button>
                </div>
            </div>
        ), { duration: Infinity });
    });
};
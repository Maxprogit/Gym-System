import { useEffect, useState } from 'react';
import { X, Send, Bot, User, Loader2, MessageCircle, FileText } from 'lucide-react';
import { API } from '../config/api';
import { toast } from 'sonner';

interface Message {
    role: 'user' | 'assistant';
    content: string;
}

interface AIModalProps {
    isOpen: boolean;
    onClose: () => void;
    memberName: string;
    memberPhone: string;
    memberId: number;  
}

export function AIModal({ isOpen, onClose, memberName, memberPhone, memberId }: AIModalProps) {
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [isComplete, setIsComplete] = useState(false);
    const [sending, setSending] = useState(false);
    const [planType, setPlanType] = useState('Plan Personalizado');
    const [messages, setMessages] = useState<Message[]>([]);
    useEffect(() => {
    if (isOpen && memberName) {
        setMessages([{
            role: 'assistant',
            content: `Hola! ${memberName} Soy tu entrenador Voy a ayudarte a crear un plan personalizado. ¿Necesitas una rutina de entrenamiento, un plan de dieta, o ambos?`
        }]);
        setIsComplete(false);
        setInput('');
        setPlanType('Plan Personalizado');
    }
}, [isOpen, memberName]);
    

    if (!isOpen) return null;

    const sendMessage = async () => {
        if (!input.trim() || loading) return;

        const userMessage: Message = { role: 'user', content: input };
        const updatedMessages = [...messages, userMessage];
        setMessages(updatedMessages);
        setInput('');
        setLoading(true);

        try {
            const res = await fetch(`${API.base}/api/ai/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ messages: updatedMessages, memberName, memberId })
            });

            const data = await res.json();
            const assistantMessage = { role: 'assistant' as const, content: data.message };
            setMessages(prev => [...prev, assistantMessage]);

            if (data.isComplete) {
                setIsComplete(true);
                // Detectar tipo de plan
                const content = data.message.toLowerCase();
                if (content.includes('dieta') && content.includes('rutina')) {
                    setPlanType('Rutina y Dieta');
                } else if (content.includes('dieta')) {
                    setPlanType('Dieta');
                } else {
                    setPlanType('Rutina de Entrenamiento');
                }
            }
        } catch (err) {
            toast.error('Error al conectar con la IA');
        } finally {
            setLoading(false);
        }
    };

    const getFullPlan = () => {
        return messages
            .filter(m => m.role === 'assistant')
            .map(m => m.content)
            .join('\n\n');
    };

    const handleSavePlan = async () => {
        try {
            await fetch(`${API.base}/api/ai/save-plan`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    memberId,
                    planType,
                    planContent: getFullPlan()
                })
            });
            toast.success('Plan guardado correctamente ✅');
        } catch (err) {
            toast.error('Error al guardar el plan');
        }
    };

    const handleSendPDF = async () => {
        setSending(true);
        try {

            await handleSavePlan();

            const res = await fetch(`${API.base}/api/ai/send-plan-pdf`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    phone: memberPhone,
                    planContent: getFullPlan(),
                    memberName,
                    planType
                })
            });

            if (res.ok) {
                toast.success(`PDF enviado a ${memberName} por WhatsApp 📄`);
                onClose();
            } else {
                toast.error('Error al enviar el PDF');
            }
        } catch (err) {
            toast.error('Error al enviar el PDF');
        } finally {
            setSending(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="w-full max-w-lg bg-[#18181b] border border-[#27272a] rounded-xl shadow-[0_0_50px_rgba(0,0,0,0.5)] flex flex-col" style={{ height: '80vh' }}>

                {/* Header */}
                <div className="flex justify-between items-center p-5 border-b border-[#27272a]">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-[#D4FF00] rounded-lg flex items-center justify-center">
                            <Bot size={18} className="text-black" />
                        </div>
                        <div>
                            <h2 className="text-white font-bold font-heading uppercase">Couch</h2>
                            <p className="text-[#a1a1aa] text-xs font-mono">Atleta {memberName}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-[#a1a1aa] hover:text-white transition-colors">
                        <X size={24} />
                    </button>
                </div>

                {/* Mensajes */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {messages.map((msg, i) => (
                        <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                            <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${msg.role === 'assistant' ? 'bg-[#D4FF00]' : 'bg-[#27272a]'}`}>
                                {msg.role === 'assistant'
                                    ? <Bot size={14} className="text-black" />
                                    : <User size={14} className="text-white" />
                                }
                            </div>
                            <div className={`max-w-[80%] px-4 py-3 rounded-xl text-sm font-mono whitespace-pre-wrap ${
                                msg.role === 'assistant'
                                    ? 'bg-[#27272a] text-white rounded-tl-none'
                                    : 'bg-[#D4FF00] text-black rounded-tr-none'
                            }`}>
                                {msg.content}
                            </div>
                        </div>
                    ))}

                    {loading && (
                        <div className="flex gap-3">
                            <div className="w-7 h-7 rounded-full bg-[#D4FF00] flex items-center justify-center">
                                <Bot size={14} className="text-black" />
                            </div>
                            <div className="bg-[#27272a] px-4 py-3 rounded-xl rounded-tl-none">
                                <Loader2 size={16} className="text-[#D4FF00] animate-spin" />
                            </div>
                        </div>
                    )}
                </div>

                {isComplete && (
                    <div className="px-4 py-3 border-t border-[#27272a] flex gap-2">
                        <button
                            onClick={handleSavePlan}
                            className="flex-1 flex items-center justify-center gap-2 bg-[#27272a] hover:bg-[#3f3f46] text-white font-bold py-2 rounded-lg transition-all font-mono text-sm"
                        >
                            <FileText size={16} />
                            Guardar Plan
                        </button>
                        <button
                            onClick={handleSendPDF}
                            disabled={sending}
                            className="flex-1 flex items-center justify-center gap-2 bg-green-500 hover:bg-green-600 text-white font-bold py-2 rounded-lg transition-all font-mono text-sm disabled:opacity-50"
                        >
                            {sending ? <Loader2 size={16} className="animate-spin" /> : <MessageCircle size={16} />}
                            {sending ? 'Enviando...' : 'Enviar PDF'}
                        </button>
                    </div>
                )}

                <div className="p-4 border-t border-[#27272a] flex gap-3">
                    <textarea
                        className="flex-1 bg-[#09090b] border border-[#27272a] rounded-lg px-3 py-2 text-white text-sm font-mono resize-none focus:outline-none focus:border-[#D4FF00] transition-all"
                        placeholder="Escribe tu respuesta..."
                        rows={2}
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        disabled={loading || isComplete}
                    />
                    <button
                        onClick={sendMessage}
                        disabled={loading || !input.trim() || isComplete}
                        className="bg-[#D4FF00] hover:bg-[#b8dd00] text-black p-3 rounded-lg transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                        <Send size={18} />
                    </button>
                </div>
            </div>
        </div>
    );
}
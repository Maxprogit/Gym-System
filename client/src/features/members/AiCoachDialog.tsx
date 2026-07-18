import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { Apple, ArrowUpRight, Bot, Dumbbell, FileDown, Files, History, MessageSquare, RefreshCw, Send, Sparkles, UserRound } from 'lucide-react';
import { api, getErrorMessage } from '../../lib/api';
import { notify } from '../../lib/notify';
import { shortDate } from '../../lib/format';
import type { AiPlan, Exercise, Member } from '../../types';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { ExercisePicker } from '../exercises/ExercisePicker';
import { gsap, useGSAP } from '../../lib/motion';

interface ChatMessage { role: 'assistant' | 'user'; content: string }

export function AiCoachDialog({ member, onClose }: { member: Member | null; onClose: () => void }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<'chat' | 'history' | 'atlas'>('chat');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [history, setHistory] = useState<AiPlan[]>([]);
  const [planType, setPlanType] = useState('Plan de entrenamiento');
  const [finalPlan, setFinalPlan] = useState('');
  const [savedPlan, setSavedPlan] = useState('');
  const [loading, setLoading] = useState(false);
  const [action, setAction] = useState<'send' | 'download' | null>(null);
  const [error, setError] = useState('');
  const [lastPrompt, setLastPrompt] = useState('');
  const [selectedExercises, setSelectedExercises] = useState<Exercise[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const requestRef = useRef<AbortController | null>(null);

  useEffect(() => {
    requestRef.current?.abort();
    requestRef.current = null;
    setLoading(false);
    setAction(null);
    if (!member) return;
    setMessages([]);
    setInput('');
    setFinalPlan('');
    setSavedPlan('');
    setError('');
    setLastPrompt('');
    setSelectedExercises([]);
    setView('chat');
    api.get<AiPlan[]>(`/ai/plans/${member.MemberID}`).then(({ data }) => setHistory(data)).catch(() => setHistory([]));
    return () => {
      requestRef.current?.abort();
    };
  }, [member]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, loading, error]);

  useGSAP(() => {
    const panel = rootRef.current?.querySelector<HTMLElement>('.coach-panel');
    if (!panel) return;
    gsap.fromTo(panel, { autoAlpha: 0, x: 42, rotateY: -5, clipPath: 'inset(0 0 0 18%)' }, { autoAlpha: 1, x: 0, rotateY: 0, clipPath: 'inset(0 0 0 0%)', duration: 0.82, ease: 'goliat-in' });
  }, { dependencies: [member, view], revertOnUpdate: true });

  useGSAP(() => {
    if (!messages.length) return;
    const messageNode = rootRef.current?.querySelector<HTMLElement>('.coach-message:last-of-type');
    if (!messageNode) return;
    gsap.fromTo(messageNode, { autoAlpha: 0, y: 28, scale: 0.94, rotateX: -8 }, { autoAlpha: 1, y: 0, scale: 1, rotateX: 0, duration: 0.65, ease: 'back.out(1.7)' });
  }, { dependencies: [messages.length], revertOnUpdate: false });

  const askCoach = async (prompt: string, retry = false) => {
    if (!member || !prompt.trim() || loading) return;
    const cleanPrompt = prompt.trim();
    const baseMessages = retry && messages.at(-1)?.role === 'user' ? messages.slice(0, -1) : messages;
    const nextMessages: ChatMessage[] = [...baseMessages, { role: 'user', content: cleanPrompt }];
    const controller = new AbortController();
    requestRef.current?.abort();
    requestRef.current = controller;
    setMessages(nextMessages);
    setInput('');
    setLastPrompt(cleanPrompt);
    setError('');
    setLoading(true);
    try {
      const { data } = await api.post<{ message: string; isComplete: boolean; planContent?: string | null; planType?: string | null; exerciseIds?: string[] }>('/ai/generate', {
        messages: nextMessages,
        memberName: member.FullName,
        memberId: member.MemberID,
        selectedExerciseIds: selectedExercises.map((exercise) => exercise.id),
      }, { timeout: 90_000, signal: controller.signal });
      if (!data.message?.trim()) throw new Error('La IA devolvió una respuesta vacía');
      setMessages((current) => [...current, { role: 'assistant', content: data.isComplete ? 'Plan listo.' : data.message.trim() }]);
      if (data.isComplete) {
        if (!data.planContent) throw new Error('El Coach no entregó el documento estructurado');
        const resolvedType = data.planType || 'Plan integral';
        const signature = resolvedType + ':' + data.planContent;
        setFinalPlan(data.planContent);
        setPlanType(resolvedType);
        void api.post('/ai/plans', { memberId: member.MemberID, planType: resolvedType, planContent: data.planContent })
          .then(() => {
            setSavedPlan(signature);
            return api.get<AiPlan[]>('/ai/plans/' + member.MemberID);
          })
          .then(({ data: plans }) => setHistory(plans))
          .catch(() => notify.warning('Plan generado', 'No se añadió al historial; aún puedes descargarlo.'));
      }
    } catch (requestError) {
      if (controller.signal.aborted) return;
      const message = getErrorMessage(requestError, 'El coach no pudo responder. Tu mensaje sigue guardado para reintentar.');
      setError(message);
      notify.error('El Coach no pudo responder', message);
    } finally {
      if (requestRef.current === controller) {
        requestRef.current = null;
        setLoading(false);
      }
    }
  };

  const sendMessage = (event: FormEvent) => {
    event.preventDefault();
    void askCoach(input);
  };

  const handleComposerKey = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      if (input.trim() && !loading) void askCoach(input);
    }
  };

  const refreshHistory = async () => {
    if (!member) return;
    const { data } = await api.get<AiPlan[]>(`/ai/plans/${member.MemberID}`);
    setHistory(data);
  };

  const downloadPdf = async (content = finalPlan, type = planType, planId?: number) => {
    if (!member || !content || action) return;
    setAction('download');
    try {
      const response = await notify.promise(api.post('/ai/plan-pdf', {
        memberId: member.MemberID,
        planType: type,
        planContent: content,
      }, { timeout: 90_000, responseType: 'blob' }), {
        loading: 'Generando PDF',
        success: 'PDF listo para descargar',
        error: 'No pudimos generar el PDF',
      });
      const url = URL.createObjectURL(response.data);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `goliat-${type.toLowerCase().includes('integral') ? 'integral' : type.toLowerCase().includes('nutric') ? 'nutricion' : 'entrenamiento'}-${planId || member.MemberID}.pdf`;
      anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
    } catch (requestError) {
      setError(getErrorMessage(requestError, 'No pudimos construir el documento.'));
    } finally {
      setAction(null);
    }
  };

  const sendPdf = async () => {
    if (!member || !finalPlan || action) return;
    setAction('send');
    try {
      const signature = `${planType}:${finalPlan}`;
      if (savedPlan !== signature) {
        await api.post('/ai/plans', { memberId: member.MemberID, planType, planContent: finalPlan });
        setSavedPlan(signature);
        await refreshHistory();
      }
      await notify.promise(api.post('/ai/send-plan-pdf', { memberId: member.MemberID, planType, planContent: finalPlan }, { timeout: 90_000 }), {
        loading: 'Generando y enviando el PDF',
        success: 'PDF enviado por WhatsApp',
        error: 'No pudimos enviar el PDF',
      });
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setAction(null);
    }
  };

  return (
    <Modal open={Boolean(member)} onClose={onClose} title="Coach" size="xl">
      <div className="coach-studio" ref={rootRef}>
        <aside className="coach-brief">
          <span className="coach-identity"><i>{member?.FullName.slice(0, 1)}</i><p><small>Atleta</small><strong>{member?.FullName}</strong></p></span>
          <div className="coach-switch"><button type="button" className={view === 'chat' ? 'is-active' : ''} onClick={() => setView('chat')}><MessageSquare size={16} /> Sesión</button><button type="button" className={view === 'atlas' ? 'is-active' : ''} onClick={() => setView('atlas')}><Dumbbell size={16} /> Atlas <b>{selectedExercises.length}</b></button><button type="button" className={view === 'history' ? 'is-active' : ''} onClick={() => setView('history')}><History size={16} /> Historial <b>{history.length}</b></button></div>
        </aside>

        {view === 'chat' ? <section className="coach-conversation coach-panel">
          <header><div><span className="live-dot" /> Sesión activa</div><small>Enter envía · Shift + Enter crea una línea</small></header>
          <div className="coach-feed">
            <div className="coach-intro"><span><Bot size={18} /></span><p>Indica objetivo, experiencia, días, equipo y limitaciones de {member?.FullName}.</p></div>
            {messages.map((message, index) => <div key={`${message.role}-${index}`} className={`coach-message coach-message--${message.role}`}><span>{message.role === 'assistant' ? <Bot size={16} /> : <UserRound size={16} />}</span><p>{message.content}</p></div>)}
            {loading && <div className="coach-message coach-message--assistant is-thinking"><span><Sparkles size={16} /></span><p>Procesando <i /><i /><i /></p></div>}
            {error && <div className="coach-error"><p>{error}</p><button type="button" onClick={() => void askCoach(lastPrompt, true)} disabled={loading}><RefreshCw size={14} /> Reintentar</button></div>}
            <div ref={bottomRef} />
          </div>

          {finalPlan && <div className="plan-station">
            <div className="plan-formats" role="radiogroup" aria-label="Tipo de documento">
              <button type="button" className={planType === 'Plan de entrenamiento' ? 'is-active' : ''} onClick={() => setPlanType('Plan de entrenamiento')}><Dumbbell size={17} /><strong>Entrenamiento</strong></button>
              <button type="button" className={planType === 'Plan de nutrición' ? 'is-active' : ''} onClick={() => setPlanType('Plan de nutrición')}><Apple size={17} /><strong>Nutrición</strong></button>
              <button type="button" className={planType === 'Plan integral' ? 'is-active' : ''} onClick={() => setPlanType('Plan integral')}><Files size={17} /><strong>Integral</strong></button>
            </div>
            <div className="plan-station__actions"><Button type="button" variant="secondary" loading={action === 'download'} disabled={Boolean(action)} icon={<FileDown size={16} />} onClick={() => void downloadPdf()}>Descargar PDF</Button><Button type="button" loading={action === 'send'} disabled={Boolean(action)} icon={<Send size={16} />} onClick={sendPdf}>Enviar por WhatsApp</Button></div>
          </div>}

          <form className="coach-composer" onSubmit={sendMessage}><textarea rows={3} value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={handleComposerKey} placeholder="Describe el contexto del atleta…" disabled={loading} /><button type="submit" disabled={!input.trim() || loading} aria-label="Enviar mensaje"><ArrowUpRight size={21} /></button></form>
        </section> : view === 'atlas' ? <div className="coach-panel"><ExercisePicker selected={selectedExercises} onToggle={(exercise) => setSelectedExercises((current) => current.some((item) => item.id === exercise.id) ? current.filter((item) => item.id !== exercise.id) : [...current, exercise])} /></div> : <section className="coach-history coach-panel">
          <header><div><h3>Historial</h3></div><small>{history.length}</small></header>
          {history.length ? history.map((plan, index) => <article key={plan.PlanID}><span>{String(index + 1).padStart(2, '0')}</span><div><header><strong>{plan.PlanType}</strong><time>{shortDate(plan.CreatedAt)}</time></header><button type="button" onClick={() => void downloadPdf(plan.PlanContent, plan.PlanType, plan.PlanID)}><FileDown size={14} /> Descargar PDF</button></div></article>) : <div className="history-empty"><History size={24} /><h3>Sin planes</h3></div>}
        </section>}
      </div>
    </Modal>
  );
}

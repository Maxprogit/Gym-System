import { useEffect, useLayoutEffect, useMemo, useState, type FormEvent } from 'react';
import { CalendarPlus } from 'lucide-react';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { PaymentCheckoutDialog } from '../../components/ui/PaymentCheckoutDialog';
import { getErrorMessage } from '../../lib/api';
import { notify } from '../../lib/notify';
import { currency } from '../../lib/format';
import { useMemberStore } from '../../stores/memberStore';
import type { Member } from '../../types';

export function RenewalDialog({ member, onClose }: { member: Member | null; onClose: () => void }) {
  const plans = useMemberStore((state) => state.plans);
  const renew = useMemberStore((state) => state.renew);
  const [planId, setPlanId] = useState('');
  const [method, setMethod] = useState('Efectivo');
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useLayoutEffect(() => {
    if (!member) return;
    setPlanId(String(plans[0]?.PlanID || ''));
    setMethod('Efectivo');
    setCheckoutOpen(false);
    setError('');
  }, [member]);

  useEffect(() => {
    if (!member || !plans[0]) return;
    setPlanId((current) => current || String(plans[0].PlanID));
  }, [member, plans]);

  const selectedPlan = useMemo(() => plans.find((plan) => plan.PlanID === Number(planId)), [planId, plans]);

  const save = async () => {
    if (!member || !selectedPlan) return;
    setLoading(true);
    setError('');
    try {
      const renewal = (async () => {
        await renew(member.MemberID, selectedPlan.PlanID, method);
        return selectedPlan.DurationDays;
      })();
      await notify.promise(renewal, {
        loading: 'Procesando renovación',
        success: (days) => `Membresía renovada por ${days} días`,
        error: 'No pudimos renovar la membresía',
      });
      setCheckoutOpen(false);
      onClose();
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setLoading(false);
    }
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setError('');
    if (!member || !selectedPlan) return;
    if (method === 'Tarjeta' || method === 'Transferencia') {
      setCheckoutOpen(true);
      return;
    }
    void save();
  };

  return (
    <Modal open={Boolean(member)} onClose={onClose} title="Renovar membresía" description={member ? `Extiende la vigencia de ${member.FullName} desde su fecha actual.` : undefined}>
      <form className="form-grid" onSubmit={submit}>
        <label className="field"><span>Nuevo plan</span><select value={planId} onChange={(event) => setPlanId(event.target.value)}>{plans.map((plan) => <option key={plan.PlanID} value={plan.PlanID}>{plan.PlanName}</option>)}</select></label>
        <label className="field"><span>Método de pago</span><select value={method} onChange={(event) => setMethod(event.target.value)}><option>Efectivo</option><option>Tarjeta</option><option>Transferencia</option></select></label>
        {selectedPlan && <div className="renewal-summary field--wide"><div><span>Duración</span><strong>{selectedPlan.DurationDays} días</strong></div><div><span>Total autorizado por servidor</span><strong>{currency.format(Number(selectedPlan.Price))}</strong></div></div>}
        {error && <p className="form-error field--wide">{error}</p>}
        <div className="form-actions field--wide"><Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button><Button type="submit" loading={loading} icon={<CalendarPlus size={17} />}>Confirmar renovación</Button></div>
      </form>
      {selectedPlan && (method === 'Tarjeta' || method === 'Transferencia') && (
        <PaymentCheckoutDialog
          open={checkoutOpen}
          method={method}
          amount={Number(selectedPlan.Price)}
          onClose={() => setCheckoutOpen(false)}
          onSuccess={save}
        />
      )}
    </Modal>
  );
}

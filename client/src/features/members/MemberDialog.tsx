import { useEffect, useLayoutEffect, useState, type FormEvent } from 'react';
import { UserPlus } from 'lucide-react';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { PaymentCheckoutDialog } from '../../components/ui/PaymentCheckoutDialog';
import { getErrorMessage } from '../../lib/api';
import { notify } from '../../lib/notify';
import { useMemberStore } from '../../stores/memberStore';
import type { Member } from '../../types';

export function MemberDialog({ open, onClose, member }: { open: boolean; onClose: () => void; member: Member | null }) {
  const plans = useMemberStore((state) => state.plans);
  const add = useMemberStore((state) => state.add);
  const update = useMemberStore((state) => state.update);
  const [form, setForm] = useState({ fullName: '', phone: '', planId: '', paymentMethod: 'Efectivo' });
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useLayoutEffect(() => {
    if (!open) return;
    setForm(member ? {
      fullName: member.FullName,
      phone: member.Phone,
      planId: '',
      paymentMethod: 'Efectivo',
    } : {
      fullName: '',
      phone: '',
      planId: String(plans[0]?.PlanID || ''),
      paymentMethod: 'Efectivo',
    });
    setCheckoutOpen(false);
    setError('');
  }, [member, open]);

  useEffect(() => {
    if (!open || member || !plans[0]) return;
    setForm((current) => current.planId ? current : { ...current, planId: String(plans[0].PlanID) });
  }, [member, open, plans]);

  const validate = () => {
    setError('');
    if (form.fullName.trim().length < 3 || form.phone.replace(/\D/g, '').length < 10) {
      setError('Verifica el nombre y el teléfono del atleta.');
      return false;
    }
    if (!member && !form.planId) {
      setError('Selecciona un plan de membresía.');
      return false;
    }
    return true;
  };

  const save = async () => {
    setLoading(true);
    try {
      const operation = (async () => {
        if (member) await update(member.MemberID, { fullName: form.fullName, phone: form.phone });
        else await add({ ...form, planId: Number(form.planId) });
      })();
      await notify.promise(operation, {
        loading: member ? 'Actualizando atleta' : 'Registrando atleta y membresía',
        success: member ? 'Datos del atleta actualizados' : 'Atleta registrado y pago aplicado',
        error: member ? 'No pudimos actualizar al atleta' : 'No pudimos registrar al atleta',
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
    if (!validate()) return;
    if (!member && (form.paymentMethod === 'Tarjeta' || form.paymentMethod === 'Transferencia')) {
      setCheckoutOpen(true);
      return;
    }
    void save();
  };

  const selectedPlan = plans.find((plan) => plan.PlanID === Number(form.planId));

  return (
    <Modal open={open} onClose={onClose} title={member ? 'Editar atleta' : 'Nuevo atleta'}>
      <form className="form-grid" onSubmit={submit}>
        <label className="field field--wide"><span>Nombre completo</span><input autoFocus value={form.fullName} onChange={(event) => { const fullName = event.target.value; setForm((current) => ({ ...current, fullName })); }} placeholder="Ej. Fernanda López" /></label>
        <label className="field field--wide"><span>WhatsApp</span><input inputMode="tel" value={form.phone} onChange={(event) => { const phone = event.target.value; setForm((current) => ({ ...current, phone })); }} placeholder="464 123 4567" /></label>
        {!member && (
          <>
            <label className="field"><span>Plan</span><select value={form.planId} onChange={(event) => { const planId = event.target.value; setForm((current) => ({ ...current, planId })); }}>{plans.map((plan) => <option key={plan.PlanID} value={plan.PlanID}>{plan.PlanName} · ${plan.Price}</option>)}</select></label>
            <label className="field"><span>Método de pago</span><select value={form.paymentMethod} onChange={(event) => { const paymentMethod = event.target.value; setForm((current) => ({ ...current, paymentMethod })); }}><option>Efectivo</option><option>Tarjeta</option><option>Transferencia</option></select></label>
          </>
        )}
        {error && <p className="form-error field--wide">{error}</p>}
        <div className="form-actions field--wide">
          <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button type="submit" loading={loading} icon={<UserPlus size={17} />}>{member ? 'Guardar cambios' : 'Registrar atleta'}</Button>
        </div>
      </form>
      {!member && selectedPlan && (form.paymentMethod === 'Tarjeta' || form.paymentMethod === 'Transferencia') && (
        <PaymentCheckoutDialog
          open={checkoutOpen}
          method={form.paymentMethod}
          amount={Number(selectedPlan.Price)}
          onClose={() => setCheckoutOpen(false)}
          onSuccess={save}
        />
      )}
    </Modal>
  );
}

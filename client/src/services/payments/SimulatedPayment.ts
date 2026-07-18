export interface PaymentData {
  amount: number;
  method: 'Tarjeta' | 'Transferencia' | 'Efectivo';
  cardNumber?: string;
  cardName?: string;
  cardExpiry?: string;
  cardCvv?: string;
  transferReference?: string;
  transferConfirmed?: boolean;
}

export interface PaymentResult {
  success: boolean;
  transactionId?: string;
  error?: string;
}

const validateCard = (data: PaymentData) => {
  const number = String(data.cardNumber || '').replace(/\D/g, '');
  if (!/^\d{16}$/.test(number)) return 'La tarjeta debe contener 16 dígitos.';
  if (String(data.cardName || '').trim().length < 3) return 'Escribe el nombre impreso en la tarjeta.';
  if (!/^(0[1-9]|1[0-2])\/\d{2}$/.test(String(data.cardExpiry || ''))) return 'La vigencia debe tener formato MM/AA.';
  const [month, year] = String(data.cardExpiry).split('/').map(Number);
  if (new Date(2000 + year, month, 1) <= new Date()) return 'La tarjeta simulada está vencida.';
  if (!/^\d{3,4}$/.test(String(data.cardCvv || ''))) return 'El código de seguridad no es válido.';
  if (number.endsWith('0000')) return 'Tarjeta declinada. Intenta con otro método.';
  return '';
};

export const simulatedPayment = async (data: PaymentData): Promise<PaymentResult> => {
  await new Promise((resolve) => window.setTimeout(resolve, 1500));

  if (!Number.isFinite(data.amount) || data.amount <= 0) {
    return { success: false, error: 'El monto del cobro no es válido.' };
  }
  if (data.method === 'Tarjeta') {
    const cardError = validateCard(data);
    if (cardError) return { success: false, error: cardError };
  }
  if (data.method === 'Transferencia' && !data.transferConfirmed) {
    return { success: false, error: 'Confirma que realizaste la transferencia simulada.' };
  }

  const transactionId = `SIM-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
  return { success: true, transactionId };
};

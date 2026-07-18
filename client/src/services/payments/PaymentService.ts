import { simulatedPayment, type PaymentData, type PaymentResult } from './SimulatedPayment';

const provider = import.meta.env.VITE_PAYMENT_PROVIDER || 'simulated';

export const processPayment = async (data: PaymentData): Promise<PaymentResult> => {
  if (provider === 'simulated') return simulatedPayment(data);
  return { success: false, error: 'El proveedor de pagos configurado no está disponible.' };
};

export type { PaymentData, PaymentResult };

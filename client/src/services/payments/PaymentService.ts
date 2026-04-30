import { simulatedPayment, PaymentData, PaymentResult } from './SimulatedPayment';

const provider = import.meta.env.VITE_PAYMENT_PROVIDER || 'simulated';

export const processPayment = async (data: PaymentData): Promise<PaymentResult> => {
    if (provider === 'simulated') {
        return await simulatedPayment(data);
    }
    // futuro: stripe, conekta, etc.
    return { success: false, error: 'Proveedor de pagos no configurado' };
};

export type { PaymentData, PaymentResult };
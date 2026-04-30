export interface PaymentData {
    amount: number;
    method: 'Tarjeta' | 'Transferencia' | 'Efectivo';
    cardNumber?: string;
    cardName?: string;
    cardExpiry?: string;
    cardCvv?: string;
}

export interface PaymentResult {
    success: boolean;
    transactionId?: string;
    error?: string;
}

export const simulatedPayment = async (data: PaymentData): Promise<PaymentResult> => {
    // Simula un delay de red real
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Simula un rechazo si la tarjeta termina en 0000
    if (data.cardNumber?.endsWith('0000')) {
        return { success: false, error: 'Tarjeta declinada. Intenta con otro método.' };
    }

    // Genera un ID de transacción falso pero realista
    const transactionId = `SIM-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

    return { success: true, transactionId };
};
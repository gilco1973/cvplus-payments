// Payment hook for React components
import { useState, useCallback } from 'react';
import { PaymentIntent, PaymentResult } from '../../types/payment.types';

export interface UsePaymentReturn {
  createPayment: (amount: number, currency?: string) => Promise<PaymentResult>;
  confirmPayment: (paymentIntentId: string) => Promise<PaymentResult>;
  loading: boolean;
  error: string | null;
  paymentIntent: PaymentIntent | null;
}

export const usePayment = (): UsePaymentReturn => {
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [paymentIntent, setPaymentIntent] = useState<PaymentIntent | null>(null);

  const createPayment = useCallback(async (amount: number, currency = 'usd'): Promise<PaymentResult> => {
    setLoading(true);
    setError(null);

    try {
      // This would make an API call to create payment intent
      const mockPaymentIntent: PaymentIntent = {
        id: `pi_${Date.now()}`,
        amount,
        currency,
        status: 'requires_payment_method',
        clientSecret: `pi_${Date.now()}_secret_test`,
      };

      setPaymentIntent(mockPaymentIntent);
      
      return {
        success: true,
        paymentIntent: mockPaymentIntent,
      };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Payment creation failed';
      setError(errorMessage);
      
      return {
        success: false,
        error: errorMessage,
      };
    } finally {
      setLoading(false);
    }
  }, []);

  const confirmPayment = useCallback(async (paymentIntentId: string): Promise<PaymentResult> => {
    setLoading(true);
    setError(null);

    try {
      // This would make an API call to confirm payment
      const confirmedPayment: PaymentIntent = {
        id: paymentIntentId,
        amount: paymentIntent?.amount || 0,
        currency: paymentIntent?.currency || 'usd',
        status: 'succeeded',
      };

      setPaymentIntent(confirmedPayment);
      
      return {
        success: true,
        paymentIntent: confirmedPayment,
      };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Payment confirmation failed';
      setError(errorMessage);
      
      return {
        success: false,
        error: errorMessage,
      };
    } finally {
      setLoading(false);
    }
  }, [paymentIntent]);

  return {
    createPayment,
    confirmPayment,
    loading,
    error,
    paymentIntent,
  };
};

export default usePayment;
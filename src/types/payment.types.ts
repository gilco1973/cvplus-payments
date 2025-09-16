// @ts-ignore - Export conflicts// Payment processing types (legacy - prefer payments.types.ts for new code)

export interface CheckoutSession {
  id: string;
  url: string;
  customerId?: string;
  paymentIntentId?: string;
  subscriptionId?: string;
  mode: 'payment' | 'setup' | 'subscription';
}
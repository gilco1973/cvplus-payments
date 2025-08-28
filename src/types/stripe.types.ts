// Stripe-specific types

export interface StripeConfig {
  secretKey: string;
  publishableKey: string;
  webhookSecret: string;
  currency: string;
}

export interface StripeCustomer {
  id: string;
  email: string;
  name?: string;
  metadata?: Record<string, string>;
}

export interface StripeSubscription {
  id: string;
  customerId: string;
  status: 'active' | 'past_due' | 'unpaid' | 'canceled' | 'incomplete' | 'incomplete_expired' | 'trialing';
  priceId: string;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  metadata?: Record<string, string>;
}

export interface WebhookEvent {
  id: string;
  type: string;
  data: {
    object: any;
  };
  created: number;
}
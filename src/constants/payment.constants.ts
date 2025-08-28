// Payment processing constants

export const PAYMENT_CONSTANTS = {
  CURRENCIES: {
    USD: 'usd',
    EUR: 'eur',
    GBP: 'gbp',
  },
  
  PAYMENT_METHODS: {
    CARD: 'card',
    APPLE_PAY: 'apple_pay',
    GOOGLE_PAY: 'google_pay',
  },
  
  SUBSCRIPTION_STATUSES: {
    ACTIVE: 'active',
    PAST_DUE: 'past_due',
    UNPAID: 'unpaid',
    CANCELED: 'canceled',
    INCOMPLETE: 'incomplete',
    INCOMPLETE_EXPIRED: 'incomplete_expired',
    TRIALING: 'trialing',
  },
  
  BOOKING_STATUSES: {
    PENDING: 'pending',
    CONFIRMED: 'confirmed',
    CANCELLED: 'cancelled',  
    COMPLETED: 'completed',
  },
  
  WEBHOOK_EVENTS: {
    PAYMENT_INTENT_SUCCEEDED: 'payment_intent.succeeded',
    PAYMENT_INTENT_PAYMENT_FAILED: 'payment_intent.payment_failed',
    CUSTOMER_SUBSCRIPTION_CREATED: 'customer.subscription.created',
    CUSTOMER_SUBSCRIPTION_UPDATED: 'customer.subscription.updated',
    CUSTOMER_SUBSCRIPTION_DELETED: 'customer.subscription.deleted',
    INVOICE_PAYMENT_SUCCEEDED: 'invoice.payment_succeeded',
    INVOICE_PAYMENT_FAILED: 'invoice.payment_failed',
  },
} as const;
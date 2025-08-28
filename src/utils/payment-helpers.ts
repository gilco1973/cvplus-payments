// Payment utility and helper functions

/**
 * Convert amount from dollars to cents for Stripe
 */
export function dollarsToStripeAmount(dollars: number): number {
  return Math.round(dollars * 100);
}

/**
 * Convert Stripe amount (cents) to dollars
 */
export function stripeAmountToDollars(cents: number): number {
  return cents / 100;
}

/**
 * Format currency amount for display
 */
export function formatCurrency(amount: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(amount);
}

/**
 * Validate email format for payment processing
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Generate payment metadata
 */
export function generatePaymentMetadata(data: Record<string, any>): Record<string, string> {
  const metadata: Record<string, string> = {};
  
  for (const [key, value] of Object.entries(data)) {
    // Stripe metadata values must be strings and <= 500 characters
    const stringValue = String(value);
    metadata[key] = stringValue.length > 500 ? stringValue.substring(0, 500) : stringValue;
  }
  
  return metadata;
}
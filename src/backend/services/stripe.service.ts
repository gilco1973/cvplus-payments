// @ts-ignore - Export conflicts// Stripe service implementation
import Stripe from 'stripe';

export class StripeService {
  private stripe: Stripe;

  constructor(secretKey: string) {
    this.stripe = new Stripe(secretKey, {
      apiVersion: '2024-06-20',
    });
  }

  async createPaymentIntent(amount: number, currency: string = 'usd') {
    return await this.stripe.paymentIntents.create({
      amount,
      currency,
    });
  }

  async createCheckoutSession(options: Stripe.Checkout.SessionCreateParams) {
    return await this.stripe.checkout.sessions.create(options);
  }

  async retrievePaymentIntent(paymentIntentId: string) {
    return await this.stripe.paymentIntents.retrieve(paymentIntentId);
  }
}

export default StripeService;
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { logger, db } from '@cvplus/core';

// Local CORS configuration
const corsConfig = {
  origin: ['http://localhost:3000', 'https://cvplus.app'],
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
};
import {
  getPriceInCents,
  getStripePriceId,
  logPricingStatus,
  validatePricingConfig,
  getTierConfig
} from '../config/pricing';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20' as any,
});

interface CreateCheckoutSessionData {
  userId: string;
  userEmail: string;
  priceId?: string; // Optional Stripe price ID
  successUrl?: string;
  cancelUrl?: string;
}

export const createCheckoutSession = onCall<CreateCheckoutSessionData>(
  {
    ...corsConfig,
    secrets: ['STRIPE_SECRET_KEY', 'STRIPE_PUBLISHABLE_KEY']
  },
  async (request) => {
    const { data, auth } = request;

    // Verify authentication
    if (!auth) {
      throw new HttpsError('unauthenticated', 'User must be authenticated');
    }

    // Verify user matches the authenticated user
    if (auth.uid !== data.userId) {
      throw new HttpsError('permission-denied', 'User ID mismatch');
    }

    const { 
      userId, 
      userEmail, 
      priceId,
      successUrl = `${process.env.FUNCTIONS_EMULATOR ? 'http://localhost:3000' : 'https://getmycv-ai.web.app'}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl = `${process.env.FUNCTIONS_EMULATOR ? 'http://localhost:3000' : 'https://getmycv-ai.web.app'}/pricing?canceled=true`
    } = data;

    try {
      // Check if user already has lifetime premium
      const existingSubscription = await db
        .collection('userSubscriptions')
        .doc(userId)
        .get();

      if (existingSubscription.exists && existingSubscription.data()?.lifetimeAccess) {
        throw new HttpsError(
          'failed-precondition',
          'User already has lifetime premium access'
        );
      }

      // Create or retrieve Stripe customer
      let customerId: string;
      const existingPaymentData = await db
        .collection('paymentHistory')
        .where('userId', '==', userId)
        .limit(1)
        .get();

      if (!existingPaymentData.empty && existingPaymentData.docs[0].data().stripeCustomerId) {
        customerId = existingPaymentData.docs[0].data().stripeCustomerId;
      } else {
        const customer = await stripe.customers.create({
          email: userEmail,
          metadata: {
            userId,
            platform: 'cvplus'
          }
        });
        customerId = customer.id;
      }

      // Create checkout session
      const sessionParams: Stripe.Checkout.SessionCreateParams = {
        customer: customerId,
        payment_method_types: ['card'],
        mode: 'payment',
        success_url: successUrl,
        cancel_url: cancelUrl,
        metadata: {
          userId,
          userEmail,
          productType: 'lifetime_premium'
        },
        customer_update: {
          address: 'auto',
        },
        invoice_creation: {
          enabled: true,
        },
      };

      // Validate pricing configuration on each request
      const pricingValidation = validatePricingConfig();
      if (!pricingValidation.isValid) {
        logger.error('Pricing configuration validation failed', {
          errors: pricingValidation.errors,
          warnings: pricingValidation.warnings
        });
      }

      // Use price ID if provided, otherwise create one-time payment using centralized config
      if (priceId) {
        sessionParams.line_items = [{
          price: priceId,
          quantity: 1,
        }];
      } else {
        // Get pricing from centralized configuration
        const premiumConfig = getTierConfig('PREMIUM');
        const fallbackPriceId = getStripePriceId('PREMIUM');
        
        // Try to use Stripe Price ID first if properly configured
        if (fallbackPriceId && !fallbackPriceId.includes('template')) {
          sessionParams.line_items = [{
            price: fallbackPriceId,
            quantity: 1,
          }];
          
          logger.info('Using environment-specific Stripe Price ID', {
            priceId: fallbackPriceId,
            environment: process.env.NODE_ENV || 'unknown'
          });
        } else {
          // Fallback to price_data with centralized pricing
          sessionParams.line_items = [{
            price_data: {
              currency: premiumConfig.price.currency.toLowerCase(),
              product_data: {
                name: 'CVPlus Premium - Lifetime Access',
                description: premiumConfig.description,
                images: ['https://getmycv-ai.web.app/CVisionary_Logo.png'],
              },
              unit_amount: getPriceInCents('PREMIUM'),
            },
            quantity: 1,
          }];
          
          logger.warn('Using price_data fallback due to missing Stripe Price ID', {
            priceCents: getPriceInCents('PREMIUM'),
            priceDollars: premiumConfig.price.dollars,
            environment: process.env.NODE_ENV || 'unknown',
            fallbackPriceId
          });
        }
      }

      const session = await stripe.checkout.sessions.create(sessionParams);

      // Log pricing configuration status
      logPricingStatus('PREMIUM');
      
      // Log checkout session creation
      logger.info('Checkout session created', {
        userId,
        userEmail,
        sessionId: session.id,
        customerId,
        amount: priceId ? 'price_id_used' : getPriceInCents('PREMIUM'),
        priceConfig: {
          providedPriceId: priceId,
          fallbackPriceId: priceId ? null : getStripePriceId('PREMIUM'),
          priceCents: getPriceInCents('PREMIUM'),
          priceDollars: getTierConfig('PREMIUM').price.dollars,
          environment: process.env.NODE_ENV || 'unknown'
        }
      });

      return {
        sessionId: session.id,
        url: session.url,
        customerId
      };

    } catch (error) {
      logger.error('Error creating checkout session', { error, userId, userEmail });
      
      if (error instanceof HttpsError) {
        throw error;
      }
      
      throw new HttpsError(
        'internal',
        'Failed to create checkout session',
        error
      );
    }
  }
);
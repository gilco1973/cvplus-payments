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
  logPricingStatus,
  validatePricingConfig,
  getTierConfig
} from '../config/pricing';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20' as any,
});

interface CreatePaymentIntentData {
  userId: string;
  email: string;
  googleId: string;
  amount?: number; // Optional, defaults to premium pricing from config
}

export const createPaymentIntent = onCall<CreatePaymentIntentData>(
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

    // Validate pricing configuration
    const pricingValidation = validatePricingConfig();
    if (!pricingValidation.isValid) {
      logger.error('Pricing configuration validation failed', {
        errors: pricingValidation.errors,
        warnings: pricingValidation.warnings
      });
    }
    
    // Use provided amount or default to premium pricing from centralized config
    const defaultAmount = getPriceInCents('PREMIUM');
    const { userId, email, googleId, amount = defaultAmount } = data;
    
    // Log pricing configuration status
    logPricingStatus('PREMIUM');
    
    logger.info('Creating payment intent with pricing', {
      providedAmount: data.amount,
      finalAmount: amount,
      defaultPremiumAmount: defaultAmount,
      premiumPriceDollars: getTierConfig('PREMIUM').price.dollars
    });

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
          email,
          metadata: {
            userId,
            googleId,
            platform: 'cvplus'
          }
        });
        customerId = customer.id;
      }

      // Get premium config for consistent description and currency
      const premiumConfig = getTierConfig('PREMIUM');
      
      // Create payment intent
      const paymentIntent = await stripe.paymentIntents.create({
        amount,
        currency: premiumConfig.price.currency.toLowerCase(),
        customer: customerId,
        description: `CVPlus ${premiumConfig.name} - ${premiumConfig.description}`,
        metadata: {
          userId,
          googleId,
          email,
          productType: 'lifetime_premium',
          tier: premiumConfig.tier,
          priceCents: amount.toString(),
          priceDollars: (amount / 100).toString()
        },
        automatic_payment_methods: {
          enabled: true,
        },
      });

      // Log payment intent creation
      logger.info('Payment intent created', {
        userId,
        email,
        paymentIntentId: paymentIntent.id,
        amount,
        customerId
      });

      return {
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
        customerId,
        amount
      };

    } catch (error) {
      logger.error('Error creating payment intent', { error, userId, email });
      
      if (error instanceof HttpsError) {
        throw error;
      }
      
      throw new HttpsError(
        'internal',
        'Failed to create payment intent',
        error
      );
    }
  }
);
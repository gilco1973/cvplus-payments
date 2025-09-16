// @ts-ignore - Export conflictsimport { onCall, HttpsError } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions';
import { db } from '../../../../../functions/src/config/firebase';
import { corsOptions } from '../../../../../functions/src/config/cors';
import Stripe from 'stripe';
import { Timestamp } from 'firebase-admin/firestore';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20',
});

interface ConfirmPaymentData {
  paymentIntentId: string;
  userId: string;
  googleId: string;
}

export const confirmPayment = onCall<ConfirmPaymentData>(
  {
    ...corsOptions,
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

    const { paymentIntentId, userId, googleId } = data;

    try {
      // Verify payment with Stripe
      const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

      if (paymentIntent.status !== 'succeeded') {
        throw new HttpsError(
          'failed-precondition',
          `Payment not completed. Status: ${paymentIntent.status}`
        );
      }

      // Verify payment metadata matches
      if (paymentIntent.metadata.userId !== userId || 
          paymentIntent.metadata.googleId !== googleId) {
        throw new HttpsError(
          'permission-denied',
          'Payment metadata mismatch'
        );
      }

      const now = Timestamp.now();

      // Create user subscription record
      const subscriptionData = {
        userId,
        email: paymentIntent.metadata.email,
        googleId,
        subscriptionStatus: 'premium_lifetime',
        paymentMethod: 'stripe',
        stripeCustomerId: paymentIntent.customer as string,
        stripePaymentIntentId: paymentIntentId,
        purchasedAt: now,
        lifetimeAccess: true,
        features: {
          webPortal: true,
          aiChat: true,
          podcast: true,
          advancedAnalytics: true
        },
        metadata: {
          paymentAmount: paymentIntent.amount,
          currency: paymentIntent.currency,
          accountVerification: {
            googleEmail: paymentIntent.metadata.email,
            googleId,
            verifiedAt: now
          }
        },
        createdAt: now,
        updatedAt: now
      };

      // Create payment history record
      const paymentHistoryData = {
        paymentId: paymentIntentId,
        userId,
        amount: paymentIntent.amount,
        currency: paymentIntent.currency,
        status: 'succeeded',
        stripePaymentIntentId: paymentIntentId,
        stripeCustomerId: paymentIntent.customer as string,
        paymentMethod: {
          type: paymentIntent.payment_method_types[0],
          // Additional payment method details can be added here
        },
        createdAt: now,
        processedAt: now
      };

      // Use batch write for atomicity
      const batch = db.batch();

      // Create/update subscription
      const subscriptionRef = db.collection('userSubscriptions').doc(userId);
      batch.set(subscriptionRef, subscriptionData);

      // Create payment history
      const paymentHistoryRef = db.collection('paymentHistory').doc(paymentIntentId);
      batch.set(paymentHistoryRef, paymentHistoryData);

      // Update user document
      const userRef = db.collection('users').doc(userId);
      batch.update(userRef, {
        subscriptionStatus: 'premium_lifetime',
        premiumFeatures: ['webPortal', 'aiChat', 'podcast', 'advancedAnalytics'],
        lifetimeAccessGranted: true,
        purchaseDate: now,
        googleAccountVerification: {
          email: paymentIntent.metadata.email,
          id: googleId,
          verifiedAt: now
        }
      });

      // Commit the batch
      await batch.commit();

      logger.info('Lifetime premium access granted', {
        userId,
        paymentIntentId,
        amount: paymentIntent.amount,
        googleId
      });

      return {
        success: true,
        subscriptionStatus: 'premium_lifetime',
        lifetimeAccess: true,
        features: subscriptionData.features,
        purchasedAt: now,
        message: 'Lifetime premium access granted successfully'
      };

    } catch (error) {
      logger.error('Error confirming payment', { error, userId, paymentIntentId });
      
      if (error instanceof HttpsError) {
        throw error;
      }
      
      throw new HttpsError(
        'internal',
        'Failed to confirm payment and grant premium access',
        error
      );
    }
  }
);
// @ts-ignore - Export conflictsimport { onRequest } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions';
import { db } from '../../../../../functions/src/config/firebase';
import Stripe from 'stripe';
import { Timestamp } from 'firebase-admin/firestore';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20',
});

const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET!;

export const handleStripeWebhook = onRequest(
  {
    secrets: ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET', 'STRIPE_PUBLISHABLE_KEY']
  },
  async (req, res) => {
  const sig = req.headers['stripe-signature'] as string;

  if (!sig) {
    logger.error('Missing stripe-signature header');
    res.status(400).send('Missing stripe-signature header');
    return;
  }

  let event: Stripe.Event;

  try {
    // Verify webhook signature
    event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
  } catch (err) {
    logger.error('Webhook signature verification failed', { error: err });
    res.status(400).send(`Webhook Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    return;
  }

  try {
    switch (event.type) {
      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        await handlePaymentSucceeded(paymentIntent);
        break;
      }
      
      case 'payment_intent.payment_failed': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        await handlePaymentFailed(paymentIntent);
        break;
      }
      
      case 'charge.dispute.created': {
        const dispute = event.data.object as Stripe.Dispute;
        await handleChargeDispute(dispute);
        break;
      }
      
      default:
        logger.info('Unhandled webhook event type', { type: event.type });
    }

    res.status(200).json({ received: true });
  } catch (error) {
    logger.error('Error handling webhook', { error, eventType: event.type });
    res.status(500).send('Webhook handler failed');
  }
});

async function handlePaymentSucceeded(paymentIntent: Stripe.PaymentIntent) {
  const { id: paymentIntentId, metadata } = paymentIntent;
  const { userId, googleId, email } = metadata;

  if (!userId || !googleId || !email) {
    logger.error('Missing required metadata in payment intent', { paymentIntentId, metadata });
    return;
  }

  try {
    // Check if we've already processed this payment
    const existingSubscription = await db
      .collection('userSubscriptions')
      .doc(userId)
      .get();

    if (existingSubscription.exists && 
        existingSubscription.data()?.stripePaymentIntentId === paymentIntentId) {
      logger.info('Payment already processed', { paymentIntentId, userId });
      return;
    }

    const now = Timestamp.now();

    // Create subscription data
    const subscriptionData = {
      userId,
      email,
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
          googleEmail: email,
          googleId,
          verifiedAt: now
        }
      },
      createdAt: now,
      updatedAt: now
    };

    // Update payment history
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
      },
      createdAt: now,
      processedAt: now
    };

    // Use batch write for atomicity
    const batch = db.batch();

    // Create/update subscription
    const subscriptionRef = db.collection('userSubscriptions').doc(userId);
    batch.set(subscriptionRef, subscriptionData);

    // Update payment history
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
        email,
        id: googleId,
        verifiedAt: now
      }
    });

    await batch.commit();

    logger.info('Webhook: Lifetime premium access granted', {
      userId,
      paymentIntentId,
      amount: paymentIntent.amount
    });

  } catch (error) {
    logger.error('Error processing successful payment webhook', {
      error,
      paymentIntentId,
      userId
    });
    throw error;
  }
}

async function handlePaymentFailed(paymentIntent: Stripe.PaymentIntent) {
  const { id: paymentIntentId, metadata } = paymentIntent;
  const { userId } = metadata;

  logger.warn('Payment failed', {
    paymentIntentId,
    userId,
    lastPaymentError: paymentIntent.last_payment_error
  });

  // Update payment history with failed status
  if (paymentIntentId) {
    try {
      await db.collection('paymentHistory').doc(paymentIntentId).set({
        paymentId: paymentIntentId,
        userId,
        amount: paymentIntent.amount,
        currency: paymentIntent.currency,
        status: 'failed',
        stripePaymentIntentId: paymentIntentId,
        stripeCustomerId: paymentIntent.customer as string,
        paymentMethod: {
          type: paymentIntent.payment_method_types[0],
        },
        failureReason: paymentIntent.last_payment_error?.message || 'Payment failed',
        createdAt: Timestamp.now(),
        failedAt: Timestamp.now()
      });
    } catch (error) {
      logger.error('Error updating failed payment history', { error, paymentIntentId });
    }
  }
}

async function handleChargeDispute(dispute: Stripe.Dispute) {
  const chargeId = dispute.charge as string;
  
  logger.warn('Charge dispute created', {
    disputeId: dispute.id,
    chargeId,
    amount: dispute.amount,
    reason: dispute.reason,
    status: dispute.status
  });

  // You might want to implement additional logic here:
  // - Flag the user account
  // - Send notifications to admin
  // - Temporarily suspend premium features pending resolution
}
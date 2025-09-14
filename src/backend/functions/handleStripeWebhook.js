"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleStripeWebhook = void 0;
const https_1 = require("firebase-functions/v2/https");
const firebase_functions_1 = require("firebase-functions");
const firebase_1 = require("../../../../../functions/src/config/firebase");
const stripe_1 = __importDefault(require("stripe"));
const firestore_1 = require("firebase-admin/firestore");
const stripe = new stripe_1.default(process.env.STRIPE_SECRET_KEY, {
    apiVersion: '2024-06-20',
});
const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;
exports.handleStripeWebhook = (0, https_1.onRequest)({
    secrets: ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET', 'STRIPE_PUBLISHABLE_KEY']
}, async (req, res) => {
    const sig = req.headers['stripe-signature'];
    if (!sig) {
        firebase_functions_1.logger.error('Missing stripe-signature header');
        res.status(400).send('Missing stripe-signature header');
        return;
    }
    let event;
    try {
        // Verify webhook signature
        event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
    }
    catch (err) {
        firebase_functions_1.logger.error('Webhook signature verification failed', { error: err });
        res.status(400).send(`Webhook Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
        return;
    }
    try {
        switch (event.type) {
            case 'payment_intent.succeeded': {
                const paymentIntent = event.data.object;
                await handlePaymentSucceeded(paymentIntent);
                break;
            }
            case 'payment_intent.payment_failed': {
                const paymentIntent = event.data.object;
                await handlePaymentFailed(paymentIntent);
                break;
            }
            case 'charge.dispute.created': {
                const dispute = event.data.object;
                await handleChargeDispute(dispute);
                break;
            }
            default:
                firebase_functions_1.logger.info('Unhandled webhook event type', { type: event.type });
        }
        res.status(200).json({ received: true });
    }
    catch (error) {
        firebase_functions_1.logger.error('Error handling webhook', { error, eventType: event.type });
        res.status(500).send('Webhook handler failed');
    }
});
async function handlePaymentSucceeded(paymentIntent) {
    const { id: paymentIntentId, metadata } = paymentIntent;
    const { userId, googleId, email } = metadata;
    if (!userId || !googleId || !email) {
        firebase_functions_1.logger.error('Missing required metadata in payment intent', { paymentIntentId, metadata });
        return;
    }
    try {
        // Check if we've already processed this payment
        const existingSubscription = await firebase_1.db
            .collection('userSubscriptions')
            .doc(userId)
            .get();
        if (existingSubscription.exists &&
            existingSubscription.data()?.stripePaymentIntentId === paymentIntentId) {
            firebase_functions_1.logger.info('Payment already processed', { paymentIntentId, userId });
            return;
        }
        const now = firestore_1.Timestamp.now();
        // Create subscription data
        const subscriptionData = {
            userId,
            email,
            googleId,
            subscriptionStatus: 'premium_lifetime',
            paymentMethod: 'stripe',
            stripeCustomerId: paymentIntent.customer,
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
            stripeCustomerId: paymentIntent.customer,
            paymentMethod: {
                type: paymentIntent.payment_method_types[0],
            },
            createdAt: now,
            processedAt: now
        };
        // Use batch write for atomicity
        const batch = firebase_1.db.batch();
        // Create/update subscription
        const subscriptionRef = firebase_1.db.collection('userSubscriptions').doc(userId);
        batch.set(subscriptionRef, subscriptionData);
        // Update payment history
        const paymentHistoryRef = firebase_1.db.collection('paymentHistory').doc(paymentIntentId);
        batch.set(paymentHistoryRef, paymentHistoryData);
        // Update user document
        const userRef = firebase_1.db.collection('users').doc(userId);
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
        firebase_functions_1.logger.info('Webhook: Lifetime premium access granted', {
            userId,
            paymentIntentId,
            amount: paymentIntent.amount
        });
    }
    catch (error) {
        firebase_functions_1.logger.error('Error processing successful payment webhook', {
            error,
            paymentIntentId,
            userId
        });
        throw error;
    }
}
async function handlePaymentFailed(paymentIntent) {
    const { id: paymentIntentId, metadata } = paymentIntent;
    const { userId } = metadata;
    firebase_functions_1.logger.warn('Payment failed', {
        paymentIntentId,
        userId,
        lastPaymentError: paymentIntent.last_payment_error
    });
    // Update payment history with failed status
    if (paymentIntentId) {
        try {
            await firebase_1.db.collection('paymentHistory').doc(paymentIntentId).set({
                paymentId: paymentIntentId,
                userId,
                amount: paymentIntent.amount,
                currency: paymentIntent.currency,
                status: 'failed',
                stripePaymentIntentId: paymentIntentId,
                stripeCustomerId: paymentIntent.customer,
                paymentMethod: {
                    type: paymentIntent.payment_method_types[0],
                },
                failureReason: paymentIntent.last_payment_error?.message || 'Payment failed',
                createdAt: firestore_1.Timestamp.now(),
                failedAt: firestore_1.Timestamp.now()
            });
        }
        catch (error) {
            firebase_functions_1.logger.error('Error updating failed payment history', { error, paymentIntentId });
        }
    }
}
async function handleChargeDispute(dispute) {
    const chargeId = dispute.charge;
    firebase_functions_1.logger.warn('Charge dispute created', {
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
//# sourceMappingURL=handleStripeWebhook.js.map
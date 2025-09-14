"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.confirmPayment = void 0;
const https_1 = require("firebase-functions/v2/https");
const firebase_functions_1 = require("firebase-functions");
const firebase_1 = require("../../../../../functions/src/config/firebase");
const cors_1 = require("../../../../../functions/src/config/cors");
const stripe_1 = __importDefault(require("stripe"));
const firestore_1 = require("firebase-admin/firestore");
const stripe = new stripe_1.default(process.env.STRIPE_SECRET_KEY, {
    apiVersion: '2024-06-20',
});
exports.confirmPayment = (0, https_1.onCall)({
    ...cors_1.corsOptions,
    secrets: ['STRIPE_SECRET_KEY', 'STRIPE_PUBLISHABLE_KEY']
}, async (request) => {
    const { data, auth } = request;
    // Verify authentication
    if (!auth) {
        throw new https_1.HttpsError('unauthenticated', 'User must be authenticated');
    }
    // Verify user matches the authenticated user
    if (auth.uid !== data.userId) {
        throw new https_1.HttpsError('permission-denied', 'User ID mismatch');
    }
    const { paymentIntentId, userId, googleId } = data;
    try {
        // Verify payment with Stripe
        const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
        if (paymentIntent.status !== 'succeeded') {
            throw new https_1.HttpsError('failed-precondition', `Payment not completed. Status: ${paymentIntent.status}`);
        }
        // Verify payment metadata matches
        if (paymentIntent.metadata.userId !== userId ||
            paymentIntent.metadata.googleId !== googleId) {
            throw new https_1.HttpsError('permission-denied', 'Payment metadata mismatch');
        }
        const now = firestore_1.Timestamp.now();
        // Create user subscription record
        const subscriptionData = {
            userId,
            email: paymentIntent.metadata.email,
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
            stripeCustomerId: paymentIntent.customer,
            paymentMethod: {
                type: paymentIntent.payment_method_types[0],
                // Additional payment method details can be added here
            },
            createdAt: now,
            processedAt: now
        };
        // Use batch write for atomicity
        const batch = firebase_1.db.batch();
        // Create/update subscription
        const subscriptionRef = firebase_1.db.collection('userSubscriptions').doc(userId);
        batch.set(subscriptionRef, subscriptionData);
        // Create payment history
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
                email: paymentIntent.metadata.email,
                id: googleId,
                verifiedAt: now
            }
        });
        // Commit the batch
        await batch.commit();
        firebase_functions_1.logger.info('Lifetime premium access granted', {
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
    }
    catch (error) {
        firebase_functions_1.logger.error('Error confirming payment', { error, userId, paymentIntentId });
        if (error instanceof https_1.HttpsError) {
            throw error;
        }
        throw new https_1.HttpsError('internal', 'Failed to confirm payment and grant premium access', error);
    }
});
//# sourceMappingURL=confirmPayment.js.map
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createPaymentIntent = void 0;
const https_1 = require("firebase-functions/v2/https");
const firebase_functions_1 = require("firebase-functions");
const firebase_1 = require("../../../../../functions/src/config/firebase");
const pricing_1 = require("../../../../../functions/src/config/pricing");
const cors_1 = require("../../../../../functions/src/config/cors");
const stripe_1 = __importDefault(require("stripe"));
const stripe = new stripe_1.default(process.env.STRIPE_SECRET_KEY, {
    apiVersion: '2024-06-20',
});
exports.createPaymentIntent = (0, https_1.onCall)({
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
    // Validate pricing configuration
    const pricingValidation = (0, pricing_1.validatePricingConfig)();
    if (!pricingValidation.isValid) {
        firebase_functions_1.logger.error('Pricing configuration validation failed', {
            errors: pricingValidation.errors,
            warnings: pricingValidation.warnings
        });
    }
    // Use provided amount or default to premium pricing from centralized config
    const defaultAmount = (0, pricing_1.getPriceInCents)('PREMIUM');
    const { userId, email, googleId, amount = defaultAmount } = data;
    // Log pricing configuration status
    (0, pricing_1.logPricingStatus)();
    firebase_functions_1.logger.info('Creating payment intent with pricing', {
        providedAmount: data.amount,
        finalAmount: amount,
        defaultPremiumAmount: defaultAmount,
        premiumPriceDollars: (0, pricing_1.getTierConfig)('PREMIUM').price.dollars
    });
    try {
        // Check if user already has lifetime premium
        const existingSubscription = await firebase_1.db
            .collection('userSubscriptions')
            .doc(userId)
            .get();
        if (existingSubscription.exists && existingSubscription.data()?.lifetimeAccess) {
            throw new https_1.HttpsError('failed-precondition', 'User already has lifetime premium access');
        }
        // Create or retrieve Stripe customer
        let customerId;
        const existingPaymentData = await firebase_1.db
            .collection('paymentHistory')
            .where('userId', '==', userId)
            .limit(1)
            .get();
        if (!existingPaymentData.empty && existingPaymentData.docs[0].data().stripeCustomerId) {
            customerId = existingPaymentData.docs[0].data().stripeCustomerId;
        }
        else {
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
        const premiumConfig = (0, pricing_1.getTierConfig)('PREMIUM');
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
        firebase_functions_1.logger.info('Payment intent created', {
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
    }
    catch (error) {
        firebase_functions_1.logger.error('Error creating payment intent', { error, userId, email });
        if (error instanceof https_1.HttpsError) {
            throw error;
        }
        throw new https_1.HttpsError('internal', 'Failed to create payment intent', error);
    }
});
//# sourceMappingURL=createPaymentIntent.js.map
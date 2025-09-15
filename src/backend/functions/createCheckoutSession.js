"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createCheckoutSession = void 0;
const https_1 = require("firebase-functions/v2/https");
const firebase_functions_1 = require("firebase-functions");
const firebase_1 = require("../../../../../functions/src/config/firebase");
const pricing_1 = require("../../../../../functions/src/config/pricing");
const cors_1 = require("../../../../../functions/src/config/cors");
const stripe_1 = __importDefault(require("stripe"));
const stripe = new stripe_1.default(process.env.STRIPE_SECRET_KEY, {
    apiVersion: '2024-06-20',
});
exports.createCheckoutSession = (0, https_1.onCall)({
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
    const { userId, userEmail, priceId, successUrl = `${process.env.FUNCTIONS_EMULATOR ? 'http://localhost:3000' : 'https://getmycv-ai.web.app'}/payment-success?session_id={CHECKOUT_SESSION_ID}`, cancelUrl = `${process.env.FUNCTIONS_EMULATOR ? 'http://localhost:3000' : 'https://getmycv-ai.web.app'}/pricing?canceled=true` } = data;
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
                email: userEmail,
                metadata: {
                    userId,
                    platform: 'cvplus'
                }
            });
            customerId = customer.id;
        }
        // Create checkout session
        const sessionParams = {
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
        const pricingValidation = (0, pricing_1.validatePricingConfig)();
        if (!pricingValidation.isValid) {
            firebase_functions_1.logger.error('Pricing configuration validation failed', {
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
        }
        else {
            // Get pricing from centralized configuration
            const premiumConfig = (0, pricing_1.getTierConfig)('PREMIUM');
            const fallbackPriceId = (0, pricing_1.getStripePriceId)('PREMIUM');
            // Try to use Stripe Price ID first if properly configured
            if (fallbackPriceId && !fallbackPriceId.includes('template')) {
                sessionParams.line_items = [{
                        price: fallbackPriceId,
                        quantity: 1,
                    }];
                firebase_functions_1.logger.info('Using environment-specific Stripe Price ID', {
                    priceId: fallbackPriceId,
                    environment: process.env.NODE_ENV || 'unknown'
                });
            }
            else {
                // Fallback to price_data with centralized pricing
                sessionParams.line_items = [{
                        price_data: {
                            currency: premiumConfig.price.currency.toLowerCase(),
                            product_data: {
                                name: 'CVPlus Premium - Lifetime Access',
                                description: premiumConfig.description,
                                images: ['https://getmycv-ai.web.app/CVisionary_Logo.png'],
                            },
                            unit_amount: (0, pricing_1.getPriceInCents)('PREMIUM'),
                        },
                        quantity: 1,
                    }];
                firebase_functions_1.logger.warn('Using price_data fallback due to missing Stripe Price ID', {
                    priceCents: (0, pricing_1.getPriceInCents)('PREMIUM'),
                    priceDollars: premiumConfig.price.dollars,
                    environment: process.env.NODE_ENV || 'unknown',
                    fallbackPriceId
                });
            }
        }
        const session = await stripe.checkout.sessions.create(sessionParams);
        // Log pricing configuration status
        (0, pricing_1.logPricingStatus)();
        // Log checkout session creation
        firebase_functions_1.logger.info('Checkout session created', {
            userId,
            userEmail,
            sessionId: session.id,
            customerId,
            amount: priceId ? 'price_id_used' : (0, pricing_1.getPriceInCents)('PREMIUM'),
            priceConfig: {
                providedPriceId: priceId,
                fallbackPriceId: priceId ? null : (0, pricing_1.getStripePriceId)('PREMIUM'),
                priceCents: (0, pricing_1.getPriceInCents)('PREMIUM'),
                priceDollars: (0, pricing_1.getTierConfig)('PREMIUM').price.dollars,
                environment: process.env.NODE_ENV || 'unknown'
            }
        });
        return {
            sessionId: session.id,
            url: session.url,
            customerId
        };
    }
    catch (error) {
        firebase_functions_1.logger.error('Error creating checkout session', { error, userId, userEmail });
        if (error instanceof https_1.HttpsError) {
            throw error;
        }
        throw new https_1.HttpsError('internal', 'Failed to create checkout session', error);
    }
});
//# sourceMappingURL=createCheckoutSession.js.map
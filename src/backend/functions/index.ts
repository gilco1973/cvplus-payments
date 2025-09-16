// @ts-ignore - Export conflicts// Firebase Cloud Functions for payment processing
// These functions have been migrated from the premium module

// Core payment functions
export { checkFeatureAccess } from './core/checkFeatureAccess';

// Original payment processing functions (existing)
export { createCheckoutSession } from './createCheckoutSession';
export { confirmPayment } from './confirmPayment';  
export { createPaymentIntent } from './createPaymentIntent';
export { getUserSubscription, getUserSubscriptionInternal, invalidateUserSubscriptionCache } from './getUserSubscription';
export { handleStripeWebhook } from './handleStripeWebhook';

// Booking and scheduling functions
export { bookMeeting } from './bookMeeting';
export { sendSchedulingEmail } from './sendSchedulingEmail';

// Future exports (to be migrated from premium):
// Stripe functions
// export * from './stripe';
// PayPal functions  
// export * from './paypal';
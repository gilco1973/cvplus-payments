// Firebase Cloud Functions for payment processing
// These functions will be migrated from the main functions directory

// Payment processing functions
export { createCheckoutSession } from './createCheckoutSession';
export { confirmPayment } from './confirmPayment';  
export { createPaymentIntent } from './createPaymentIntent';
export { getUserSubscription } from './getUserSubscription';
export { checkFeatureAccess } from './checkFeatureAccess';
export { handleStripeWebhook } from './handleStripeWebhook';

// Booking and scheduling functions
export { bookMeeting } from './bookMeeting';
export { sendSchedulingEmail } from './sendSchedulingEmail';
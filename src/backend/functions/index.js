"use strict";
// Firebase Cloud Functions for payment processing
// These functions have been migrated from the premium module
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendSchedulingEmail = exports.bookMeeting = exports.handleStripeWebhook = exports.invalidateUserSubscriptionCache = exports.getUserSubscriptionInternal = exports.getUserSubscription = exports.createPaymentIntent = exports.confirmPayment = exports.createCheckoutSession = exports.checkFeatureAccess = void 0;
// Core payment functions
var checkFeatureAccess_1 = require("./core/checkFeatureAccess");
Object.defineProperty(exports, "checkFeatureAccess", { enumerable: true, get: function () { return checkFeatureAccess_1.checkFeatureAccess; } });
// Original payment processing functions (existing)
var createCheckoutSession_1 = require("./createCheckoutSession");
Object.defineProperty(exports, "createCheckoutSession", { enumerable: true, get: function () { return createCheckoutSession_1.createCheckoutSession; } });
var confirmPayment_1 = require("./confirmPayment");
Object.defineProperty(exports, "confirmPayment", { enumerable: true, get: function () { return confirmPayment_1.confirmPayment; } });
var createPaymentIntent_1 = require("./createPaymentIntent");
Object.defineProperty(exports, "createPaymentIntent", { enumerable: true, get: function () { return createPaymentIntent_1.createPaymentIntent; } });
var getUserSubscription_1 = require("./getUserSubscription");
Object.defineProperty(exports, "getUserSubscription", { enumerable: true, get: function () { return getUserSubscription_1.getUserSubscription; } });
Object.defineProperty(exports, "getUserSubscriptionInternal", { enumerable: true, get: function () { return getUserSubscription_1.getUserSubscriptionInternal; } });
Object.defineProperty(exports, "invalidateUserSubscriptionCache", { enumerable: true, get: function () { return getUserSubscription_1.invalidateUserSubscriptionCache; } });
var handleStripeWebhook_1 = require("./handleStripeWebhook");
Object.defineProperty(exports, "handleStripeWebhook", { enumerable: true, get: function () { return handleStripeWebhook_1.handleStripeWebhook; } });
// Booking and scheduling functions
var bookMeeting_1 = require("./bookMeeting");
Object.defineProperty(exports, "bookMeeting", { enumerable: true, get: function () { return bookMeeting_1.bookMeeting; } });
var sendSchedulingEmail_1 = require("./sendSchedulingEmail");
Object.defineProperty(exports, "sendSchedulingEmail", { enumerable: true, get: function () { return sendSchedulingEmail_1.sendSchedulingEmail; } });
// Future exports (to be migrated from premium):
// Stripe functions
// export * from './stripe';
// PayPal functions  
// export * from './paypal';
//# sourceMappingURL=index.js.map
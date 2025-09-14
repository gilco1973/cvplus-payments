"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getUserSubscription = void 0;
exports.getUserSubscriptionInternal = getUserSubscriptionInternal;
exports.invalidateUserSubscriptionCache = invalidateUserSubscriptionCache;
const https_1 = require("firebase-functions/v2/https");
const firebase_functions_1 = require("firebase-functions");
const cors_1 = require("../../../../../functions/src/config/cors");
const cached_subscription_service_1 = require("../../../../../functions/src/services/cached-subscription.service");
exports.getUserSubscription = (0, https_1.onCall)({
    ...cors_1.corsOptions
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
    const { userId } = data;
    try {
        // Get user subscription with caching
        const subscriptionData = await cached_subscription_service_1.cachedSubscriptionService.getUserSubscription(userId);
        firebase_functions_1.logger.info('User subscription retrieved', {
            userId,
            subscriptionStatus: subscriptionData.subscriptionStatus,
            lifetimeAccess: subscriptionData.lifetimeAccess
        });
        return {
            subscriptionStatus: subscriptionData.subscriptionStatus,
            lifetimeAccess: subscriptionData.lifetimeAccess,
            features: subscriptionData.features,
            purchasedAt: subscriptionData.purchasedAt,
            paymentAmount: subscriptionData.metadata?.paymentAmount,
            currency: subscriptionData.metadata?.currency,
            googleAccountVerified: subscriptionData.metadata?.accountVerification?.verifiedAt,
            stripeCustomerId: subscriptionData.stripeCustomerId,
            message: subscriptionData.lifetimeAccess
                ? 'Lifetime premium access active'
                : subscriptionData.subscriptionStatus === 'free'
                    ? 'No premium subscription found'
                    : 'Free tier active'
        };
    }
    catch (error) {
        firebase_functions_1.logger.error('Error getting user subscription', { error, userId });
        if (error instanceof https_1.HttpsError) {
            throw error;
        }
        throw new https_1.HttpsError('internal', 'Failed to get user subscription', error);
    }
});
// Helper function for internal use (not exposed as Cloud Function)
// Now uses caching for improved performance
async function getUserSubscriptionInternal(userId) {
    try {
        firebase_functions_1.logger.debug('Getting user subscription internally with cache', { userId });
        return await cached_subscription_service_1.cachedSubscriptionService.getUserSubscription(userId);
    }
    catch (error) {
        firebase_functions_1.logger.error('Error getting user subscription internally', { error, userId });
        throw error;
    }
}
// Helper function to invalidate cache when subscription changes
function invalidateUserSubscriptionCache(userId) {
    cached_subscription_service_1.cachedSubscriptionService.invalidateUserSubscription(userId);
}
//# sourceMappingURL=getUserSubscription.js.map
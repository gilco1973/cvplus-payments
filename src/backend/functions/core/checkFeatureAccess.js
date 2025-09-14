"use strict";
/**
 * CVPlus Payment Feature Access Check
 * Migrated from premium module
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkFeatureAccess = void 0;
const https_1 = require("firebase-functions/v2/https");
const firebase_functions_1 = require("firebase-functions");
const firebase_1 = require("../../../../../../functions/src/config/firebase");
const cors_1 = require("../../../../../../functions/src/config/cors");
const premium_features_1 = require("../../../../../../functions/src/types/premium-features");
exports.checkFeatureAccess = (0, https_1.onCall)({
    cors: cors_1.corsOptions,
    enforceAppCheck: false,
    memory: '512MiB',
    timeoutSeconds: 30,
}, async (request) => {
    const { auth, data } = request;
    try {
        // Authentication check
        if (!auth?.uid) {
            throw new https_1.HttpsError('unauthenticated', 'User must be authenticated');
        }
        const { feature, context } = data;
        // Input validation
        if (!feature || !(0, premium_features_1.isValidPremiumFeature)(feature)) {
            throw new https_1.HttpsError('invalid-argument', 'Valid premium feature required');
        }
        firebase_functions_1.logger.info(`Checking feature access for user ${auth.uid}`, {
            feature,
            context: context || 'no_context',
        });
        // Get user data from Firestore
        const userDoc = await firebase_1.db.collection('users').doc(auth.uid).get();
        if (!userDoc.exists) {
            throw new https_1.HttpsError('not-found', 'User profile not found');
        }
        const userData = userDoc.data();
        const subscription = userData?.subscription;
        // Check if feature requires subscription
        if (!(0, premium_features_1.requiresSubscription)(feature)) {
            return {
                hasAccess: true,
                feature,
                reason: 'free_feature',
            };
        }
        // Check if user has active subscription
        if (!subscription || subscription.status !== 'active') {
            // Check for grace period
            const gracePeriod = await checkGracePeriod(auth.uid, feature);
            if (gracePeriod.hasGracePeriod) {
                return {
                    hasAccess: true,
                    feature,
                    reason: 'grace_period',
                    gracePeriodEnd: gracePeriod.endDate,
                };
            }
            return {
                hasAccess: false,
                feature,
                reason: 'no_subscription',
                requiredTier: (0, premium_features_1.getMinimumTier)(feature),
                upgradeUrl: generateUpgradeUrl(feature),
            };
        }
        // Check subscription tier compatibility
        const requiredTier = (0, premium_features_1.getMinimumTier)(feature);
        const currentTier = subscription.planId || 'free';
        const hasValidTier = checkTierCompatibility(currentTier, requiredTier);
        if (!hasValidTier) {
            return {
                hasAccess: false,
                feature,
                reason: 'insufficient_tier',
                requiredTier,
                currentTier,
                upgradeUrl: generateUpgradeUrl(feature),
            };
        }
        // Check usage limits for the feature
        const usageCheck = await checkUsageLimits(auth.uid, feature, currentTier);
        if (!usageCheck.withinLimits) {
            return {
                hasAccess: false,
                feature,
                reason: 'usage_limit_exceeded',
                usageLimit: {
                    current: usageCheck.currentUsage,
                    limit: usageCheck.limit,
                    resetDate: usageCheck.resetDate,
                },
                upgradeUrl: generateUpgradeUrl(feature),
            };
        }
        // Check subscription expiry
        if (subscription.currentPeriodEnd && new Date() > subscription.currentPeriodEnd.toDate()) {
            return {
                hasAccess: false,
                feature,
                reason: 'subscription_expired',
                upgradeUrl: generateUpgradeUrl(feature),
            };
        }
        // All checks passed
        firebase_functions_1.logger.info(`Feature access granted for user ${auth.uid}`, {
            feature,
            tier: currentTier,
            usageRemaining: usageCheck.limit - usageCheck.currentUsage,
        });
        return {
            hasAccess: true,
            feature,
            reason: 'subscription_access',
            currentTier,
            usageLimit: usageCheck.limit > 0 ? {
                current: usageCheck.currentUsage,
                limit: usageCheck.limit,
                resetDate: usageCheck.resetDate,
            } : undefined,
        };
    }
    catch (error) {
        firebase_functions_1.logger.error('Failed to check feature access', {
            userId: auth?.uid,
            feature: data.feature,
            error: error instanceof Error ? error.message : 'Unknown error',
        });
        if (error instanceof https_1.HttpsError) {
            throw error;
        }
        throw new https_1.HttpsError('internal', 'Failed to check feature access');
    }
});
// Helper functions - imported from main functions
/**
 * Check if user has grace period for a feature
 */
async function checkGracePeriod(userId, feature) {
    try {
        const gracePeriodDoc = await firebase_1.db
            .collection('users')
            .doc(userId)
            .collection('grace_periods')
            .doc(feature)
            .get();
        if (!gracePeriodDoc.exists) {
            return { hasGracePeriod: false };
        }
        const gracePeriodData = gracePeriodDoc.data();
        const endDate = gracePeriodData?.endDate?.toDate();
        if (!endDate || new Date() > endDate) {
            // Grace period expired, clean up
            await gracePeriodDoc.ref.delete();
            return { hasGracePeriod: false };
        }
        return {
            hasGracePeriod: true,
            endDate,
        };
    }
    catch (error) {
        firebase_functions_1.logger.error('Failed to check grace period', {
            userId,
            feature,
            error: error instanceof Error ? error.message : 'Unknown error',
        });
        return { hasGracePeriod: false };
    }
}
/**
 * Check if current tier is compatible with required tier
 */
function checkTierCompatibility(currentTier, requiredTier) {
    const tierHierarchy = ['free', 'basic', 'pro', 'enterprise'];
    const currentIndex = tierHierarchy.indexOf(currentTier);
    const requiredIndex = tierHierarchy.indexOf(requiredTier);
    // If either tier is not found, be permissive for now
    if (currentIndex === -1 || requiredIndex === -1) {
        return true;
    }
    return currentIndex >= requiredIndex;
}
/**
 * Check usage limits for a feature
 */
async function checkUsageLimits(userId, feature, planId) {
    try {
        // Get plan limits
        const planDoc = await firebase_1.db.collection('subscription_plans').doc(planId).get();
        const planData = planDoc.data();
        const featureLimits = planData?.features?.[feature]?.limits;
        if (!featureLimits) {
            // No limits defined, allow unlimited usage
            return {
                withinLimits: true,
                currentUsage: 0,
                limit: -1, // -1 indicates unlimited
                resetDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
            };
        }
        // Get current month's usage
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        const usageQuery = await firebase_1.db
            .collection('feature_usage')
            .where('userId', '==', userId)
            .where('feature', '==', feature)
            .where('timestamp', '>=', startOfMonth)
            .where('timestamp', '<=', endOfMonth)
            .get();
        const currentUsage = usageQuery.size;
        const limit = featureLimits.monthly || featureLimits.total || 0;
        return {
            withinLimits: limit === -1 || currentUsage < limit,
            currentUsage,
            limit,
            resetDate: endOfMonth,
        };
    }
    catch (error) {
        firebase_functions_1.logger.error('Failed to check usage limits', {
            userId,
            feature,
            planId,
            error: error instanceof Error ? error.message : 'Unknown error',
        });
        // On error, be permissive
        return {
            withinLimits: true,
            currentUsage: 0,
            limit: -1,
            resetDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        };
    }
}
/**
 * Generate upgrade URL for feature
 */
function generateUpgradeUrl(feature) {
    const baseUrl = process.env.FRONTEND_URL || 'https://cvplus-webapp.web.app';
    const requiredTier = (0, premium_features_1.getMinimumTier)(feature);
    return `${baseUrl}/billing/upgrade?feature=${feature}&tier=${requiredTier}`;
}
//# sourceMappingURL=checkFeatureAccess.js.map
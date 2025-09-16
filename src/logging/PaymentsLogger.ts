// @ts-ignore - Export conflicts/**
 * T038: Payments logging in packages/payments/src/logging/PaymentsLogger.ts
 *
 * Specialized logger for payment processing, transaction monitoring, and financial compliance events
 */

import { PaymentsLogger as BasePaymentsLogger, paymentsLogger } from '@cvplus/core';

// Re-export the payments logger
export { paymentsLogger };
export default paymentsLogger;
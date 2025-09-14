interface CreateCheckoutSessionData {
    userId: string;
    userEmail: string;
    priceId?: string;
    successUrl?: string;
    cancelUrl?: string;
}
export declare const createCheckoutSession: import("firebase-functions/v2/https").CallableFunction<CreateCheckoutSessionData, any, unknown>;
export {};
//# sourceMappingURL=createCheckoutSession.d.ts.map
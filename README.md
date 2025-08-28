# CVPlus Payments

Stripe integration, payment processing, and booking services for the CVPlus platform.

## Overview

The CVPlus Payments package provides comprehensive payment processing capabilities including:

- **Stripe Integration**: Complete Stripe payment processing with webhooks
- **Subscription Management**: Handle recurring subscriptions and billing
- **Payment Processing**: One-time payments and checkout sessions
- **Booking System**: Calendar integration for scheduling and payments
- **Feature Access Control**: Payment-based feature gating

## Package Structure

```
src/
├── backend/
│   ├── functions/           # Firebase Cloud Functions
│   └── services/           # Backend payment services
├── frontend/
│   ├── components/         # React payment components  
│   └── hooks/             # Payment-related hooks
├── types/                 # TypeScript type definitions
├── constants/            # Payment constants and configuration
└── utils/               # Payment utility functions
```

## Features

### Payment Processing
- Stripe checkout sessions
- Payment intents for custom flows
- Payment confirmation and webhooks
- Subscription billing management

### Booking System
- Meeting scheduling integration
- Calendar availability management
- Automated scheduling emails
- Payment-based booking confirmations

### Feature Access
- Premium feature gating
- Subscription-based access control
- Usage tracking and limits
- Feature upgrade prompts

## Installation

```bash
npm install @cvplus/payments
```

## Usage

### Frontend Components

```tsx
import { PaymentForm, BookingScheduler } from '@cvplus/payments/frontend';
import { usePayment, useBooking } from '@cvplus/payments/frontend';

// Payment form component
<PaymentForm 
  amount={2999} 
  currency="usd"
  onSuccess={handlePaymentSuccess}
/>

// Booking scheduler component
<BookingScheduler
  availableSlots={slots}
  onBookingConfirmed={handleBooking}
/>
```

### Backend Services

```typescript
import { 
  createCheckoutSession,
  confirmPayment,
  getUserSubscription 
} from '@cvplus/payments/backend';

// Create Stripe checkout session
const session = await createCheckoutSession({
  priceId: 'price_123',
  customerId: 'cus_456',
  successUrl: 'https://app.cvplus.com/success',
  cancelUrl: 'https://app.cvplus.com/cancel'
});

// Confirm payment
const result = await confirmPayment(paymentIntentId);

// Get user subscription
const subscription = await getUserSubscription(userId);
```

## Configuration

Set the following environment variables:

```env
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
CALENDLY_API_TOKEN=your_calendly_token
```

## Development

```bash
# Install dependencies
npm install

# Build the package
npm run build

# Run tests
npm test

# Start development mode
npm run dev
```

## API Reference

### Functions
- `createCheckoutSession` - Create Stripe checkout session
- `confirmPayment` - Confirm payment intent
- `createPaymentIntent` - Create payment intent
- `getUserSubscription` - Get user subscription details
- `checkFeatureAccess` - Check feature access permissions
- `handleStripeWebhook` - Process Stripe webhooks
- `bookMeeting` - Schedule meeting with payment
- `sendSchedulingEmail` - Send booking confirmation emails

### Components
- `PaymentForm` - Stripe payment form
- `BookingScheduler` - Meeting booking interface

### Hooks
- `usePayment` - Payment processing hook
- `useBooking` - Booking management hook

## License

Proprietary - CVPlus Platform
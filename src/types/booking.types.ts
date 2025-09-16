// @ts-ignore - Export conflicts// Booking and scheduling types

export interface BookingSlot {
  id: string;
  startTime: Date;
  endTime: Date;
  available: boolean;
  price?: number;
  title?: string;
  description?: string;
}

export interface Booking {
  id: string;
  userId: string;
  slotId: string;
  startTime: Date;
  endTime: Date;
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed';
  paymentIntentId?: string;
  amount?: number;
  currency?: string;
  meetingLink?: string;
  notes?: string;
}

export interface BookingRequest {
  slotId: string;
  userId: string;
  notes?: string;
  paymentRequired?: boolean;
  amount?: number;
  currency?: string;
}
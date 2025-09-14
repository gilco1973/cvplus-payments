// Booking hook for React components
import { useState, useCallback } from 'react';
import { BookingType } from '../../types/booking.types';

export interface UseBookingReturn {
  createBooking: (bookingData: Partial<BookingType>) => Promise<BookingType>;
  updateBooking: (bookingId: string, updates: Partial<BookingType>) => Promise<BookingType>;
  loading: boolean;
  error: string | null;
  booking: BookingType | null;
}

export const useBooking = (): UseBookingReturn => {
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [booking, setBooking] = useState<BookingType | null>(null);

  const createBooking = useCallback(async (bookingData: Partial<BookingType>): Promise<BookingType> => {
    setLoading(true);
    setError(null);

    try {
      // This would make an API call to create booking
      const newBooking: BookingType = {
        id: `booking_${Date.now()}`,
        userId: bookingData.userId || '',
        meetingType: bookingData.meetingType || 'consultation',
        status: 'scheduled',
        scheduledAt: bookingData.scheduledAt || new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      setBooking(newBooking);
      return newBooking;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Booking creation failed';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, []);

  const updateBooking = useCallback(async (bookingId: string, updates: Partial<BookingType>): Promise<BookingType> => {
    setLoading(true);
    setError(null);

    try {
      // This would make an API call to update booking
      if (!booking) {
        throw new Error('No booking to update');
      }

      const updatedBooking: BookingType = {
        ...booking,
        ...updates,
        updatedAt: new Date(),
      };

      setBooking(updatedBooking);
      return updatedBooking;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Booking update failed';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [booking]);

  return {
    createBooking,
    updateBooking,
    loading,
    error,
    booking,
  };
};

export default useBooking;
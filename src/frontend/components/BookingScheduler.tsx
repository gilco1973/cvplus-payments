// Booking scheduler component
import React, { useState } from 'react';

export interface BookingSchedulerProps {
  onBook: (bookingData: any) => void;
  loading?: boolean;
}

export const BookingScheduler: React.FC<BookingSchedulerProps> = ({ onBook, loading = false }) => {
  const [meetingType, setMeetingType] = useState<string>('consultation');
  const [scheduledAt, setScheduledAt] = useState<string>('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onBook({
      meetingType,
      scheduledAt: new Date(scheduledAt),
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="meetingType" className="block text-sm font-medium text-gray-700">
          Meeting Type
        </label>
        <select
          id="meetingType"
          value={meetingType}
          onChange={(e) => setMeetingType(e.target.value)}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
        >
          <option value="consultation">Consultation</option>
          <option value="follow-up">Follow-up</option>
          <option value="workshop">Workshop</option>
        </select>
      </div>
      
      <div>
        <label htmlFor="scheduledAt" className="block text-sm font-medium text-gray-700">
          Schedule Date & Time
        </label>
        <input
          type="datetime-local"
          id="scheduledAt"
          value={scheduledAt}
          onChange={(e) => setScheduledAt(e.target.value)}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
          required
        />
      </div>
      
      <button
        type="submit"
        disabled={loading}
        className="w-full bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700 disabled:opacity-50"
      >
        {loading ? 'Scheduling...' : 'Book Meeting'}
      </button>
    </form>
  );
};

export default BookingScheduler;
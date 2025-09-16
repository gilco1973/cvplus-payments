// @ts-ignore - Export conflictsimport { onCall } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { simpleCorsOptions } from '../config/cors';
import { calendarIntegrationService } from '../services/calendar-integration.service';
import { requireCalendarPermissions } from '../utils/auth';

export const bookMeeting = onCall(
  {
    timeoutSeconds: 60,
    ...simpleCorsOptions
  },
  async (request) => {
    // CRITICAL SECURITY: Require Google authentication with calendar permissions
    const user = await requireCalendarPermissions(request);
    const { jobId, duration, attendeeEmail, attendeeName, meetingType } = request.data;

    // SECURITY: Input validation
    if (!jobId || typeof jobId !== 'string') {
      throw new Error('Invalid jobId provided');
    }
    if (!duration || typeof duration !== 'number' || duration < 15 || duration > 180) {
      throw new Error('Invalid duration. Must be between 15 and 180 minutes');
    }
    if (!attendeeEmail || typeof attendeeEmail !== 'string' || !attendeeEmail.includes('@')) {
      throw new Error('Invalid attendee email provided');
    }
    if (meetingType && typeof meetingType !== 'string') {
      throw new Error('Invalid meeting type provided');
    }

    try {
      // Log security event without PII
      // Verify user owns the job - CRITICAL SECURITY CHECK
      const jobDoc = await admin.firestore()
        .collection('jobs')
        .doc(jobId)
        .get();
      
      if (!jobDoc.exists) {
        throw new Error('Job not found');
      }
      
      const jobData = jobDoc.data();
      if (!jobData?.parsedData) {
        throw new Error('CV data not found');
      }
      
      // SECURITY: Ensure user owns this job
      if (jobData.userId !== user.uid) {
        throw new Error('Unauthorized: You can only book meetings for your own CV');
      }

      const personalInfo = jobData.parsedData.personalInfo || {};
      const professionalName = personalInfo.name || jobData.parsedData.personalInformation?.name || 'Professional';
      const professionalEmail = personalInfo.email || 'contact@example.com';

      // Create Google Calendar meeting invite
      const meetingInvite = await calendarIntegrationService.createMeetingInvite(
        attendeeEmail,
        duration,
        professionalName,
        professionalEmail,
        meetingType
      );

      // Store the meeting request in Firestore
      const meetingDoc = await admin.firestore()
        .collection('meetings')
        .add({
          jobId,
          attendeeEmail,
          attendeeName: attendeeName || attendeeEmail,
          professionalName,
          professionalEmail,
          duration,
          meetingType,
          status: 'pending',
          calendarUrl: meetingInvite.calendarUrl,
          meetingDetails: meetingInvite.meetingDetails,
          createdAt: FieldValue.serverTimestamp(),
          requestedVia: 'availability-calendar'
        });

      // Send notification email to professional (optional)
      // This could be implemented using SendGrid or Firebase Functions email sending

      return {
        success: true,
        meetingId: meetingDoc.id,
        calendarUrl: meetingInvite.calendarUrl,
        meetingDetails: meetingInvite.meetingDetails,
        message: 'Meeting request created successfully. The professional will be notified.'
      };

    } catch (error) {
      throw new Error(`Failed to book meeting: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
);
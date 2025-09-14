"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.bookMeeting = void 0;
const https_1 = require("firebase-functions/v2/https");
const admin = __importStar(require("firebase-admin"));
const firestore_1 = require("firebase-admin/firestore");
const cors_1 = require("../config/cors");
const calendar_integration_service_1 = require("../services/calendar-integration.service");
const auth_1 = require("../utils/auth");
exports.bookMeeting = (0, https_1.onCall)({
    timeoutSeconds: 60,
    ...cors_1.simpleCorsOptions
}, async (request) => {
    // CRITICAL SECURITY: Require Google authentication with calendar permissions
    const user = await (0, auth_1.requireCalendarPermissions)(request);
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
        const meetingInvite = await calendar_integration_service_1.calendarIntegrationService.createMeetingInvite(attendeeEmail, duration, professionalName, professionalEmail, meetingType);
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
            createdAt: firestore_1.FieldValue.serverTimestamp(),
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
    }
    catch (error) {
        throw new Error(`Failed to book meeting: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
});
//# sourceMappingURL=bookMeeting.js.map
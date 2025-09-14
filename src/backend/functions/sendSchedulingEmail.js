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
exports.sendSchedulingEmail = void 0;
const https_1 = require("firebase-functions/v2/https");
const firebase_functions_1 = require("firebase-functions");
const nodemailer = __importStar(require("nodemailer"));
exports.sendSchedulingEmail = (0, https_1.onCall)(async (request) => {
    try {
        // Validate required data
        const { name, email, phone, date, time, message } = request.data;
        if (!name || !email || !phone || !date || !time) {
            throw new https_1.HttpsError('invalid-argument', 'Missing required fields');
        }
        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            throw new https_1.HttpsError('invalid-argument', 'Invalid email format');
        }
        // Create email transporter (using Gmail SMTP)
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.GMAIL_USER, // Set in Firebase functions config
                pass: process.env.GMAIL_APP_PASSWORD // Set in Firebase functions config
            }
        });
        // Format the email content
        const emailSubject = 'Call Scheduling Request - CVPlus FAQ';
        const emailBody = `
New call scheduling request from CVPlus FAQ page:

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📞 CALL SCHEDULING REQUEST
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

👤 Contact Information:
   Name: ${name}
   Email: ${email}
   Phone: ${phone}

📅 Requested Schedule:
   Date: ${new Date(date).toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        })}
   Time: ${time} EST

💬 Additional Message:
   ${message || 'No additional message provided'}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚡ ACTION REQUIRED: Please contact this user to confirm the scheduled call.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

This request was submitted through the CVPlus FAQ support system.
Timestamp: ${new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })} EST
    `;
        // Send email to admin
        const mailOptions = {
            from: process.env.GMAIL_USER,
            to: 'admin@cvplus.ai',
            subject: emailSubject,
            text: emailBody,
            replyTo: email // Allow admin to reply directly to the user
        };
        const result = await transporter.sendMail(mailOptions);
        firebase_functions_1.logger.info('Scheduling email sent successfully', {
            messageId: result.messageId,
            userEmail: email,
            userName: name,
            requestedDate: date,
            requestedTime: time
        });
        // Send confirmation email to user
        const userConfirmationOptions = {
            from: process.env.GMAIL_USER,
            to: email,
            subject: 'Call Scheduling Request Received - CVPlus',
            text: `
Hi ${name},

Thank you for your call scheduling request! We have received your request for a call on:

📅 Date: ${new Date(date).toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            })}
⏰ Time: ${time} EST

Our team will contact you within 24 hours to confirm this appointment. If you need to make any changes or have urgent questions, please reply to this email.

Best regards,
CVPlus Support Team

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
This is an automated confirmation. Please do not reply to this email unless you need to make changes to your request.
      `
        };
        await transporter.sendMail(userConfirmationOptions);
        return {
            success: true,
            message: 'Scheduling request sent successfully',
            timestamp: new Date().toISOString()
        };
    }
    catch (error) {
        firebase_functions_1.logger.error('Error sending scheduling email', error);
        if (error instanceof https_1.HttpsError) {
            throw error;
        }
        throw new https_1.HttpsError('internal', 'Failed to send scheduling request');
    }
});
//# sourceMappingURL=sendSchedulingEmail.js.map
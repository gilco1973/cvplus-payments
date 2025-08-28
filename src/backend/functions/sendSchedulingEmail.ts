import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions';
import * as nodemailer from 'nodemailer';

interface SchedulingRequestData {
  name: string;
  email: string;
  phone: string;
  date: string;
  time: string;
  message?: string;
}

export const sendSchedulingEmail = onCall(async (request) => {
  try {
    // Validate required data
    const { name, email, phone, date, time, message } = request.data as SchedulingRequestData;
    
    if (!name || !email || !phone || !date || !time) {
      throw new HttpsError('invalid-argument', 'Missing required fields');
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new HttpsError('invalid-argument', 'Invalid email format');
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
    
    logger.info('Scheduling email sent successfully', {
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

  } catch (error) {
    logger.error('Error sending scheduling email', error);
    
    if (error instanceof HttpsError) {
      throw error;
    }
    
    throw new HttpsError('internal', 'Failed to send scheduling request');
  }
});
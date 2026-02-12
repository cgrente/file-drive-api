import { SendEmailCommand, SESClient } from '@aws-sdk/client-ses';
import { getClients } from '../infra/clients';

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string; // Optional plain text content for fallback
}

class SESService {
  private ses(): SESClient {
    return getClients().ses;
  }

  /**
   * Send an email using AWS SES
   * @param {EmailOptions} options - Email details including recipient, subject, and content
   * @returns {Promise<any>} - Promise resolving to email sending result
   */
  async sendEmail(options: EmailOptions): Promise<any> {
    try {
      const params = {
        Destination: {
          ToAddresses: [options.to],
        },
        Message: {
          Body: {
            Text: options.text ? { Data: options.text } : undefined,
            Html: { Data: options.html },
          },
          Subject: { Data: options.subject },
        },
        Source: process.env.SENDER_EMAIL || '', // Verified sender email in SES
      };

      const command = new SendEmailCommand(params);
      const result = await this.ses().send(command);
      // console.log(`Email sent: ${result.MessageId}`);
      return result;
    } catch (error) {
      console.error('Error sending email:', error);
      throw new Error('Failed to send email');
    }
  }

  /**
   * Generate a notification email template
   * @param {string} type - Type of email (e.g., 'file_shared', 'welcome')
   * @param {any} data - Dynamic data to inject into the email template
   * @returns {EmailOptions} - The email options containing subject, text, and HTML
   */
  generateEmailTemplate(type: string, data: any): EmailOptions {
    switch (type) {
      case 'file_shared':
        return {
          to: data.receiverEmail,
          subject: `${data.senderName} shared a file with you`,
          text: `${data.senderName} has shared a file: ${data.fileName}. Access it here: ${data.link}`,
          html: `
            <p>Hello ${data.receiverName},</p>
            <p>${data.senderName} has shared a file with you: <b>${data.fileName}</b>.</p>
            <p><a href="${data.link}">Click here to access the file</a></p>
            <p>Thank you for using our app!</p>`,
        };
      case 'permission_revoked':
        return {
          to: data.receiverEmail,
          subject: `Access revoked for ${data.fileName}`,
          text: `${data.senderName} has revoked your access to the file: ${data.fileName}.`,
          html: `
            <p>Hello ${data.receiverName},</p>
            <p>${data.senderName} has revoked your access to the file: <b>${data.fileName}</b>.</p>
            <p>If you have questions, contact the owner.</p>`,
        };
      case 'welcome':
        return {
          to: data.userEmail,
          subject: `Welcome to our service, ${data.receiverName}!`,
          text: `Welcome ${data.receiverName}! Thank you for signing up for our service.`,
          html: `
            <p>Welcome ${data.receiverName}!</p>
            <p>Thank you for signing up for our service.</p>`,
        };
      case 'password_reset':
        return {
          to: data.userEmail,
          subject: 'Password Reset Request',
          text: `Click the link below to reset your password: ${data.resetLink}`,
          html: `
            <p>Hello,</p>
            <p>Click the link below to reset your password:</p>
            <p><a href="${data.resetLink}">Reset Password</a></p>`,
        };
      case 'invite': // ✅ New Invite Template
        return {
          to: data.receiverEmail,
          subject: `You're Invited to Join Our Platform, ${data.receiverName}!`,
          text: `Hello ${data.receiverName}, you've been invited to join our platform. Click the link below to accept the invitation: ${data.inviteLink}`,
          html: `
            <p>Hello <strong>${data.receiverName}</strong>,</p>
            <p>You've been invited to join our platform.</p>
            <p><strong>Temporary Password:</strong> <code>${data.temporaryPassword}</code></p>
            <p>Click the link below to accept the invitation:</p>
            <p><a href="${data.inviteLink}" style="color: blue; text-decoration: underline;">Accept Invitation</a></p>
            <p>If you did not expect this email, you can safely ignore it.</p>
            <p>Thank you!</p>
          `,
        };
      case 'resend-invite': // ✅ Resend Invite Template with Temporary Password
        return {
          to: data.receiverEmail,
          subject: `Reminder: You're Invited to Join Our Platform, ${data.receiverName}!`,
          text: `Hello ${data.receiverName},\n\nThis is a friendly reminder that you've been invited to join our platform.\n\nTemporary Password: ${data.temporaryPassword}\n\nClick the link below to accept the invitation:\n${data.inviteLink}\n\nIf you did not expect this email, you can safely ignore it.\nThank you!`,
          html: `
            <p>Hello <strong>${data.receiverName}</strong>,</p>
            <p>This is a friendly reminder that you've been invited to join our platform.</p>
            <p><strong>Temporary Password:</strong> <code>${data.temporaryPassword}</code></p>
            <p>Click the link below to accept the invitation:</p>
            <p><a href="${data.inviteLink}" style="color: blue; text-decoration: underline;">Accept Invitation</a></p>
            <p>If you did not expect this email, you can safely ignore it.</p>
            <p>Thank you!</p>
          `,
        };
      case 'email_verification':
        return {
          to: data.userEmail,
          subject: `Verify Your Email Address, ${data.receiverName}`,
          text: `Hello ${data.receiverName}, please verify your email address by clicking this link: ${data.verificationLink}`,
          html: `
            <p>Hello ${data.receiverName},</p>
            <p>Thank you for signing up. Please verify your email address by clicking the link below:</p>
            <p><a href="${data.verificationLink}">Verify Email Address</a></p>
            <p>If you did not sign up, please ignore this email.</p>
            <p>Thank you!</p>`,
        };
      default:
        return {
          to: data.userEmail,
          subject: 'Notification from our service',
          text: `Hello, thank you for using our service.`,
          html: `<p>Hello,</p><p>Thank you for using our service.</p>`,
        };
    }
  }
}

export default new SESService();
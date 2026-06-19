const { SESClient, SendEmailCommand } = require('@aws-sdk/client-ses');
require('dotenv').config();

const region = process.env.AWS_REGION || 'ap-south-1';
const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
const fromEmail = process.env.AWS_SES_FROM_EMAIL || 'noreply@saas-billing-rajbi.com';

let sesClient = null;

const isMock = !accessKeyId || accessKeyId === 'mock-key-id';

if (!isMock) {
  sesClient = new SESClient({
    region,
    credentials: {
      accessKeyId,
      secretAccessKey
    }
  });
}

/**
 * Sends a generic formatted email via SES (falls back to logging in mock mode).
 */
async function sendEmail({ to, subject, html, text }) {
  if (isMock) {
    console.log(`[SES-MOCK-EMAIL] Send to: ${to}`);
    console.log(`[SES-MOCK-EMAIL] Subject: ${subject}`);
    console.log(`[SES-MOCK-EMAIL] Body Preview: ${text}`);
    return { MessageId: `mock-msg-${Math.random().toString(36).substring(7)}` };
  }

  const params = {
    Source: fromEmail,
    Destination: {
      ToAddresses: [to]
    },
    Message: {
      Subject: {
        Data: subject,
        Charset: 'UTF-8'
      },
      Body: {
        Html: {
          Data: html,
          Charset: 'UTF-8'
        },
        Text: {
          Data: text,
          Charset: 'UTF-8'
        }
      }
    }
  };

  try {
    const command = new SendEmailCommand(params);
    return await sesClient.send(command);
  } catch (error) {
    console.error('SES Email Dispatch Failed:', error);
    throw error;
  }
}

async function sendWelcomeEmail(toEmail, name, companyName, loginUrl) {
  return await sendEmail({
    to: toEmail,
    subject: `Welcome to SaaS Platform, ${name}!`,
    text: `Hi ${name}, your SaaS organization ${companyName} has been successfully provisioned. Login here: ${loginUrl}`,
    html: `
      <div style="font-family: sans-serif; padding: 20px; color: #333;">
        <h2>Welcome to the Platform, ${name}!</h2>
        <p>Your organization <strong>${companyName}</strong> has been successfully provisioned and is ready for use.</p>
        <p>You can access your tenant dashboard via the button below:</p>
        <a href="${loginUrl}" style="display: inline-block; padding: 10px 20px; background-color: #6366F1; color: #fff; text-decoration: none; border-radius: 5px;">Login to Dashboard</a>
        <br/><br/>
        <p>Best regards,<br/>The Platform Team</p>
      </div>
    `
  });
}

async function sendTrialEndingEmail(toEmail, name, trialEndsAt) {
  const dateStr = new Date(trialEndsAt).toLocaleDateString();
  return await sendEmail({
    to: toEmail,
    subject: 'Your Free Trial is Ending Soon!',
    text: `Hi ${name}, your trial will end on ${dateStr}. Please subscribe to a plan to avoid any disruption.`,
    html: `
      <div style="font-family: sans-serif; padding: 20px; color: #333;">
        <h2>Your Trial is Ending Soon</h2>
        <p>Hi ${name},</p>
        <p>This is a friendly reminder that your free trial period is scheduled to end on <strong>${dateStr}</strong>.</p>
        <p>To keep using the platform without interruption, please visit the billing settings panel and update your payment method.</p>
        <br/>
        <p>Best regards,<br/>The Platform Team</p>
      </div>
    `
  });
}

async function sendPaymentFailedEmail(toEmail, name, amountDue, invoiceUrl) {
  return await sendEmail({
    to: toEmail,
    subject: 'Action Required: Payment Attempt Failed',
    text: `Hi ${name}, our payment attempt for $${amountDue} failed. Please update your card info: ${invoiceUrl}`,
    html: `
      <div style="font-family: sans-serif; padding: 20px; color: #333;">
        <h2 style="color: #EF4444;">Payment Attempt Failed</h2>
        <p>Hi ${name},</p>
        <p>We were unable to process your subscription payment of <strong>$${amountDue}</strong>.</p>
        <p>Please click the link below to resolve this payment issue:</p>
        <a href="${invoiceUrl}" style="display: inline-block; padding: 10px 20px; background-color: #EF4444; color: #fff; text-decoration: none; border-radius: 5px;">Update Payment Method</a>
        <br/><br/>
        <p>Best regards,<br/>The Platform Team</p>
      </div>
    `
  });
}

async function sendInvoicePaidEmail(toEmail, name, amountPaid, pdfUrl) {
  return await sendEmail({
    to: toEmail,
    subject: 'Receipt for your subscription payment',
    text: `Hi ${name}, thank you for your payment of $${amountPaid}. Download receipt: ${pdfUrl}`,
    html: `
      <div style="font-family: sans-serif; padding: 20px; color: #333;">
        <h2>Thank you for your payment!</h2>
        <p>Hi ${name},</p>
        <p>We have received your payment of <strong>$${amountPaid}</strong>. Your subscription remains active.</p>
        <p>You can download your PDF receipt here:</p>
        <a href="${pdfUrl}" style="display: inline-block; padding: 10px 20px; background-color: #10B981; color: #fff; text-decoration: none; border-radius: 5px;">Download PDF Invoice</a>
        <br/><br/>
        <p>Best regards,<br/>The Platform Team</p>
      </div>
    `
  });
}

async function sendInvitationEmail(toEmail, inviteLink, inviterName, companyName) {
  return await sendEmail({
    to: toEmail,
    subject: `Invitation to join ${companyName} on SaaS Platform`,
    text: `You have been invited by ${inviterName} to join ${companyName}. Accept invitation: ${inviteLink}`,
    html: `
      <div style="font-family: sans-serif; padding: 20px; color: #333;">
        <h2>You've been invited!</h2>
        <p>Hi,</p>
        <p><strong>${inviterName}</strong> has invited you to join the team at <strong>${companyName}</strong> on the SaaS platform.</p>
        <p>Please click the button below to accept the invitation and configure your account:</p>
        <a href="${inviteLink}" style="display: inline-block; padding: 10px 20px; background-color: #6366F1; color: #fff; text-decoration: none; border-radius: 5px;">Accept Invitation</a>
        <br/><br/>
        <p>Best regards,<br/>The Platform Team</p>
      </div>
    `
  });
}

module.exports = {
  sendEmail,
  sendWelcomeEmail,
  sendTrialEndingEmail,
  sendPaymentFailedEmail,
  sendInvoicePaidEmail,
  sendInvitationEmail
};

const nodemailer = require('nodemailer');

/**
 * Email Service for QuickAlert
 * Handles sending verification emails, alerts, and notifications
 */

// Create transporter based on environment
const createTransporter = () => {
  // For development, use Ethereal (fake SMTP) if no Gmail credentials
  if (process.env.NODE_ENV === 'development' && !process.env.EMAIL_USER) {
    console.log('[Email] No EMAIL_USER configured. Emails will be logged to console.');
    return null;
  }

  // For production/development with Gmail
  if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
    return nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS, // Use App Password, not regular password
      },
    });
  }

  // Fallback: Use Ethereal test account
  return null;
};

let transporter = null;

// Initialize transporter
const initializeTransporter = async () => {
  transporter = createTransporter();
  
  if (transporter) {
    try {
      await transporter.verify();
      console.log('[Email] ✓ Email service connected');
      return true;
    } catch (error) {
      console.error('[Email] ✗ Email service connection failed:', error.message);
      transporter = null;
      return false;
    }
  }
  return false;
};

/**
 * Send email
 * @param {Object} options - Email options
 * @param {string} options.to - Recipient email
 * @param {string} options.subject - Email subject
 * @param {string} options.text - Plain text content
 * @param {string} options.html - HTML content
 */
const sendEmail = async ({ to, subject, text, html }) => {
  // If no transporter, log to console (development fallback)
  if (!transporter) {
    console.log('\n========== EMAIL (Not Sent - No Config) ==========');
    console.log(`To: ${to}`);
    console.log(`Subject: ${subject}`);
    console.log(`Content: ${text}`);
    console.log('==================================================\n');
    return { success: true, message: 'Email logged (no transporter configured)' };
  }

  try {
    const mailOptions = {
      from: `"QuickAlert" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      text,
      html,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`[Email] ✓ Sent to ${to}: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error(`[Email] ✗ Failed to send to ${to}:`, error.message);
    throw error;
  }
};

/**
 * Send verification code email
 * @param {string} to - Recipient email
 * @param {string} code - 6-digit verification code
 * @param {string} firstName - User's first name
 */
const sendVerificationEmail = async (to, code, firstName = 'User') => {
  const subject = 'Verify Your QuickAlert Account';
  
  const text = `
Hello ${firstName},

Welcome to QuickAlert!

Your verification code is: ${code}

This code will expire in 10 minutes.

If you didn't create an account with QuickAlert, please ignore this email.

Best regards,
The QuickAlert Team
  `.trim();

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 28px;">🚨 QuickAlert</h1>
    <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0;">Emergency Alert System</p>
  </div>
  
  <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #e5e7eb; border-top: none;">
    <h2 style="color: #1f2937; margin-top: 0;">Welcome, ${firstName}! 👋</h2>
    
    <p style="color: #4b5563;">Thank you for joining QuickAlert. To complete your registration, please use the verification code below:</p>
    
    <div style="background: white; border: 2px dashed #dc2626; border-radius: 10px; padding: 20px; text-align: center; margin: 25px 0;">
      <p style="margin: 0 0 10px 0; color: #6b7280; font-size: 14px;">Your Verification Code</p>
      <div style="font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #dc2626;">${code}</div>
    </div>
    
    <p style="color: #6b7280; font-size: 14px;">⏱️ This code will expire in <strong>10 minutes</strong>.</p>
    
    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 25px 0;">
    
    <p style="color: #9ca3af; font-size: 12px; margin-bottom: 0;">
      If you didn't create an account with QuickAlert, please ignore this email.
      <br><br>
      © 2025 QuickAlert. All rights reserved.
    </p>
  </div>
</body>
</html>
  `.trim();

  return sendEmail({ to, subject, text, html });
};

/**
 * Send password reset email
 * @param {string} to - Recipient email
 * @param {string} code - Reset code
 * @param {string} firstName - User's first name
 */
const sendPasswordResetEmail = async (to, code, firstName = 'User') => {
  const subject = 'Reset Your QuickAlert Password';
  
  const text = `
Hello ${firstName},

We received a request to reset your QuickAlert password.

Your password reset code is: ${code}

This code will expire in 10 minutes.

If you didn't request a password reset, please ignore this email or contact support if you have concerns.

Best regards,
The QuickAlert Team
  `.trim();

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 28px;">🚨 QuickAlert</h1>
    <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0;">Password Reset Request</p>
  </div>
  
  <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #e5e7eb; border-top: none;">
    <h2 style="color: #1f2937; margin-top: 0;">Hello, ${firstName} 🔐</h2>
    
    <p style="color: #4b5563;">We received a request to reset your password. Use the code below to proceed:</p>
    
    <div style="background: white; border: 2px dashed #dc2626; border-radius: 10px; padding: 20px; text-align: center; margin: 25px 0;">
      <p style="margin: 0 0 10px 0; color: #6b7280; font-size: 14px;">Your Reset Code</p>
      <div style="font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #dc2626;">${code}</div>
    </div>
    
    <p style="color: #6b7280; font-size: 14px;">⏱️ This code will expire in <strong>10 minutes</strong>.</p>
    
    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 25px 0;">
    
    <p style="color: #9ca3af; font-size: 12px; margin-bottom: 0;">
      If you didn't request a password reset, you can safely ignore this email.
      <br><br>
      © 2025 QuickAlert. All rights reserved.
    </p>
  </div>
</body>
</html>
  `.trim();

  return sendEmail({ to, subject, text, html });
};

/**
 * Send alert notification email
 * @param {string} to - Recipient email
 * @param {Object} alert - Alert details
 */
const sendAlertNotificationEmail = async (to, alert, firstName = 'User') => {
  const severityColors = {
    critical: '#dc2626',
    high: '#ea580c',
    medium: '#ca8a04',
    low: '#16a34a',
  };

  const subject = `🚨 [${alert.severity.toUpperCase()}] ${alert.title}`;
  
  const text = `
EMERGENCY ALERT

Title: ${alert.title}
Severity: ${alert.severity.toUpperCase()}
Type: ${alert.type}

Description:
${alert.description}

Location: ${alert.location?.address || 'Not specified'}

Stay safe and follow local emergency guidelines.

- QuickAlert Team
  `.trim();

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: ${severityColors[alert.severity] || '#dc2626'}; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 24px;">🚨 EMERGENCY ALERT</h1>
    <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0; font-size: 18px; font-weight: bold;">${alert.severity.toUpperCase()}</p>
  </div>
  
  <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #e5e7eb; border-top: none;">
    <h2 style="color: #1f2937; margin-top: 0;">${alert.title}</h2>
    
    <div style="background: white; border-left: 4px solid ${severityColors[alert.severity] || '#dc2626'}; padding: 15px; margin: 20px 0;">
      <p style="margin: 0; color: #4b5563;">${alert.description}</p>
    </div>
    
    <p style="color: #6b7280;"><strong>Type:</strong> ${alert.type}</p>
    <p style="color: #6b7280;"><strong>Location:</strong> ${alert.location?.address || 'Check app for details'}</p>
    
    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 25px 0;">
    
    <p style="color: #9ca3af; font-size: 12px; margin-bottom: 0;">
      Stay safe and follow local emergency guidelines.
      <br><br>
      © 2025 QuickAlert. All rights reserved.
    </p>
  </div>
</body>
</html>
  `.trim();

  return sendEmail({ to, subject, text, html });
};

module.exports = {
  initializeTransporter,
  sendEmail,
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendAlertNotificationEmail,
};

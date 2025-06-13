const SibApiV3Sdk = require('sib-api-v3-sdk');
const dotenv = require('dotenv');
const crypto = require('crypto');

dotenv.config();

// Initialize Brevo API client
const defaultClient = SibApiV3Sdk.ApiClient.instance;
const apiKey = defaultClient.authentications['api-key'];
console.log(apiKey)
apiKey.apiKey = process.env.BREVO_API_KEY;
console.log(process.env.BREVO_API_KEY);

const apiInstance = new SibApiV3Sdk.TransactionalEmailsApi();

// Core function to send emails using Brevo
const sendEmail = async (to, subject, html) => {
  const textContent = typeof html === 'string' ? html.replace(/<[^>]*>?/gm, '') : '';
  console.log("Sender:", {
    name: process.env.EMAIL_FROM_NAME,
    email: process.env.EMAIL_FROM_ADDRESS
  });

  const sendSmtpEmail = new SibApiV3Sdk.SendSmtpEmail();
  sendSmtpEmail.sender = {
    name: process.env.EMAIL_FROM_NAME,
    email: process.env.EMAIL_FROM_ADDRESS,
  };
  sendSmtpEmail.to = [{ email: to }];
  sendSmtpEmail.subject = subject;
  sendSmtpEmail.htmlContent = html;
  sendSmtpEmail.textContent = textContent;

  try {
    const response = await apiInstance.sendTransacEmail(sendSmtpEmail);
    console.log(`Email sent to ${to}: ${response.messageId || 'Success'}`);
    return response;
  } catch (error) {
    // Enhanced error logging
    const errorDetails = {
      timestamp: new Date().toISOString(),
      to,
      subject,
      error: {
        message: error.response?.body?.message || error.message,
        code: error.response?.body?.code || error.code,
        details: error.response?.body || 'No additional details'
      }
    };
    
    console.error('Email sending failed:', JSON.stringify(errorDetails, null, 2));

    // Check for specific error types
    if (error.response?.body?.code === 'unauthorized' && error.response?.body?.message?.includes('unrecognised IP address')) {
      throw new Error(
        'Email sending failed: IP address not whitelisted. Please add your server IP to the Brevo allowlist at: https://app.brevo.com/security/authorised_ips'
      );
    }

    // Throw a user-friendly error
    throw new Error(`Failed to send email: ${error.response?.body?.message || error.message}`);
  }
};

const sendPasswordResetEmail = async (email, resetToken) => {
  const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;
  const subject = 'Password Reset Request';
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>Password Reset</h2>
      <p>You requested a password reset. Click the link below to set a new password:</p>
      <a href="${resetUrl}" style="display: inline-block; padding: 10px 20px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px;">Reset Password</a>
      <p>This link will expire in 1 hour.</p>
      <p>If you didn't request this, please ignore this email.</p>
    </div>
  `;
  await sendEmail(email, subject, html);
};

const generateVerificationToken = () => {
  return crypto.randomBytes(20).toString('hex');
};

const sendVerificationEmail = async (email, token) => {
  console.log("Starting to send email verification");
  const verificationUrl = `${process.env.FRONTEND_URL}/verify-email?token=${token}`;
  
  const subject = 'Verify Your Email Address';
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>Email Verification</h2>
      <p>Thank you for registering! Please verify your email address:</p>
      <a href="${verificationUrl}" 
         style="display: inline-block; padding: 10px 20px; background-color: #007bff; 
                color: white; text-decoration: none; border-radius: 5px;">
        Verify Email
      </a>
      <p>If you didn't create an account, please ignore this email.</p>
      <p style="color: #666;">This link expires in 24 hours.</p>
    </div>
  `;

  await sendEmail(email, subject, html);
};

const sendNotificationEmail = async (email, subject, message) => {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>${subject}</h2>
      <p>${message}</p>
      <p>Thank you for using our service.</p>
    </div>
  `;

  await sendEmail(email, subject, html);
};

const sendBookingConfirmationEmails = async (booking) => {
  // Send email to renter
  const renterSubject = 'Your Booking Has Been Confirmed!';
  const renterMessage = `
    Your booking for "${booking.ad.title}" has been confirmed.
    Booking Details:
    - Start Date: ${booking.startDate.toLocaleDateString()}
    - End Date: ${booking.endDate.toLocaleDateString()}
    - Total Amount: ${booking.totalAmount}
    
    Please contact the owner for further details.
    Owner Name: ${booking.owner.first_name} ${booking.owner.last_name}
    Owner Email: ${booking.owner.email}
  `;
  await sendNotificationEmail(booking.renter.email, renterSubject, renterMessage);

  // Send email to owner
  const ownerSubject = 'New Booking Confirmation';
  const ownerMessage = `
    A booking for your listing "${booking.ad.title}" has been confirmed.
    Booking Details:
    - Start Date: ${booking.startDate.toLocaleDateString()}
    - End Date: ${booking.endDate.toLocaleDateString()}
    - Total Amount: ${booking.totalAmount}
    
    Renter Details:
    - Name: ${booking.renter.first_name} ${booking.renter.last_name}
    - Email: ${booking.renter.email}
    - Phone: ${booking.renterContact?.phone || 'Not provided'}
  `;
  await sendNotificationEmail(booking.owner.email, ownerSubject, ownerMessage);
};

const sendBookingCreationEmails = async (booking) => {
  // Send email to renter
  const renterSubject = 'New Booking Created';
  const renterMessage = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>Your Booking Has Been Created!</h2>
      <p>Your booking for "${booking.ad.title}" has been created successfully.</p>
      <div style="background-color: #f5f5f5; padding: 20px; border-radius: 5px; margin: 20px 0;">
        <h3>Booking Details:</h3>
        <ul style="list-style: none; padding: 0;">
          <li><strong>Start Date:</strong> ${new Date(booking.startDate).toLocaleDateString()}</li>
          <li><strong>End Date:</strong> ${new Date(booking.endDate).toLocaleDateString()}</li>
          <li><strong>Total Amount:</strong> $${booking.totalAmount}</li>
          ${booking.specialRequests ? `<li><strong>Special Requests:</strong> ${booking.specialRequests}</li>` : ''}
        </ul>
      </div>
      <p>Please wait for the owner to confirm your booking.</p>
      <p>You will receive another email once the booking is confirmed.</p>
    </div>
  `;
  await sendEmail(booking.renter.email, renterSubject, renterMessage);

  // Send email to owner
  const ownerSubject = 'New Booking Request';
  const ownerMessage = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>New Booking Request</h2>
      <p>You have received a new booking request for "${booking.ad.title}".</p>
      <div style="background-color: #f5f5f5; padding: 20px; border-radius: 5px; margin: 20px 0;">
        <h3>Booking Details:</h3>
        <ul style="list-style: none; padding: 0;">
          <li><strong>Start Date:</strong> ${new Date(booking.startDate).toLocaleDateString()}</li>
          <li><strong>End Date:</strong> ${new Date(booking.endDate).toLocaleDateString()}</li>
          <li><strong>Total Amount:</strong> $${booking.totalAmount}</li>
          ${booking.specialRequests ? `<li><strong>Special Requests:</strong> ${booking.specialRequests}</li>` : ''}
        </ul>
        <h3>Renter Details:</h3>
        <ul style="list-style: none; padding: 0;">
          <li><strong>Name:</strong> ${booking.renter.first_name} ${booking.renter.last_name}</li>
          <li><strong>Email:</strong> ${booking.renter.email}</li>
          ${booking.renterContact?.phone ? `<li><strong>Phone:</strong> ${booking.renterContact.phone}</li>` : ''}
        </ul>
      </div>
      <p>Please review and confirm or reject this booking request.</p>
    </div>
  `;
  await sendEmail(booking.owner.email, ownerSubject, ownerMessage);
};

const sendBookingRejectionEmails = async (booking, rejectionReason) => {
  // Send email to renter
  const renterSubject = 'Booking Request Rejected';
  const renterMessage = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>Booking Request Rejected</h2>
      <p>Your booking request for "${booking.ad.title}" has been rejected by the owner.</p>
      <div style="background-color: #f5f5f5; padding: 20px; border-radius: 5px; margin: 20px 0;">
        <h3>Booking Details:</h3>
        <ul style="list-style: none; padding: 0;">
          <li><strong>Start Date:</strong> ${new Date(booking.startDate).toLocaleDateString()}</li>
          <li><strong>End Date:</strong> ${new Date(booking.endDate).toLocaleDateString()}</li>
          <li><strong>Total Amount:</strong> $${booking.totalAmount}</li>
        </ul>
        <h3>Rejection Reason:</h3>
        <p>${rejectionReason}</p>
      </div>
      <p>You can try booking another item or contact the owner for more information.</p>
    </div>
  `;
  await sendEmail(booking.renter.email, renterSubject, renterMessage);

  // Send email to owner
  const ownerSubject = 'Booking Rejection Confirmation';
  const ownerMessage = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>Booking Rejection Confirmation</h2>
      <p>You have rejected the booking request for "${booking.ad.title}".</p>
      <div style="background-color: #f5f5f5; padding: 20px; border-radius: 5px; margin: 20px 0;">
        <h3>Booking Details:</h3>
        <ul style="list-style: none; padding: 0;">
          <li><strong>Start Date:</strong> ${new Date(booking.startDate).toLocaleDateString()}</li>
          <li><strong>End Date:</strong> ${new Date(booking.endDate).toLocaleDateString()}</li>
          <li><strong>Total Amount:</strong> $${booking.totalAmount}</li>
        </ul>
        <h3>Renter Details:</h3>
        <ul style="list-style: none; padding: 0;">
          <li><strong>Name:</strong> ${booking.renter.first_name} ${booking.renter.last_name}</li>
          <li><strong>Email:</strong> ${booking.renter.email}</li>
          ${booking.renterContact?.phone ? `<li><strong>Phone:</strong> ${booking.renterContact.phone}</li>` : ''}
        </ul>
        <h3>Rejection Reason:</h3>
        <p>${rejectionReason}</p>
      </div>
    </div>
  `;
  await sendEmail(booking.owner.email, ownerSubject, ownerMessage);
};

const sendBookingCancellationEmails = async (booking, reason, cancelledBy) => {
  const isCancelledByRenter = cancelledBy.toString() === booking.renter._id.toString();
  const cancelledByUser = isCancelledByRenter ? booking.renter : booking.owner;
  const otherUser = isCancelledByRenter ? booking.owner : booking.renter;

  // Send email to the user who cancelled
  const cancellerSubject = 'Booking Cancellation Confirmation';
  const cancellerMessage = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>Booking Cancellation Confirmation</h2>
      <p>You have successfully cancelled your booking for "${booking.ad.title}".</p>
      <div style="background-color: #f5f5f5; padding: 20px; border-radius: 5px; margin: 20px 0;">
        <h3>Booking Details:</h3>
        <ul style="list-style: none; padding: 0;">
          <li><strong>Start Date:</strong> ${new Date(booking.startDate).toLocaleDateString()}</li>
          <li><strong>End Date:</strong> ${new Date(booking.endDate).toLocaleDateString()}</li>
          <li><strong>Total Amount:</strong> $${booking.totalAmount}</li>
        </ul>
        <h3>Cancellation Reason:</h3>
        <p>${reason}</p>
      </div>
    </div>
  `;
  await sendEmail(cancelledByUser.email, cancellerSubject, cancellerMessage);

  // Send email to the other party
  const otherPartySubject = 'Booking Cancellation Notification';
  const otherPartyMessage = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>Booking Cancellation Notification</h2>
      <p>The booking for "${booking.ad.title}" has been cancelled by ${isCancelledByRenter ? 'the renter' : 'the owner'}.</p>
      <div style="background-color: #f5f5f5; padding: 20px; border-radius: 5px; margin: 20px 0;">
        <h3>Booking Details:</h3>
        <ul style="list-style: none; padding: 0;">
          <li><strong>Start Date:</strong> ${new Date(booking.startDate).toLocaleDateString()}</li>
          <li><strong>End Date:</strong> ${new Date(booking.endDate).toLocaleDateString()}</li>
          <li><strong>Total Amount:</strong> $${booking.totalAmount}</li>
        </ul>
        <h3>Cancellation Details:</h3>
        <ul style="list-style: none; padding: 0;">
          <li><strong>Cancelled By:</strong> ${cancelledByUser.first_name} ${cancelledByUser.last_name}</li>
          <li><strong>Reason:</strong> ${reason}</li>
        </ul>
      </div>
    </div>
  `;
  await sendEmail(otherUser.email, otherPartySubject, otherPartyMessage);
};

const sendBookingStatusUpdateEmails = async (booking, updateData) => {
  const { pickupStatus, returnStatus } = updateData;
  const statusMessages = {
    'pending': 'is pending',
    'in-progress': 'is in progress',
    'completed': 'has been completed',
    'cancelled': 'has been cancelled'
  };

  // Send email to renter
  const renterSubject = 'Booking Status Update';
  const renterMessage = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>Booking Status Update</h2>
      <p>Your booking for "${booking.ad.title}" has been updated.</p>
      <div style="background-color: #f5f5f5; padding: 20px; border-radius: 5px; margin: 20px 0;">
        <h3>Booking Details:</h3>
        <ul style="list-style: none; padding: 0;">
          <li><strong>Start Date:</strong> ${new Date(booking.startDate).toLocaleDateString()}</li>
          <li><strong>End Date:</strong> ${new Date(booking.endDate).toLocaleDateString()}</li>
          <li><strong>Total Amount:</strong> $${booking.totalAmount}</li>
        </ul>
        <h3>Status Updates:</h3>
        <ul style="list-style: none; padding: 0;">
          ${pickupStatus ? `<li><strong>Pickup Status:</strong> ${statusMessages[pickupStatus]}</li>` : ''}
          ${returnStatus ? `<li><strong>Return Status:</strong> ${statusMessages[returnStatus]}</li>` : ''}
        </ul>
      </div>
      <p>Please contact the owner if you have any questions.</p>
    </div>
  `;
  await sendEmail(booking.renter.email, renterSubject, renterMessage);

  // Send email to owner
  const ownerSubject = 'Booking Status Update';
  const ownerMessage = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>Booking Status Update</h2>
      <p>The booking for "${booking.ad.title}" has been updated.</p>
      <div style="background-color: #f5f5f5; padding: 20px; border-radius: 5px; margin: 20px 0;">
        <h3>Booking Details:</h3>
        <ul style="list-style: none; padding: 0;">
          <li><strong>Start Date:</strong> ${new Date(booking.startDate).toLocaleDateString()}</li>
          <li><strong>End Date:</strong> ${new Date(booking.endDate).toLocaleDateString()}</li>
          <li><strong>Total Amount:</strong> $${booking.totalAmount}</li>
        </ul>
        <h3>Renter Details:</h3>
        <ul style="list-style: none; padding: 0;">
          <li><strong>Name:</strong> ${booking.renter.first_name} ${booking.renter.last_name}</li>
          <li><strong>Email:</strong> ${booking.renter.email}</li>
          ${booking.renterContact?.phone ? `<li><strong>Phone:</strong> ${booking.renterContact.phone}</li>` : ''}
        </ul>
        <h3>Status Updates:</h3>
        <ul style="list-style: none; padding: 0;">
          ${pickupStatus ? `<li><strong>Pickup Status:</strong> ${statusMessages[pickupStatus]}</li>` : ''}
          ${returnStatus ? `<li><strong>Return Status:</strong> ${statusMessages[returnStatus]}</li>` : ''}
        </ul>
      </div>
    </div>
  `;
  await sendEmail(booking.owner.email, ownerSubject, ownerMessage);
};

module.exports = {
  sendEmail,
  sendPasswordResetEmail,
  generateVerificationToken,
  sendVerificationEmail,
  sendNotificationEmail,
  sendBookingConfirmationEmails,
  sendBookingCreationEmails,
  sendBookingRejectionEmails,
  sendBookingCancellationEmails,
  sendBookingStatusUpdateEmails
};

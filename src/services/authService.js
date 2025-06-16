const bcrypt = require("bcryptjs");
const User = require("../models/User");
const { CustomError, OnfidoPendingError, AccountLockedError, EmailUnverifiedError } = require('../errors/CustomeError');
const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');
const { generateToken } = require('../utils/auth');
const onfido = require('../utils/onfido')
const crypto = require('crypto');
const { generateVerificationToken, sendPasswordResetEmail, sendVerificationEmail } = require("../utils/sendMail");


dotenv.config();

const registerUser = async (userData) => {
  const { email, password, first_name, last_name, address, phoneNumber } = userData;

  // Check if user exists
  const existingUser = await User.findOne({ email: email.toLowerCase().trim() });
  if (existingUser) throw new CustomError('User already exists', 400);

  // Hash password
  const hashedPassword = await bcrypt.hash(password, 10);

  // Generate email verification token
  const verificationToken = generateVerificationToken();
  const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

  // Create user (no Onfido code)
  const newUser = new User({
    email: email.toLowerCase().trim(),
    password: hashedPassword,
    first_name,
    last_name,
    address,
    phoneNumber,
    emailVerificationToken: verificationToken,
    emailVerificationExpire: verificationExpires,
    status: 'email_unverified',
    onFidoVerificationStatus: 'not_started' // Default status
  });

  await newUser.save();
  await sendVerificationEmail(newUser.email, verificationToken);
  console.log("email sent to",newUser.email)

  return {
    _id: newUser._id,
    email: newUser.email,
    first_name: newUser.first_name,
    last_name: newUser.last_name,
    status: newUser.status,
    message: 'Registration successful. Verify your email.'
  };
};


const loginUser = async (loginData) => {
  const { email, password } = loginData;

  // 1. Find user by email (case insensitive)
  const user = await User.findOne({ email: email.toLowerCase().trim() });
  if (!user) {
    throw { statusCode: 401, message: 'Invalid email or password' };
  }

  if (user.emailVerified==false) {
    throw { statusCode: 403, message: 'Email not verified', code: 'email_unverified' };
  }

  // 2. Check if account is locked
  if (user.accountLockedUntil && user.accountLockedUntil > new Date()) {
    throw { 
      statusCode: 403, 
      message: `Account locked until ${user.accountLockedUntil}`,
      code: 'account_locked'
    };
  }

  // 3. Verify password
  const isPasswordValid = await bcrypt.compare(password, user.password);
  if (!isPasswordValid) {
    // Increment failed attempts
    user.loginAttempts += 1;
    
    // Lock account after 5 failed attempts
    if (user.loginAttempts >= 5) {
      user.accountLockedUntil = new Date(Date.now() + 30 * 60 * 1000); // 30 mins
      await user.save();
      throw {
        statusCode: 403,
        message: `Account locked until ${user.accountLockedUntil}`,
        code: 'account_locked'
      };
    }
    
    await user.save();
    throw { statusCode: 401, message: 'Invalid email or password' };
  }

  // 4. Reset attempts on successful login
  user.loginAttempts = 0;
  user.lastLogin = new Date();
  await user.save();

  // 5. Check email verification
  // if (user.emailVerified==false) {
  //   throw { statusCode: 403, message: 'Email not verified', code: 'email_unverified' };
  // }

  // 6. Check OnFido verification
  // if (user.onFidoVerificationRequired && user.onFidoVerificationStatus !== 'approved') {
  //   throw { statusCode: 403, message: 'OnFido verification pending', code: 'onfido_pending' };
  // }

  // 7. Generate token for successful login
  const token = generateToken(user._id, user.email);

  // Return user data (without password)
  const userData = user.toObject();
  delete userData.password;

  return { user: userData, token };
};

const verifyEmailToken = async (token) => {
  console.log("token", token);
  const user = await User.findOne({ 
    emailVerificationToken: token,
    emailVerificationExpire: { $gt: Date.now() }
  });
  
  if (!user) throw new Error('Invalid/expired token');
  
  user.emailVerified = true;
  user.emailVerificationToken = undefined;
  await user.save();
  
  return user;
};

const forgotPassword = async (email) => {
  // 1. Find user by email
  const user = await User.findOne({ email });
  if (!user) {
    // Don't reveal whether email exists or not
    return;
  }

  // 2. Generate reset token
  const resetToken = crypto.randomBytes(32).toString('hex');
  const resetTokenExpiry = Date.now() + 3600000; // 1 hour from now

  // 3. Save token and expiry to user
  user.passwordResetToken = resetToken;
  user.passwordResetExpires = resetTokenExpiry;
  await user.save();

  // 4. Send email
  await sendPasswordResetEmail(user.email, resetToken);
};

const resetPassword = async (token, newPassword) => {
  // 1. Find user by token and check expiry
  const user = await User.findOne({
    passwordResetToken: token,
    passwordResetExpires: { $gt: Date.now() }
  });

  if (!user) {
    throw new CustomError('Password reset token is invalid or has expired', 400);
  }

  // 2. Hash new password
  const hashedPassword = await bcrypt.hash(newPassword, 10);

  // 3. Update user password and clear reset token
  user.password = hashedPassword;
  user.passwordResetToken = undefined;
  user.passwordResetExpires = undefined;
  await user.save();

  // 4. Return the updated user (without password)
  const userData = {
    _id: user._id,
    email: user.email,
    fullName: user.fullName
  };

  return userData;
};

// Update startVerification to handle errors better
const startVerification = async (userId) => {
  const user = await User.findById(userId);
  if (!user) throw new CustomError('User not found', 404);

  // Check if user already has an applicant ID
  if (user.onfidoApplicantId) {
    try {
      // Verify existing applicant is valid
      await onfido.getApplicantStatus(user.onfidoApplicantId);
      const sdkToken = await onfido.generateSdkToken(user.onfidoApplicantId);
      return { sdkToken, applicantId: user.onfidoApplicantId };
    } catch (error) {
      // If existing applicant is invalid, create a new one
      console.warn('Existing applicant invalid, creating new one:', error.message);
    }
  }

  // Create new applicant
  const applicant = await onfido.createApplicant({
    first_name: user.first_name,
    last_name: user.last_name,
    email: user.email,
    address: user.address
  });

  // Generate SDK token
  const sdkToken = await onfido.generateSdkToken(applicant.id);

  // Update user
  user.onfidoApplicantId = applicant.id;
  user.onFidoVerificationStatus = 'pending';
  await user.save();

  return { sdkToken, applicantId: applicant.id };
};
const getProfile = async (userId) => {
  try {
    const user = await User.findById(userId).select('-password');
    if (!user) {
      throw new CustomError('User not found', 404);
    }
    return {
      success: true,
      user
    };
  } catch (error) {
    console.error('Profile service error:', error);
    throw error; // Re-throw for controller handling
  }
};

const getProfileByEmail = async (email) => {
  try {
    const user = await User.findOne({ email: email.toLowerCase().trim() }).select('-password');
    if (!user) {
      throw new CustomError('User not found', 404);
    }
    return {
      success: true,
      user
    };
  } catch (error) {
    console.error('Profile by email service error:', error);
    throw error;
  }
};

module.exports = {
  registerUser,
  loginUser,
  verifyEmailToken,
  forgotPassword,
  resetPassword,
  startVerification,
  getProfile,
  getProfileByEmail,
};
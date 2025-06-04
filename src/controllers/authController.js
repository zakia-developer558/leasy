const { ForgotPasswordSchema, ResetPasswordSchema, UserLoginSchema, UserRegistrationSchema } = require("../validations/authSchemaValidator");
const { forgotPassword, loginUser, registerUser, resetPassword, verifyEmailToken, startVerification, getProfile } = require("../services/authService");
const { z } = require("zod");
const { CustomError } = require("../errors/CustomeError");
const onfido = require('../utils/onfido')
//const { generateOnfidoSdkToken } = require("../utils/onfido");
const User = require("../models/User");
const crypto = require('crypto');

const register = async (req, res) => {
  try {
    const validatedData = UserRegistrationSchema.parse(req.body);
    const newUser = await registerUser(validatedData);
    const response = {
      success: true,
      message: newUser.message,
      user: {
        _id: newUser._id,
        email: newUser.email,
        first_name: newUser.first_name,
        last_name: newUser.last_name,
        status: newUser.status
      }
    };

    // Add Onfido data to response if it exists
    if (newUser.sdkToken) {
      response.onfido = {
        sdkToken: newUser.sdkToken,
        applicantId: newUser.applicantId
      };
    }

    res.status(201).json(response);

 

  } catch (error) {
    console.error("Registration error:", error);

    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        success: false,
        message: "Validation failed",
        errors: error.errors 
      });
    }

    if (error instanceof CustomError) {
      return res.status(error.statusCode).json({ 
        success: false,
        message: error.message 
      });
    }

    res.status(500).json({ 
      success: false,
      message: "Registration failed. Please try again later." 
    });
  }
};

const login = async (req, res) => {
  try {
    const validatedData = UserLoginSchema.parse(req.body);
    const { user, token } = await loginUser(validatedData);

    res.status(200).json({ 
      message: "Login successful",
      user,
      token 
    });
  } catch (error) {
    console.error("Login error:", error);

    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        message: "Validation failed",
        errors: error.errors 
      });
    }

    if (error.statusCode) {
      return res.status(error.statusCode).json({
        message: error.message,
        code: error.code || 'authentication_error'
      });
    }

    res.status(500).json({ message: "Internal server error" });
  }
};

const verifyEmail = async (req, res) => {
  try {
    const user = await verifyEmailToken(req.query.token);
    res.json({ success: true, user });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
};

const forgotPasswordController = async (req, res) => {
  try {
    const { email } = ForgotPasswordSchema.parse(req.body);
    await forgotPassword(email);

    res.status(200).json({
      message: "If an account with that email exists, a password reset link has been sent"
    });
  } catch (error) {
    console.error("Error in forgot password:", error);

    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: error.errors });
    }

    res.status(500).json({ message: "Internal Server Error" });
  }
};

const resetPasswordController = async (req, res) => {
  try {
    const { token, newPassword } = ResetPasswordSchema.parse(req.body);
    const user = await resetPassword(token, newPassword);

    res.status(200).json({
      message: "Password reset successful",
      user
    });
  } catch (error) {
    console.error("Error in reset password:", error);

    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: error.errors });
    }

    if (error instanceof CustomError) {
      return res.status(error.statusCode).json({ message: error.message });
    }

    res.status(500).json({ message: "Internal Server Error" });
  }
};


const handleOnfidoWebhook = async (req, res) => {
  try {
    const rawBody = req.rawBody || req.body.toString('utf8');
    const signature = req.headers['x-sha2-signature'];

    // Verify signature
    if (!onfido.verifyWebhook(rawBody, signature, process.env.ONFIDO_WEBHOOK_SECRET)) {
      return res.status(401).json({ error: 'Invalid signature' });
    }

    const payload = JSON.parse(rawBody);
    
    // Process different event types
    switch (payload.resource_type) {
      case 'check':
        await handleCheckEvent(payload);
        break;
      case 'workflow_run':
        await handleWorkflowEvent(payload);
        break;
      case 'document':
        await handleDocumentEvent(payload);
        break;
      default:
        console.warn('Unhandled webhook type:', payload.resource_type);
    }

    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ error: error.message });
  }
};

async function handleCheckEvent(payload) {
  const checkId = payload.object.id;
  const user = await User.findOne({ onfidoCheckId: checkId });
  
  if (!user) {
    console.error('User not found for check ID:', checkId);
    return;
  }

  // Update user status based on check result
  user.onFidoVerificationStatus = payload.object.status;
  user.status = payload.object.status === 'approved' ? 'verified' : 'verification_failed';
  await user.save();

  // TODO: Send notification email
}
const initiateVerification = async (req, res) => {
  try {
    const userId = req.user._id; // From auth middleware
    console.log(userId);
    const { sdkToken, applicantId } = await startVerification(userId);

    res.json({
      success: true,
      sdkToken,
      applicantId,
      message: 'Verification started. Use the SDK token in frontend.'
    });
  } catch (error) {
    console.error('Onfido error:', error);
    res.status(500).json({ 
      success: false,
      error: error.message || 'Failed to start verification' 
    });
  }
};
const fetchProfile = async (req, res) => {
  try {
    // Debug logged-in user from middleware
    console.log('Auth middleware user:', req.user); 
    
    if (!req.user._id) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const result = await getProfile(req.user._id);
    res.status(200).json(result);
  } catch (error) {
    console.error('Profile controller error:', error);
    res.status(error.statusCode || 500).json({
      success: false,
      error: error.message || 'Failed to fetch profile'
    });
  }
};
module.exports = {
  register,
  login,
  verifyEmail,
  forgotPasswordController,
  resetPasswordController,
  handleOnfidoWebhook,
  initiateVerification,
  fetchProfile,
  
};
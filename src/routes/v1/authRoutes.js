const express = require('express');
const bodyParser = require('body-parser');
const { 
  forgotPasswordController, 
  login, 
  register, 
  resetPasswordController, 
  verifyEmail, 
  handleOnfidoWebhook,
  initiateVerification,
  fetchProfile,
  fetchProfileByEmail
} = require('../../controllers/authController');
const { authMiddleware } = require('../../middlewares/authMiddleware');
const authRouter = express.Router();

authRouter.post('/register', register);
authRouter.post('/login', login);
authRouter.post('/forget-password', forgotPasswordController);
authRouter.post('/reset-password', resetPasswordController);
authRouter.post('/verify-email', verifyEmail);
authRouter.post(
  '/webhooks/onfido',
  express.raw({ type: 'application/json' }), // ← Critical for signature verification
  handleOnfidoWebhook
);
authRouter.post('/verify/onfido', authMiddleware, initiateVerification);
authRouter.get('/get-profile', authMiddleware, fetchProfile);
authRouter.get('/get-profile-by-email', fetchProfileByEmail);

module.exports = authRouter;
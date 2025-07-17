const SubscriptionPlan = require('../models/SubscriptionPlan');
const { CustomError } = require('../errors/CustomeError');
const UserSubscription = require('../models/UserSubscription');
const User = require('../models/User');
const axios = require('axios');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const { sendNotificationEmail } = require('../utils/sendMail');

// Helper: Check if user is admin
function isAdmin(user) {
  return user && user.role === 'admin';
}

// Create a new subscription plan (Admin only)
const createPlan = async (req, res, next) => {
  try {
    if (!isAdmin(req.user)) {
      return res.status(403).json({ success: false, error: 'Forbidden: Admins only' });
    }
    const { name, price, listingLimit, featuredAds, commissionDiscount, description, isActive } = req.body;
    const plan = new SubscriptionPlan({ name, price, listingLimit, featuredAds, commissionDiscount, description, isActive });
    await plan.save();
    res.status(201).json({ success: true, plan });
  } catch (error) {
    next(error);
  }
};

// Update a subscription plan (Admin only)
const updatePlan = async (req, res, next) => {
  try {
    if (!isAdmin(req.user)) {
      return res.status(403).json({ success: false, error: 'Forbidden: Admins only' });
    }
    const { id } = req.params;
    const updates = req.body;
    const plan = await SubscriptionPlan.findByIdAndUpdate(id, updates, { new: true });
    if (!plan) {
      return res.status(404).json({ success: false, error: 'Plan not found' });
    }
    res.json({ success: true, plan });
  } catch (error) {
    next(error);
  }
};

// Delete a subscription plan (Admin only)
const deletePlan = async (req, res, next) => {
  try {
    if (!isAdmin(req.user)) {
      return res.status(403).json({ success: false, error: 'Forbidden: Admins only' });
    }
    const { id } = req.params;
    const plan = await SubscriptionPlan.findByIdAndDelete(id);
    if (!plan) {
      return res.status(404).json({ success: false, error: 'Plan not found' });
    }
    res.json({ success: true, message: 'Plan deleted' });
  } catch (error) {
    next(error);
  }
};

// Get all subscription plans (public)
const getPlans = async (req, res, next) => {
  try {
    const plans = await SubscriptionPlan.find();
    res.json({ success: true, plans });
  } catch (error) {
    next(error);
  }
};

// Get a single plan by ID (public)
const getPlanById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const plan = await SubscriptionPlan.findById(id);
    if (!plan) {
      return res.status(404).json({ success: false, error: 'Plan not found' });
    }
    res.json({ success: true, plan });
  } catch (error) {
    next(error);
  }
};

// Helper: Generate T-Pay payment link for subscription
async function generateTPaySubscriptionLink({ amount, description, userId, planId, customerEmail }) {
  const config = {
    baseUrl: process.env.TPAY_BASE_URL || 'https://openapi.sandbox.tpay.com',
    clientId: process.env.TPAY_CLIENT_ID,
    secret: process.env.TPAY_SECRET,
    merchantId: process.env.TPAY_MERCHANT_ID,
    defaultReturnUrl: process.env.TPAY_DEFAULT_RETURN_URL,
    defaultErrorUrl: process.env.TPAY_DEFAULT_ERROR_URL
  };

  try {
    // Step 1: Get OAuth2 access token
    const tokenPayload = new URLSearchParams();
    tokenPayload.append('client_id', config.clientId);
    tokenPayload.append('client_secret', config.secret);
    tokenPayload.append('grant_type', 'client_credentials');

    const authResponse = await axios.post(
      `${config.baseUrl}/oauth/auth`,
      tokenPayload,
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json'
        }
      }
    );
    const accessToken = authResponse.data.access_token;
    if (!accessToken) throw new Error('Failed to obtain T-Pay access token');

    // Step 2: Create payment transaction
    // Convert amount to grosz (int)
    const amountInGrosz = Math.round(amount * 100);
    const paymentPayload = {
      currency: 'PLN',
      description: description.substring(0, 128),
      hiddenDescription: `${userId}_${planId}`,
      languageCode: 'PL',
      preSelectedChannelId: '64',
      pos: { id: '01G6WAS5MNGQ2X728AW53D8JPR' },
      billingAddress: {
        email: customerEmail,
        name: 'Customer Name',
        phone: '',
        street: 'string',
        postalCode: 'string',
        city: 'string',
        country: 'PL',
        houseNo: 'string',
        flatNo: 'string'
      },
      childTransactions: [
        {
          amount: amountInGrosz, // int grosz
          description,
          merchant: { id: '01G6WAPZFNNX4CXBPKQH5MYD4R' },
          products: [
            {
              name: description,
              externalId: planId.toString(),
              quantity: 1,
              unitPrice: amountInGrosz // int grosz
            }
          ]
        }
      ],
      transactionCallbacks: [
        {
          type: 1,
          value: process.env.TPAY_WEBHOOK_URL || `${config.defaultReturnUrl}/api/payments/webhook`
        }
      ]
    };

    console.log('TPay Payment Payload:', paymentPayload);

    const paymentResponse = await axios.post(
      `${config.baseUrl}/marketplace/v1/transaction`,
      paymentPayload,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        timeout: 15000
      }
    );

    if (!paymentResponse.data?.paymentUrl) {
      throw new Error('TPay did not return a payment URL');
    }
    return paymentResponse.data.paymentUrl;
  } catch (error) {
    if (error.response) {
      console.error('TPay API Error:', error.response.data);
    }
    throw error;
  }
}

// Updated: Subscribe to a plan (user) with T-Pay payment link
const subscribeToPlan = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { planId, paymentMethod } = req.body;
    // Check if plan exists and is active
    const plan = await SubscriptionPlan.findById(planId);
    if (!plan || !plan.isActive) {
      return res.status(404).json({ success: false, error: 'Plan not found or inactive' });
    }
    // Check if user already has an active subscription
    const existing = await UserSubscription.findOne({ user: userId, status: 'active' });
    if (existing) {
      return res.status(400).json({ success: false, error: 'You already have an active subscription' });
    }
    // Generate T-Pay payment link
    const paymentUrl = await generateTPaySubscriptionLink({
      amount: plan.price,
      description: `Subscription for ${plan.name}`,
      userId,
      planId,
      customerEmail: req.user.email
    });
    // Create a pending subscription record
    const now = new Date();
    const sub = new UserSubscription({
      user: userId,
      plan: planId,
      status: 'pending',
      startDate: now,
      paymentMethod: paymentMethod || 'T-Pay',
      paymentStatus: 'pending'
    });
    await sub.save();
    res.status(201).json({ success: true, paymentUrl, subscription: sub });
  } catch (error) {
    next(error);
  }
};

// Get current user's subscription
const getMySubscription = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const sub = await UserSubscription.findOne({ user: userId, status: 'active' }).populate('plan');
    if (!sub) {
      return res.status(404).json({ success: false, error: 'No active subscription' });
    }
    res.json({ success: true, subscription: sub });
  } catch (error) {
    next(error);
  }
};

// Cancel current user's subscription
const cancelMySubscription = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const sub = await UserSubscription.findOne({ user: userId, status: 'active' });
    if (!sub) {
      return res.status(404).json({ success: false, error: 'No active subscription to cancel' });
    }
    sub.status = 'cancelled';
    sub.endDate = new Date();
    await sub.save();
    // Send subscription cancellation email
    const user = await User.findById(userId);
    const plan = await SubscriptionPlan.findById(sub.plan);
    const subject = 'Subscription Cancelled';
    const message = `Dear ${user.first_name},\n\nYour subscription to the ${plan.name} plan has been cancelled. If this was a mistake, you can subscribe again at any time.`;
    await sendNotificationEmail(user.email, subject, message);
    res.json({ success: true, message: 'Subscription cancelled', subscription: sub });
  } catch (error) {
    next(error);
  }
};

// Helper: Generate PDF invoice and return file path
async function generateInvoicePDF({ user, plan, subscription, invoiceId }) {
  const invoiceDir = path.join(__dirname, '../../invoices');
  if (!fs.existsSync(invoiceDir)) fs.mkdirSync(invoiceDir);
  const fileName = `invoice_${invoiceId}.pdf`;
  const filePath = path.join(invoiceDir, fileName);
  const doc = new PDFDocument();
  doc.pipe(fs.createWriteStream(filePath));
  doc.fontSize(20).text('Subscription Invoice', { align: 'center' });
  doc.moveDown();
  doc.fontSize(12).text(`Invoice ID: ${invoiceId}`);
  doc.text(`Date: ${new Date().toLocaleDateString()}`);
  doc.text(`User: ${user.first_name} ${user.last_name} (${user.email})`);
  doc.text(`Plan: ${plan.name}`);
  doc.text(`Price: ${plan.price} PLN`);
  doc.text(`Subscription ID: ${subscription._id}`);
  doc.text(`Status: ${subscription.status}`);
  doc.end();
  return filePath;
}

// Updated T-Pay webhook handler for subscription payments with invoice generation
const handleTPaySubscriptionWebhook = async (req, res) => {
  try {
    const { hiddenDescription, tr_status, tr_paid, tr_id, tr_date, tr_error } = req.body;
    if (!hiddenDescription) {
      return res.status(400).send('Missing hiddenDescription');
    }
    const [userId, planId] = hiddenDescription.split('_');
    if (!userId || !planId) {
      return res.status(400).send('Invalid hiddenDescription');
    }
    const sub = await UserSubscription.findOne({ user: userId, plan: planId, status: 'pending' });
    if (!sub) {
      return res.status(404).send('Subscription not found');
    }
    if (tr_status === 'TRUE' && tr_paid === '1') {
      sub.status = 'active';
      sub.paymentStatus = 'paid';
      sub.startDate = new Date(tr_date) || new Date();
      // Generate invoice
      const user = await User.findById(userId);
      const plan = await SubscriptionPlan.findById(planId);
      const invoiceId = `${sub._id}-${Date.now()}`;
      const invoicePath = await generateInvoicePDF({ user, plan, subscription: sub, invoiceId });
      sub.invoiceUrl = invoicePath;
      sub.invoiceId = invoiceId;
      await sub.save();
      // Send subscription confirmation email
      const subject = 'Subscription Activated';
      const message = `Dear ${user.first_name},\n\nYour subscription to the ${plan.name} plan is now active.\nThank you for subscribing!`;
      await sendNotificationEmail(user.email, subject, message);
      return res.send('OK');
    } else {
      sub.paymentStatus = 'failed';
      sub.status = 'cancelled';
      await sub.save();
      return res.status(400).send(tr_error || 'Payment failed');
    }
  } catch (error) {
    console.error('TPay Subscription Webhook Error:', error);
    return res.status(500).send('Internal server error');
  }
};

// Endpoint to download/view invoice PDF for a user's subscription
const downloadInvoice = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { subscriptionId } = req.params;
    const sub = await UserSubscription.findOne({ _id: subscriptionId, user: userId });
    if (!sub || !sub.invoiceUrl) {
      return res.status(404).json({ success: false, error: 'Invoice not found' });
    }
    res.download(sub.invoiceUrl, err => {
      if (err) {
        console.error('Invoice download error:', err);
        res.status(500).send('Error downloading invoice');
      }
    });
  } catch (error) {
    next(error);
  }
};

// Get all invoices for the authenticated user
const getAllInvoices = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const subs = await UserSubscription.find({ user: userId, invoiceUrl: { $exists: true, $ne: null } })
      .populate('plan');
    const invoices = subs.map(sub => ({
      subscriptionId: sub._id,
      invoiceId: sub.invoiceId,
      invoiceUrl: sub.invoiceUrl,
      plan: sub.plan?.name,
      amount: sub.plan?.price,
      status: sub.status,
      paymentStatus: sub.paymentStatus,
      date: sub.startDate,
    }));
    res.json({ success: true, invoices });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createPlan,
  updatePlan,
  deletePlan,
  getPlans,
  getPlanById,
  subscribeToPlan,
  getMySubscription,
  cancelMySubscription,
  handleTPaySubscriptionWebhook,
  downloadInvoice,
  getAllInvoices
}; 
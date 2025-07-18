const express = require('express');
const { authMiddleware } = require('../../middlewares/authMiddleware');
const {createPlan,updatePlan,deletePlan,getPlans,getPlanById, handleTPaySubscriptionWebhook, subscribeToPlan, getMySubscription, cancelMySubscription, downloadInvoice, getAllInvoices} = require('../../controllers/subscriptionPlanController')
const subRouter = express.Router();


// Subscription Plan Admin APIs
// Route to create new subscription plans (admin only)
subRouter.post('/create-plans', authMiddleware, createPlan);
// Route to update an existing subscription plan (admin only)
subRouter.put('/update-plan/:id', authMiddleware, updatePlan);
// Route to delete a subscription plan (admin only)
subRouter.delete('/delete-plan/:id', authMiddleware, deletePlan);
// Route to get all subscription plans
subRouter.get('/subscription-plans', getPlans);
// Route to get a specific subscription plan by ID
subRouter.get('/subscription-plans/:id', getPlanById);
// Webhook endpoint for TPay to notify payment status (POST only)
subRouter.post('/tpay/webhook', handleTPaySubscriptionWebhook);
// Route for users to subscribe to a plan (generates TPay payment link)
subRouter.post('/subscribe', authMiddleware, subscribeToPlan);
// Route to get the current user's active subscription
subRouter.get('/my-subscription', authMiddleware, getMySubscription);
// Route to cancel the current user's subscription
subRouter.post('/cancel-subscription', authMiddleware, cancelMySubscription);
// Route to download a specific invoice PDF for a subscription
subRouter.get('/invoice/:subscriptionId', authMiddleware, downloadInvoice);
// Route to get all invoices for the current user
subRouter.get('/invoices', authMiddleware, getAllInvoices);

module.exports = subRouter;
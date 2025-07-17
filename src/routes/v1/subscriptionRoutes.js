const express = require('express');
const { authMiddleware } = require('../../middlewares/authMiddleware');
const {createPlan,updatePlan,deletePlan,getPlans,getPlanById, handleTPaySubscriptionWebhook, subscribeToPlan, getMySubscription, cancelMySubscription, downloadInvoice, getAllInvoices} = require('../../controllers/subscriptionPlanController')
const subRouter = express.Router();


// Subscription Plan Admin APIs
subRouter.post('/create-plans', authMiddleware, createPlan);
subRouter.put('/update-plan/:id', authMiddleware, updatePlan);
subRouter.delete('/delete-plan/:id', authMiddleware, deletePlan);
subRouter.get('/subscription-plans', getPlans);
subRouter.get('/subscription-plans/:id', getPlanById);
subRouter.post('/tpay/webhook', handleTPaySubscriptionWebhook);
subRouter.post('/subscribe', authMiddleware, subscribeToPlan);
subRouter.get('/my-subscription', authMiddleware, getMySubscription);
subRouter.post('/cancel-subscription', authMiddleware, cancelMySubscription);
subRouter.get('/invoice/:subscriptionId', authMiddleware, downloadInvoice);
subRouter.get('/invoices', authMiddleware, getAllInvoices);

module.exports = subRouter;
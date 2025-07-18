const express = require('express');
const { authMiddleware } = require('../../middlewares/authMiddleware');
const { createAdController, previewAdController, applyAdBoostController, recalculateScoreController, updateUserRankingController, applyProfileBoostController, updateAdController, deleteAdController, getAllAdsController, createDraftAdController, getUserAdsController, getAdDetailsController, searchRentalsController, getAdDescriptionController } = require('../../controllers/adController');

const adRouter = express.Router();

adRouter.post('/create-ad', authMiddleware,createAdController);
adRouter.post('/create-draft-ad', authMiddleware,createDraftAdController);
adRouter.post('/preview-add', authMiddleware, previewAdController);
adRouter.get('/ad-ranking', getAllAdsController);
adRouter.post('/apply-ranking/:id', authMiddleware, applyAdBoostController);
adRouter.post('/recalculate-score/:adId', authMiddleware, recalculateScoreController);
adRouter.post('/apply-profileboost', authMiddleware, applyProfileBoostController);
adRouter.patch('/update-listing/:id', authMiddleware,updateAdController);
adRouter.delete('/delete-listing/:id', authMiddleware, deleteAdController);
adRouter.get('/all-user-adds', authMiddleware, getUserAdsController);
adRouter.get('/get-ads/:fullIdString', getAdDetailsController);
adRouter.get('/search',searchRentalsController)
adRouter.get('/ad-description/:id', getAdDescriptionController);

module.exports = adRouter;
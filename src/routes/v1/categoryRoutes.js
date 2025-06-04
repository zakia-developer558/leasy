const express = require('express');
const { authMiddleware } = require('../../middlewares/authMiddleware');
const { createCategoryController, getCategoriesController, deleteCategoryController, addSubcategoryController } = require('../../controllers/categoryController');
const catRouter = express.Router();

catRouter.post('/create-category', authMiddleware,createCategoryController);
catRouter.post('/add-sub-category/:categoryId', authMiddleware,addSubcategoryController);

catRouter.get('/get-categories', authMiddleware,getCategoriesController);
catRouter.delete('/delete-category/:categoryId', authMiddleware, deleteCategoryController);

module.exports = catRouter;
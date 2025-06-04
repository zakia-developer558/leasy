const { badRequest, notFound } = require('../errors/httpError');
const Category = require('../models/Category');
const mongoose = require('mongoose');

const getCategories = async () => {
  try {
    const categories = await Category.find().sort({ name: 1 });
    return {
      success: true,
      categories
    };
  } catch (error) {
    console.error('Category service error:', error);
    throw error;
  }
};

const createCategory = async (name, icon = null, subcategories = []) => {
  try {
    // Case-insensitive duplicate check
    const exists = await Category.findOne({ 
      name: { $regex: new RegExp(`^${name}$`, 'i') } 
    });
    
    if (exists) {
      throw badRequest(`Category '${name}' already exists`, 409); // 409 Conflict
    }

    const category = new Category({ 
      name, 
      icon,
      subcategories: subcategories.map(name => ({ name }))
    });
    
    await category.save();

    return {
      success: true,
      category
    };
  } catch (error) {
    console.error('Create category error:', error);
    throw error; // Re-throw the error for the controller to handle
  }
};

const addSubcategory = async (categoryId, name) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(categoryId)) {
      throw badRequest('Invalid category ID format', 400);
    }

    const category = await Category.findById(categoryId);
    if (!category) throw badRequest('Category not found', 404);

    // Case-insensitive check
    const exists = category.subcategories.some(
      sub => sub.name.toLowerCase() === name.toLowerCase().trim()
    );
    
    if (exists) throw badRequest(`Subcategory '${name}' already exists`, 409);

    const newSubcategory = { name: name.trim() };
    category.subcategories.push(newSubcategory);
    await category.save();

    return {
      success: true,
      subcategory: category.subcategories.find(
        sub => sub.name.toLowerCase() === name.toLowerCase().trim()
      )
    };
  } catch (error) {
    console.error('Add subcategory error:', error);
    throw error;
  }
};

const deleteCategoryService = async (categoryId) => {
  try {
    // Additional check (though Zod already validated)
    if (!mongoose.Types.ObjectId.isValid(categoryId)) {
      throw badRequest('Invalid category ID format', 400);
    }

    const category = await Category.findByIdAndDelete(categoryId);
    if (!category) throw notFound('Category not found', 404);

    // You might want to delete related subcategories or products here
    // Example: await Product.deleteMany({ category: categoryId });

    return {
      success: true,
      deletedId: categoryId,
      deletedCount: 1
    };
  } catch (error) {
    console.error('Delete category error:', error);
    throw error;
  }
};

module.exports = {
  getCategories,
  createCategory,
  deleteCategoryService,
  addSubcategory
};
const { getCategories, createCategory, deleteCategoryService, addSubcategory } = require("../services/categoryService");
const {  categoryIdSchema, createCategorySchema, addSubcategorySchema } = require("../validations/categoryValidation");

exports.getCategoriesController = async (req, res, next) => {
    try {
      const { success, categories } = await getCategories();
      res.json({ success, categories });
    } catch (error) {
      next(error);
    }
  };
  
exports.createCategoryController = async (req, res, next) => {
  try {
    const validatedData = createCategorySchema.parse(req.body);
    const { success, category } = await createCategory(
      validatedData.name,
      validatedData.icon,
      validatedData.subcategories || []
    );
    
    res.status(201).json({ success, category });
  } catch (error) {
    // Handle known operational errors (like duplicate category)
    if (error.isOperational) {
      return res.status(error.statusCode || 400).json({
        success: false,
        error: error.message
      });
    }
    
    // Handle Zod validation errors
    if (error.name === 'ZodError') {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: error.errors.map(e => ({
          path: e.path.join('.'),
          message: e.message
        }))
      });
    }
    
    // Forward unexpected errors to global handler
    next(error);
  }
};
  
exports.addSubcategoryController = async (req, res, next) => {
  try {
    console.log('Category ID:', req.params.categoryId); // Proper logging
    
    const validatedData = addSubcategorySchema.parse({
      ...req.body,
      categoryId: req.params.categoryId
    });
    
    const { success, subcategory } = await addSubcategory(
      validatedData.categoryId,
      validatedData.name
    );
    
    res.status(201).json({ 
      success,
      subcategory,
      message: 'Subcategory added successfully' 
    });
  } catch (error) {
    // Handle specific error cases
    if (error.isOperational) {
      return res.status(error.statusCode || 400).json({
        success: false,
        error: error.message
      });
    }
    
    // Handle Zod validation errors
    if (error.name === 'ZodError') {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: error.errors.map(e => ({
          path: e.path.join('.'),
          message: e.message
        }))
      });
    }
    
    next(error);
  }
};
  
exports.deleteCategoryController = async (req, res, next) => {
  try {
    // Validate the category ID
    console.log('Received params:', req.params);
    const validatedId = categoryIdSchema.parse(req.params.categoryId);
    
    const { success, deletedId } = await deleteCategoryService(validatedId);
    
    res.json({ 
      success,
      deletedId,
      message: 'Category deleted successfully'
    });
  } catch (error) {
    // Handle specific error cases
    if (error.isOperational) {
      return res.status(error.statusCode || 400).json({
        success: false,
        error: error.message
      });
    }
    
    // Handle Zod validation errors
    if (error.name === 'ZodError') {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: error.errors.map(e => ({
          path: e.path.join('.'),
          message: e.message
        }))
      });
    }
    
    next(error);
  }
};
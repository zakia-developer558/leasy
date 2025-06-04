const { z } = require('zod');
const mongoose = require('mongoose');


const createCategorySchema = z.object({
  name: z.string().min(3).max(50),
  icon: z.string().optional(),
  subcategories: z.array(
    z.string().min(2).max(30).trim()
  ).optional().default([]) // Explicit default
});

const addSubcategorySchema = z.object({
  categoryId: z.string().min(1, "Category ID is required")
    .refine(val => mongoose.Types.ObjectId.isValid(val), {
      message: "Invalid category ID format"
    }),
  name: z.string()
    .min(2, "Subcategory name must be at least 2 characters")
    .max(30, "Subcategory name cannot exceed 30 characters")
    .trim()
});

const categoryIdSchema = z.string().refine(
  val => mongoose.Types.ObjectId.isValid(val), 
  { message: "Invalid category ID format" }
);

module.exports = {
  createCategorySchema,
  addSubcategorySchema,
  categoryIdSchema
};
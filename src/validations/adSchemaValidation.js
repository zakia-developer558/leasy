// validations/ad.validation.js
const { z } = require('zod');
const mongoose = require('mongoose');

const validateCategoryId = async (id) => {
  return mongoose.Types.ObjectId.isValid(id) && 
         await mongoose.model('Category').exists({ _id: id });
};

const validateSubcategory = async (subcategoryId, categoryId) => {
  if (!subcategoryId) return true; // subcategory is optional
  
  // Check if category exists and contains this subcategory
  const category = await mongoose.model('Category').findOne({
    _id: categoryId,
    'subcategories._id': subcategoryId
  });
  
  return !!category;
};

const createAdSchema = z.object({
  title: z.string().min(5).max(100),
  description: z.string().max(500).optional(),
  price: z.number().min(0).optional(),
  photos: z.array(z.string().url()).min(3 ,{ message: "Please add 3 or more photos to proceed" }),
  category: z.string().refine(validateCategoryId, {
    message: "Invalid category ID"
  }),
  isHighlighted: z.boolean().optional().default(false),
  subcategory: z.string().optional()
    .superRefine(async (subcategoryId, ctx) => {
      // Get the category ID from the parent object
      const categoryId = ctx.parent?.category;
      if (!categoryId) return;
      
      const isValid = await validateSubcategory(subcategoryId, categoryId);
      if (!isValid) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Subcategory doesn't belong to this category",
        });
      }
    }),
  pickupAddress: z.string().min(1),
  returnAddress: z.string().min(1),
  isHighlighted: z.boolean().optional().default(false),
  deposit: z.number().min(0).optional(),
  availability: z.object({
    months: z.array(z.string().min(1)).min(1), 
    daysOfWeek: z.array(z.string()),
    pickupHours: z.string(),
    returnHours: z.string()
  }),
  loanPeriod: z.string(),
  paymentMethods: z.array(z.string()).min(1),
  contractTemplate: z.string().url().optional(),
  loanCondition: z.string().url().optional()
});

const updateAdSchema = z.object({
  title: z.string().min(5).max(100).optional(),
  description: z.string().max(500).optional(),
  price: z.number().min(0).optional(),
  photos: z.array(z.string().url()).min(3).optional(),
  category: z.string()
    .refine(validateCategoryId, { message: "Invalid category ID" })
    .optional(),
  subcategory: z.string().optional()
    .superRefine(async (subcategoryId, ctx) => {
      const categoryId = ctx.parent?.category;
      if (!categoryId) return;
      const isValid = await validateSubcategory(subcategoryId, categoryId);
      if (!isValid) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Subcategory doesn't belong to this category",
        });
      }
    }),
  pickupAddress: z.string().min(1).optional(),
  returnAddress: z.string().min(1).optional(),
  isHighlighted: z.boolean().optional(),
  deposit: z.number().min(0).optional(),
  availability: z.object({
    months: z.array(z.string().min(1)).min(1).optional(),
    daysOfWeek: z.array(z.string()).optional(),
    pickupHours: z.string().optional(),
    returnHours: z.string().optional()
  }).optional(),
  loanPeriod: z.string().optional(),
  paymentMethods: z.string().min(1).optional(),
  contractTemplate: z.string().url().optional(),
  loanCondition: z.string().url().optional()
}).refine(data => Object.keys(data).length > 0, {
  message: "At least one field must be provided for update"
});

// Extract TypeScript type (optional but useful)
const CreateAdInput = createAdSchema;
module.exports = { createAdSchema, CreateAdInput,updateAdSchema };
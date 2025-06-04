const mongoose = require('mongoose');

const SubcategorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  slug: {
    type: String,
    lowercase: true
  }
}, { _id: true }); // Ensure subcategories have their own IDs

const CategorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  slug: {
    type: String,
    unique: true,
    lowercase: true
  },
  icon: String,
  subcategories: [SubcategorySchema], // Array of subcategories
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Auto-generate slugs before saving
CategorySchema.pre('save', function(next) {
  this.slug = this.name.toLowerCase().replace(/\s+/g, '-');
  
  // Generate slugs for subcategories
  if (this.subcategories && this.subcategories.length) {
    this.subcategories = this.subcategories.map(sub => ({
      ...sub,
      slug: sub.name.toLowerCase().replace(/\s+/g, '-')
    }));
  }
  
  next();
});

module.exports = mongoose.model('Category', CategorySchema);
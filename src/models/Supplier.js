const mongoose = require('mongoose');
const { getNextSequence } = require('../utils/autoIncrement');

const supplierSchema = new mongoose.Schema({
  id: {
    type: Number,
    unique: true,
    index: true
  },
  name: {
    type: String,
    required: true,
    trim: true,
    index: true
  },
  contact: {
    type: String,
    trim: true
  },
  address: {
    type: String,
    trim: true
  }
}, {
  timestamps: true
});

// Auto-increment ID before saving (only for new documents)
supplierSchema.pre('save', async function (next) {
  // Only generate ID if it's a new document and ID is not set
  if (this.isNew && !this.id) {
    try {
      this.id = await getNextSequence('Supplier');
    } catch (error) {
      return next(error);
    }
  }
  next();
});

// Index for faster searches
supplierSchema.index({ name: 1 });
supplierSchema.index({ id: 1 }); // Index on auto-increment ID

module.exports = mongoose.model('Supplier', supplierSchema);


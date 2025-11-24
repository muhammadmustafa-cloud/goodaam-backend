const mongoose = require('mongoose');
const { getNextSequence } = require('../utils/autoIncrement');

const customerSchema = new mongoose.Schema({
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
customerSchema.pre('save', async function (next) {
  // Only generate ID if it's a new document and ID is not set
  if (this.isNew && !this.id) {
    try {
      this.id = await getNextSequence('Customer');
    } catch (error) {
      return next(error);
    }
  }
  next();
});

// Index for faster searches
customerSchema.index({ name: 1 });
customerSchema.index({ id: 1 }); // Index on auto-increment ID

module.exports = mongoose.model('Customer', customerSchema);


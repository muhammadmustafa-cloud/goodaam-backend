const mongoose = require('mongoose');
const { getNextSequence } = require('../utils/autoIncrement');

const laadItemSchema = new mongoose.Schema({
  id: {
    type: Number,
    unique: true,
    index: true,
    sparse: true // Allow null values during migration
  },
  laadId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Laad',
    required: true,
    index: true
  },
  itemId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Item',
    required: true,
    index: true
  },
  totalBags: {
    type: Number,
    required: true
  },
  remainingBags: {
    type: Number,
    required: true,
    index: true
  },
  qualityGrade: {
    type: String,
    trim: true
  },
  weightPerBag: {
    type: Number
  },
  ratePerBag: {
    type: Number
  },
  totalAmount: {
    type: Number
  },
  weightFromJacobabad: {
    type: Number
  },
  faisalabadWeight: {
    type: Number
  }
}, {
  timestamps: true
});

// Auto-increment ID before saving (only for new documents)
laadItemSchema.pre('save', async function (next) {
  // Only generate ID if it's a new document and ID is not set
  if (this.isNew && !this.id) {
    try {
      this.id = await getNextSequence('LaadItem');
    } catch (error) {
      return next(error);
    }
  }
  next();
});

// Indexes for faster queries
laadItemSchema.index({ laadId: 1 });
laadItemSchema.index({ itemId: 1 });
laadItemSchema.index({ remainingBags: 1 });
laadItemSchema.index({ id: 1 }); // Index on auto-increment ID

module.exports = mongoose.model('LaadItem', laadItemSchema);


const mongoose = require('mongoose');
const { getNextSequence } = require('../utils/autoIncrement');

const truckArrivalEntrySchema = new mongoose.Schema({
  id: {
    type: Number,
    unique: true,
    index: true,
    sparse: true
  },
  laadNumber: {
    type: String,
    required: true,
    index: true
  },
  laadId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Laad',
    index: true
  },
  supplierId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Supplier',
    index: true
  },
  arrivalDate: {
    type: Date,
    required: true,
    index: true
  },
  gatePassNumber: {
    type: String,
    trim: true
  },
  notes: {
    type: String,
    trim: true
  },
  items: [{
    itemId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Item',
      required: true
    },
    itemName: String,
    itemQuality: String,
    totalBags: {
      type: Number,
      required: true
    },
    qualityGrade: String,
    weightPerBag: Number,
    weightFromJacobabad: Number,
    faisalabadWeight: Number,
    ratePerBag: Number,
    totalAmount: Number,
    status: {
      type: String,
      enum: ['ADDED', 'UPDATED', 'DUPLICATE_SKIPPED'], // UPDATED = combined with existing item
      default: 'ADDED'
    },
    laadItemId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'LaadItem'
    }
  }],
  totalBags: {
    type: Number,
    default: 0
  },
  totalWeight: {
    type: Number,
    default: 0
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    index: true
  }
}, {
  timestamps: true
});

// Auto-increment ID before saving
truckArrivalEntrySchema.pre('save', async function (next) {
  if (this.isNew && !this.id) {
    try {
      this.id = await getNextSequence('TruckArrivalEntry');
    } catch (error) {
      return next(error);
    }
  }
  next();
});

// Indexes
truckArrivalEntrySchema.index({ laadNumber: 1 });
truckArrivalEntrySchema.index({ arrivalDate: -1 });
truckArrivalEntrySchema.index({ createdAt: -1 });

module.exports = mongoose.model('TruckArrivalEntry', truckArrivalEntrySchema);


const mongoose = require('mongoose');
const { getNextSequence } = require('../utils/autoIncrement');

const vehicleSchema = new mongoose.Schema({
  id: {
    type: Number,
    unique: true,
    index: true
  },
  number: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  type: {
    type: String,
    enum: ['TRUCK', 'PICKUP', 'LOADER', 'TRACTOR', 'OTHER'],
    required: true
  },
  capacity: {
    type: Number
  },
  ownerName: {
    type: String,
    trim: true
  },
  ownerContact: {
    type: String,
    trim: true
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Auto-increment ID before saving (only for new documents)
vehicleSchema.pre('save', async function (next) {
  if (this.isNew && !this.id) {
    try {
      this.id = await getNextSequence('Vehicle');
    } catch (error) {
      return next(error);
    }
  }
  next();
});

vehicleSchema.index({ id: 1 }); // Index on auto-increment ID

module.exports = mongoose.model('Vehicle', vehicleSchema);


const mongoose = require('mongoose');

const laadSchema = new mongoose.Schema({
  laadNumber: {
    type: String,
    required: true,
    index: true
  },
  vehicleNumber: {
    type: String,
    trim: true
  },
  vehicleId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Vehicle'
  },
  arrivalDate: {
    type: Date,
    required: true,
    index: true
  },
  gatePassNumber: {
    type: String,
    trim: true,
    index: true
  },
  notes: {
    type: String,
    trim: true
  },
  supplierId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Supplier',
    required: false,
    index: true
  }
}, {
  timestamps: true
});

// Indexes for faster queries
laadSchema.index({ supplierId: 1 });
laadSchema.index({ arrivalDate: -1 });
laadSchema.index({ laadNumber: 1 });

module.exports = mongoose.model('Laad', laadSchema);


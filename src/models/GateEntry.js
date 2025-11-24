const mongoose = require('mongoose');

const gateEntrySchema = new mongoose.Schema({
  truckNumber: {
    type: String,
    required: true,
    index: true
  },
  driverName: {
    type: String,
    trim: true
  },
  arrivalTime: {
    type: Date,
    default: Date.now,
    index: true
  },
  weightMachineReading: {
    type: Number
  },
  grossWeight: {
    type: Number
  },
  tareWeight: {
    type: Number
  },
  netWeight: {
    type: Number
  },
  gatepassNumber: {
    type: String,
    unique: true,
    sparse: true
  },
  status: {
    type: String,
    enum: ['PENDING', 'WEIGHED', 'PROCESSED', 'COMPLETED', 'CANCELLED'],
    default: 'PENDING',
    index: true
  },
  notes: {
    type: String,
    trim: true
  },
  createdById: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  laadId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Laad'
  }
}, {
  timestamps: true
});

// Indexes for faster queries
gateEntrySchema.index({ status: 1 });
gateEntrySchema.index({ arrivalTime: -1 });
gateEntrySchema.index({ createdById: 1 });
gateEntrySchema.index({ truckNumber: 1 });

module.exports = mongoose.model('GateEntry', gateEntrySchema);


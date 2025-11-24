const mongoose = require('mongoose');

/**
 * Counter collection for auto-incrementing IDs
 * Each model has its own counter
 */
const counterSchema = new mongoose.Schema({
  _id: { type: String, required: true }, // Model name (e.g., 'Supplier', 'Customer')
  sequence: { 
    type: Number, 
    default: 0,
    required: true
  }
}, {
  collection: 'counters', // Explicit collection name
  versionKey: false // Disable __v field
});

// Index for faster lookups
counterSchema.index({ _id: 1 }, { unique: true });

module.exports = mongoose.model('Counter', counterSchema);


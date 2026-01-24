const mongoose = require('mongoose');
const { getNextItemSequence } = require('../utils/autoIncrement');

const itemSchema = new mongoose.Schema({
  id: {
    type: Number,
    unique: true,
    index: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  quality: {
    type: String,
    required: true,
    trim: true
  },
  category: {
    type: String,
    enum: ['daal', 'channa'],
    required: true,
    default: 'daal'
  }
}, {
  timestamps: true
});

// Auto-increment ID before saving (only for new documents)
itemSchema.pre('save', async function (next) {
  if (this.isNew && !this.id) {
    try {
      this.id = await getNextItemSequence(this.category || 'daal');
    } catch (error) {
      return next(error);
    }
  }
  next();
});

itemSchema.index({ id: 1 }); // Index on auto-increment ID

module.exports = mongoose.model('Item', itemSchema);


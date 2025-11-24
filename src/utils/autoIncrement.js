const Counter = require('../models/Counter');

/**
 * Get the next sequence number for a model
 * Uses findOneAndUpdate with upsert for atomicity (works without replica set)
 * 
 * @param {string} modelName - Name of the model (e.g., 'Supplier', 'Customer')
 * @returns {Promise<number>} - Next sequence number
 */
async function getNextSequence(modelName) {
  // Use findOneAndUpdate with upsert - atomic operation, no transaction needed
  const counter = await Counter.findByIdAndUpdate(
    modelName,
    { $inc: { sequence: 1 } },
    { 
      new: true, 
      upsert: true, // Create if doesn't exist
      setDefaultsOnInsert: true // Set defaults when creating
    }
  );

  return counter.sequence;
}

/**
 * Reset counter for a model (useful for testing)
 * 
 * @param {string} modelName - Name of the model
 * @param {number} startFrom - Starting number (default: 0)
 */
async function resetCounter(modelName, startFrom = 0) {
  await Counter.findByIdAndUpdate(
    modelName,
    { sequence: startFrom },
    { upsert: true }
  );
}

/**
 * Get current sequence for a model
 * 
 * @param {string} modelName - Name of the model
 * @returns {Promise<number>} - Current sequence number
 */
async function getCurrentSequence(modelName) {
  const counter = await Counter.findById(modelName);
  return counter ? counter.sequence : 0;
}

module.exports = {
  getNextSequence,
  resetCounter,
  getCurrentSequence
};


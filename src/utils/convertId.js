const mongoose = require('mongoose');
const Supplier = require('../models/Supplier');
const Vehicle = require('../models/Vehicle');
const Item = require('../models/Item');
const Customer = require('../models/Customer');
const LaadItem = require('../models/LaadItem');

/**
 * Convert numeric ID to MongoDB ObjectId
 * Supports both numeric IDs (auto-increment) and ObjectId strings
 * 
 * @param {number|string} id - Numeric ID or ObjectId string
 * @param {string} modelName - Model name ('Supplier', 'Vehicle', 'Item', 'Customer')
 * @returns {Promise<mongoose.Types.ObjectId|null>} - MongoDB ObjectId or null if not found
 */
async function convertToObjectId(id, modelName) {
  // If already a valid ObjectId, return it
  if (mongoose.Types.ObjectId.isValid(id) && typeof id === 'string' && id.length === 24) {
    return new mongoose.Types.ObjectId(id);
  }

  // If numeric ID, find the document and get its _id
  if (typeof id === 'number' || /^\d+$/.test(id)) {
    let Model;
    switch (modelName) {
      case 'Supplier':
        Model = Supplier;
        break;
      case 'Vehicle':
        Model = Vehicle;
        break;
      case 'Item':
        Model = Item;
        break;
      case 'Customer':
        Model = Customer;
        break;
      case 'LaadItem':
        Model = LaadItem;
        break;
      default:
        throw new Error(`Unknown model: ${modelName}`);
    }

    const doc = await Model.findOne({ id: parseInt(id) });
    if (!doc) {
      throw new Error(`${modelName} with id ${id} not found`);
    }
    return doc._id;
  }

  // If invalid format, throw error
  throw new Error(`Invalid ID format: ${id} for model ${modelName}`);
}

/**
 * Convert multiple IDs to ObjectIds
 * 
 * @param {Array<number|string>} ids - Array of numeric IDs or ObjectId strings
 * @param {string} modelName - Model name
 * @returns {Promise<Array<mongoose.Types.ObjectId>>} - Array of ObjectIds
 */
async function convertIdsToObjectIds(ids, modelName) {
  return Promise.all(ids.map(id => convertToObjectId(id, modelName)));
}

module.exports = {
  convertToObjectId,
  convertIdsToObjectIds
};


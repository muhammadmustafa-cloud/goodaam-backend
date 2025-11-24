const mongoose = require('mongoose');

/**
 * Middleware to validate MongoDB ObjectId in route parameters
 * Works with any parameter name ending with 'Id' or just 'id'
 * For PUT/PATCH requests, allows ID from body as fallback
 */
const validateObjectId = (req, res, next) => {
  // Find the ID parameter (check common patterns: id, *Id, *ID)
  let idParam = null;
  const params = req.params;
  
  // Check for 'id' first (most common)
  if (params.id) {
    idParam = params.id;
  } else {
    // Check for any parameter ending with 'Id' or 'ID'
    for (const key in params) {
      if (key.toLowerCase().endsWith('id')) {
        idParam = params[key];
        break;
      }
    }
  }
  
  // Check if ID is provided
  if (!idParam || idParam === 'undefined' || idParam === 'null') {
    // For PUT/PATCH requests, allow ID from body (controller will handle it)
    if ((req.method === 'PUT' || req.method === 'PATCH') && (req.body.id || req.body._id)) {
      return next(); // Let controller handle ID from body
    }
    
    return res.status(400).json({
      success: false,
      message: 'ID is required and cannot be undefined. Provide ID in URL path or request body (for PUT/PATCH).'
    });
  }

  // Check if ID is valid (either MongoDB ObjectId or numeric auto-increment ID)
  const isValidObjectId = mongoose.Types.ObjectId.isValid(idParam);
  const isValidNumericId = /^\d+$/.test(idParam);
  
  if (!isValidObjectId && !isValidNumericId) {
    return res.status(400).json({
      success: false,
      message: `Invalid ID format: "${idParam}". Expected a valid MongoDB ObjectId or numeric ID.`
    });
  }

  next();
};

module.exports = { validateObjectId };


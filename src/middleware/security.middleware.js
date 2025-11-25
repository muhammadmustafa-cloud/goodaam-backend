const { body, validationResult } = require('express-validator');

/**
 * Input sanitization middleware to prevent XSS attacks
 */
const sanitizeInput = (req, res, next) => {
  // Sanitize string inputs
  const sanitizeObject = (obj) => {
    if (typeof obj === 'string') {
      return obj.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
    }
    // Preserve arrays as arrays
    if (Array.isArray(obj)) {
      return obj.map(item => sanitizeObject(item));
    }
    if (typeof obj === 'object' && obj !== null) {
      const sanitized = {};
      for (const key in obj) {
        sanitized[key] = sanitizeObject(obj[key]);
      }
      return sanitized;
    }
    return obj;
  };

  if (req.body) {
    req.body = sanitizeObject(req.body);
  }
  if (req.query) {
    req.query = sanitizeObject(req.query);
  }
  if (req.params) {
    req.params = sanitizeObject(req.params);
  }

  next();
};

/**
 * Validation middleware factory
 */
const validate = (validations) => {
  return async (req, res, next) => {
    // Run all validations
    for (const validation of validations) {
      await validation.run(req);
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array().map(err => ({
          field: err.path,
          message: err.msg,
          value: err.value
        }))
      });
    }

    next();
  };
};

// Specific validation chains for different entities
const validateCustomer = validate([
  body('name')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be between 2 and 100 characters'),
  body('contact')
    .optional()
    .trim()
    .isLength({ max: 20 })
    .withMessage('Contact must be maximum 20 characters'),
  body('address')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('Address must be maximum 200 characters')
]);

const validateSupplier = validate([
  body('name')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be between 2 and 100 characters'),
  body('contact')
    .optional()
    .trim()
    .isLength({ max: 20 })
    .withMessage('Contact must be maximum 20 characters'),
  body('address')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('Address must be maximum 200 characters')
]);

const validateVehicle = validate([
  body('number')
    .trim()
    .isLength({ min: 3, max: 20 })
    .withMessage('Vehicle number must be between 3 and 20 characters'),
  body('type')
    .isIn(['TRUCK', 'PICKUP', 'LOADER', 'TRACTOR', 'OTHER'])
    .withMessage('Invalid vehicle type'),
  body('capacity')
    .optional()
    .isNumeric()
    .withMessage('Capacity must be a number'),
  body('ownerName')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Owner name must be maximum 100 characters'),
  body('ownerContact')
    .optional()
    .trim()
    .isLength({ max: 20 })
    .withMessage('Owner contact must be maximum 20 characters')
]);

const validateItem = validate([
  body('name')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Item name must be between 2 and 100 characters'),
  body('quality')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('Quality must be maximum 50 characters'),
  body('bagWeight')
    .isNumeric()
    .withMessage('Bag weight must be a number')
]);

const validateLaad = validate([
  body('laadNumber')
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Laad number must be between 1 and 50 characters'),
  body('supplierId')
    .isInt({ min: 1 })
    .withMessage('Valid supplier ID is required'),
  body('vehicleId')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Valid vehicle ID is required'),
  body('arrivalDate')
    .isISO8601()
    .withMessage('Valid arrival date is required'),
  body('notes')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Notes must be maximum 500 characters')
]);

const validateSale = validate([
  body('customerId')
    .isInt({ min: 1 })
    .withMessage('Valid customer ID is required'),
  body('laadItemId')
    .notEmpty()
    .withMessage('Valid laad item ID is required'),
  body('bagsSold')
    .isInt({ min: 1 })
    .withMessage('Bags sold must be a positive integer'),
  body('ratePerBag')
    .optional({ nullable: true, checkFalsy: true })
    .isFloat({ min: 0 })
    .withMessage('Rate per bag must be a positive number if provided')
]);

module.exports = {
  sanitizeInput,
  validate,
  validateCustomer,
  validateSupplier,
  validateVehicle,
  validateItem,
  validateLaad,
  validateSale
};
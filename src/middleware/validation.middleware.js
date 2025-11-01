const { body, param, query, validationResult } = require('express-validator');

/**
 * Validation middleware to check for validation errors
 */
const validate = (req, res, next) => {
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

/**
 * Validation rules for suppliers
 */
const supplierValidation = {
  create: [
    body('name')
      .trim()
      .notEmpty().withMessage('Supplier name is required')
      .isLength({ min: 2, max: 100 }).withMessage('Name must be between 2 and 100 characters'),
    body('contact')
      .optional()
      .trim()
      .matches(/^[\d\s\-+()]+$/).withMessage('Invalid contact format'),
    body('address')
      .optional()
      .trim()
      .isLength({ max: 500 }).withMessage('Address must not exceed 500 characters'),
    validate
  ],
  update: [
    param('id').isInt().withMessage('Invalid supplier ID'),
    body('name')
      .optional()
      .trim()
      .isLength({ min: 2, max: 100 }).withMessage('Name must be between 2 and 100 characters'),
    body('contact')
      .optional()
      .trim()
      .matches(/^[\d\s\-+()]+$/).withMessage('Invalid contact format'),
    body('address')
      .optional()
      .trim()
      .isLength({ max: 500 }).withMessage('Address must not exceed 500 characters'),
    validate
  ]
};

/**
 * Validation rules for customers
 */
const customerValidation = {
  create: [
    body('name')
      .trim()
      .notEmpty().withMessage('Customer name is required')
      .isLength({ min: 2, max: 100 }).withMessage('Name must be between 2 and 100 characters'),
    body('contact')
      .optional()
      .trim()
      .matches(/^[\d\s\-+()]+$/).withMessage('Invalid contact format'),
    body('address')
      .optional()
      .trim()
      .isLength({ max: 500 }).withMessage('Address must not exceed 500 characters'),
    validate
  ],
  update: [
    param('id').isInt().withMessage('Invalid customer ID'),
    body('name')
      .optional()
      .trim()
      .isLength({ min: 2, max: 100 }).withMessage('Name must be between 2 and 100 characters'),
    validate
  ]
};

/**
 * Validation rules for vehicles
 */
const vehicleValidation = {
  create: [
    body('number')
      .trim()
      .notEmpty().withMessage('Vehicle number is required')
      .isLength({ min: 2, max: 50 }).withMessage('Vehicle number must be between 2 and 50 characters'),
    body('type')
      .notEmpty().withMessage('Vehicle type is required')
      .isIn(['TRUCK', 'PICKUP', 'LOADER', 'TRACTOR', 'OTHER']).withMessage('Invalid vehicle type'),
    body('capacity')
      .optional()
      .isInt({ min: 0 }).withMessage('Capacity must be a positive number'),
    body('ownerName')
      .optional()
      .trim()
      .isLength({ max: 100 }).withMessage('Owner name must not exceed 100 characters'),
    validate
  ],
  update: [
    param('id').isInt().withMessage('Invalid vehicle ID'),
    body('type')
      .optional()
      .isIn(['TRUCK', 'PICKUP', 'LOADER', 'TRACTOR', 'OTHER']).withMessage('Invalid vehicle type'),
    body('capacity')
      .optional()
      .isInt({ min: 0 }).withMessage('Capacity must be a positive number'),
    validate
  ]
};

/**
 * Validation rules for items
 */
const itemValidation = {
  create: [
    body('name')
      .trim()
      .notEmpty().withMessage('Item name is required')
      .isLength({ min: 2, max: 100 }).withMessage('Name must be between 2 and 100 characters'),
    body('category')
      .optional()
      .trim()
      .isLength({ max: 50 }).withMessage('Category must not exceed 50 characters'),
    body('unit')
      .optional()
      .trim()
      .isLength({ max: 20 }).withMessage('Unit must not exceed 20 characters'),
    validate
  ]
};

/**
 * Validation rules for laads (truck arrivals)
 */
const laadValidation = {
  create: [
    body('laadNumber')
      .trim()
      .notEmpty().withMessage('Laad number is required')
      .isLength({ min: 2, max: 50 }).withMessage('Laad number must be between 2 and 50 characters'),
    body('supplierId')
      .isInt({ min: 1 }).withMessage('Valid supplier ID is required'),
    body('arrivalDate')
      .notEmpty().withMessage('Arrival date is required')
      .isISO8601().withMessage('Invalid date format'),
    body('items')
      .isArray({ min: 1 }).withMessage('At least one item is required'),
    body('items.*.itemId')
      .isInt({ min: 1 }).withMessage('Valid item ID is required'),
    body('items.*.totalBags')
      .isInt({ min: 1 }).withMessage('Total bags must be at least 1'),
    body('items.*.weightPerBag')
      .optional()
      .isFloat({ min: 0 }).withMessage('Weight per bag must be positive'),
    body('items.*.ratePerBag')
      .optional()
      .isFloat({ min: 0 }).withMessage('Rate per bag must be positive'),
    validate
  ]
};

/**
 * Validation rules for sales
 */
const saleValidation = {
  create: [
    body('customerId')
      .isInt({ min: 1 }).withMessage('Valid customer ID is required'),
    body('laadItemId')
      .isInt({ min: 1 }).withMessage('Valid laad item ID is required'),
    body('bagsSold')
      .isInt({ min: 1 }).withMessage('Bags sold must be at least 1'),
    body('ratePerBag')
      .optional()
      .isFloat({ min: 0 }).withMessage('Rate per bag must be positive'),
    validate
  ],
  createMix: [
    body('customerId')
      .isInt({ min: 1 }).withMessage('Valid customer ID is required'),
    body('items')
      .isArray({ min: 1 }).withMessage('At least one item is required'),
    body('items.*.laadItemId')
      .isInt({ min: 1 }).withMessage('Valid laad item ID is required'),
    body('items.*.bagsSold')
      .isInt({ min: 1 }).withMessage('Bags sold must be at least 1'),
    validate
  ]
};

/**
 * ID parameter validation
 */
const idValidation = [
  param('id').isInt({ min: 1 }).withMessage('Invalid ID'),
  validate
];

module.exports = {
  validate,
  supplierValidation,
  customerValidation,
  vehicleValidation,
  itemValidation,
  laadValidation,
  saleValidation,
  idValidation
};



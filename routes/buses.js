/**
 * Bus Routes
 * Defines bus management endpoints with role-based access control
 */

const express = require('express');
const { body, query } = require('express-validator');
const {
  getAllBuses,
  getBusById,
  searchBuses,
  createBus,
  updateBus,
  deleteBus,
  getBusStats
} = require('../controllers/busController');
const { protect } = require('../middleware/auth');
const { adminOnly } = require('../middleware/roleAuth');

const router = express.Router();

/**
 * @route   GET /api/buses/stats
 * @desc    Get bus statistics
 * @access  Private/Admin
 */
router.get('/stats', protect, adminOnly, getBusStats);

/**
 * @route   GET /api/buses/search
 * @desc    Search buses by route and date
 * @access  Public
 */
router.get('/search', [
  query('from')
    .notEmpty()
    .withMessage('From city is required')
    .trim(),
  query('to')
    .notEmpty()
    .withMessage('To city is required')
    .trim(),
  query('date')
    .notEmpty()
    .withMessage('Travel date is required')
    .isISO8601()
    .withMessage('Date must be in YYYY-MM-DD format')
], searchBuses);

/**
 * @route   GET /api/buses
 * @desc    Get all buses with filtering
 * @access  Public
 */
router.get('/', [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  query('status')
    .optional()
    .isIn(['active', 'inactive', 'maintenance'])
    .withMessage('Status must be active, inactive, or maintenance'),
  query('busType')
    .optional()
    .isIn(['AC', 'Non-AC', 'Sleeper', 'Semi-Sleeper', 'Volvo', 'Luxury'])
    .withMessage('Invalid bus type')
], getAllBuses);

/**
 * @route   POST /api/buses
 * @desc    Create new bus
 * @access  Private/Admin
 */
router.post('/', protect, adminOnly, [
  body('busNumber')
    .notEmpty()
    .withMessage('Bus number is required')
    .matches(/^[A-Z0-9-]+$/)
    .withMessage('Bus number should contain only letters, numbers, and hyphens')
    .trim(),
  body('route.from')
    .notEmpty()
    .withMessage('Origin city is required')
    .trim(),
  body('route.to')
    .notEmpty()
    .withMessage('Destination city is required')
    .trim(),
  body('capacity')
    .isInt({ min: 1, max: 100 })
    .withMessage('Capacity must be between 1 and 100'),
  body('fare')
    .isNumeric({ min: 0 })
    .withMessage('Fare must be a positive number'),
  body('departureTime')
    .matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .withMessage('Departure time must be in HH:MM format'),
  body('arrivalTime')
    .matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .withMessage('Arrival time must be in HH:MM format'),
  body('operatingDays')
    .isArray({ min: 1 })
    .withMessage('At least one operating day is required'),
  body('operatingDays.*')
    .isIn(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'])
    .withMessage('Invalid day name'),
  body('busType')
    .isIn(['AC', 'Non-AC', 'Sleeper', 'Semi-Sleeper', 'Volvo', 'Luxury'])
    .withMessage('Invalid bus type'),
  body('amenities')
    .optional()
    .isArray()
    .withMessage('Amenities must be an array'),
  body('amenities.*')
    .optional()
    .isIn(['AC', 'WiFi', 'Charging Point', 'Entertainment', 'Snacks', 'Water Bottle'])
    .withMessage('Invalid amenity'),
  body('driver.name')
    .notEmpty()
    .withMessage('Driver name is required')
    .trim(),
  body('driver.license')
    .notEmpty()
    .withMessage('Driver license is required')
    .trim(),
  body('driver.phone')
    .matches(/^\d{10}$/)
    .withMessage('Driver phone must be a valid 10-digit number')
], createBus);

/**
 * @route   GET /api/buses/:id
 * @desc    Get single bus by ID
 * @access  Public
 */
router.get('/:id', getBusById);

/**
 * @route   PUT /api/buses/:id
 * @desc    Update bus
 * @access  Private/Admin
 */
router.put('/:id', protect, adminOnly, [
  body('busNumber')
    .optional()
    .matches(/^[A-Z0-9-]+$/)
    .withMessage('Bus number should contain only letters, numbers, and hyphens')
    .trim(),
  body('route.from')
    .optional()
    .trim(),
  body('route.to')
    .optional()
    .trim(),
  body('capacity')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Capacity must be between 1 and 100'),
  body('availableSeats')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Available seats must be a non-negative number'),
  body('fare')
    .optional()
    .isNumeric({ min: 0 })
    .withMessage('Fare must be a positive number'),
  body('departureTime')
    .optional()
    .matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .withMessage('Departure time must be in HH:MM format'),
  body('arrivalTime')
    .optional()
    .matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .withMessage('Arrival time must be in HH:MM format'),
  body('operatingDays')
    .optional()
    .isArray({ min: 1 })
    .withMessage('At least one operating day is required'),
  body('operatingDays.*')
    .optional()
    .isIn(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'])
    .withMessage('Invalid day name'),
  body('busType')
    .optional()
    .isIn(['AC', 'Non-AC', 'Sleeper', 'Semi-Sleeper', 'Volvo', 'Luxury'])
    .withMessage('Invalid bus type'),
  body('status')
    .optional()
    .isIn(['active', 'inactive', 'maintenance'])
    .withMessage('Status must be active, inactive, or maintenance'),
  body('amenities')
    .optional()
    .isArray()
    .withMessage('Amenities must be an array'),
  body('amenities.*')
    .optional()
    .isIn(['AC', 'WiFi', 'Charging Point', 'Entertainment', 'Snacks', 'Water Bottle'])
    .withMessage('Invalid amenity'),
  body('driver.name')
    .optional()
    .trim(),
  body('driver.license')
    .optional()
    .trim(),
  body('driver.phone')
    .optional()
    .matches(/^\d{10}$/)
    .withMessage('Driver phone must be a valid 10-digit number')
], updateBus);

/**
 * @route   DELETE /api/buses/:id
 * @desc    Delete bus
 * @access  Private/Admin
 */
router.delete('/:id', protect, adminOnly, deleteBus);

module.exports = router;
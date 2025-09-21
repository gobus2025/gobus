/**
 * Booking Routes
 * Defines booking management endpoints with validation and access control
 */

const express = require('express');
const { body, query } = require('express-validator');
const {
  createBooking,
  getUserBookings,
  getBookingById,
  confirmBooking,
  cancelBooking,
  getAllBookings,
  getBookingStats
} = require('../controllers/bookingController');
const { protect } = require('../middleware/auth');
const { adminOnly, ownerOrAdmin } = require('../middleware/roleAuth');

const router = express.Router();

/**
 * @route   GET /api/bookings/stats
 * @desc    Get booking statistics
 * @access  Private/Admin
 */
router.get('/stats', protect, adminOnly, getBookingStats);

/**
 * @route   GET /api/bookings
 * @desc    Get all bookings (Admin only)
 * @access  Private/Admin
 */
router.get('/', protect, adminOnly, [
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
    .isIn(['pending', 'confirmed', 'cancelled', 'completed'])
    .withMessage('Invalid status'),
  query('dateFrom')
    .optional()
    .isISO8601()
    .withMessage('Date from must be in YYYY-MM-DD format'),
  query('dateTo')
    .optional()
    .isISO8601()
    .withMessage('Date to must be in YYYY-MM-DD format')
], getAllBookings);

/**
 * @route   POST /api/bookings
 * @desc    Create new booking
 * @access  Private
 */
router.post('/', protect, [
  body('busId')
    .isMongoId()
    .withMessage('Invalid bus ID'),
  body('passengerDetails')
    .isArray({ min: 1 })
    .withMessage('At least one passenger detail is required'),
  body('passengerDetails.*.name')
    .notEmpty()
    .withMessage('Passenger name is required')
    .isLength({ min: 2, max: 50 })
    .withMessage('Passenger name must be between 2 and 50 characters')
    .trim(),
  body('passengerDetails.*.age')
    .isInt({ min: 1, max: 120 })
    .withMessage('Passenger age must be between 1 and 120'),
  body('passengerDetails.*.gender')
    .isIn(['male', 'female', 'other'])
    .withMessage('Gender must be male, female, or other'),
  body('passengerDetails.*.seatNumber')
    .notEmpty()
    .withMessage('Seat number is required for each passenger')
    .trim(),
  body('travelDate')
    .isISO8601()
    .withMessage('Travel date must be in YYYY-MM-DD format'),
  body('paymentMethod')
    .isIn(['cash', 'card', 'upi', 'wallet', 'netbanking'])
    .withMessage('Invalid payment method'),
  body('contactInfo.phone')
    .matches(/^\d{10}$/)
    .withMessage('Contact phone must be a valid 10-digit number'),
  body('contactInfo.email')
    .isEmail()
    .withMessage('Contact email must be a valid email address')
    .normalizeEmail()
], createBooking);

/**
 * @route   GET /api/bookings/user/:userId
 * @desc    Get user bookings
 * @access  Private (User can access own bookings, Admin can access any)
 */
router.get('/user/:userId', protect, ownerOrAdmin(), [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 50 })
    .withMessage('Limit must be between 1 and 50'),
  query('status')
    .optional()
    .isIn(['pending', 'confirmed', 'cancelled', 'completed'])
    .withMessage('Invalid status')
], getUserBookings);

/**
 * @route   GET /api/bookings/:id
 * @desc    Get single booking by ID
 * @access  Private (Owner or Admin)
 */
router.get('/:id', protect, getBookingById);

/**
 * @route   PUT /api/bookings/:id/confirm
 * @desc    Confirm booking
 * @access  Private/Admin
 */
router.put('/:id/confirm', protect, adminOnly, confirmBooking);

/**
 * @route   DELETE /api/bookings/:id
 * @desc    Cancel booking
 * @access  Private (Owner or Admin)
 */
router.delete('/:id', protect, [
  body('reason')
    .optional()
    .isLength({ max: 200 })
    .withMessage('Cancellation reason must not exceed 200 characters')
    .trim()
], cancelBooking);

module.exports = router;
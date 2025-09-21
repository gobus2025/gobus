/**
 * Booking Controller
 * Handles booking management operations with seat availability validation
 */

const { validationResult } = require('express-validator');
const Booking = require('../models/Booking');
const Bus = require('../models/Bus');
const User = require('../models/User');

/**
 * Create new booking
 * @route POST /api/bookings
 * @access Private
 */
const createBooking = async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        status: 'error',
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const {
      busId,
      passengerDetails,
      travelDate,
      paymentMethod,
      contactInfo
    } = req.body;

    // Validate bus exists and is active
    const bus = await Bus.findById(busId);
    if (!bus) {
      return res.status(404).json({
        status: 'error',
        message: 'Bus not found'
      });
    }

    if (bus.status !== 'active') {
      return res.status(400).json({
        status: 'error',
        message: 'Bus is not available for booking'
      });
    }

    // Validate travel date
    const travelDateTime = new Date(travelDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (travelDateTime < today) {
      return res.status(400).json({
        status: 'error',
        message: 'Travel date cannot be in the past'
      });
    }

    // Check if bus operates on the requested day
    const dayName = travelDateTime.toLocaleDateString('en-US', { weekday: 'long' });
    if (!bus.operatingDays.includes(dayName)) {
      return res.status(400).json({
        status: 'error',
        message: `Bus does not operate on ${dayName}. Operating days: ${bus.operatingDays.join(', ')}`
      });
    }

    const seatCount = passengerDetails.length;

    // Check seat availability
    if (bus.availableSeats < seatCount) {
      return res.status(400).json({
        status: 'error',
        message: `Only ${bus.availableSeats} seats available. You requested ${seatCount} seats.`
      });
    }

    // Check for seat conflicts (if seat numbers are provided)
    const requestedSeats = passengerDetails.map(p => p.seatNumber).filter(Boolean);
    if (requestedSeats.length > 0) {
      const seatAvailable = await Booking.checkSeatAvailability(busId, travelDate, requestedSeats);
      if (!seatAvailable) {
        return res.status(400).json({
          status: 'error',
          message: 'One or more requested seats are already booked'
        });
      }
    }

    // Calculate total amount
    const totalAmount = bus.fare * seatCount;

    // Create booking
    const bookingData = {
      userId: req.user._id,
      busId,
      passengerDetails,
      travelDate,
      totalAmount,
      seatCount,
      paymentMethod,
      contactInfo,
      status: 'pending'
    };

    const booking = await Booking.create(bookingData);

    // Reserve seats on the bus
    await bus.bookSeats(seatCount);

    // Populate booking with bus and user details
    await booking.populate([
      {
        path: 'busId',
        select: 'busNumber route departureTime arrivalTime busType'
      },
      {
        path: 'userId',
        select: 'name email'
      }
    ]);

    res.status(201).json({
      status: 'success',
      message: 'Booking created successfully',
      data: {
        booking
      }
    });

  } catch (error) {
    console.error('Create booking error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error while creating booking',
      ...(process.env.NODE_ENV === 'development' && { error: error.message })
    });
  }
};

/**
 * Get user bookings
 * @route GET /api/bookings/user/:userId
 * @access Private (User can access own bookings, Admin can access any)
 */
const getUserBookings = async (req, res) => {
  try {
    const userId = req.params.userId;
    const {
      page = 1,
      limit = 10,
      status,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    // Check authorization (user can only access own bookings unless admin)
    if (req.user.role !== 'admin' && req.user._id.toString() !== userId) {
      return res.status(403).json({
        status: 'error',
        message: 'Access denied. You can only view your own bookings.'
      });
    }

    // Validate user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found'
      });
    }

    const options = {
      limit: parseInt(limit),
      skip: (parseInt(page) - 1) * parseInt(limit),
      status: status
    };

    // Get bookings
    const bookings = await Booking.getUserBookings(userId, options);

    // Get total count for pagination
    const filter = { userId };
    if (status) filter.status = status;
    
    const total = await Booking.countDocuments(filter);
    const totalPages = Math.ceil(total / parseInt(limit));

    res.status(200).json({
      status: 'success',
      data: {
        bookings,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalBookings: total,
          hasNext: parseInt(page) < totalPages,
          hasPrev: parseInt(page) > 1
        }
      }
    });

  } catch (error) {
    console.error('Get user bookings error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error while fetching bookings',
      ...(process.env.NODE_ENV === 'development' && { error: error.message })
    });
  }
};

/**
 * Get single booking by ID
 * @route GET /api/bookings/:id
 * @access Private
 */
const getBookingById = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id)
      .populate('busId', 'busNumber route departureTime arrivalTime busType amenities')
      .populate('userId', 'name email');

    if (!booking) {
      return res.status(404).json({
        status: 'error',
        message: 'Booking not found'
      });
    }

    // Check authorization
    if (req.user.role !== 'admin' && booking.userId._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        status: 'error',
        message: 'Access denied. You can only view your own bookings.'
      });
    }

    res.status(200).json({
      status: 'success',
      data: {
        booking
      }
    });

  } catch (error) {
    console.error('Get booking by ID error:', error);
    
    if (error.name === 'CastError') {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid booking ID format'
      });
    }

    res.status(500).json({
      status: 'error',
      message: 'Server error while fetching booking',
      ...(process.env.NODE_ENV === 'development' && { error: error.message })
    });
  }
};

/**
 * Confirm booking (Admin only or payment gateway callback)
 * @route PUT /api/bookings/:id/confirm
 * @access Private/Admin
 */
const confirmBooking = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);

    if (!booking) {
      return res.status(404).json({
        status: 'error',
        message: 'Booking not found'
      });
    }

    if (booking.status !== 'pending') {
      return res.status(400).json({
        status: 'error',
        message: `Booking cannot be confirmed. Current status: ${booking.status}`
      });
    }

    // Confirm booking
    await booking.confirmBooking();

    await booking.populate([
      {
        path: 'busId',
        select: 'busNumber route departureTime arrivalTime'
      },
      {
        path: 'userId',
        select: 'name email'
      }
    ]);

    res.status(200).json({
      status: 'success',
      message: 'Booking confirmed successfully',
      data: {
        booking
      }
    });

  } catch (error) {
    console.error('Confirm booking error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error while confirming booking',
      ...(process.env.NODE_ENV === 'development' && { error: error.message })
    });
  }
};

/**
 * Cancel booking
 * @route DELETE /api/bookings/:id
 * @access Private
 */
const cancelBooking = async (req, res) => {
  try {
    const { reason } = req.body;

    const booking = await Booking.findById(req.params.id)
      .populate('busId', 'busNumber route');

    if (!booking) {
      return res.status(404).json({
        status: 'error',
        message: 'Booking not found'
      });
    }

    // Check authorization
    if (req.user.role !== 'admin' && booking.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        status: 'error',
        message: 'Access denied. You can only cancel your own bookings.'
      });
    }

    if (booking.status === 'cancelled') {
      return res.status(400).json({
        status: 'error',
        message: 'Booking is already cancelled'
      });
    }

    if (booking.status === 'completed') {
      return res.status(400).json({
        status: 'error',
        message: 'Cannot cancel completed booking'
      });
    }

    // Cancel booking
    const cancelledBooking = await booking.cancelBooking(reason || 'User requested cancellation');

    res.status(200).json({
      status: 'success',
      message: 'Booking cancelled successfully',
      data: {
        booking: cancelledBooking,
        refundAmount: cancelledBooking.refundAmount,
        refundStatus: cancelledBooking.refundAmount > 0 ? 'Refund will be processed' : 'No refund applicable'
      }
    });

  } catch (error) {
    console.error('Cancel booking error:', error);
    
    if (error.message.includes('cannot be cancelled')) {
      return res.status(400).json({
        status: 'error',
        message: error.message
      });
    }

    res.status(500).json({
      status: 'error',
      message: 'Server error while cancelling booking',
      ...(process.env.NODE_ENV === 'development' && { error: error.message })
    });
  }
};

/**
 * Get all bookings (Admin only)
 * @route GET /api/bookings
 * @access Private/Admin
 */
const getAllBookings = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      status,
      busId,
      userId,
      dateFrom,
      dateTo,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    // Build filter
    const filter = {};
    if (status) filter.status = status;
    if (busId) filter.busId = busId;
    if (userId) filter.userId = userId;
    
    if (dateFrom || dateTo) {
      filter.travelDate = {};
      if (dateFrom) filter.travelDate.$gte = new Date(dateFrom);
      if (dateTo) filter.travelDate.$lte = new Date(dateTo);
    }

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sortDirection = sortOrder === 'desc' ? -1 : 1;

    // Get bookings
    const bookings = await Booking.find(filter)
      .populate('busId', 'busNumber route departureTime arrivalTime')
      .populate('userId', 'name email')
      .sort({ [sortBy]: sortDirection })
      .limit(parseInt(limit))
      .skip(skip);

    // Get total count
    const total = await Booking.countDocuments(filter);
    const totalPages = Math.ceil(total / parseInt(limit));

    res.status(200).json({
      status: 'success',
      data: {
        bookings,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalBookings: total,
          hasNext: parseInt(page) < totalPages,
          hasPrev: parseInt(page) > 1
        }
      }
    });

  } catch (error) {
    console.error('Get all bookings error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error while fetching bookings',
      ...(process.env.NODE_ENV === 'development' && { error: error.message })
    });
  }
};

/**
 * Get booking statistics (Admin only)
 * @route GET /api/bookings/stats
 * @access Private/Admin
 */
const getBookingStats = async (req, res) => {
  try {
    const stats = await Booking.aggregate([
      {
        $group: {
          _id: null,
          totalBookings: { $sum: 1 },
          confirmedBookings: {
            $sum: { $cond: [{ $eq: ['$status', 'confirmed'] }, 1, 0] }
          },
          cancelledBookings: {
            $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] }
          },
          pendingBookings: {
            $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] }
          },
          totalRevenue: { $sum: '$totalAmount' },
          totalRefunds: { $sum: '$refundAmount' },
          averageBookingValue: { $avg: '$totalAmount' },
          totalSeatsBooked: { $sum: '$seatCount' }
        }
      }
    ]);

    // Get daily bookings for the last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const dailyStats = await Booking.aggregate([
      {
        $match: {
          createdAt: { $gte: thirtyDaysAgo }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
            day: { $dayOfMonth: '$createdAt' }
          },
          bookings: { $sum: 1 },
          revenue: { $sum: '$totalAmount' }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } }
    ]);

    // Get top routes by bookings
    const topRoutes = await Booking.aggregate([
      {
        $lookup: {
          from: 'buses',
          localField: 'busId',
          foreignField: '_id',
          as: 'bus'
        }
      },
      { $unwind: '$bus' },
      {
        $group: {
          _id: {
            from: '$bus.route.from',
            to: '$bus.route.to'
          },
          bookings: { $sum: 1 },
          revenue: { $sum: '$totalAmount' }
        }
      },
      { $sort: { bookings: -1 } },
      { $limit: 10 }
    ]);

    res.status(200).json({
      status: 'success',
      data: {
        overview: stats[0] || {},
        dailyStats,
        topRoutes
      }
    });

  } catch (error) {
    console.error('Get booking stats error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error while fetching booking statistics',
      ...(process.env.NODE_ENV === 'development' && { error: error.message })
    });
  }
};

module.exports = {
  createBooking,
  getUserBookings,
  getBookingById,
  confirmBooking,
  cancelBooking,
  getAllBookings,
  getBookingStats
};
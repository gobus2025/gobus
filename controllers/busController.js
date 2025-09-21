/**
 * Bus Controller
 * Handles bus management operations (CRUD) with admin access control
 */

const { validationResult } = require('express-validator');
const Bus = require('../models/Bus');

/**
 * Get all buses with optional filtering
 * @route GET /api/buses
 * @access Public
 */
const getAllBuses = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      status,
      busType,
      from,
      to,
      sortBy = 'departureTime',
      sortOrder = 'asc'
    } = req.query;

    // Build filter object
    const filter = {};
    if (status) filter.status = status;
    if (busType) filter.busType = busType;
    if (from) filter['route.from'] = new RegExp(from, 'i');
    if (to) filter['route.to'] = new RegExp(to, 'i');

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sortDirection = sortOrder === 'desc' ? -1 : 1;

    // Get buses with pagination
    const buses = await Bus.find(filter)
      .sort({ [sortBy]: sortDirection })
      .limit(parseInt(limit))
      .skip(skip)
      .populate('driver', 'name license phone');

    // Get total count for pagination
    const total = await Bus.countDocuments(filter);
    const totalPages = Math.ceil(total / parseInt(limit));

    res.status(200).json({
      status: 'success',
      data: {
        buses,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalBuses: total,
          hasNext: parseInt(page) < totalPages,
          hasPrev: parseInt(page) > 1
        }
      }
    });

  } catch (error) {
    console.error('Get all buses error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error while fetching buses',
      ...(process.env.NODE_ENV === 'development' && { error: error.message })
    });
  }
};

/**
 * Get single bus by ID
 * @route GET /api/buses/:id
 * @access Public
 */
const getBusById = async (req, res) => {
  try {
    const bus = await Bus.findById(req.params.id);

    if (!bus) {
      return res.status(404).json({
        status: 'error',
        message: 'Bus not found'
      });
    }

    res.status(200).json({
      status: 'success',
      data: {
        bus
      }
    });

  } catch (error) {
    console.error('Get bus by ID error:', error);
    
    // Handle invalid ObjectId
    if (error.name === 'CastError') {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid bus ID format'
      });
    }

    res.status(500).json({
      status: 'error',
      message: 'Server error while fetching bus',
      ...(process.env.NODE_ENV === 'development' && { error: error.message })
    });
  }
};

/**
 * Search buses by route and date
 * @route GET /api/buses/search
 * @access Public
 */
const searchBuses = async (req, res) => {
  try {
    const { from, to, date } = req.query;

    // Validate required parameters
    if (!from || !to || !date) {
      return res.status(400).json({
        status: 'error',
        message: 'From, to, and date parameters are required',
        required: {
          from: 'Origin city',
          to: 'Destination city',
          date: 'Travel date (YYYY-MM-DD format)'
        }
      });
    }

    // Validate date format and future date
    const travelDate = new Date(date);
    if (isNaN(travelDate.getTime())) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid date format. Please use YYYY-MM-DD format.'
      });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (travelDate < today) {
      return res.status(400).json({
        status: 'error',
        message: 'Travel date cannot be in the past'
      });
    }

    // Search buses
    const buses = await Bus.searchByRoute(from, to, date);

    res.status(200).json({
      status: 'success',
      data: {
        buses,
        searchCriteria: {
          from,
          to,
          date,
          dayOfWeek: travelDate.toLocaleDateString('en-US', { weekday: 'long' })
        },
        resultsCount: buses.length
      }
    });

  } catch (error) {
    console.error('Search buses error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error while searching buses',
      ...(process.env.NODE_ENV === 'development' && { error: error.message })
    });
  }
};

/**
 * Create new bus (Admin only)
 * @route POST /api/buses
 * @access Private/Admin
 */
const createBus = async (req, res) => {
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

    const busData = req.body;

    // Check if bus number already exists
    const existingBus = await Bus.findOne({ busNumber: busData.busNumber.toUpperCase() });
    if (existingBus) {
      return res.status(400).json({
        status: 'error',
        message: 'Bus with this number already exists'
      });
    }

    // Create new bus
    const bus = await Bus.create({
      ...busData,
      busNumber: busData.busNumber.toUpperCase()
    });

    res.status(201).json({
      status: 'success',
      message: 'Bus created successfully',
      data: {
        bus
      }
    });

  } catch (error) {
    console.error('Create bus error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error while creating bus',
      ...(process.env.NODE_ENV === 'development' && { error: error.message })
    });
  }
};

/**
 * Update bus (Admin only)
 * @route PUT /api/buses/:id
 * @access Private/Admin
 */
const updateBus = async (req, res) => {
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

    const busId = req.params.id;
    const updateData = req.body;

    // Check if bus exists
    const existingBus = await Bus.findById(busId);
    if (!existingBus) {
      return res.status(404).json({
        status: 'error',
        message: 'Bus not found'
      });
    }

    // Check if bus number is being changed and if it already exists
    if (updateData.busNumber && updateData.busNumber !== existingBus.busNumber) {
      const busWithSameNumber = await Bus.findOne({
        busNumber: updateData.busNumber.toUpperCase(),
        _id: { $ne: busId }
      });

      if (busWithSameNumber) {
        return res.status(400).json({
          status: 'error',
          message: 'Another bus with this number already exists'
        });
      }

      updateData.busNumber = updateData.busNumber.toUpperCase();
    }

    // Update bus
    const bus = await Bus.findByIdAndUpdate(
      busId,
      updateData,
      { new: true, runValidators: true }
    );

    res.status(200).json({
      status: 'success',
      message: 'Bus updated successfully',
      data: {
        bus
      }
    });

  } catch (error) {
    console.error('Update bus error:', error);
    
    if (error.name === 'CastError') {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid bus ID format'
      });
    }

    res.status(500).json({
      status: 'error',
      message: 'Server error while updating bus',
      ...(process.env.NODE_ENV === 'development' && { error: error.message })
    });
  }
};

/**
 * Delete bus (Admin only)
 * @route DELETE /api/buses/:id
 * @access Private/Admin
 */
const deleteBus = async (req, res) => {
  try {
    const busId = req.params.id;

    // Check if bus exists
    const bus = await Bus.findById(busId);
    if (!bus) {
      return res.status(404).json({
        status: 'error',
        message: 'Bus not found'
      });
    }

    // Check if bus has active bookings
    const Booking = require('../models/Booking');
    const activeBookings = await Booking.countDocuments({
      busId,
      status: { $in: ['confirmed', 'pending'] },
      travelDate: { $gte: new Date() }
    });

    if (activeBookings > 0) {
      return res.status(400).json({
        status: 'error',
        message: `Cannot delete bus. It has ${activeBookings} active booking(s). Cancel all bookings first or set bus status to inactive.`
      });
    }

    // Delete bus
    await Bus.findByIdAndDelete(busId);

    res.status(200).json({
      status: 'success',
      message: 'Bus deleted successfully'
    });

  } catch (error) {
    console.error('Delete bus error:', error);
    
    if (error.name === 'CastError') {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid bus ID format'
      });
    }

    res.status(500).json({
      status: 'error',
      message: 'Server error while deleting bus',
      ...(process.env.NODE_ENV === 'development' && { error: error.message })
    });
  }
};

/**
 * Get bus statistics (Admin only)
 * @route GET /api/buses/stats
 * @access Private/Admin
 */
const getBusStats = async (req, res) => {
  try {
    const stats = await Bus.aggregate([
      {
        $group: {
          _id: null,
          totalBuses: { $sum: 1 },
          activeBuses: {
            $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] }
          },
          inactiveBuses: {
            $sum: { $cond: [{ $eq: ['$status', 'inactive'] }, 1, 0] }
          },
          maintenanceBuses: {
            $sum: { $cond: [{ $eq: ['$status', 'maintenance'] }, 1, 0] }
          },
          totalCapacity: { $sum: '$capacity' },
          totalAvailableSeats: { $sum: '$availableSeats' },
          averageFare: { $avg: '$fare' },
          averageCapacity: { $avg: '$capacity' }
        }
      }
    ]);

    // Get bus type distribution
    const busTypeStats = await Bus.aggregate([
      {
        $group: {
          _id: '$busType',
          count: { $sum: 1 },
          averageFare: { $avg: '$fare' }
        }
      }
    ]);

    // Get route statistics
    const routeStats = await Bus.aggregate([
      {
        $group: {
          _id: {
            from: '$route.from',
            to: '$route.to'
          },
          count: { $sum: 1 },
          averageFare: { $avg: '$fare' }
        }
      },
      { $limit: 10 } // Top 10 routes
    ]);

    res.status(200).json({
      status: 'success',
      data: {
        overview: stats[0] || {},
        busTypeDistribution: busTypeStats,
        topRoutes: routeStats
      }
    });

  } catch (error) {
    console.error('Get bus stats error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error while fetching bus statistics',
      ...(process.env.NODE_ENV === 'development' && { error: error.message })
    });
  }
};

module.exports = {
  getAllBuses,
  getBusById,
  searchBuses,
  createBus,
  updateBus,
  deleteBus,
  getBusStats
};
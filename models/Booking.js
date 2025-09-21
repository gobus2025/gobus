/**
 * Booking Model
 * Defines the booking schema with seat management and payment tracking
 */

const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
  bookingId: {
    type: String,
    required: true,
    unique: true,
    default: function() {
      return 'BKG' + Date.now() + Math.floor(Math.random() * 1000);
    }
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User ID is required']
  },
  busId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Bus',
    required: [true, 'Bus ID is required']
  },
  passengerDetails: [{
    name: {
      type: String,
      required: [true, 'Passenger name is required'],
      trim: true
    },
    age: {
      type: Number,
      required: [true, 'Passenger age is required'],
      min: [1, 'Age must be at least 1'],
      max: [120, 'Age cannot exceed 120']
    },
    gender: {
      type: String,
      enum: ['male', 'female', 'other'],
      required: [true, 'Gender is required']
    },
    seatNumber: {
      type: String,
      required: [true, 'Seat number is required']
    }
  }],
  bookingDate: {
    type: Date,
    required: [true, 'Booking date is required']
  },
  travelDate: {
    type: Date,
    required: [true, 'Travel date is required'],
    validate: {
      validator: function(value) {
        return value >= new Date().setHours(0, 0, 0, 0);
      },
      message: 'Travel date cannot be in the past'
    }
  },
  totalAmount: {
    type: Number,
    required: [true, 'Total amount is required'],
    min: [0, 'Total amount must be positive']
  },
  seatCount: {
    type: Number,
    required: [true, 'Seat count is required'],
    min: [1, 'At least one seat must be booked']
  },
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'cancelled', 'completed'],
    default: 'pending'
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'paid', 'refunded', 'failed'],
    default: 'pending'
  },
  paymentMethod: {
    type: String,
    enum: ['cash', 'card', 'upi', 'wallet', 'netbanking'],
    required: [true, 'Payment method is required']
  },
  cancellationReason: {
    type: String,
    trim: true
  },
  cancellationDate: {
    type: Date
  },
  refundAmount: {
    type: Number,
    default: 0,
    min: [0, 'Refund amount cannot be negative']
  },
  contactInfo: {
    phone: {
      type: String,
      required: [true, 'Contact phone is required'],
      match: [/^\d{10}$/, 'Please provide a valid 10-digit phone number']
    },
    email: {
      type: String,
      required: [true, 'Contact email is required'],
      match: [
        /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
        'Please provide a valid email address'
      ]
    }
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Compound indexes for better query performance
bookingSchema.index({ userId: 1, status: 1 });
bookingSchema.index({ busId: 1, travelDate: 1 });
bookingSchema.index({ bookingId: 1 });
bookingSchema.index({ status: 1, travelDate: 1 });

/**
 * Virtual property to check if booking can be cancelled
 * Cancellation allowed up to 2 hours before departure
 */
bookingSchema.virtual('canCancel').get(function() {
  if (this.status !== 'confirmed') return false;
  
  const now = new Date();
  const travelDateTime = new Date(this.travelDate);
  const timeDifference = travelDateTime - now;
  const hoursUntilTravel = timeDifference / (1000 * 60 * 60);
  
  return hoursUntilTravel > 2;
});

/**
 * Virtual property to calculate refund amount based on cancellation policy
 */
bookingSchema.virtual('eligibleRefundAmount').get(function() {
  if (!this.canCancel) return 0;
  
  const now = new Date();
  const travelDateTime = new Date(this.travelDate);
  const timeDifference = travelDateTime - now;
  const hoursUntilTravel = timeDifference / (1000 * 60 * 60);
  
  // Refund policy: 
  // > 24 hours: 90% refund
  // 2-24 hours: 50% refund
  // < 2 hours: No refund
  
  if (hoursUntilTravel > 24) {
    return Math.floor(this.totalAmount * 0.9);
  } else if (hoursUntilTravel > 2) {
    return Math.floor(this.totalAmount * 0.5);
  }
  
  return 0;
});

/**
 * Virtual property to populate bus and user information
 */
bookingSchema.virtual('bookingDetails', {
  ref: 'Bus',
  localField: 'busId',
  foreignField: '_id',
  justOne: true
});

/**
 * Pre-save middleware to set booking date
 */
bookingSchema.pre('save', function(next) {
  if (this.isNew) {
    this.bookingDate = new Date();
  }
  next();
});

/**
 * Instance method to cancel booking
 * @param {string} reason - Cancellation reason
 * @returns {Object} - Updated booking with refund details
 */
bookingSchema.methods.cancelBooking = async function(reason) {
  if (!this.canCancel) {
    throw new Error('Booking cannot be cancelled at this time');
  }
  
  this.status = 'cancelled';
  this.cancellationReason = reason;
  this.cancellationDate = new Date();
  this.refundAmount = this.eligibleRefundAmount;
  this.paymentStatus = this.refundAmount > 0 ? 'refunded' : 'paid';
  
  // Release seats back to the bus
  const Bus = require('./Bus');
  const bus = await Bus.findById(this.busId);
  if (bus) {
    await bus.releaseSeats(this.seatCount);
  }
  
  return this.save();
};

/**
 * Instance method to confirm booking
 */
bookingSchema.methods.confirmBooking = function() {
  this.status = 'confirmed';
  this.paymentStatus = 'paid';
  return this.save();
};

/**
 * Static method to get user booking history
 * @param {string} userId - User ID
 * @param {Object} options - Query options (limit, skip, status)
 * @returns {Array} - Array of bookings with populated bus details
 */
bookingSchema.statics.getUserBookings = function(userId, options = {}) {
  const query = { userId };
  
  if (options.status) {
    query.status = options.status;
  }
  
  return this.find(query)
    .populate('busId', 'busNumber route departureTime arrivalTime')
    .sort({ createdAt: -1 })
    .limit(options.limit || 10)
    .skip(options.skip || 0);
};

/**
 * Static method to check seat availability for a bus on a specific date
 * @param {string} busId - Bus ID
 * @param {Date} travelDate - Travel date
 * @param {Array} requestedSeats - Array of requested seat numbers
 * @returns {boolean} - True if seats are available
 */
bookingSchema.statics.checkSeatAvailability = async function(busId, travelDate, requestedSeats) {
  const startOfDay = new Date(travelDate);
  startOfDay.setHours(0, 0, 0, 0);
  
  const endOfDay = new Date(travelDate);
  endOfDay.setHours(23, 59, 59, 999);
  
  const bookedSeats = await this.find({
    busId,
    travelDate: { $gte: startOfDay, $lte: endOfDay },
    status: { $in: ['confirmed', 'pending'] }
  }).distinct('passengerDetails.seatNumber');
  
  // Check if any requested seat is already booked
  return !requestedSeats.some(seat => bookedSeats.includes(seat));
};

module.exports = mongoose.model('Booking', bookingSchema);
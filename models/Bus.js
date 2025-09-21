/**
 * Bus Model
 * Defines the bus schema with route information and capacity management
 */

const mongoose = require('mongoose');

const busSchema = new mongoose.Schema({
  busNumber: {
    type: String,
    required: [true, 'Bus number is required'],
    unique: true,
    trim: true,
    uppercase: true,
    match: [/^[A-Z0-9-]+$/, 'Bus number should contain only letters, numbers, and hyphens']
  },
  route: {
    from: {
      type: String,
      required: [true, 'Origin city is required'],
      trim: true
    },
    to: {
      type: String,
      required: [true, 'Destination city is required'],
      trim: true
    }
  },
  capacity: {
    type: Number,
    required: [true, 'Bus capacity is required'],
    min: [1, 'Capacity must be at least 1'],
    max: [100, 'Capacity cannot exceed 100 seats']
  },
  availableSeats: {
    type: Number,
    required: true,
    min: [0, 'Available seats cannot be negative']
  },
  fare: {
    type: Number,
    required: [true, 'Fare is required'],
    min: [0, 'Fare must be a positive number']
  },
  departureTime: {
    type: String,
    required: [true, 'Departure time is required'],
    match: [/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Please provide time in HH:MM format']
  },
  arrivalTime: {
    type: String,
    required: [true, 'Arrival time is required'],
    match: [/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Please provide time in HH:MM format']
  },
  operatingDays: [{
    type: String,
    enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
    required: true
  }],
  amenities: [{
    type: String,
    enum: ['AC', 'WiFi', 'Charging Point', 'Entertainment', 'Snacks', 'Water Bottle']
  }],
  busType: {
    type: String,
    enum: ['AC', 'Non-AC', 'Sleeper', 'Semi-Sleeper', 'Volvo', 'Luxury'],
    required: [true, 'Bus type is required']
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'maintenance'],
    default: 'active'
  },
  driver: {
    name: {
      type: String,
      required: [true, 'Driver name is required']
    },
    license: {
      type: String,
      required: [true, 'Driver license is required']
    },
    phone: {
      type: String,
      required: [true, 'Driver phone is required'],
      match: [/^\d{10}$/, 'Please provide a valid 10-digit phone number']
    }
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Compound indexes for better query performance
busSchema.index({ 'route.from': 1, 'route.to': 1 });
busSchema.index({ departureTime: 1 });
busSchema.index({ status: 1 });
busSchema.index({ busNumber: 1 });

/**
 * Pre-save middleware to initialize available seats
 */
busSchema.pre('save', function(next) {
  // Set available seats to capacity when creating new bus
  if (this.isNew && !this.availableSeats) {
    this.availableSeats = this.capacity;
  }
  
  // Ensure available seats don't exceed capacity
  if (this.availableSeats > this.capacity) {
    this.availableSeats = this.capacity;
  }
  
  next();
});

/**
 * Virtual property to check if bus is available for booking
 */
busSchema.virtual('isBookable').get(function() {
  return this.status === 'active' && this.availableSeats > 0;
});

/**
 * Virtual property to get occupancy percentage
 */
busSchema.virtual('occupancyRate').get(function() {
  return ((this.capacity - this.availableSeats) / this.capacity * 100).toFixed(2);
});

/**
 * Instance method to book seats
 * @param {number} seatCount - Number of seats to book
 * @returns {boolean} - True if booking successful
 */
busSchema.methods.bookSeats = function(seatCount) {
  if (this.availableSeats >= seatCount) {
    this.availableSeats -= seatCount;
    return this.save();
  }
  throw new Error('Not enough available seats');
};

/**
 * Instance method to release seats (for cancellations)
 * @param {number} seatCount - Number of seats to release
 */
busSchema.methods.releaseSeats = function(seatCount) {
  this.availableSeats = Math.min(this.availableSeats + seatCount, this.capacity);
  return this.save();
};

/**
 * Static method to search buses by route and date
 * @param {string} from - Origin city
 * @param {string} to - Destination city
 * @param {string} date - Travel date (day name)
 * @returns {Array} - Array of available buses
 */
busSchema.statics.searchByRoute = function(from, to, date) {
  const dayName = new Date(date).toLocaleDateString('en-US', { weekday: 'long' });
  
  return this.find({
    'route.from': new RegExp(from, 'i'),
    'route.to': new RegExp(to, 'i'),
    operatingDays: dayName,
    status: 'active',
    availableSeats: { $gt: 0 }
  }).sort({ departureTime: 1 });
};

module.exports = mongoose.model('Bus', busSchema);
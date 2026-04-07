const mongoose = require('mongoose');

const queueTokenSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  facilityId: { type: mongoose.Schema.Types.ObjectId, ref: 'Facility' },
  hospitalId: { type: String }, // Provided by QR code
  location: { 
    lat: { type: Number },
    lng: { type: Number }
  }, // User's scanned location
  tokenNumber: { type: String },
  appointmentTime: { type: Date },
  department: { type: String, required: true },
  urgency: { type: String, required: true }, // Low, Medium, High, Emergency
  status: { type: String, enum: ['waiting', 'serving', 'completed', 'cancelled'], default: 'waiting' },
  issues: { type: String },
  isEmergency: { type: Boolean, default: false },
  position: { type: Number },
  estimatedWaitTime: { type: Number }, // in minutes
  createdAt: { type: Date, default: Date.now },
  servedAt: { type: Date },
  completedAt: { type: Date }
});

module.exports = mongoose.model('QueueToken', queueTokenSchema);

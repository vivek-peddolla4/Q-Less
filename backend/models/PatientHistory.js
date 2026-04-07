const mongoose = require('mongoose');

const patientHistorySchema = new mongoose.Schema({
  patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  visits: [{
    visitDate: { type: Date, default: Date.now },
    department: { type: String },
    doctor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    status: { type: String, enum: ['completed', 'cancelled', 'no-show'], default: 'completed' },
    duration: { type: Number }, // in minutes
    medicalRecordId: { type: mongoose.Schema.Types.ObjectId, ref: 'MedicalRecord' }
  }],
  totalVisits: { type: Number, default: 0 },
  lastVisitDate: { type: Date },
  chronicConditions: [{ type: String }],
  allergies: [{ type: String }],
  bloodType: { type: String },
  emergencyContact: {
    name: { type: String },
    phone: { type: String },
    relationship: { type: String }
  },
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('PatientHistory', patientHistorySchema);

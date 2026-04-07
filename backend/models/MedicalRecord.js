const mongoose = require('mongoose');

const medicalRecordSchema = new mongoose.Schema({
  patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  doctorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }, // Optional for patient-created records
  visitDate: { type: Date, required: true },
  facilityId: { type: mongoose.Schema.Types.ObjectId, ref: 'Facility' },
  department: { type: String, required: true },
  diagnosis: { type: String, required: true },
  symptoms: { type: String },
  treatment: { type: String },
  prescription: {
    medicines: [{
      name: { type: String },
      dosage: { type: String },
      frequency: { type: String },
      duration: { type: String }
    }],
    notes: { type: String }
  },
  followUpDate: { type: Date },
  notes: { type: String },
  documentIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Document' }],
  recordType: { type: String, enum: ['doctor', 'patient'], default: 'doctor' }, // To distinguish between doctor-created and patient-created
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('MedicalRecord', medicalRecordSchema);

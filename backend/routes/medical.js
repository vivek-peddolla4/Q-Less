const express = require('express');
const mongoose = require('mongoose');
const User = require('../models/User');
const MedicalRecord = require('../models/MedicalRecord');
const PatientHistory = require('../models/PatientHistory');
const QueueToken = require('../models/QueueToken');
const Document = require('../models/Document');
const Feedback = require('../models/Feedback');
const TriageSetting = require('../models/TriageSetting');
const auth = require('../middleware/auth');

const router = express.Router();

// Middleware to verify doctor/admin role (use auth first, then check role)
const verifyDoctor = (req, res, next) => {
  // req.user is already set by auth middleware
  if (req.user && (req.user.role === 'service_provider' || req.user.role === 'admin')) {
    next();
  } else {
    return res.status(403).json({ 
      message: 'Only doctors/admins can create medical records',
      receivedRole: req.user?.role,
      debug: 'User object: ' + JSON.stringify(req.user)
    });
  }
};

// ===== DOCTOR ENDPOINTS =====

// Create medical record after consultation
router.post('/create', auth, verifyDoctor, async (req, res) => {
  try {
    const { patientId, diagnosis, symptoms, treatment, prescription, followUpDate, notes, queueTokenId } = req.body;

    // Validate required fields
    if (!patientId) {
      return res.status(400).json({ message: 'Patient ID is required' });
    }
    
    if (!diagnosis || diagnosis.trim() === '') {
      return res.status(400).json({ message: 'Diagnosis is required' });
    }

    // Validate patient exists
    const User = require('../models/User');
    const patient = await User.findById(patientId);
    if (!patient) {
      return res.status(404).json({ message: 'Patient not found' });
    }

    // Get doctor's specialization as department
    const doctor = await User.findById(req.user.userId);
    if (!doctor) {
      return res.status(404).json({ message: 'Doctor not found' });
    }

    const department = doctor.specialization || 'General Medicine';
    
    const medicalRecord = new MedicalRecord({
      patientId,
      doctorId: req.user.userId,
      visitDate: new Date(),
      department: department,
      diagnosis: diagnosis.trim(),
      symptoms: symptoms ? symptoms.trim() : '',
      treatment: treatment ? treatment.trim() : '',
      prescription: prescription || {},
      followUpDate: followUpDate ? new Date(followUpDate) : null,
      notes: notes ? notes.trim() : ''
    });

    const savedRecord = await medicalRecord.save();

    // Update patient history
    let patientHistory = await PatientHistory.findOne({ patientId });
    if (!patientHistory) {
      patientHistory = new PatientHistory({ patientId });
    }

    patientHistory.visits.push({
      visitDate: new Date(),
      department: doctor.specialization || 'General',
      doctor: req.user.userId,
      status: 'completed',
      medicalRecordId: savedRecord._id
    });
    patientHistory.totalVisits = patientHistory.visits.length;
    patientHistory.lastVisitDate = new Date();
    await patientHistory.save();

    // Mark queue token as completed if provided
    if (queueTokenId) {
      await QueueToken.findByIdAndUpdate(queueTokenId, {
        status: 'completed',
        completedAt: new Date()
      });
    }

    // Emit real-time notification to patient that medical record was created
    req.io.to(`patient_${patientId}`).emit('medicalRecordCreated', {
      patientId,
      medicalRecordId: savedRecord._id,
      doctorId: req.user.userId,
      department: department || 'General',
      diagnosis: diagnosis.trim()
    });

    res.status(201).json({
      message: 'Medical record created successfully',
      medicalRecord: savedRecord
    });
  } catch (err) {
    console.error('Create medical record error:', err);
    res.status(500).json({ 
      message: 'Error creating medical record', 
      error: err.message 
    });
  }
});

// Update medical record
router.put('/update/:id', auth, verifyDoctor, async (req, res) => {
  try {
    const { diagnosis, treatment, prescription, followUpDate, notes } = req.body;
    
    const medicalRecord = await MedicalRecord.findById(req.params.id);
    if (!medicalRecord) {
      return res.status(404).json({ message: 'Medical record not found' });
    }

    if (medicalRecord.doctorId.toString() !== req.user.userId) {
      return res.status(403).json({ message: 'Not authorized to update this record' });
    }

    medicalRecord.diagnosis = diagnosis || medicalRecord.diagnosis;
    medicalRecord.treatment = treatment || medicalRecord.treatment;
    medicalRecord.prescription = prescription || medicalRecord.prescription;
    medicalRecord.followUpDate = followUpDate || medicalRecord.followUpDate;
    medicalRecord.notes = notes || medicalRecord.notes;

    await medicalRecord.save();
    res.json({ message: 'Medical record updated', medicalRecord });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Add/update prescription under medical record
router.post('/:id/prescription', auth, verifyDoctor, async (req, res) => {
  try {
    const { medicines, notes } = req.body;
    const medicalRecord = await MedicalRecord.findById(req.params.id);
    if (!medicalRecord) return res.status(404).json({ message: 'Medical record not found' });
    if (medicalRecord.doctorId.toString() !== req.user.userId && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized to update this medical record' });
    }

    medicalRecord.prescription = {
      medicines: medicines || medicalRecord.prescription?.medicines || [],
      notes: notes || medicalRecord.prescription?.notes || ''
    };

    await medicalRecord.save();
    res.json({ message: 'Prescription updated', medicalRecord });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// ===== PATIENT ENDPOINTS =====

// Create patient's own medical record (self-reported)
router.post('/patient-create', auth, async (req, res) => {
  try {
    const patientId = req.user.userId; // Patient creating their own record
    const { diagnosis, symptoms, treatment, prescription, followUpDate, notes } = req.body;

    // Validate required fields
    if (!diagnosis || diagnosis.trim() === '') {
      return res.status(400).json({ message: 'Diagnosis is required' });
    }

    // Get patient info
    const patient = await User.findById(patientId);
    if (!patient) {
      return res.status(404).json({ message: 'User not found' });
    }

    const medicalRecord = new MedicalRecord({
      patientId,
      doctorId: null, // No doctor for self-reported records
      visitDate: new Date(),
      department: 'Self-reported',
      diagnosis: diagnosis.trim(),
      symptoms: symptoms ? symptoms.trim() : '',
      treatment: treatment ? treatment.trim() : '',
      prescription: prescription || {},
      followUpDate: followUpDate ? new Date(followUpDate) : null,
      notes: notes ? notes.trim() : '',
      recordType: 'patient' // Mark as patient-created
    });

    const savedRecord = await medicalRecord.save();

    // Update patient history
    let patientHistory = await PatientHistory.findOne({ patientId });
    if (!patientHistory) {
      patientHistory = new PatientHistory({ patientId });
    }

    patientHistory.visits.push({
      visitDate: new Date(),
      department: 'Self-reported',
      doctor: null,
      status: 'self-reported',
      medicalRecordId: savedRecord._id
    });
    patientHistory.totalVisits = patientHistory.visits.length;
    patientHistory.lastVisitDate = new Date();
    await patientHistory.save();

    res.status(201).json({
      message: 'Medical record saved successfully',
      medicalRecord: savedRecord
    });
  } catch (err) {
    console.error('Patient medical record error:', err);
    res.status(500).json({ 
      message: 'Error saving medical record', 
      error: err.message 
    });
  }
});

// Get patient's medical history
router.get('/history/:patientId', auth, async (req, res) => {
  try {
    const patientHistory = await PatientHistory.findOne({ patientId: req.params.patientId })
      .populate('visits.doctor', 'name specialization')
      .populate('visits.medicalRecordId');

    if (!patientHistory) {
      // Return empty history instead of 404
      return res.json({
        patientId: req.params.patientId,
        totalVisits: 0,
        visits: [],
        bloodType: null,
        allergies: null,
        lastVisitDate: null,
        medicalConditions: []
      });
    }

    res.json(patientHistory);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Get patient's medical records (all visits with details)
router.get('/records/:patientId', auth, async (req, res) => {
  try {
    const medicalRecords = await MedicalRecord.find({ patientId: req.params.patientId })
      .populate('doctorId', 'name specialization')
      .sort({ visitDate: -1 });

    // Return empty array instead of 404 error
    res.json(medicalRecords);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Get single medical record with full details
router.get('/record/:id', auth, async (req, res) => {
  try {
    const medicalRecord = await MedicalRecord.findById(req.params.id)
      .populate('doctorId', 'name specialization email')
      .populate('documentIds');

    if (!medicalRecord) {
      return res.status(404).json({ message: 'Record not found' });
    }

    res.json(medicalRecord);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Prescription export as PDF
router.get('/prescriptions/pdf/:id', auth, verifyDoctor, async (req, res) => {
  try {
    const record = await MedicalRecord.findById(req.params.id).populate('patientId', 'name email').populate('doctorId', 'name specialization');
    if (!record) return res.status(404).json({ message: 'Medical record not found' });

    const PDFDocument = require('pdfkit');
    const doc = new PDFDocument();
    res.setHeader('Content-disposition', `attachment; filename=prescription-${record._id}.pdf`);
    res.setHeader('Content-type', 'application/pdf');

    doc.fontSize(20).text('Q-LESS Prescription', { align: 'center' });
    doc.moveDown();
    doc.fontSize(12).text(`Patient: ${record.patientId.name}`);
    doc.text(`Doctor: ${record.doctorId.name} (${record.doctorId.specialization})`);
    doc.text(`Department: ${record.department}`);
    doc.text(`Date: ${record.visitDate.toLocaleString()}`);
    doc.moveDown();
    doc.fontSize(14).text('Prescription', { underline: true });
    doc.fontSize(12).text(record.prescription.notes || 'No notes provided', { paragraphGap: 10 });

    if (record.prescription.medicines && record.prescription.medicines.length) {
      record.prescription.medicines.forEach((med, i) => {
        doc.text(`${i + 1}. ${med.name} - ${med.dosage}, ${med.frequency}, ${med.duration}`);
      });
    } else {
      doc.text('No medicines prescribed.');
    }

    doc.pipe(res);
    doc.end();
  } catch (err) {
    res.status(500).json({ message: 'Error generating PDF', error: err.message });
  }
});

// Get prescriptions for a patient
router.get('/prescriptions/:patientId', auth, async (req, res) => {
  try {
    const medicalRecords = await MedicalRecord.find(
      { patientId: req.params.patientId, 'prescription.medicines.0': { $exists: true } }
    )
      .populate('doctorId', 'name specialization')
      .sort({ visitDate: -1 });

    // Return empty array if no prescriptions found
    res.json(medicalRecords);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Update patient profile details (history metadata)
router.put('/profile/:patientId', async (req, res) => {
  try {
    const { chronicConditions, allergies, bloodType, emergencyContact } = req.body;

    let patientHistory = await PatientHistory.findOne({ patientId: req.params.patientId });
    if (!patientHistory) {
      patientHistory = new PatientHistory({ patientId: req.params.patientId });
    }

    patientHistory.chronicConditions = chronicConditions || patientHistory.chronicConditions;
    patientHistory.allergies = allergies || patientHistory.allergies;
    patientHistory.bloodType = bloodType || patientHistory.bloodType;
    patientHistory.emergencyContact = emergencyContact || patientHistory.emergencyContact;
    patientHistory.updatedAt = new Date();

    await patientHistory.save();
    res.json({ message: 'Profile updated', patientHistory });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// ===== ADMIN ENDPOINTS =====

// Get all medical records (admin only)
router.get('/admin/all', auth, verifyDoctor, async (req, res) => {
  try {
    const medicalRecords = await MedicalRecord.find()
      .populate('patientId', 'name email')
      .populate('doctorId', 'name specialization')
      .sort({ visitDate: -1 });

    res.json(medicalRecords);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Get doctor's patient list
router.get('/doctor/patients/:doctorId', auth, verifyDoctor, async (req, res) => {
  try {
    const medicalRecords = await MedicalRecord.find({ doctorId: req.params.doctorId })
      .populate('patientId', 'name email')
      .distinct('patientId');

    res.json(medicalRecords);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Patient/doctor feedback
router.post('/feedback', auth, async (req, res) => {
  try {
    const { doctorId, rating, comments, medicalRecordId } = req.body;
    const patientId = req.user.userId;

    if (!doctorId || !rating) {
      return res.status(400).json({ message: 'doctorId and rating are required' });
    }

    const feedback = new Feedback({ patientId, doctorId, rating, comments });
    await feedback.save();

    // update triage model using doctor feedback
    if (medicalRecordId) {
      const med = await MedicalRecord.findById(medicalRecordId);
      if (med && med.department) {
        let setting = await TriageSetting.findOne({ department: med.department });
        const delta = (rating - 3) * 0.1;
        if (!setting) {
          setting = new TriageSetting({ department: med.department, score: 1.0 + delta, votes: 1 });
        } else {
          setting.votes += 1;
          setting.score = Math.max(0.2, Math.min(5.0, ((setting.score * (setting.votes - 1)) + delta) / setting.votes));
        }
        await setting.save();
      }
    }

    res.status(201).json({ message: 'Feedback submitted', feedback });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

router.get('/feedback/doctor/:doctorId', auth, async (req, res) => {
  try {
    const doctorId = req.params.doctorId;
    const feedbacks = await Feedback.find({ doctorId }).populate('patientId', 'name');
    const avgRating = feedbacks.length ? (feedbacks.reduce((sum, f) => sum + f.rating, 0) / feedbacks.length).toFixed(2) : 0;
    res.json({ feedbacks, avgRating, total: feedbacks.length });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

router.get('/feedback/report', auth, verifyDoctor, async (req, res) => {
  try {
    if (req.userRole !== 'admin') return res.status(403).json({ message: 'Admin only' });
    const feedbackByDoctor = await Feedback.aggregate([
      { $group: { _id: '$doctorId', avgRating: { $avg: '$rating' }, count: { $sum: 1 } } },
      { $sort: { avgRating: -1, count: -1 } }
    ]);
    res.json(feedbackByDoctor);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;

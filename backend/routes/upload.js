const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Document = require('../models/Document');
const auth = require('../middleware/auth');

const router = express.Router();

// ─────────────────────────────────────────────────────────────
// UPLOAD DIRECTORY — absolute path anchored to this file's location.
// In Docker: resolves to /app/uploads (mounted as a named volume).
// Locally: resolves to backend/uploads/
// Using __dirname guarantees correct path regardless of process.cwd().
// ─────────────────────────────────────────────────────────────
const UPLOAD_DIR = path.join(__dirname, '..', 'uploads');

// Ensure the upload directory exists at startup (recursive: true is safe if it already exists)
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  console.log('[UPLOAD] Created uploads directory at:', UPLOAD_DIR);
}

// ─────────────────────────────────────────────────────────────
// ALLOWED FILE TYPES — only safe medical document formats
// ─────────────────────────────────────────────────────────────
const ALLOWED_MIMETYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/msword',                                                      // .doc
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
];

const MAX_FILE_SIZE_MB = 10;

// ─────────────────────────────────────────────────────────────
// MULTER STORAGE — saves to absolute UPLOAD_DIR path
// ─────────────────────────────────────────────────────────────
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, UPLOAD_DIR);
  },
  filename: function (req, file, cb) {
    // Prefix with userId to avoid collisions between users
    const userId = req.user?.userId || 'unknown';
    const timestamp = Date.now();
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${userId}-${timestamp}${ext}`);
  }
});

// ─────────────────────────────────────────────────────────────
// FILE FILTER — reject disallowed file types before they are written to disk
// ─────────────────────────────────────────────────────────────
function fileFilter(req, file, cb) {
  if (ALLOWED_MIMETYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`File type '${file.mimetype}' is not allowed. Accepted: PDF, JPEG, PNG, WEBP, DOC, DOCX.`), false);
  }
}

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE_MB * 1024 * 1024, // 10 MB
  }
});

// ─────────────────────────────────────────────────────────────
// POST /api/upload — Upload a medical document
// ─────────────────────────────────────────────────────────────
router.post('/', auth, (req, res, next) => {
  upload.single('document')(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ message: `File too large. Maximum size is ${MAX_FILE_SIZE_MB}MB.` });
      }
      return res.status(400).json({ message: `Upload error: ${err.message}` });
    } else if (err) {
      return res.status(400).json({ message: err.message });
    }
    next();
  });
}, async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const newDoc = new Document({
      userId: req.user.userId,
      filename: req.file.originalname,   // store original name for display
      path: req.file.filename,           // store only the filename (not full path) for portability
      mimetype: req.file.mimetype
    });

    await newDoc.save();

    res.status(201).json({
      message: 'File uploaded successfully',
      document: {
        id: newDoc._id,
        filename: newDoc.filename,
        mimetype: newDoc.mimetype,
        uploadedAt: newDoc.uploadedAt,
        url: `/api/upload/file/${newDoc._id}`
      }
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────
// GET /api/upload — List current user's uploaded documents
// ─────────────────────────────────────────────────────────────
router.get('/', auth, async (req, res) => {
  try {
    const docs = await Document.find({ userId: req.user.userId }).sort({ uploadedAt: -1 });
    // Return with download URLs
    const docsWithUrls = docs.map(doc => ({
      id: doc._id,
      filename: doc.filename,
      mimetype: doc.mimetype,
      uploadedAt: doc.uploadedAt,
      url: `/api/upload/file/${doc._id}`
    }));
    res.json(docsWithUrls);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────
// GET /api/upload/file/:id — Download/view a specific document
// Only the owning patient (or admin) can access their files.
// ─────────────────────────────────────────────────────────────
router.get('/file/:id', auth, async (req, res) => {
  try {
    const doc = await Document.findById(req.params.id);
    if (!doc) return res.status(404).json({ message: 'Document not found' });

    // Security: only the owner or an admin can download
    if (doc.userId.toString() !== req.user.userId && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied' });
    }

    const filePath = path.join(UPLOAD_DIR, doc.path);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: 'File not found on disk' });
    }

    // Set content-disposition so browser knows the original filename
    res.setHeader('Content-Disposition', `inline; filename="${doc.filename}"`);
    res.setHeader('Content-Type', doc.mimetype);
    res.sendFile(filePath);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────
// DELETE /api/upload/file/:id — Delete a document (owner only)
// ─────────────────────────────────────────────────────────────
router.delete('/file/:id', auth, async (req, res) => {
  try {
    const doc = await Document.findById(req.params.id);
    if (!doc) return res.status(404).json({ message: 'Document not found' });

    if (doc.userId.toString() !== req.user.userId && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Delete the physical file
    const filePath = path.join(UPLOAD_DIR, doc.path);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    // Delete the DB record
    await Document.findByIdAndDelete(req.params.id);

    res.json({ message: 'Document deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;

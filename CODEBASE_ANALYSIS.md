# Q-LESS: Comprehensive Codebase Analysis

**Date**: March 31, 2026  
**Project**: Virtual Queue Management System with AI-Powered Triage

---

## 📋 Executive Summary

Q-LESS is a **full-stack, AI-powered virtual queue management system** for healthcare facilities. It dynamically routes patients to appropriate departments based on symptom analysis, manages multiple concurrent queues via Redis with emergency prioritization, and provides real-time updates using WebSockets. The system supports three user roles (patients, doctors/staff, and administrators) with distinct dashboards and capabilities.

---

## 🎯 Core Features (Currently Implemented)

### 1. **AI-Powered Symptom Triage**
- Patients describe symptoms → Flask AI engine classifies into departments
- Urgency levels assigned: `Low`, `Medium`, `High`, `Emergency`
- Emergency patients automatically prioritized in queue (LPUSH to front)
- Fallback logic when AI service unavailable
- **Implementation**: Rule-based symptom matching (Python Flask on port 5000)

### 2. **Virtual Queue Management**
- **Multi-department queues** maintained in Redis (lightning-fast)
- **Position tracking**: Real-time position calculation within each department
- **Estimated wait time**: Calculated as `position * 15 minutes` (AVG_SERVICE_TIME)
- **Emergency prioritization**: Emergency patients added to queue front, others to back
- **Queue status transitions**: `waiting` → `serving` → `completed`

### 3. **Real-Time WebSocket Notifications**
- Live queue updates broadcast to all clients via Socket.io
- Individual notifications to users:
  - Appointment scheduled with exact time
  - "Leave Now!" alert when position ≤ 2
  - "It's your turn now!" when transitioning to serving
  - Location reminder alerts (when within 3 positions)
- Queue update broadcasts trigger dashboard refreshes

### 4. **QR Code Hospital Entry**
- Patients scan hospital QR codes containing location data
- GPS validation: Must be within **200 meters** of hospital location
- Auto-routes to symptom form upon verification
- Hospital ID tracked with token for analytics

### 5. **Document Upload & Storage**
- Patients can upload medical records, prescriptions, test results
- Files stored locally via Multer (path: `uploads/`)
- Associated with user profiles in MongoDB
- Supports any file type with metadata

### 6. **Role-Based Access Control**
Three distinct user types:
- **Patient** (`role: 'user'`): Access dashboard, queue entry, document upload
- **Doctor** (`role: 'service_provider'`): Specialty-filtered queue view, serve/complete patients
- **Admin** (`role: 'admin'`): Full system visibility, queue reassignment, analytics

### 7. **JWT Authentication**
- Token-based authentication with 24-hour expiration
- Bcrypt password hashing
- Middleware checks on all protected routes
- Automatic logout on token expiry

---

## 🏗️ Technical Architecture

### **Frontend (React + Vite)**
```
Frontend Stack:
- React Router for navigation
- Socket.io-client for real-time updates  
- Axios for HTTP requests
- Tailwind CSS + Recharts for UI/analytics
- React Toastify for notifications
```

### **Backend (Node.js + Express)**
```
Backend Stack:
- Express.js REST API
- Socket.io for WebSocket broadcasting
- MongoDB + Mongoose for persistence
- Redis for queue management
- JWT for authentication
```

### **AI Engine (Python Flask)**
```
AI Stack:
- Flask lightweight server
- Rule-based symptom classification
- CORS enabled for frontend requests
```

---

## 📊 Database Models

### **1. User Schema** (MongoDB)
```javascript
{
  _id: ObjectId,
  name: String (required),
  email: String (unique, required),
  password: String (bcrypt hash),
  role: Enum['user', 'admin', 'service_provider'],
  specialization: String (e.g., "Cardiology" for doctors),
  createdAt: Date (default: now)
}
```

### **2. QueueToken Schema** (MongoDB)
```javascript
{
  _id: ObjectId,
  userId: ObjectId (ref: User),
  hospitalId: String,
  location: { lat: Number, lng: Number },
  tokenNumber: String (format: "QL-XXX"),
  department: String (required),
  urgency: Enum['Low', 'Medium', 'High', 'Emergency'],
  status: Enum['waiting', 'serving', 'completed', 'cancelled'],
  issues: String (symptom description),
  isEmergency: Boolean,
  position: Number (in queue),
  estimatedWaitTime: Number (minutes),
  appointmentTime: Date (calculated),
  servedAt: Date,
  completedAt: Date,
  createdAt: Date (default: now)
}
```

### **3. Document Schema** (MongoDB)
```javascript
{
  _id: ObjectId,
  userId: ObjectId (ref: User),
  filename: String,
  path: String (file location),
  mimetype: String,
  uploadedAt: Date (default: now)
}
```

### **4. Redis Queues**
```
Key Format: queue:{department}
Value: Array of token ObjectIds
Example: queue:Cardiology = [token1._id, token2._id, ...]
- LPUSH: Add emergency patients (front)
- RPUSH: Add regular patients (back)
- LPOP: Dequeue next patient
```

---

## 🔌 API Endpoints

### **Authentication Routes** (`/api/auth`)
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/register` | ❌ | Register user (patient/doctor/admin) |
| POST | `/login` | ❌ | Authenticate, return JWT + user data |
| GET | `/users` | ✅ | **DEV ONLY** - View all users |

### **Queue Routes** (`/api/queue`)
| Method | Endpoint | Auth | Role | Description |
|--------|----------|------|------|-------------|
| POST | `/join-qr` | ✅ | Patient | Join queue via QR scan (AI triage) |
| POST | `/join` | ✅ | Patient | Join queue manually |
| POST | `/scan-qr` | ✅ | Patient | Verify location (200m radius) |
| GET | `/status/:tokenId` | ✅ | Patient | Get real-time position/wait time |
| GET | `/my-active` | ✅ | Patient | Fetch active queue token |
| GET | `/all` | ✅ | Doctor/Admin | Get all active queues |
| POST | `/serve/:department` | ✅ | Doctor/Admin | Dequeue next patient |
| POST | `/complete/:tokenId` | ✅ | Doctor/Admin | Mark service complete |
| POST | `/reassign/:tokenId` | ✅ | Admin | Reassign to different department |

### **Document Routes** (`/api/upload`)
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/` | ✅ | Upload document (Multer) |
| GET | `/` | ✅ | List user's documents |

---

## 📄 Frontend Pages & Features

### **1. Login Page** (`/login`)
- Email & password authentication
- Role-based redirect after login
- Glassmorphism design with animated gradients
- Error messages for invalid credentials
- Link to registration page

### **2. Register Page** (`/register`)
- Create new user account
- Select role: Patient, Doctor, Admin
- Specialization field (for doctors)
- Password validation (min 6 chars)
- Form validation & error display

### **3. Patient Dashboard** (`/dashboard`)
**Main UI Components:**
- **Symptom Analyzer Panel**: 
  - Textarea for symptom input
  - "Analyze Symptoms" button → calls Flask AI
  - Shows department + urgency recommendations
  - Join queue button
  
- **Queue Status Panel** (when in queue):
  - Position card with gradient background
  - Estimated wait time display
  - Department indicator
  - "Serving Now" alert when called
  
- **QR Code Scanner Button**: Navigate to `/scan`

- **Document Upload Sidebar**:
  - File input with drag-drop styling
  - Upload button with validation
  - Success/error notifications

- **Real-time Notifications**: Toast alerts for all events

- **Features**:
  - Logout button
  - Greeting with user name
  - Socket.io subscription for live updates

### **4. QR Scanner Page** (`/scan`)
**Workflow:**
1. Request geolocation from browser
2. Initialize camera with HTML5 QR scanner
3. User positions hospital QR in frame
4. Parse QR data (hospitalId, lat, lng)
5. Verify location is within 200m
6. Display symptom form on success
7. Submit form → join-qr endpoint → redirect to token display

**Components:**
- QR reader frame (250x250 box)
- Location verification spinner
- SymptomForm component (below)

### **5. Token Display Page** (`/token/:id`)
**Real-time Status Card:**
- Token number (QL-XXX format)
- Department name
- Status indicators:
  - Waiting: Indigo gradient
  - Serving: Green gradient
  - Completed: Gray gradient
  - Emergency: Red gradient
  
**Information Display:**
- Current position
- Estimated wait time
- Appointment scheduled time
- Location warnings (dynamic)
- Leave hospital reminder at position 3

**Socket.io Listeners:**
- Queue updates trigger refresh
- In-app toasts for notifications
- Periodic geo-check (30s) when position ≤ 3

### **6. Doctor Dashboard** (`/doctor`)
**Layout:**
- Header with doctor name & specialization
- Left column (2/3): Patient queue
- Right column (1/3): Statistics

**Features:**
- Filter tokens by doctor's specialization
- Show "Currently Serving" section
- Display waiting patients in order (emergency first)
- "Serve Next" button (moves patient to serving)
- "Mark as Completed" button (completes patient)
- Statistics panel:
  - Total waiting patients
  - Average wait time calculation
  - Real-time updates via Socket.io

### **7. Admin Dashboard** (`/admin`)
**Layout:**
- Analytics sidebar (1/3)
- Live queues section (2/3)

**Features:**
- Bar chart: Waiting patients per department
- Total waiting count card
- "Currently Serving" section
- Department-wise queue tables
  - Shows all departments: Cardiology, Orthopedics, General Medicine, Ophthalmology, Gastroenterology, Emergency
  - Sort emergency patients first
  - Show patient name, issues, token
  - Serve/Reassign buttons per patient
  
**Real-time Updates:**
- Socket.io listener refresh queues
- Live patient movements

### **Shared Components**

**SymptomForm Component:**
- Used in QR scanner workflow
- Collects: Name, Phone, Symptoms
- Form validation
- Submit → join-qr
- Cancel → reload scanner

---

## 🚀 Current Implementation Status

### ✅ **Fully Implemented Features**
- [x] User registration & authentication (JWT)
- [x] Three role-based dashboards
- [x] AI symptom classification (Flask rule-based)
- [x] Redis queue management with emergency prioritization
- [x] Real-time WebSocket updates (Socket.io)
- [x] QR code scanning with GPS validation
- [x] Document upload/storage
- [x] Queue position tracking & wait time calculation
- [x] Admin queue reassignment
- [x] Responsive Tailwind CSS UI
- [x] Database persistence (MongoDB)

### ⚠️ **Partially Implemented / Edge Cases**
1. **AI Fallback**: Flask connection errors silently fall back to defaults
   - File: [backend/routes/queue.js](backend/routes/queue.js#L35-L40)
   - Commented logic for development mode in [frontend/src/pages/QRScanner.jsx](frontend/src/pages/QRScanner.jsx#L53-L56)

2. **Queue Position When Token Deleted**: 
   - File: [backend/routes/queue.js](backend/routes/queue.js#L194-L197)
   - "Just fallback" comment indicates incomplete edge case handling

3. **Development-Only Routes**:
   - `/api/auth/users` endpoint lacks proper authorization
   - File: [backend/routes/auth.js](backend/routes/auth.js#L50-L57)
   - Should require admin role check

### ⛔ **Not Implemented / Missing Features**
1. **Input Validation**: 
   - No schema validation (consider Joi/Zod)
   - SQL/NoSQL injection protection not explicit
   
2. **Error Handling**:
   - Generic "Server error" responses for debugging
   - No centralized error handler middleware
   
3. **Rate Limiting**: 
   - No API rate limiting on auth/queue endpoints
   
4. **Queue Cleanup**:
   - No automatic removal of old/completed tokens
   - Redis keys persist indefinitely
   
5. **Doctor Assignment Logic**:
   - Doctors manually filter by specialization
   - No automatic patient-to-doctor assignment workflow
   
6. **Patient Cancellation**:
   - No UI for patients to cancel queue entry
   - Status 'cancelled' defined but not used
   
7. **Metrics/Analytics**:
   - No historical queue metrics
   - Wait time statistics not persisted
   
8. **Location Tracking:**
   - One-time location check (doesn't track patient movement)
   - Periodic geofencing implemented client-side only

9. **Scalability Considerations**:
   - Redis queue limited to single instance (no clustering)
   - No load balancing strategy documented
   - Socket.io broadcast to all clients (no room segmentation)

---

## 🔍 Code Quality Observations

### **Strengths**
- Clean separation of concerns (routes/models/middleware)
- Consistent error handling patterns
- Good use of async/await
- Responsive UI with Tailwind + animations
- Real-time updates well-integrated

### **Areas for Improvement**
- Add schema validation (MongoDB schemas are bare)
- Implement comprehensive error handling
- Add request logging/monitoring
- Increase test coverage
- Document complex queue logic
- Add rate limiting on API endpoints
- Implement request body sanitization
- Consider extracting shared logic into utilities

---

## 🔐 Security Observations

### **Implemented**
- ✅ JWT token-based auth
- ✅ Bcrypt password hashing
- ✅ Role-based access control (RBAC)
- ✅ CORS enabled

### **Needs Review**
- ⚠️ No input validation/sanitization
- ⚠️ No rate limiting
- ⚠️ Temporary `/api/auth/users` development endpoint exposed
- ⚠️ Sensitive error messages leak internal details
- ⚠️ No HTTPS enforcement documented
- ⚠️ No password reset mechanism
- ⚠️ No email verification

---

## 📦 Dependencies Summary

**Frontend (Node/npm):**
- react, react-router-dom
- socket.io-client
- axios
- tailwindcss, postcss
- recharts (analytics)
- lucide-react (icons)
- react-toastify (notifications)
- html5-qrcode (QR scanning)
- geolib (distance calculations)

**Backend (Node/npm):**
- express, cors
- mongoose (MongoDB ODM)
- redis (queue management)
- bcrypt (password hashing)
- jsonwebtoken (JWT)
- socket.io (WebSockets)
- multer (file uploads)
- axios (HTTP client)
- geolib (distance calculations)

**AI Service (Python):**
- Flask, Flask-CORS

---

## 🎬 Typical User Workflows

### **Patient Journey (Full Flow)**
1. **Register** → name, email, password, role=patient
2. **Login** → authenticate, redirect to `/dashboard`
3. **Describe Symptoms** → "I have chest pain" → Click "Analyze"
4. **Receive Triage** → "Cardiology" + "High" urgency recommended
5. **Join Queue** → Token QL-456 assigned, position shown
6. **Wait** → Real-time position updates via Socket.io
7. **Receive Alert** → "Leave Now!" when position = 2
8. **Arrive** → "It's your turn!" when position = 1
9. **Serve** → Dashboard shows "Serving Now"

### **Doctor Journey**
1. **Register** → doctor name, email, role=service_provider, specialization=Cardiology
2. **Login** → redirect to `/doctor`
3. **View Queue** → See waiting Cardiology patients (emergency first)
4. **Serve Patient** → Click "Serve Next" → patient moves to "Serving"
5. **Complete** → Click "Mark as Completed" → patient removed from queue
6. **Monitor** → Real-time statistics of waiting patients

### **Admin Journey**
1. **Register** → admin name, email, role=admin
2. **Login** → redirect to `/admin`
3. **View Analytics** → Bar chart of department queues
4. **Manage Queue** → Serve patients across departments
5. **Reassign** → Move patient to different department
6. **Monitor** → Live queue loads across all departments

---

## 🚦 Current Deployment & Configuration

**Ports:**
- Frontend: 5173 (Vite dev server)
- Backend: 8000 (Express)
- AI Service: 5000 (Flask)
- Redis: 6379 (default)
- MongoDB: 27017 (default)

**Environment Variables Required:**
- `PORT` (backend, default 8000)
- `MONGO_URI` (default: mongodb://localhost:27017/qless)
- `REDIS_URL` (default: redis://localhost:6379)
- `JWT_SECRET` (for token signing)

---

## 📈 Next-Level Enhancement Opportunities

1. **Advanced AI**: Integrate ML model instead of rule-based system
2. **Patient History**: Persistent medical records per patient
3. **Queue Analytics**: Historical metrics, trends, peak hours
4. **Mobile App**: Native iOS/Android version
5. **Video Consultations**: Telemedicine integration
6. **SMS Notifications**: Send updates to patient phone
7. **Payment Integration**: Appointment booking with payments
8. **Multi-facility**: Support multiple hospitals in one system
9. **Staff Scheduling**: Doctor shift management
10. **Prescription Management**: E-prescriptions generation

---

## 📝 Files Reference

**Key Files Reviewed:**
- Backend: `server.js`, `routes/auth.js`, `routes/queue.js`, `routes/upload.js`, `models/*`, `middleware/auth.js`
- Frontend: `App.jsx`, `pages/Dashboard.jsx`, `pages/AdminDashboard.jsx`, `pages/DoctorDashboard.jsx`, `pages/QRScanner.jsx`, `pages/TokenDisplay.jsx`, `context/AuthContext.jsx`, `components/SymptomForm.jsx`
- AI: `ai_service/app.py`
- Config: `Report.md`, `check_users.js`

---

## 🎓 Conclusion

Q-LESS is a **well-structured, functional prototype** of a virtual queue management system with solid fundamentals:
- ✅ Complete CRUD operations for key entities
- ✅ Real-time synchronization across clients
- ✅ Three-tier role-based access
- ✅ Modern, responsive UI
- ✅ AI-powered patient routing

The codebase is **ready for enhancement** with production-grade features like advanced validation, monitoring, scalability improvements, and extended functionality as outlined above.

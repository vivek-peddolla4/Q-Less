const express = require('express');
const { createClient } = require('redis');
const QueueToken = require('../models/QueueToken');
const User = require('../models/User');
const Facility = require('../models/Facility');
const TriageSetting = require('../models/TriageSetting');
const Feedback = require('../models/Feedback');
const auth = require('../middleware/auth');
const axios = require('axios');
const { getDistance } = require('geolib');
const { sendEmail, sendSMS } = require('../utils/notifyService');

const router = express.Router();

const redisClient = createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379'
});

redisClient.on('error', (err) => console.log('Redis Client Error', err));
redisClient.connect().catch(console.error);

const AVG_SERVICE_TIME = 15; // 15 mins

async function notifyPatient(token, textMessage) {
  try {
    const user = await User.findById(token.userId);
    if (!user) return;

    // Socket notification goes through external socket event from caller
    if (user.email && textMessage) {
      await sendEmail(user.email, 'Q-LESS queue update', textMessage);
    }

    // SMS: use phone in token data if available
    const phone = token.phone || user.phone;
    if (phone) {
      await sendSMS(phone, textMessage);
    }
  } catch (err) {
    console.error('notifyPatient error:', err.message);
  }
}

async function notifyProximity(department, io, facilityId = 'default') {
  const queueKey = `queue:${facilityId}:${department}`;
  const nextIds = await redisClient.lRange(queueKey, 0, 4); // first 5

  for (let idx = 0; idx < nextIds.length; idx += 1) {
    const queueToken = await QueueToken.findById(nextIds[idx]);
    if (!queueToken) continue;

    queueToken.position = idx + 1;
    queueToken.estimatedWaitTime = queueToken.position * AVG_SERVICE_TIME;
    queueToken.facilityId = facilityId;
    await queueToken.save();

    if (queueToken.position <= 5) {
      const message = `Your turn is coming up soon! Current position: ${queueToken.position} (dept: ${department}, facility: ${facilityId}).`;
      if (io) {
        io.to(queueToken.userId.toString()).emit('notification', { message });
      }
      await notifyPatient(queueToken, message);
    }
  }
}

async function getAdaptiveDepartment(symptoms) {
  let department = 'General Medicine';
  let urgency = 'Low';

  try {
    const flaskResponse = await axios.post('http://127.0.0.1:5000/predict', { symptoms });
    if (flaskResponse.data) {
      department = flaskResponse.data.department || department;
      urgency = flaskResponse.data.urgency || urgency;
    }
  } catch (err) {
    console.error('Flask API error:', err.message);
  }

  // Adjust by learned triage scores
  const setting = await TriageSetting.findOne({ department });
  if (setting && setting.score > 0) {
    const isWeighted = setting.score < 0.8 ? 'General Medicine' : department;
    department = isWeighted;
  }

  return { department, urgency };
}

async function updateTriageSetting(department, delta) {
  let setting = await TriageSetting.findOne({ department });
  if (!setting) {
    setting = new TriageSetting({ department, score: 1.0 + delta, votes: 1 });
  } else {
    setting.votes += 1;
    setting.score = Math.max(0.2, Math.min(5.0, ((setting.score * (setting.votes - 1)) + delta) / setting.votes));
  }
  await setting.save();
  return setting;
}

async function buildQueueQuery({ name, email, status, department, urgency, facilityId, startDate, endDate }) {
  const mongoQuery = {};
  if (status) mongoQuery.status = status;
  if (department) mongoQuery.department = department;
  if (urgency) mongoQuery.urgency = urgency;
  if (facilityId) mongoQuery.facilityId = facilityId;

  if (startDate || endDate) {
    mongoQuery.createdAt = {};
    if (startDate) mongoQuery.createdAt.$gte = new Date(startDate);
    if (endDate) mongoQuery.createdAt.$lte = new Date(endDate);
  }

  let userIds = null;
  if (name || email) {
    const userQuery = {};
    if (name) userQuery.name = { $regex: name, $options: 'i' };
    if (email) userQuery.email = { $regex: email, $options: 'i' };
    const users = await User.find(userQuery).select('_id');
    userIds = users.map((u) => u._id);
    mongoQuery.userId = { $in: userIds.length ? userIds : ['null'] };
  }

  return mongoQuery;
}

// Facility management
router.get('/facilities', auth, async (req, res) => {
  try {
    const facilities = await Facility.find({});
    res.json(facilities);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

router.post('/facilities', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ message: 'Admin only' });
    const { name, address, phone } = req.body;
    const facility = new Facility({ name, address, phone });
    await facility.save();
    res.status(201).json(facility);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

router.put('/facilities/:id', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ message: 'Admin only' });
    const facility = await Facility.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!facility) return res.status(404).json({ message: 'Facility not found' });
    res.json(facility);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// QR Scan Location Validation
router.post('/scan-qr', auth, async (req, res) => {
  try {
    const { hospitalId, qrLat, qrLng, userLat, userLng } = req.body;
    if (!qrLat || !qrLng || !userLat || !userLng) {
      return res.status(400).json({ message: 'Location data missing' });
    }
    
    // Calculate distance in meters
    const distance = getDistance(
      { latitude: userLat, longitude: userLng },
      { latitude: qrLat, longitude: qrLng }
    );
    
    // Validate if within 200 meters
    if (distance > 200) {
      return res.status(403).json({ message: 'Please scan QR at the hospital location.' });
    }
    
    res.json({ message: 'Location verified successfully', hospitalId, distance });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Join Queue via QR Scan (AI processed)
router.post('/join-qr', auth, async (req, res) => {
  try {
    const { hospitalId, facilityId, location, symptoms, name, phone } = req.body;
    
    // Check if user already has an active token (waiting or serving)
    const activeToken = await QueueToken.findOne({
      userId: req.user.userId,
      status: { $in: ['waiting', 'serving'] }
    });
    
    if (activeToken) {
      return res.status(400).json({ 
        message: 'You are already in the queue',
        activeTokenId: activeToken._id,
        position: activeToken.position,
        department: activeToken.department,
        estimatedWaitTime: activeToken.estimatedWaitTime
      });
    }
    
    if (!symptoms) {
      return res.status(400).json({ message: 'Symptoms are required' });
    }
    
    // optional facility check
    if (facilityId) {
      const facility = await Facility.findById(facilityId);
      if (!facility) return res.status(400).json({ message: 'Invalid facility selected' });
    }
    
    // 1. Triaging via ML service and personalization
    let department = 'General Medicine';
    let urgency = 'Low';
    try {
      const triageResult = await getAdaptiveDepartment(symptoms);
      department = triageResult.department;
      urgency = triageResult.urgency;
    } catch (err) {
      console.error('Triage service error:', err.message);
    }
    
    const isEmergency = urgency === 'Emergency' || urgency === 'High';

    // 2. Generate token number
    const randomNum = Math.floor(100 + Math.random() * 900);
    const tokenNumber = `QL-${randomNum}`;
    
    // Create token in DB
    const token = new QueueToken({
      userId: req.user.userId,
      hospitalId,
      location,
      department,
      urgency,
      issues: symptoms,
      isEmergency,
      tokenNumber,
      phone
    });
    
    await token.save();
    
    // 3. Add to Redis Queue
    const facilityKey = facilityId ? facilityId : 'default';
    const queueKey = `queue:${facilityKey}:${department}`;
    if (isEmergency) {
      await redisClient.lPush(queueKey, token._id.toString());
    } else {
      await redisClient.rPush(queueKey, token._id.toString());
    }
    
    // 4. Get Position
    const elements = await redisClient.lRange(queueKey, 0, -1);
    const positionIndex = elements.indexOf(token._id.toString());
    
    token.position = positionIndex + 1;
    token.estimatedWaitTime = token.position * AVG_SERVICE_TIME;
    token.facilityId = facilityId || null;
    
    // Calculate appointment timestamp
    const aptTime = new Date();
    aptTime.setMinutes(aptTime.getMinutes() + token.estimatedWaitTime);
    token.appointmentTime = aptTime;
    
    await token.save();
    
    // Broadcast queue update to clients
    req.io.emit('queueUpdate', { department });

    // Send immediate notification about appointment scheduled
    const timeString = aptTime.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    const initialMsg = `Your appointment is scheduled at ${timeString}. Current position: ${token.position}.`;
    req.io.to(token.userId.toString()).emit('notification', { message: initialMsg });
    await notifyPatient(token, initialMsg);

    // Send proximity notification for top 5 positions
    if (token.position <= 5) {
      const urgencyMsg = token.position <= 2 ? 'Leave Now! Your turn is approaching.' : 'Get ready, you are in the next 5.';
      req.io.to(token.userId.toString()).emit('notification', { message: urgencyMsg });
      await notifyPatient(token, urgencyMsg);
    }

    await notifyProximity(department, req.io, facilityId || 'default', facilityId || 'default');
    
    res.status(201).json(token);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Add to Queue
router.post('/join', auth, async (req, res) => {
  try {
    let { facilityId, department, urgency, issues, isEmergency, phone } = req.body;
    
    // Check if user already has an active token (waiting or serving)
    const activeToken = await QueueToken.findOne({
      userId: req.user.userId,
      status: { $in: ['waiting', 'serving'] }
    });
    
    if (activeToken) {
      return res.status(400).json({ 
        message: 'You are already in the queue',
        activeTokenId: activeToken._id,
        position: activeToken.position,
        department: activeToken.department,
        estimatedWaitTime: activeToken.estimatedWaitTime
      });
    }
    
    if (facilityId) {
      const facility = await Facility.findById(facilityId);
      if (!facility) return res.status(400).json({ message: 'Invalid facility selected' });
    }

    if (!department && issues) {
      const triageResult = await getAdaptiveDepartment(issues);
      department = triageResult.department;
      urgency = triageResult.urgency;
      isEmergency = triageResult.urgency === 'Emergency' || triageResult.urgency === 'High';
    }

    // Create token in DB
    const token = new QueueToken({
      userId: req.user.userId,
      facilityId: facilityId || null,
      department,
      urgency,
      issues,
      isEmergency,
      phone
    });
    
    await token.save();
    
    // Add to Redis Queue
    const facilityKey = facilityId ? facilityId : 'default';
    const queueKey = `queue:${facilityKey}:${department}`;
    
    // If emergency, prioritize by adding to front (LPUSH), else back (RPUSH)
    if (isEmergency) {
      await redisClient.lPush(queueKey, token._id.toString());
    } else {
      await redisClient.rPush(queueKey, token._id.toString());
    }
    
    // Get Position
    const elements = await redisClient.lRange(queueKey, 0, -1);
    const positionIndex = elements.indexOf(token._id.toString());
    
    token.position = positionIndex + 1;
    token.estimatedWaitTime = token.position * AVG_SERVICE_TIME;
    token.facilityId = facilityId || null;
    await token.save();
    
    req.io.emit('queueUpdate', { facilityId, department });

    const initialMsg = `Your position is ${token.position} in ${department} (facility: ${facilityId || 'default'}). Estimated wait ${token.estimatedWaitTime} minutes.`;
    req.io.to(token.userId.toString()).emit('notification', { message: initialMsg });
    await notifyPatient(token, initialMsg);

    if (token.position <= 5) {
      const urgencyMsg = token.position <= 2 ? 'Leave Now! Your turn is approaching.' : 'You are within top 5 in queue. Please be ready.';
      req.io.to(token.userId.toString()).emit('notification', { message: urgencyMsg });
      await notifyPatient(token, urgencyMsg);
    }

    await notifyProximity(department, req.io, facilityId || 'default');

    res.status(201).json(token);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Track position
router.get('/status/:tokenId', auth, async (req, res) => {
  try {
    const token = await QueueToken.findById(req.params.tokenId);
    if (!token) return res.status(404).json({ message: 'Token not found' });
    
    if (token.status === 'completed' || token.status === 'cancelled') {
        return res.json(token);
    }
    
    const facilityKey = token.facilityId ? token.facilityId.toString() : 'default';
    const queueKey = `queue:${facilityKey}:${token.department}`;
    const elements = await redisClient.lRange(queueKey, 0, -1);
    const positionIndex = elements.indexOf(token._id.toString());
    
    if (positionIndex === -1 && token.status !== 'serving') {
        // Just fallback
    } else if (positionIndex !== -1) {
      token.position = positionIndex + 1; // 1-based index
      token.estimatedWaitTime = token.position * AVG_SERVICE_TIME;
    }
    
    res.json(token);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Admin Remove user (dequeue)
router.post('/serve/:department', auth, async (req, res) => {
  try {
    // Allow admin and service_providers
    if (req.user.role === 'user') {
      return res.status(403).json({ message: 'Staff only' });
    }

    const { department } = req.params;
    const facilityId = req.query.facilityId || 'default';
    const queueKey = `queue:${facilityId}:${department}`;
    
    // Pop from left (front of queue)
    const tokenId = await redisClient.lPop(queueKey);
    
    if (!tokenId) {
      return res.status(404).json({ message: 'Queue is empty' });
    }
    
    const token = await QueueToken.findById(tokenId);
    token.status = 'serving';
    token.servedAt = new Date();
    token.position = 0;
    token.estimatedWaitTime = 0;
    await token.save();
    
    req.io.emit('queueUpdate', { facilityId, department });
    req.io.to(token.userId.toString()).emit('notification', { message: 'It is your turn now!' });
    await notifyPatient(token, 'It is your turn now! Please proceed to the service desk.');
    await notifyProximity(department, req.io, facilityId);
    
    res.json({ message: 'User serving now', token });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Admin Get all queues with search/filter
router.get('/all', auth, async (req, res) => {
  try {
    if (req.user.role === 'user') return res.status(403).json({ message: 'Staff only' });
    const { name, email, status, department, urgency, startDate, endDate } = req.query;

    const q = await buildQueueQuery({ name, email, status, department, urgency, startDate, endDate });

    // If status is not passed include active statuses
    if (!status) {
      q.status = { $in: ['waiting', 'serving'] };
    }

    const tokens = await QueueToken.find(q)
      .populate('userId', 'name email')
      .sort('createdAt');

    res.json(tokens);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Admin queue analytics
router.get('/analytics', auth, async (req, res) => {
  try {
    if (req.user.role === 'user') return res.status(403).json({ message: 'Staff only' });

    const facilityId = req.query.facilityId;
    const query = facilityId ? { facilityId } : {};
    const allTokens = await QueueToken.find(query);

    const loadByDepartment = allTokens
      .filter(t => ['waiting', 'serving'].includes(t.status))
      .reduce((acc, t) => {
        acc[t.department] = (acc[t.department] || 0) + 1;
        return acc;
      }, {});

    const completed = allTokens.filter(t => t.status === 'completed' && t.servedAt && t.completedAt);
    const avgWaitTimes = completed.reduce((acc, t) => {
      const dept = t.department;
      const waitMinutes = (t.servedAt - t.createdAt) / 60000;
      if (!acc[dept]) acc[dept] = { total: 0, count: 0 };
      acc[dept].total += waitMinutes;
      acc[dept].count += 1;
      return acc;
    }, {});

    const avgWaitTimesResult = Object.entries(avgWaitTimes).map(([dept, item]) => ({
      department: dept,
      averageWait: item.count ? Number((item.total / item.count).toFixed(1)) : 0,
    }));

    const hours = allTokens.reduce((acc, t) => {
      if (!t.createdAt) return acc;
      const hour = new Date(t.createdAt).getHours();
      acc[hour] = (acc[hour] || 0) + 1;
      return acc;
    }, {});

    const peakHours = Object.entries(hours)
      .map(([hour, count]) => ({ hour: `${hour}:00`, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);

    res.json({ loadByDepartment, avgWaitTimes: avgWaitTimesResult, peakHours });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Triage settings and learner
router.get('/triage/settings', auth, async (req, res) => {
  try {
    const settings = await TriageSetting.find();
    res.json(settings);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

router.post('/triage/feedback', auth, async (req, res) => {
  try {
    const { department, feedbackScore } = req.body; // feedbackScore = -1..+1 (bad/good)
    if (!department || typeof feedbackScore !== 'number') {
      return res.status(400).json({ message: 'department and feedbackScore are required' });
    }

    let setting = await TriageSetting.findOne({ department });
    if (!setting) {
      setting = new TriageSetting({ department, score: 1.0 + feedbackScore, votes: 1 });
    } else {
      setting.votes += 1;
      setting.score = Math.max(0.2, Math.min(5.0, ((setting.score * (setting.votes - 1)) + feedbackScore) / setting.votes));
    }
    await setting.save();

    res.json({ message: 'Triage feedback applied', setting });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Get my active queue
router.get('/my-active', auth, async (req, res) => {
  try {
    const token = await QueueToken.findOne({ userId: req.user.userId, status: { $in: ['waiting', 'serving'] } });
    if (!token) return res.status(404).json({ message: 'No active queue' });
    
    if (token.status === 'serving') {
       token.position = 0;
       token.estimatedWaitTime = 0;
    } else {
       const facilityKey = token.facilityId ? token.facilityId.toString() : 'default';
       const queueKey = `queue:${facilityKey}:${token.department}`;
       const elements = await redisClient.lRange(queueKey, 0, -1);
       const positionIndex = elements.indexOf(token._id.toString());
       if (positionIndex !== -1) {
         token.position = positionIndex + 1;
         token.estimatedWaitTime = token.position * AVG_SERVICE_TIME;
       }
    }
    res.json(token);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Admin mark complete
router.post('/complete/:tokenId', auth, async (req, res) => {
  try {
    if (req.user.role === 'user') return res.status(403).json({ message: 'Staff only' });
    
    const token = await QueueToken.findById(req.params.tokenId);
    if (!token) return res.status(404).json({ message: 'Token not found' });
    
    token.status = 'completed';
    token.completedAt = new Date();
    await token.save();
    
    const facilityId = token.facilityId ? token.facilityId.toString() : 'default';
    req.io.emit('queueUpdate', { facilityId, department: token.department });
    await notifyProximity(token.department, req.io, facilityId);
    res.json({ message: 'Token completed', token });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Admin reassign token 
router.post('/reassign/:tokenId', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ message: 'Admin only' });
    
    const { department } = req.body;
    const token = await QueueToken.findById(req.params.tokenId);
    if (!token) return res.status(404).json({ message: 'Token not found' });
    
    // remove from old redis list
    const oldKey = `queue:${token.department}`;
    await redisClient.lRem(oldKey, 0, token._id.toString());
    const oldDept = token.department;
    
    // add to new redis list
    token.department = department;
    const oldFacility = token.facilityId ? token.facilityId.toString() : 'default';
    const newFacility = token.facilityId ? token.facilityId.toString() : 'default';
    const newKey = `queue:${newFacility}:${department}`;
    if (token.isEmergency) {
      await redisClient.lPush(newKey, token._id.toString());
    } else {
      await redisClient.rPush(newKey, token._id.toString());
    }
    
    await token.save();
    req.io.emit('queueUpdate', { department });
    req.io.emit('queueUpdate', { department: oldDept });
    await notifyProximity(department, req.io);
    await notifyProximity(oldDept, req.io);
    
    res.json({ message: 'Reassigned successfully', token });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;

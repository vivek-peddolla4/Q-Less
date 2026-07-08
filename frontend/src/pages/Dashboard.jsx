import { useContext, useEffect, useState } from 'react';
import { AuthContext } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import axios from 'axios';
import { API_BASE_URL, AI_SERVICE_URL } from '../config';
import { Clock, Upload, CheckCircle2, AlertTriangle, QrCode, Activity, User, Mail } from 'lucide-react';
import Navbar from '../components/Navbar';
import UserSidebar from '../components/UserSidebar';
import PatientHistory from '../components/PatientHistory';
import PrescriptionsView from '../components/PrescriptionsView';
import PatientMedicalForm from '../components/PatientMedicalForm';
import HealthAnalytics from '../components/HealthAnalytics';

export default function Dashboard() {
  const navigate = useNavigate();
  const { user, token, logout } = useContext(AuthContext);
  const [activeTab, setActiveTab] = useState('home');
  const [socket, setSocket] = useState(null);
  const [symptoms, setSymptoms] = useState('');
  const [prediction, setPrediction] = useState(null);
  const [queueToken, setQueueToken] = useState(null);
  const [file, setFile] = useState(null);
  const [notification, setNotification] = useState('');
  const [refreshHistoryTrigger, setRefreshHistoryTrigger] = useState(0);
  const [medicalRecords, setMedicalRecords] = useState([]);

  useEffect(() => {
    if (!token) return;

    const fetchActiveQueue = async () => {
      try {
        const { data } = await axios.get(`${API_BASE_URL}/api/queue/my-active`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setQueueToken(data);
      } catch (e) {
        // No active queue found
      }
    };

    const fetchMedicalRecords = async () => {
      try {
        if (!user?.id) {
          console.warn('User ID not available for fetching medical records');
          return;
        }
        console.log('Fetching medical records for user:', user.id);
        const { data } = await axios.get(`${API_BASE_URL}/api/medical/records/${user.id}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        console.log('Medical records fetched:', data);
        setMedicalRecords(data);
      } catch (err) {
        console.error('Error fetching records:', err.response?.data || err.message);
        setMedicalRecords([]);
      }
    };

    fetchActiveQueue();
    fetchMedicalRecords();

    const newSocket = io(API_BASE_URL);
    setSocket(newSocket);

    newSocket.on('connect', () => {
       newSocket.emit('join', user.id);
       newSocket.emit('joinPatientRoom', user.id); // Join patient room for medical record updates
    });

    newSocket.on('queueUpdate', () => {
      if (queueToken) fetchQueueStatus(queueToken._id);
    });

    newSocket.on('notification', (data) => {
      setNotification(data.message);
    });

    newSocket.on('medicalRecordCreated', (data) => {
      // Refresh medical records when a new one is created by a doctor
      console.log('Dashboard: Received medicalRecordCreated event:', data);
      console.log('Comparing user.id:', { received: data.patientId, expected: user.id, match: data.patientId === user.id });
      if (data.patientId === user.id || data.patientId.toString() === user.id || data.patientId.toString() === user.id.toString()) {
        console.log('Dashboard: Refreshing medical records due to new record creation');
        fetchMedicalRecords();
      }
    });

    return () => newSocket.close();
  }, [token, user, queueToken?._id]);

  const fetchQueueStatus = async (tokenId) => {
    try {
      const { data } = await axios.get(`${API_BASE_URL}/api/queue/status/${tokenId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setQueueToken(data);
    } catch(err) {
      console.error(err);
    }
  };

  const analyzeSymptoms = async () => {
    if (!symptoms.trim()) return alert('Please enter your symptoms first!');
    try {
      const { data } = await axios.post(`${AI_SERVICE_URL}/predict`, { symptoms });
      setPrediction(data);
    } catch (err) {
      console.error(err);
      alert('Failed to connect to AI server. Please make sure Python Flask is running! Error: ' + err.message);
    }
  };

  const joinQueue = async () => {
    try {
      const { data } = await axios.post(`${API_BASE_URL}/api/queue/join`, {
        department: prediction.department,
        urgency: prediction.urgency,
        issues: symptoms,
        isEmergency: prediction.urgency === 'Emergency'
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setQueueToken(data);
    } catch (err) {
      if (err.response?.status === 400 && err.response?.data?.message === 'You are already in the queue') {
        const { position, department, estimatedWaitTime } = err.response.data;
        alert(`⏳ You are already in the ${department} queue!\n\nPosition: ${position}\nEstimated Wait: ${estimatedWaitTime} minutes\n\nPlease wait for your turn.`);
        // Set the active token so user can see their queue status
        setQueueToken(err.response.data);
      } else {
        alert('Failed to join queue: ' + (err.response?.data?.message || err.message));
      }
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    const formData = new FormData();
    formData.append('document', file);
    try {
      await axios.post(`${API_BASE_URL}/api/upload`, formData, {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' }
      });
      alert('File uploaded successfully!');
      setFile(null);
    } catch (err) {
      alert('Upload failed');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar user={user} onLogout={logout} title="Q-Less Patient Dashboard" />
      
      <div className="flex flex-1">
        <UserSidebar activeTab={activeTab} setActiveTab={setActiveTab} />

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto">
          <div className="p-8 max-w-6xl">

            {notification && (
              <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 rounded-xl flex items-center gap-3 animate-in slide-in-from-top">
                <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-red-900 font-semibold">{notification}</p>
                </div>
                <button onClick={() => setNotification('')} className="text-red-600 hover:text-red-700">✕</button>
              </div>
            )}

            {/* HOME TAB */}
            {activeTab === 'home' && (
              <div className="space-y-8 animate-in fade-in duration-500">
                <div className="mb-8">
                  <h2 className="text-4xl font-black text-slate-800 mb-2">Welcome, {user?.name}!</h2>
                  <p className="text-slate-500">Manage your health and queue appointments</p>
                </div>

                {/* Symptom Analyzer */}
                {!queueToken || queueToken.status === 'cancelled' || queueToken.status === 'completed' ? (
                  <div className="bg-gradient-to-br from-cyan-50 to-blue-50 p-8 rounded-2xl shadow-lg border-2 border-cyan-200">
                    <h3 className="text-2xl font-black mb-2 text-slate-800">💊 How are you feeling today?</h3>
                    <p className="text-slate-600 mb-6 font-medium">Describe your symptoms to get directed to the right department.</p>
                    
                    <textarea 
                      value={symptoms}
                      onChange={(e) => setSymptoms(e.target.value)}
                      className="w-full p-4 bg-white border-2 border-cyan-300 rounded-xl focus:ring-2 focus:ring-cyan-500 outline-none resize-none h-32 mb-4 transition-all font-medium"
                      placeholder="e.g., I have a severe headache and fever..."
                    ></textarea>
                    
                    <button 
                      onClick={analyzeSymptoms}
                      className="px-8 py-4 bg-gradient-to-r from-cyan-600 to-blue-600 text-white font-black rounded-xl hover:shadow-lg transition transform hover:scale-105 shadow-lg flex items-center text-lg"
                    >
                      <Activity className="w-6 h-6 mr-2" />
                      🤖 Analyze Symptoms with AI
                    </button>

                    {prediction && (
                      <div className="mt-6 p-6 bg-indigo-50 rounded-xl border border-indigo-100 animate-in fade-in">
                        <h3 className="font-bold text-slate-800 mb-4">AI Recommendation:</h3>
                        <div className="flex flex-wrap gap-4 mb-6">
                          <div className="bg-white px-4 py-2 rounded-lg border border-indigo-200 flex items-center">
                            <Activity className="w-4 h-4 text-indigo-600 mr-2" />
                            <span className="text-slate-800 font-semibold">{prediction.department}</span>
                          </div>
                          <div className={`px-4 py-2 rounded-lg font-semibold flex items-center ${
                            prediction.urgency === 'Emergency' ? 'bg-red-100 text-red-700' :
                            prediction.urgency === 'High' ? 'bg-orange-100 text-orange-700' :
                            'bg-green-100 text-green-700'
                          }`}>
                            {prediction.urgency} Urgency
                          </div>
                        </div>
                        <button 
                          onClick={joinQueue}
                          className="w-full py-3 bg-gradient-to-r from-indigo-600 to-cyan-500 text-white font-bold rounded-lg hover:opacity-90 transition"
                        >
                          Join Virtual Queue
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="bg-gradient-to-br from-blue-50 to-cyan-50 p-8 rounded-2xl shadow-lg border-2 border-cyan-200">
                    <h3 className="text-2xl font-black mb-8 text-slate-800 flex items-center gap-2">⏳ Your Current Status</h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="bg-gradient-to-br from-indigo-500 to-cyan-400 p-7 rounded-2xl text-white shadow-lg hover:shadow-xl transition">
                        <p className="text-indigo-100 font-black mb-2 uppercase">📍 Position in Queue</p>
                        <div className="text-6xl font-black mb-4">{queueToken.position || (queueToken.status === 'serving' ? "🟢" : "0")}</div>
                        <span className="inline-block px-4 py-2 bg-white/20 text-sm font-black rounded-lg backdrop-blur-sm">
                          🏥 {queueToken.department}
                        </span>
                      </div>
                      
                      <div className="bg-gradient-to-br from-orange-50 to-yellow-50 p-7 rounded-2xl border-2 border-orange-300 flex flex-col justify-center items-center text-center shadow-lg">
                        <Clock className="w-12 h-12 text-orange-500 mb-3" />
                        <p className="text-slate-600 font-black uppercase">⏱️ Estimated Wait</p>
                        <div className="text-5xl font-black text-slate-800 mt-3">
                          {queueToken.estimatedWaitTime || '0'} <span className="text-lg text-slate-600 font-normal">mins</span>
                        </div>
                      </div>
                    </div>

                    {queueToken.status === 'serving' && (
                      <div className="mt-8 p-6 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-2xl border-2 border-green-300 flex items-center gap-4 font-black text-lg shadow-lg animate-pulse">
                        <CheckCircle2 className="w-8 h-8 flex-shrink-0" />
                        <span>🎉 Please head to the {queueToken.department} counter. It is your turn!</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Quick Actions */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-gradient-to-br from-indigo-50 to-indigo-100 p-7 rounded-2xl border-2 border-indigo-300 shadow-lg hover:shadow-xl transition transform hover:scale-102">
                    <QrCode className="w-10 h-10 text-indigo-600 mb-3" />
                    <h3 className="text-xl font-black text-slate-800 mb-2 flex items-center gap-2">📱 Scan QR Code</h3>
                    <p className="text-slate-600 text-sm mb-5 font-medium">Join the queue instantly at the hospital</p>
                    <button 
                      onClick={() => navigate('/scan')}
                      className="w-full py-3 bg-gradient-to-r from-indigo-600 to-blue-600 text-white font-black rounded-lg hover:shadow-lg transition transform hover:scale-105"
                    >
                      🔍 Scan Now
                    </button>
                  </div>

                  <div className="bg-gradient-to-br from-cyan-50 to-blue-100 p-7 rounded-2xl border-2 border-cyan-300 shadow-lg hover:shadow-xl transition transform hover:scale-102">
                    <Upload className="w-10 h-10 text-cyan-600 mb-3" />
                    <h3 className="text-xl font-black text-slate-800 mb-2 flex items-center gap-2">📄 Upload Documents</h3>
                    <p className="text-slate-600 text-sm mb-5 font-medium">Share medical records and prescriptions</p>
                    <div className="border-2 border-dashed border-cyan-300 rounded-lg p-4 text-center hover:bg-cyan-50 transition cursor-pointer group bg-white">
                      <input 
                        type="file" 
                        id="file-upload" 
                        className="hidden" 
                        onChange={(e) => setFile(e.target.files[0])} 
                      />
                      <label htmlFor="file-upload" className="cursor-pointer w-full block">
                        <Upload className="w-5 h-5 text-slate-400 mx-auto mb-1 group-hover:text-slate-600" />
                        <span className="text-xs font-medium text-slate-600">
                          {file ? file.name : "Click to upload"}
                        </span>
                      </label>
                    </div>
                    {file && (
                      <button 
                        onClick={handleUpload}
                        className="w-full mt-3 py-2 bg-slate-800 text-white rounded-lg font-semibold hover:bg-slate-900 transition"
                      >
                        Upload
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* MEDICAL HISTORY TAB */}
            {activeTab === 'history' && (
              <div className="space-y-6 animate-in fade-in duration-500">
                <h2 className="text-3xl font-black text-slate-800 mb-6">Medical History & Analytics</h2>
                <HealthAnalytics userId={user?.id} token={token} />
                <PatientHistory patientId={user?.id} refreshTrigger={refreshHistoryTrigger} />
              </div>
            )}

            {/* MEDICAL REPORTS TAB */}
            {activeTab === 'reports' && (
              <div className="space-y-6 animate-in fade-in duration-500">
                <div className="flex justify-between items-center">
                  <h2 className="text-3xl font-black text-slate-800 mb-6">Medical Reports & Prescriptions</h2>
                  <PatientMedicalForm onSuccess={() => setRefreshHistoryTrigger(prev => prev + 1)} />
                </div>
                
                <div className="space-y-8">
                  <PrescriptionsView patientId={user?.id} refreshTrigger={refreshHistoryTrigger} />
                  
                  {medicalRecords.length > 0 && (
                    <div className="bg-gradient-to-br from-slate-50 to-purple-50 p-8 rounded-2xl shadow-lg border-2 border-purple-200">
                      <h3 className="text-2xl font-black text-slate-800 mb-6 flex items-center gap-2">📋 My Medical Records</h3>
                      <div className="space-y-3">
                        {medicalRecords.map((record, idx) => (
                          <div key={record._id} className="p-5 bg-white rounded-xl border-2 border-purple-300 hover:border-purple-500 transition transform hover:shadow-lg hover:scale-102">
                            <div className="flex justify-between items-start gap-4">
                              <div className="flex-1">
                                <div className="flex items-center gap-3 mb-3">
                                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-600 to-pink-600 text-white flex items-center justify-center font-bold">
                                    #{idx + 1}
                                  </div>
                                  <div>
                                    <p className="font-black text-slate-800 text-lg">👨‍⚕️ Dr. {record.doctorId?.name}</p>
                                  </div>
                                </div>
                                <div className="grid grid-cols-2 gap-3 mb-3">
                                  <div className="bg-pink-50 p-3 rounded-lg border border-pink-200">
                                    <p className="text-xs text-pink-600 font-bold uppercase mb-1">📋 Diagnosis</p>
                                    <p className="font-semibold text-slate-800">{record.diagnosis}</p>
                                  </div>
                                  <div className="bg-purple-50 p-3 rounded-lg border border-purple-200">
                                    <p className="text-xs text-purple-600 font-bold uppercase mb-1">🏥 Department</p>
                                    <p className="font-semibold text-slate-800">{record.department}</p>
                                  </div>
                                </div>
                                {record.notes && (
                                  <div className="bg-yellow-50 p-3 rounded-lg border-l-4 border-yellow-500 mb-3">
                                    <p className="text-xs text-yellow-600 font-bold uppercase mb-1">📝 Notes</p>
                                    <p className="text-slate-700">{record.notes}</p>
                                  </div>
                                )}
                                <p className="text-xs text-slate-500">📅 {new Date(record.visitDate).toLocaleDateString()}</p>
                              </div>
                              <div className="bg-gradient-to-br from-purple-100 to-pink-100 p-3 rounded-lg border border-purple-300">
                                <p className="text-xs text-purple-700 font-black">✅ RECORDED</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {medicalRecords.length === 0 && (
                    <div className="text-center py-16 bg-gradient-to-br from-white to-slate-50 rounded-2xl border-2 border-dashed border-slate-300 shadow-sm">
                      <p className="text-3xl mb-2">📭</p>
                      <p className="text-slate-600 font-bold text-lg">No medical records yet</p>
                      <p className="text-slate-500 text-sm mt-2">Your medical records will appear here after you visit a doctor</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* PROFILE TAB */}
            {activeTab === 'profile' && (
              <div className="space-y-6 animate-in fade-in duration-500">
                <h2 className="text-3xl font-black text-slate-800 mb-8">👤 My Profile</h2>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Profile Card */}
                  <div className="lg:col-span-2">
                    <div className="bg-gradient-to-br from-indigo-50 to-cyan-50 p-8 rounded-2xl shadow-lg border-2 border-indigo-200 hover:shadow-xl transition-all">
                      {/* Header with Avatar */}
                      <div className="flex items-start justify-between mb-8">
                        <div className="flex items-center space-x-6">
                          <div className="w-32 h-32 rounded-full bg-gradient-to-tr from-indigo-500 via-cyan-400 to-blue-500 flex items-center justify-center text-white text-5xl font-black shadow-xl border-4 border-white">
                            {user?.name?.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <h1 className="text-4xl font-black text-slate-800 leading-tight">{user?.name}</h1>
                            <p className="text-cyan-600 font-bold text-lg mt-2">👤 Patient</p>
                            <div className="flex gap-2 mt-3">
                              <span className="px-3 py-1 bg-green-200 text-green-800 rounded-full text-sm font-bold">✅ Verified</span>
                              <span className="px-3 py-1 bg-blue-200 text-blue-800 rounded-full text-sm font-bold">Active</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Info Cards */}
                      <div className="space-y-3">
                        <div className="flex items-center space-x-4 p-5 bg-white rounded-xl border-l-4 border-indigo-500 hover:shadow-md transition">
                          <Mail className="w-6 h-6 text-indigo-600" />
                          <div className="flex-1">
                            <p className="text-xs text-slate-500 font-bold uppercase">Email Address</p>
                            <p className="font-bold text-slate-800 text-lg break-all">{user?.email}</p>
                          </div>
                        </div>

                        <div className="flex items-center space-x-4 p-5 bg-white rounded-xl border-l-4 border-cyan-500 hover:shadow-md transition">
                          <User className="w-6 h-6 text-cyan-600" />
                          <div className="flex-1">
                            <p className="text-xs text-slate-500 font-bold uppercase">Account Type</p>
                            <p className="font-bold text-slate-800 text-lg">Patient Account</p>
                          </div>
                        </div>

                        <div className="flex items-center space-x-4 p-5 bg-white rounded-xl border-l-4 border-green-500 hover:shadow-md transition">
                          <Activity className="w-6 h-6 text-green-600" />
                          <div className="flex-1">
                            <p className="text-xs text-slate-500 font-bold uppercase">Account Status</p>
                            <p className="font-bold text-slate-800 text-lg">🟢 Active & Healthy</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Stats Sidebar */}
                  <div className="space-y-4">
                    <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-6 rounded-xl border-2 border-blue-300 shadow-lg">
                      <p className="text-sm text-blue-600 font-bold uppercase mb-2">📋 Medical Visits</p>
                      <p className="text-4xl font-black text-blue-700">{medicalRecords.length}</p>
                      <p className="text-blue-600 text-sm mt-2">Total consultations</p>
                    </div>

                    <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-6 rounded-xl border-2 border-purple-300 shadow-lg">
                      <p className="text-sm text-purple-600 font-bold uppercase mb-2">🏥 Your Doctors</p>
                      <p className="text-4xl font-black text-purple-700">{new Set(medicalRecords.map(r => r.doctorId?._id)).size}</p>
                      <p className="text-purple-600 text-sm mt-2">Specialists treating you</p>
                    </div>

                    <div className="bg-gradient-to-br from-green-50 to-green-100 p-6 rounded-xl border-2 border-green-300 shadow-lg">
                      <p className="text-sm text-green-600 font-bold uppercase mb-2">⭐ Profile</p>
                      <p className="text-3xl font-black text-green-700">100%</p>
                      <p className="text-green-600 text-sm mt-2">Profile completeness</p>
                    </div>

                    <div className="bg-gradient-to-br from-red-50 to-red-100 p-6 rounded-xl border-2 border-red-300 shadow-lg">
                      <p className="text-sm text-red-600 font-bold uppercase mb-2">🔐 Security</p>
                      <p className="text-lg font-black text-red-700">Strong</p>
                      <p className="text-red-600 text-sm mt-2">Password protected</p>
                    </div>
                  </div>
                </div>

                {/* Logout Button */}
                <div className="flex gap-3">
                  <button onClick={logout} className="flex-1 py-4 bg-gradient-to-r from-red-600 to-red-700 text-white font-black text-lg rounded-xl hover:shadow-lg transition-all hover:scale-105">
                    🚪 Logout
                  </button>
                  <button className="flex-1 py-4 bg-gradient-to-r from-slate-600 to-slate-700 text-white font-black text-lg rounded-xl hover:shadow-lg transition-all hover:scale-105">
                    📝 Edit Profile
                  </button>
                </div>
              </div>
            )}

          </div>
        </main>
      </div>
    </div>
  );
}

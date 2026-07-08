import { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API_BASE_URL } from '../config';
import { Clock, CheckCircle2, User, Mail, Briefcase, Heart, Activity } from 'lucide-react';
import { io } from 'socket.io-client';
import { toast } from 'react-toastify';
import Navbar from '../components/Navbar';
import DoctorSidebar from '../components/DoctorSidebar';
import CreateMedicalRecord from '../components/CreateMedicalRecord';

export default function DoctorDashboard() {
  const { token, user, logout } = useContext(AuthContext);
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('home');
  const [tokens, setTokens] = useState([]);
  const [stats, setStats] = useState({ totalWaiting: 0, avgWaitTime: 0, completedToday: 0 });
  const [facilities, setFacilities] = useState([]);
  const [selectedFacility, setSelectedFacility] = useState('default');
  const [feedbackTargetPatient, setFeedbackTargetPatient] = useState(null);
  const [feedbackRating, setFeedbackRating] = useState(5);
  const [feedbackComments, setFeedbackComments] = useState('');
  const [socket, setSocket] = useState(null);
  const [medicalRecords, setMedicalRecords] = useState([]);
  const [servingInProgress, setServingInProgress] = useState(false);

  if (!token) {
    navigate('/login');
    return null;
  }

  // Only allow doctors/service providers to access this page
  if (user.role !== 'service_provider') {
    navigate('/');
    return null;
  }

  const fetchQueues = async () => {
    try {
      const query = selectedFacility && selectedFacility !== 'default' ? `?facilityId=${selectedFacility}` : '';
      const { data } = await axios.get(`${API_BASE_URL}/api/queue/all${query}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const myTokens = data.filter(t => t.department === user.specialization);
      setTokens(myTokens);
      
      const waiting = myTokens.filter(t => t.status === 'waiting');
      const completed = myTokens.filter(t => t.status === 'completed' && 
        new Date(t.completedAt).toDateString() === new Date().toDateString()).length;
      const avg = waiting.length > 0 ? waiting.reduce((acc, t) => acc + (t.estimatedWaitTime || 0), 0) / waiting.length : 0;
      setStats({ totalWaiting: waiting.length, avgWaitTime: Math.round(avg), completedToday: completed });
    } catch (err) {
      console.error('Error fetching queues:', err);
    }
  };

  const fetchFacilities = async () => {
    try {
      const { data } = await axios.get(`${API_BASE_URL}/api/queue/facilities`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setFacilities([{ _id: 'default', name: 'Default Facility' }, ...data]);
      setSelectedFacility('default');
    } catch (err) {
      console.error('Error fetching facilities:', err);
    }
  };

  const fetchMedicalRecords = async () => {
    try {
      const { data } = await axios.get(`${API_BASE_URL}/api/medical/admin/all`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMedicalRecords(data.filter(r => r.doctorId?._id === user.id));
    } catch (err) {
      console.error('Error fetching records:', err);
    }
  };

  useEffect(() => {
    if (!token) return;
    
    fetchFacilities();
    fetchQueues();
    fetchMedicalRecords();

    const newSocket = io(API_BASE_URL);
    setSocket(newSocket);

    newSocket.on('connect', () => {
      newSocket.emit('join', user.id);
    });

    newSocket.on('queueUpdate', () => { 
      fetchQueues(); 
    });

    return () => newSocket.close();
  }, [token, user]);

  useEffect(() => {
    if (!token) return;
    fetchQueues();
  }, [selectedFacility]);

  const handleServeNext = async () => {
    if (servingInProgress) return;
    setServingInProgress(true);
    try {
      const query = selectedFacility && selectedFacility !== 'default' ? `?facilityId=${selectedFacility}` : '';
      await axios.post(`${API_BASE_URL}/api/queue/serve/${user.specialization}${query}`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchQueues();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to serve next');
    } finally {
      setServingInProgress(false);
    }
  };

  const submitFeedback = async () => {
    if (!feedbackTargetPatient) {
      return alert('Select a patient first');
    }

    try {
      await axios.post(`${API_BASE_URL}/api/medical/feedback`, {
        doctorId: user.id,
        rating: feedbackRating,
        comments: feedbackComments,
        patientId: feedbackTargetPatient
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      toast.success('Feedback submitted successfully');
      setFeedbackTargetPatient(null);
      setFeedbackRating(5);
      setFeedbackComments('');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to submit feedback');
    }
  };

  const serveData = tokens.filter(t => t.status === 'serving');
  const waitingData = tokens.filter(t => t.status === 'waiting').sort((a, b) => b.isEmergency - a.isEmergency);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar user={user} onLogout={logout} title="Q-Less Doctor Dashboard" />
      
      <div className="flex flex-1">
        <DoctorSidebar activeTab={activeTab} setActiveTab={setActiveTab} />

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto">
          <div className="p-8 max-w-6xl">
            
            {/* HOME TAB */}
            {activeTab === 'home' && (
              <div className="space-y-8 animate-in fade-in duration-500">
                <div className="mb-8 flex flex-col md:flex-row md:items-end md:justify-between gap-4">
                  <div>
                    <h2 className="text-4xl font-black text-slate-800 mb-2">Welcome, Dr. {user?.name}!</h2>
                    <p className="text-slate-500">Specialization: <span className="font-bold text-indigo-600">{user?.specialization}</span></p>
                  </div>
                  <div className="flex items-center gap-3">
                    <label className="text-sm font-medium text-slate-600">Facility</label>
                    <select value={selectedFacility} onChange={(e) => setSelectedFacility(e.target.value)} className="border rounded-lg px-3 py-2">
                      {facilities.map(f => (
                        <option key={f._id} value={f._id}>{f.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="bg-gradient-to-br from-indigo-500 to-indigo-600 text-white p-6 rounded-2xl shadow-lg">
                    <Clock className="w-8 h-8 mb-3 text-indigo-200" />
                    <p className="text-indigo-100 text-sm font-medium">Total Waiting</p>
                    <p className="text-4xl font-black mt-2">{stats.totalWaiting}</p>
                  </div>

                  <div className="bg-gradient-to-br from-cyan-500 to-blue-600 text-white p-6 rounded-2xl shadow-lg">
                    <CheckCircle2 className="w-8 h-8 mb-3 text-cyan-200" />
                    <p className="text-cyan-100 text-sm font-medium">Completed Today</p>
                    <p className="text-4xl font-black mt-2">{stats.completedToday}</p>
                  </div>

                  <div className="bg-gradient-to-br from-purple-500 to-pink-600 text-white p-6 rounded-2xl shadow-lg">
                    <Clock className="w-8 h-8 mb-3 text-purple-200" />
                    <p className="text-purple-100 text-sm font-medium">Avg Wait Time</p>
                    <p className="text-4xl font-black mt-2">{stats.avgWaitTime} <span className="text-lg font-semibold">min</span></p>
                  </div>
                </div>

                {/* Currently Serving */}
                {serveData.length > 0 && (
                  <div className="bg-green-50 border-l-4 border-green-500 p-6 rounded-2xl">
                    <h3 className="text-lg font-bold text-green-900 mb-4 flex items-center">
                      <CheckCircle2 className="w-5 h-5 mr-2 text-green-600" />
                      Currently Serving
                    </h3>
                    <div className="space-y-3">
                      {serveData.map(t => (
                        <div key={t._id} className="bg-white p-4 rounded-xl border border-green-200 shadow-sm">
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                            <div>
                              <p className="font-bold text-slate-800">{t.userId?.name || 'Unknown'}</p>
                              <p className="text-sm text-slate-500">{t.issues}</p>
                            </div>
                            <div className="flex gap-2">
                              <CreateMedicalRecord 
                                patientId={t.userId?._id} 
                                patientName={t.userId?.name}
                                queueTokenId={t._id}
                                onSuccess={() => {
                                  fetchQueues();
                                }}
                              />
                              <button onClick={async () => {
                                try {
                                  await axios.post(`${API_BASE_URL}/api/queue/complete/${t._id}`, {}, { 
                                    headers: { Authorization: `Bearer ${token}` }
                                  });
                                  fetchQueues();
                                } catch(e) { 
                                  alert('Failed to complete session'); 
                                }
                              }} className="px-4 py-2 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 transition">
                                Mark as Done
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Patient Queue */}
                <div className="bg-gradient-to-br from-slate-50 to-blue-50 p-8 rounded-2xl shadow-lg border-2 border-blue-200">
                  <div className="flex justify-between items-center mb-8">
                    <div>
                      <h3 className="text-3xl font-black text-slate-800 flex items-center gap-2">👥 Patient Queue</h3>
                      <p className="text-slate-600 mt-2">Waiting for consultation</p>
                    </div>
                    <button onClick={handleServeNext} disabled={servingInProgress} className={`px-6 py-3 font-black text-lg rounded-xl transition transform hover:scale-105 ${
                      servingInProgress ? 'bg-slate-300 text-slate-600 cursor-not-allowed' : 'bg-gradient-to-r from-indigo-600 to-cyan-600 text-white hover:shadow-lg'
                    }`}>
                      {servingInProgress ? '⏳ Serving...' : '➡️ Serve Next'}
                    </button>
                  </div>

                  {waitingData.length === 0 ? (
                    <div className="py-16 text-center bg-white rounded-2xl border-2 border-dashed border-slate-300 shadow-sm">
                      <p className="text-3xl mb-2">✨</p>
                      <p className="text-slate-600 font-bold text-lg">No patients waiting</p>
                      <p className="text-slate-500 text-sm mt-2">Queue is clear! Great work!</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {waitingData.map((t, idx) => (
                        <div key={t._id} className={`p-5 rounded-xl border-2 flex items-center justify-between transition transform hover:scale-102 ${
                          t.isEmergency 
                            ? 'bg-gradient-to-r from-red-100 to-pink-100 border-red-400 shadow-lg' 
                            : 'bg-white border-slate-200 hover:border-indigo-400 hover:shadow-md'
                        }`}>
                          <div className="flex items-center space-x-4">
                            <div className={`w-12 h-12 rounded-full font-black text-white flex items-center justify-center text-lg ${
                              t.isEmergency ? 'bg-gradient-to-br from-red-600 to-pink-600 shadow-lg' : 'bg-gradient-to-br from-indigo-600 to-cyan-600 shadow-md'
                            }`}>
                              #{idx + 1}
                            </div>
                            <div>
                              <p className="font-black text-slate-800 text-lg">{t.userId?.name}</p>
                              <p className="text-sm text-slate-600">📝 {t.issues}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            {t.isEmergency && (
                              <span className="bg-gradient-to-r from-red-600 to-pink-600 text-white px-3 py-1 text-xs font-black rounded-full animate-pulse">
                                🚨 EMERGENCY
                              </span>
                            )}
                            <span className={`px-3 py-1 text-xs font-bold rounded-lg ${
                              t.urgency === 'Emergency' ? 'bg-red-200 text-red-800' :
                              t.urgency === 'High' ? 'bg-orange-200 text-orange-800' :
                              'bg-green-200 text-green-800'
                            }`}>
                              {t.urgency}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* HISTORY TAB */}
            {activeTab === 'history' && (
              <div className="space-y-6 animate-in fade-in duration-500">
                <div>
                  <h2 className="text-3xl font-black text-slate-800 mb-2">📜 Patient Visit History</h2>
                  <p className="text-slate-600">All patients you've consulted with</p>
                </div>

                <div className="bg-gradient-to-br from-slate-50 to-purple-50 p-8 rounded-2xl shadow-lg border-2 border-purple-200">
                  {tokens.length === 0 ? (
                    <div className="py-16 text-center bg-white rounded-2xl border-2 border-dashed border-slate-300">
                      <p className="text-3xl mb-2">📭</p>
                      <p className="text-slate-600 font-bold text-lg">No patient visits yet</p>
                      <p className="text-slate-500 text-sm mt-2">Patients will appear here after consultation</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {tokens.map((t, idx) => (
                        <div key={t._id} className={`p-5 rounded-xl border-2 transition transform hover:scale-102 hover:shadow-lg ${
                          t.status === 'completed' ? 'bg-gradient-to-r from-green-50 to-emerald-50 border-green-300' :
                          t.status === 'serving' ? 'bg-gradient-to-r from-blue-50 to-cyan-50 border-blue-300' :
                          'bg-gradient-to-r from-yellow-50 to-orange-50 border-yellow-300'
                        }`}>
                          <div className="flex justify-between items-start">
                            <div className="flex items-start gap-4 flex-1">
                              <div className={`w-10 h-10 rounded-full font-bold flex items-center justify-center text-white text-sm ${
                                t.status === 'completed' ? 'bg-gradient-to-br from-green-600 to-emerald-600' :
                                t.status === 'serving' ? 'bg-gradient-to-br from-blue-600 to-cyan-600' :
                                'bg-gradient-to-br from-yellow-600 to-orange-600'
                              }`}>
                                #{idx + 1}
                              </div>
                              <div>
                                <p className="font-black text-slate-800 text-lg">{t.userId?.name}</p>
                                <p className="text-sm text-slate-600 mt-1">📝 <strong>Issues:</strong> {t.issues}</p>
                                <p className="text-sm text-slate-600">🏥 <strong>Department:</strong> {t.department}</p>
                                <p className="text-sm text-slate-600">📅 <strong>Date:</strong> {new Date(t.visitDate).toLocaleDateString()}</p>
                              </div>
                            </div>
                            <div className="flex flex-col gap-2 items-end">
                              <span className={`px-3 py-1.5 text-xs font-black rounded-full ${
                                t.status === 'completed' ? 'bg-green-200 text-green-800' :
                                t.status === 'serving' ? 'bg-blue-200 text-blue-800' :
                                'bg-yellow-200 text-yellow-800'
                              }`}>
                                {t.status === 'completed' ? '✅ Completed' :
                                 t.status === 'serving' ? '👨‍⚕️ Serving' :
                                 '⏳ Waiting'}
                              </span>
                              <button onClick={() => setFeedbackTargetPatient(t.userId?._id)} className="px-3 py-1.5 text-xs font-bold rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition">
                                ⭐ Rate
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="bg-white p-6 rounded-2xl border border-slate-200 mt-6">
                  <h3 className="text-xl font-bold text-slate-800 mb-4">Submit Patient Feedback / Rating</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-slate-600">Patient</label>
                      <input value={feedbackTargetPatient || ''} disabled placeholder="Choose from history cards" className="mt-1 w-full border rounded-lg px-3 py-2" />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-slate-600">Rating (1-5)</label>
                      <input type="number" min="1" max="5" value={feedbackRating} onChange={e => setFeedbackRating(Number(e.target.value))} className="mt-1 w-full border rounded-lg px-3 py-2" />
                    </div>
                  </div>

                  <div className="mt-4">
                    <label className="text-sm font-medium text-slate-600">Comments</label>
                    <textarea value={feedbackComments} onChange={e => setFeedbackComments(e.target.value)} className="mt-1 w-full border rounded-lg px-3 py-2" rows="3" />
                  </div>

                  <button onClick={submitFeedback} className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-lg">Submit Feedback</button>
                </div>
              </div>
            )}

            {/* MEDICAL RECORDS TAB */}
            {activeTab === 'records' && (
              <div className="space-y-6 animate-in fade-in duration-500">
                <div>
                  <h2 className="text-3xl font-black text-slate-800 mb-2">📋 Medical Records I Created</h2>
                  <p className="text-slate-600">Complete documentation of all consultations</p>
                </div>

                <div className="bg-gradient-to-br from-slate-50 to-green-50 p-8 rounded-2xl shadow-lg border-2 border-green-200">
                  {medicalRecords.length === 0 ? (
                    <div className="py-16 text-center bg-white rounded-2xl border-2 border-dashed border-slate-300">
                      <p className="text-3xl mb-2">📭</p>
                      <p className="text-slate-600 font-bold text-lg">No medical records created yet</p>
                      <p className="text-slate-500 text-sm mt-2">Records will appear here after you create them for patients</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {medicalRecords.map((record, idx) => (
                        <div key={record._id} className="p-5 bg-white rounded-xl border-2 border-green-300 hover:border-green-500 transition transform hover:shadow-lg hover:scale-102">
                          <div className="flex justify-between items-start gap-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-3">
                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-600 to-emerald-600 text-white flex items-center justify-center font-bold">
                                  #{idx + 1}
                                </div>
                                <div>
                                  <p className="font-black text-slate-800 text-lg">{record.patientId?.name || 'Unknown'}</p>
                                  <p className="text-xs text-slate-500">Patient ID: {record.patientId?._id?.slice(-6)}</p>
                                </div>
                              </div>
                              <div className="grid grid-cols-2 gap-3 mb-3">
                                <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
                                  <p className="text-xs text-blue-600 font-bold uppercase mb-1">📋 Diagnosis</p>
                                  <p className="font-semibold text-slate-800">{record.diagnosis}</p>
                                </div>
                                <div className="bg-cyan-50 p-3 rounded-lg border border-cyan-200">
                                  <p className="text-xs text-cyan-600 font-bold uppercase mb-1">🏥 Department</p>
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
                            <div className="bg-gradient-to-br from-green-100 to-emerald-100 p-3 rounded-lg border border-green-300">
                              <p className="text-xs text-green-700 font-black">✅ RECORDED</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* PROFILE TAB */}
            {activeTab === 'profile' && (
              <div className="space-y-6 animate-in fade-in duration-500">
                <h2 className="text-3xl font-black text-slate-800 mb-8">👨‍⚕️ Doctor Profile</h2>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Profile Card */}
                  <div className="lg:col-span-2">
                    <div className="bg-gradient-to-br from-purple-50 via-pink-50 to-indigo-50 p-8 rounded-2xl shadow-lg border-2 border-purple-300 hover:shadow-xl transition-all">
                      {/* Header */}
                      <div className="flex items-start justify-between mb-8">
                        <div className="flex items-center space-x-6">
                          <div className="w-32 h-32 rounded-full bg-gradient-to-tr from-purple-500 via-pink-400 to-indigo-500 flex items-center justify-center text-white text-5xl font-black shadow-xl border-4 border-white">
                            {user?.name?.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <h1 className="text-4xl font-black text-slate-800">Dr. {user?.name}</h1>
                            <p className="text-purple-600 font-black text-xl mt-2">{user?.specialization}</p>
                            <div className="flex gap-2 mt-3">
                              <span className="px-3 py-1 bg-green-200 text-green-800 rounded-full text-sm font-bold">✅ Verified Doctor</span>
                              <span className="px-3 py-1 bg-blue-200 text-blue-800 rounded-full text-sm font-bold">⭐ 4.8 Rating</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Info Cards */}
                      <div className="space-y-3">
                        <div className="flex items-center space-x-4 p-5 bg-white rounded-xl border-l-4 border-purple-500 hover:shadow-md transition">
                          <Mail className="w-6 h-6 text-purple-600" />
                          <div className="flex-1">
                            <p className="text-xs text-slate-500 font-bold uppercase">Email Address</p>
                            <p className="font-bold text-slate-800 text-lg break-all">{user?.email}</p>
                          </div>
                        </div>

                        <div className="flex items-center space-x-4 p-5 bg-white rounded-xl border-l-4 border-indigo-500 hover:shadow-md transition">
                          <Briefcase className="w-6 h-6 text-indigo-600" />
                          <div className="flex-1">
                            <p className="text-xs text-slate-500 font-bold uppercase">Specialization</p>
                            <p className="font-bold text-slate-800 text-lg">{user?.specialization || 'General Medicine'}</p>
                          </div>
                        </div>

                        <div className="flex items-center space-x-4 p-5 bg-white rounded-xl border-l-4 border-pink-500 hover:shadow-md transition">
                          <Heart className="w-6 h-6 text-pink-600" />
                          <div className="flex-1">
                            <p className="text-xs text-slate-500 font-bold uppercase">License Status</p>
                            <p className="font-bold text-slate-800 text-lg">🔐 Active & Verified</p>
                          </div>
                        </div>

                        <div className="flex items-center space-x-4 p-5 bg-white rounded-xl border-l-4 border-green-500 hover:shadow-md transition">
                          <Clock className="w-6 h-6 text-green-600" />
                          <div className="flex-1">
                            <p className="text-xs text-slate-500 font-bold uppercase">Availability</p>
                            <p className="font-bold text-slate-800 text-lg">🟢 Online & Available</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Stats Sidebar */}
                  <div className="space-y-4">
                    <div className="bg-gradient-to-br from-pink-50 to-pink-100 p-6 rounded-xl border-2 border-pink-300 shadow-lg">
                      <p className="text-sm text-pink-600 font-bold uppercase mb-2">💖 Rating</p>
                      <p className="text-4xl font-black text-pink-700">4.8</p>
                      <p className="text-pink-600 text-sm mt-2">⭐⭐⭐⭐⭐ Excellent</p>
                    </div>

                    <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-6 rounded-xl border-2 border-blue-300 shadow-lg">
                      <p className="text-sm text-blue-600 font-bold uppercase mb-2">👥 Patients</p>
                      <p className="text-4xl font-black text-blue-700">247</p>
                      <p className="text-blue-600 text-sm mt-2">Success stories</p>
                    </div>

                    <div className="bg-gradient-to-br from-green-50 to-green-100 p-6 rounded-xl border-2 border-green-300 shadow-lg">
                      <p className="text-sm text-green-600 font-bold uppercase mb-2">✅ Consultations</p>
                      <p className="text-4xl font-black text-green-700">892</p>
                      <p className="text-green-600 text-sm mt-2">Total completed</p>
                    </div>

                    <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 p-6 rounded-xl border-2 border-yellow-300 shadow-lg">
                      <p className="text-sm text-yellow-600 font-bold uppercase mb-2">📅 Experience</p>
                      <p className="text-3xl font-black text-yellow-700">12+ yrs</p>
                      <p className="text-yellow-600 text-sm mt-2">In practice</p>
                    </div>
                  </div>
                </div>

                {/* Logout Button */}
                <div className="flex gap-3">
                  <button onClick={logout} className="flex-1 py-4 bg-gradient-to-r from-red-600 to-red-700 text-white font-black text-lg rounded-xl hover:shadow-lg transition-all hover:scale-105">
                    🚪 Logout
                  </button>
                  <button className="flex-1 py-4 bg-gradient-to-r from-slate-600 to-slate-700 text-white font-black text-lg rounded-xl hover:shadow-lg transition-all hover:scale-105">
                    ⚙️ Settings
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

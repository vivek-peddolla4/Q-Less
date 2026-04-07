import { useContext, useEffect, useState } from 'react';
import { AuthContext } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import axios from 'axios';
import { Clock, Upload, CheckCircle2, AlertTriangle, QrCode, Activity, User, Mail } from 'lucide-react';
import Navbar from '../components/Navbar';
import UserSidebar from '../components/UserSidebar';
import PatientHistory from '../components/PatientHistory';
import PrescriptionsView from '../components/PrescriptionsView';
import PatientMedicalForm from '../components/PatientMedicalForm';

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
        const { data } = await axios.get('http://localhost:8000/api/queue/my-active', {
          headers: { Authorization: `Bearer ${token}` }
        });
        setQueueToken(data);
      } catch (e) {
        // No active queue found
      }
    };

    const fetchMedicalRecords = async () => {
      try {
        const { data } = await axios.get(`http://localhost:8000/api/medical/records/${user.id}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setMedicalRecords(data);
      } catch (err) {
        console.error('Error fetching records:', err);
      }
    };

    fetchActiveQueue();
    fetchMedicalRecords();

    const newSocket = io('http://localhost:8000');
    setSocket(newSocket);

    newSocket.on('connect', () => {
       newSocket.emit('join', user.id);
    });

    newSocket.on('queueUpdate', () => {
      if (queueToken) fetchQueueStatus(queueToken._id);
    });

    newSocket.on('notification', (data) => {
      setNotification(data.message);
    });

    return () => newSocket.close();
  }, [token, user, queueToken?._id]);

  const fetchQueueStatus = async (tokenId) => {
    try {
      const { data } = await axios.get(`http://localhost:8000/api/queue/status/${tokenId}`, {
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
      const { data } = await axios.post('http://localhost:5000/predict', { symptoms });
      setPrediction(data);
    } catch (err) {
      console.error(err);
      alert('Failed to connect to AI server. Please make sure Python Flask is running! Error: ' + err.message);
    }
  };

  const joinQueue = async () => {
    try {
      const { data } = await axios.post('http://localhost:8000/api/queue/join', {
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
      await axios.post('http://localhost:8000/api/upload', formData, {
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
                  <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-slate-100">
                    <h3 className="text-2xl font-bold mb-2 text-slate-800">How are you feeling today?</h3>
                    <p className="text-slate-500 mb-6">Describe your symptoms to get directed to the right department.</p>
                    
                    <textarea 
                      value={symptoms}
                      onChange={(e) => setSymptoms(e.target.value)}
                      className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none resize-none h-32 mb-4 transition-all"
                      placeholder="e.g., I have a severe headache and fever..."
                    ></textarea>
                    
                    <button 
                      onClick={analyzeSymptoms}
                      className="px-6 py-3 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition shadow-lg shadow-indigo-200 flex items-center"
                    >
                      <Activity className="w-5 h-5 mr-2" />
                      Analyze Symptoms with AI
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
                  <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-slate-100">
                    <h3 className="text-2xl font-bold mb-6 text-slate-800">Your Current Status</h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="bg-gradient-to-br from-indigo-500 to-cyan-400 p-6 rounded-2xl text-white shadow-lg">
                        <p className="text-indigo-100 font-medium mb-2">Position in Queue</p>
                        <div className="text-5xl font-black mb-3">{queueToken.position || (queueToken.status === 'serving' ? "Now" : "0")}</div>
                        <span className="inline-block px-3 py-1 bg-white/20 text-sm font-semibold rounded-lg">
                          {queueToken.department}
                        </span>
                      </div>
                      
                      <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 flex flex-col justify-center items-center text-center">
                        <Clock className="w-10 h-10 text-orange-500 mb-3" />
                        <p className="text-slate-500 font-medium">Estimated Wait</p>
                        <div className="text-4xl font-black text-slate-800 mt-1">
                          {queueToken.estimatedWaitTime} <span className="text-lg text-slate-500 font-normal">mins</span>
                        </div>
                      </div>
                    </div>

                    {queueToken.status === 'serving' && (
                      <div className="mt-6 p-4 bg-green-50 text-green-700 rounded-lg border border-green-200 flex items-center gap-3 font-semibold">
                        <CheckCircle2 className="w-6 h-6" />
                        Please head to the {queueToken.department} counter. It is your turn!
                      </div>
                    )}
                  </div>
                )}

                {/* Quick Actions */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-gradient-to-br from-indigo-50 to-white p-6 rounded-2xl border border-indigo-100 shadow-sm">
                    <QrCode className="w-8 h-8 text-indigo-600 mb-3" />
                    <h3 className="text-lg font-bold text-slate-800 mb-2">Scan QR Code</h3>
                    <p className="text-slate-600 text-sm mb-4">Join the queue instantly at the hospital</p>
                    <button 
                      onClick={() => navigate('/scan')}
                      className="w-full py-2 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition"
                    >
                      Scan Now
                    </button>
                  </div>

                  <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                    <Upload className="w-8 h-8 text-cyan-600 mb-3" />
                    <h3 className="text-lg font-bold text-slate-800 mb-2">Upload Documents</h3>
                    <p className="text-slate-600 text-sm mb-4">Share medical records and prescriptions</p>
                    <div className="border-2 border-dashed border-slate-200 rounded-lg p-4 text-center hover:bg-slate-50 transition cursor-pointer group">
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
                <h2 className="text-3xl font-black text-slate-800 mb-6">Medical History</h2>
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
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                      <h3 className="text-xl font-bold text-slate-800 mb-4">Medical Records</h3>
                      <div className="space-y-3">
                        {medicalRecords.map(record => (
                          <div key={record._id} className="p-4 bg-slate-50 rounded-xl border border-slate-200 hover:border-indigo-300 transition">
                            <div className="flex justify-between items-start">
                              <div>
                                <p className="font-bold text-slate-800">Dr. {record.doctorId?.name}</p>
                                <p className="text-sm text-slate-600"><strong>Diagnosis:</strong> {record.diagnosis}</p>
                                <p className="text-sm text-slate-600"><strong>Department:</strong> {record.department}</p>
                                <p className="text-sm text-slate-600"><strong>Date:</strong> {new Date(record.visitDate).toLocaleDateString()}</p>
                                {record.notes &&  <p className="text-sm text-slate-600 mt-2"><strong>Notes:</strong> {record.notes}</p>}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {medicalRecords.length === 0 && (
                    <div className="text-center py-12 bg-slate-50 rounded-xl border-2 border-dashed border-slate-200">
                      <p className="text-slate-500">No medical records found</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* PROFILE TAB */}
            {activeTab === 'profile' && (
              <div className="space-y-6 animate-in fade-in duration-500">
                <h2 className="text-3xl font-black text-slate-800 mb-6">Profile</h2>

                <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100 max-w-md">
                  <div className="text-center mb-8">
                    <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-indigo-500 to-cyan-400 flex items-center justify-center text-white text-4xl font-bold mx-auto shadow-lg">
                      {user?.name?.charAt(0).toUpperCase()}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center space-x-3 p-4 bg-slate-50 rounded-xl">
                      <User className="w-5 h-5 text-indigo-600" />
                      <div>
                        <p className="text-xs text-slate-500 uppercase tracking-wide">Name</p>
                        <p className="font-bold text-slate-800">{user?.name}</p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-3 p-4 bg-slate-50 rounded-xl">
                      <Mail className="w-5 h-5 text-cyan-600" />
                      <div>
                        <p className="text-xs text-slate-500 uppercase tracking-wide">Email</p>
                        <p className="font-bold text-slate-800 break-all">{user?.email}</p>
                      </div>
                    </div>
                  </div>

                  <button onClick={logout} className="w-full mt-8 py-3 bg-red-600 text-white font-bold rounded-lg hover:bg-red-700 transition">
                    Logout
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

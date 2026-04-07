import { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Clock, CheckCircle2, User, Mail, Briefcase } from 'lucide-react';
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

  const fetchQueues = async () => {
    try {
      const query = selectedFacility && selectedFacility !== 'default' ? `?facilityId=${selectedFacility}` : '';
      const { data } = await axios.get(`http://localhost:8000/api/queue/all${query}`, {
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
      const { data } = await axios.get('http://localhost:8000/api/queue/facilities', {
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
      const { data } = await axios.get(`http://localhost:8000/api/medical/admin/all`, {
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

    const newSocket = io('http://localhost:8000');
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
      await axios.post(`http://localhost:8000/api/queue/serve/${user.specialization}${query}`, {}, {
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
      await axios.post('http://localhost:8000/api/medical/feedback', {
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
                                  await axios.post(`http://localhost:8000/api/queue/complete/${t._id}`, {}, { 
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
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                  <div className="flex justify-between items-center mb-6">
                    <h3 className="text-2xl font-bold text-slate-800">Patient Queue</h3>
                    <button onClick={handleServeNext} disabled={servingInProgress} className={`px-4 py-2 font-semibold rounded-lg transition ${servingInProgress ? 'bg-slate-300 text-slate-600 cursor-not-allowed' : 'bg-indigo-600 text-white hover:bg-indigo-700'}`}>
                      {servingInProgress ? 'Serving...' : 'Serve Next'}
                    </button>
                  </div>

                  {waitingData.length === 0 ? (
                    <div className="py-12 text-center bg-slate-50 rounded-xl border-2 border-dashed border-slate-200">
                      <p className="text-slate-500 font-medium">No patients waiting</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {waitingData.map((t, idx) => (
                        <div key={t._id} className={`p-4 rounded-xl border flex items-center justify-between transition ${
                          t.isEmergency ? 'bg-red-50 border-red-200' : 'bg-slate-50 border-slate-200 hover:border-indigo-300'
                        }`}>
                          <div className="flex items-center space-x-4">
                            <div className={`w-10 h-10 rounded-full font-bold text-white flex items-center justify-center ${
                              t.isEmergency ? 'bg-red-500' : 'bg-indigo-500'
                            }`}>
                              #{idx + 1}
                            </div>
                            <div>
                              <p className="font-semibold text-slate-800">{t.userId?.name}</p>
                              <p className="text-sm text-slate-600">{t.issues}</p>
                            </div>
                          </div>
                          {t.isEmergency && <span className="bg-red-100 text-red-700 px-2 py-1 text-xs font-bold rounded">Emergency</span>}
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
                <h2 className="text-3xl font-black text-slate-800 mb-6">Patient History</h2>

                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                  {tokens.length === 0 ? (
                    <div className="py-12 text-center">
                      <p className="text-slate-500">No patient visits found</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {tokens.map(t => (
                        <div key={t._id} className="p-4 bg-slate-50 rounded-xl border border-slate-200 hover:border-indigo-300 transition">
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="font-bold text-slate-800">{t.userId?.name}</p>
                              <p className="text-sm text-slate-600 mt-1"><strong>Issues:</strong> {t.issues}</p>
                              <p className="text-sm text-slate-600"><strong>Department:</strong> {t.department}</p>
                              <p className="text-sm text-slate-600"><strong>Visit Date:</strong> {new Date(t.visitDate).toLocaleDateString()}</p>
                            </div>
                            <span className={`px-3 py-1 text-xs font-bold rounded-lg ${
                              t.status === 'completed' ? 'bg-green-100 text-green-700' :
                              t.status === 'serving' ? 'bg-blue-100 text-blue-700' :
                              'bg-yellow-100 text-yellow-700'
                            }`}>
                              {t.status.toUpperCase()}
                            </span>
                          </div>
                          <div className="mt-2 flex gap-2">
                            <button onClick={() => setFeedbackTargetPatient(t.userId?._id)} className="px-3 py-1 text-xs font-semibold rounded-lg bg-indigo-600 text-white hover:bg-indigo-700">
                              Rate patient
                            </button>
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
                <h2 className="text-3xl font-black text-slate-800 mb-6">Medical Records Created</h2>

                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                  {medicalRecords.length === 0 ? (
                    <div className="py-12 text-center">
                      <p className="text-slate-500">No medical records yet</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {medicalRecords.map(record => (
                        <div key={record._id} className="p-4 bg-slate-50 rounded-xl border border-slate-200 hover:border-indigo-300 transition">
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="font-bold text-slate-800">{record.patientId?.name || 'Unknown'}</p>
                              <p className="text-sm text-slate-600 mt-1"><strong>Diagnosis:</strong> {record.diagnosis}</p>
                              <p className="text-sm text-slate-600"><strong>Department:</strong> {record.department}</p>
                              <p className="text-sm text-slate-600"><strong>Date:</strong> {new Date(record.visitDate).toLocaleDateString()}</p>
                              {record.notes && <p className="text-sm text-slate-600 mt-2"><strong>Notes:</strong> {record.notes}</p>}
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

                    <div className="flex items-center space-x-3 p-4 bg-slate-50 rounded-xl">
                      <Briefcase className="w-5 h-5 text-purple-600" />
                      <div>
                        <p className="text-xs text-slate-500 uppercase tracking-wide">Specialization</p>
                        <p className="font-bold text-slate-800">{user?.specialization}</p>
                      </div>
                    </div>
                  </div>

                  <button onClick={logout} className="w-full mt-8 py-3 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition">
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

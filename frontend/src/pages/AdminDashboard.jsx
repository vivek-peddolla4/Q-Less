import { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API_BASE_URL } from '../config';
import { Users, Clock, ArrowRight, CheckCircle2, Bell, User, Mail, Shield, Activity } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { io } from 'socket.io-client';
import { toast } from 'react-toastify';
import Navbar from '../components/Navbar';
import AdminSidebar from '../components/AdminSidebar';

export default function AdminDashboard() {
  const { token, user, logout } = useContext(AuthContext);
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [tokens, setTokens] = useState([]);
  const [stats, setStats] = useState([]);
  const [facilities, setFacilities] = useState([]);
  const [selectedFacility, setSelectedFacility] = useState('default');
  const [analyticsData, setAnalyticsData] = useState({ loadByDepartment: {}, avgWaitTimes: [], peakHours: [] });
  const [queueFilters, setQueueFilters] = useState({ name: '', email: '', status: '', department: '', urgency: '', startDate: '', endDate: '' });
  const [socket, setSocket] = useState(null);
  const [callNotifications, setCallNotifications] = useState([]);
  const [medicalRecords, setMedicalRecords] = useState([]);
  const [servingInProgress, setServingInProgress] = useState(false);

  if (!token) {
    navigate('/login');
    return null;
  }

  // Only allow admins to access this page
  if (user.role !== 'admin') {
    navigate('/');
    return null;
  }

  const handleReassign = async (tokenId, newDepartment) => {
    if(!newDepartment) return;
    try {
      await axios.post(`${API_BASE_URL}/api/queue/reassign/${tokenId}`, { department: newDepartment }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchQueues();
    } catch(e) {
      alert('Failed to reassign');
    }
  };

  const fetchQueues = async (filters = {}) => {
    try {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value) params.append(key, value);
      });
      if (selectedFacility && selectedFacility !== 'default') {
        params.append('facilityId', selectedFacility);
      }

      const { data } = await axios.get(`${API_BASE_URL}/api/queue/all?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setTokens(data);
      
      const deptCounts = {};
      data.forEach(t => {
        if (t.status === 'waiting') {
           deptCounts[t.department] = (deptCounts[t.department] || 0) + 1;
        }
      });
      const chartData = Object.keys(deptCounts).map(key => ({
        name: key,
        Waiting: deptCounts[key]
      }));
      setStats(chartData);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchMedicalRecords = async () => {
    try {
      const { data } = await axios.get(`${API_BASE_URL}/api/medical/admin/all`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMedicalRecords(data);
    } catch (err) {
      console.error('Error fetching records:', err);
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

  const fetchAnalytics = async () => {
    try {
      const facilityQuery = selectedFacility && selectedFacility !== 'default' ? `?facilityId=${selectedFacility}` : '';
      const { data } = await axios.get(`${API_BASE_URL}/api/queue/analytics${facilityQuery}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setAnalyticsData(data);
    } catch (err) {
      console.error('Error fetching analytics:', err);
    }
  };

  useEffect(() => {
    fetchFacilities();
    fetchQueues(queueFilters);
    fetchMedicalRecords();
    fetchAnalytics();
    
    const newSocket = io(API_BASE_URL);
    setSocket(newSocket);

    newSocket.on('queueUpdate', () => {
      fetchQueues(queueFilters);
      fetchAnalytics();
    });

    newSocket.on('callNextPatient', (data) => {
      const notification = {
        id: Date.now(),
        doctorName: data.doctorName,
        department: data.department,
        timestamp: new Date()
      };
      setCallNotifications(prev => [...prev, notification]);
      
      setTimeout(() => {
        setCallNotifications(prev => prev.filter(n => n.id !== notification.id));
      }, 5000);
      
      toast.info(`Dr. ${data.doctorName} (${data.department}) is calling next patient!`);
    });

    return () => newSocket.close();
  }, [token]);

  useEffect(() => {
    if (!token) return;
    fetchQueues(queueFilters);
    fetchAnalytics();
  }, [selectedFacility]);

  const serveNext = async (department) => {
    if (servingInProgress) return; // prevent duplicate multiple clicks
    setServingInProgress(true);
    try {
      const query = selectedFacility && selectedFacility !== 'default' ? `?facilityId=${selectedFacility}` : '';
      await axios.post(`${API_BASE_URL}/api/queue/serve/${department}${query}`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchQueues(queueFilters);
      fetchAnalytics();
    } catch (err) {
      alert(err.response?.data?.message || 'Error serving next');
    } finally {
      setServingInProgress(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar user={user} onLogout={logout} title="Q-Less Admin Dashboard" />
      
      <div className="flex flex-1">
        <AdminSidebar activeTab={activeTab} setActiveTab={setActiveTab} />

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto">
          <div className="p-8 max-w-6xl">

            {/* Notifications Display */}
            {callNotifications.length > 0 && (
              <div className="mb-6 space-y-2 animate-in slide-in-from-top">
                {callNotifications.map(notif => (
                  <div key={notif.id} className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-xl flex items-start gap-3">
                    <Bell className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-blue-900 font-semibold">🔔 Doctor Calling Next Patient</p>
                      <p className="text-blue-700 text-sm">Dr. {notif.doctorName} ({notif.department}) needs the next patient. Send them now!</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
            
            {/* DASHBOARD TAB */}
            {activeTab === 'dashboard' && (
              <div className="space-y-8 animate-in fade-in duration-500">
                <div className="mb-8 flex flex-col md:flex-row md:items-end md:justify-between gap-4">
                  <div>
                    <h2 className="text-4xl font-black text-slate-800 mb-2">Admin Dashboard</h2>
                    <p className="text-slate-500">Real-time queue management and analytics</p>
                  </div>
                  <div className="flex items-center gap-3"> 
                    <label className="text-sm font-medium text-slate-600">Facility</label>
                    <select value={selectedFacility} onChange={(e) => setSelectedFacility(e.target.value)} className="border border-slate-300 rounded-lg px-3 py-2">
                      {facilities.map(f => (
                        <option key={f._id} value={f._id}>{f.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="bg-gradient-to-br from-indigo-500 to-indigo-600 text-white p-6 rounded-2xl shadow-lg">
                    <Users className="w-8 h-8 mb-3 text-indigo-200" />
                    <p className="text-indigo-100 text-sm font-medium">Total Waiting</p>
                    <p className="text-4xl font-black mt-2">{tokens.filter(t => t.status === 'waiting').length}</p>
                  </div>

                  <div className="bg-gradient-to-br from-cyan-500 to-blue-600 text-white p-6 rounded-2xl shadow-lg">
                    <CheckCircle2 className="w-8 h-8 mb-3 text-cyan-200" />
                    <p className="text-cyan-100 text-sm font-medium">Being Served</p>
                    <p className="text-4xl font-black mt-2">{tokens.filter(t => t.status === 'serving').length}</p>
                  </div>

                  <div className="bg-gradient-to-br from-purple-500 to-pink-600 text-white p-6 rounded-2xl shadow-lg">
                    <Bell className="w-8 h-8 mb-3 text-purple-200" />
                    <p className="text-purple-100 text-sm font-medium">Notifications</p>
                    <p className="text-4xl font-black mt-2">{callNotifications.length}</p>
                  </div>
                </div>

                <div className="bg-gradient-to-br from-white to-blue-50 p-8 rounded-2xl shadow-lg border-2 border-blue-200">
                  <h3 className="text-2xl font-black text-slate-800 mb-8 flex items-center gap-2">
                    <Users className="w-7 h-7 text-indigo-600" />
                    📊 Queue Overview by Department
                  </h3>
                  <div className="h-80 bg-white rounded-xl p-4 border border-slate-200">
                    {stats.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={stats}>
                          <XAxis dataKey="name" />
                          <YAxis />
                          <Tooltip cursor={{ fill: '#f8fafc' }} />
                          <Bar dataKey="Waiting" fill="#6366f1" radius={[8, 8, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-full flex items-center justify-center text-slate-400">
                        <p className="text-lg">📭 No active queues</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* QUEUES TAB */}
            {activeTab === 'queues' && (
              <div className="space-y-8 animate-in fade-in duration-500">
                <div>
                  <h2 className="text-3xl font-black text-slate-800 mb-2">👥 Live Queues</h2>
                  <p className="text-slate-600">Real-time patient queue management</p>
                </div>

                <div className="bg-gradient-to-br from-slate-50 to-purple-50 p-6 rounded-2xl shadow-lg border-2 border-purple-200">
                  <h3 className="text-lg font-black text-slate-800 mb-6 flex items-center gap-2">🔍 Advanced Search & Filter</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <input value={queueFilters.name} onChange={(e) => setQueueFilters(prev => ({...prev, name: e.target.value}))} type="text" placeholder="👤 Patient name" className="border-2 border-slate-300 rounded-lg px-4 py-2.5 focus:border-purple-400 focus:outline-none transition font-medium" />
                    <input value={queueFilters.email} onChange={(e) => setQueueFilters(prev => ({...prev, email: e.target.value}))} type="text" placeholder="📧 Email address" className="border-2 border-slate-300 rounded-lg px-4 py-2.5 focus:border-purple-400 focus:outline-none transition font-medium" />
                    <select value={queueFilters.status} onChange={(e) => setQueueFilters(prev => ({...prev, status: e.target.value}))} className="border-2 border-slate-300 rounded-lg px-4 py-2.5 focus:border-purple-400 focus:outline-none transition font-medium">
                      <option value="">📊 Any status</option>
                      <option value="waiting">⏳ Waiting</option>
                      <option value="serving">👨‍⚕️ Serving</option>
                      <option value="completed">✅ Completed</option>
                      <option value="cancelled">❌ Cancelled</option>
                    </select>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
                    <select value={queueFilters.department} onChange={(e) => setQueueFilters(prev => ({...prev, department: e.target.value}))} className="border-2 border-slate-300 rounded-lg px-4 py-2.5 focus:border-purple-400 focus:outline-none transition font-medium">
                      <option value="">🏥 Any department</option>
                      <option value="Cardiology">❤️ Cardiology</option>
                      <option value="Orthopedics">🦴 Orthopedics</option>
                      <option value="General Medicine">💊 General Medicine</option>
                      <option value="Ophthalmology">👁️ Ophthalmology</option>
                      <option value="Gastroenterology">🔬 Gastroenterology</option>
                      <option value="Emergency">🚨 Emergency</option>
                    </select>
                    <select value={queueFilters.urgency} onChange={(e) => setQueueFilters(prev => ({...prev, urgency: e.target.value}))} className="border-2 border-slate-300 rounded-lg px-4 py-2.5 focus:border-purple-400 focus:outline-none transition font-medium">
                      <option value="">⚡ Any urgency</option>
                      <option value="Low">✅ Low</option>
                      <option value="Medium">⚠️ Medium</option>
                      <option value="High">🔴 High</option>
                      <option value="Emergency">🚨 Emergency</option>
                    </select>
                    <div className="flex items-center gap-2">
                      <input value={queueFilters.startDate} onChange={(e) => setQueueFilters(prev => ({...prev, startDate: e.target.value}))} type="date" className="border-2 border-slate-300 rounded-lg px-4 py-2.5 focus:border-purple-400 focus:outline-none transition font-medium flex-1" />
                      <span className="text-slate-600 font-bold">to</span>
                      <input value={queueFilters.endDate} onChange={(e) => setQueueFilters(prev => ({...prev, endDate: e.target.value}))} type="date" className="border-2 border-slate-300 rounded-lg px-4 py-2.5 focus:border-purple-400 focus:outline-none transition font-medium flex-1" />
                    </div>
                  </div>
                  <div className="flex items-center gap-3 mt-6">
                    <button onClick={() => fetchQueues(queueFilters)} className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-cyan-600 text-white font-black rounded-lg hover:shadow-lg transition transform hover:scale-105">🔍 Apply Filters</button>
                    <button onClick={() => {
                      const reset = { name: '', email: '', status: '', department: '', urgency: '', startDate: '', endDate: '' };
                      setQueueFilters(reset);
                      fetchQueues(reset);
                    }} className="px-6 py-3 bg-slate-200 text-slate-800 font-black rounded-lg hover:bg-slate-300 transition">🔄 Reset All</button>
                  </div>
                </div>

                {tokens.filter(t => t.status === 'serving').length > 0 && (
                  <div className="bg-gradient-to-br from-green-50 to-emerald-50 p-8 rounded-2xl mb-8 shadow-lg border-2 border-green-400">
                    <h3 className="text-2xl font-black text-green-900 mb-6 flex items-center gap-2">
                      <CheckCircle2 className="w-7 h-7 text-green-600" />
                      👨‍⚕️ Currently Serving
                    </h3>
                    <div className="space-y-3">
                      {tokens.filter(t => t.status === 'serving').map((t, idx) => (
                        <div key={t._id} className="bg-white p-5 rounded-xl border-2 border-green-300 hover:border-green-500 transition transform hover:shadow-lg hover:scale-102">
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                            <div className="flex items-start gap-3 flex-1">
                              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-600 to-emerald-600 text-white flex items-center justify-center font-bold">
                                {idx + 1}
                              </div>
                              <div>
                                <p className="font-black text-slate-800 text-lg">{t.userId?.name}</p>
                                <p className="text-sm text-slate-600">📝 {t.issues} • 🏥 {t.department}</p>
                              </div>
                            </div>
                            <span className="px-5 py-2 bg-gradient-to-r from-green-500 to-emerald-500 text-white font-black rounded-lg text-sm animate-pulse shadow-lg">
                              <span className="animate-bounce mr-2 w-3 h-3 rounded-full bg-white inline-block"></span>
                              🟢 In Progress
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="space-y-8">
                  {['Cardiology', 'Orthopedics', 'General Medicine', 'Ophthalmology', 'Gastroenterology', 'Emergency'].map(dept => {
                    const deptTokens = tokens.filter(t => t.department === dept && t.status === 'waiting').sort((a, b) => b.isEmergency - a.isEmergency);
                    
                    if (deptTokens.length === 0) return null;
                    return (
                      <div key={dept} className="bg-gradient-to-br from-slate-50 to-indigo-50 p-8 rounded-2xl shadow-lg border-2 border-indigo-200">
                        <div className="flex justify-between items-center mb-8">
                          <div>
                            <h3 className="text-2xl font-black text-slate-800">🏥 {dept}</h3>
                            <p className="text-slate-600 mt-1">{deptTokens.length} patients waiting</p>
                          </div>
                          <button 
                            onClick={() => serveNext(dept)}
                            disabled={servingInProgress}
                            className={`px-6 py-3 font-black text-lg rounded-xl transition transform hover:scale-105 flex items-center gap-2 ${servingInProgress ? 'bg-slate-300 text-slate-600 cursor-not-allowed' : 'bg-gradient-to-r from-indigo-600 to-cyan-600 text-white hover:shadow-lg'}`}
                          >
                            {servingInProgress ? '⏳ Serving...' : '➡️ Serve Next'} <ArrowRight className="w-5 h-5" />
                          </button>
                        </div>
                        <div className="space-y-3">
                          {deptTokens.map((t, idx) => (
                            <div key={t._id} className={`p-5 rounded-xl border-2 flex justify-between items-center transition transform hover:scale-102 ${
                              t.isEmergency ? 'bg-gradient-to-r from-red-100 to-pink-100 border-red-400 shadow-lg' : 'bg-white border-slate-200 hover:border-indigo-400 hover:shadow-md'
                            }`}>
                              <div className="flex items-center space-x-4">
                                <div className={`w-12 h-12 rounded-full font-black text-white flex items-center justify-center text-lg ${
                                  t.urgency === 'Emergency' ? 'bg-gradient-to-br from-red-600 to-pink-600 shadow-lg' : 'bg-gradient-to-br from-indigo-600 to-cyan-600 shadow-md'
                                }`}>
                                  #{idx + 1}
                                </div>
                                <div>
                                  <p className="font-black text-slate-800 text-lg">{t.userId?.name}</p>
                                  <p className="text-sm text-slate-600">📝 {t.issues}</p>
                                </div>
                              </div>
                              <div className="flex gap-3 items-center">
                                <select 
                                  onChange={(e) => handleReassign(t._id, e.target.value)} 
                                  defaultValue={dept}
                                  className="text-xs font-bold border-2 border-slate-300 rounded-lg px-3 py-2 bg-white outline-none cursor-pointer transition hover:border-indigo-400"
                                >
                                  <option value="Cardiology">Cardiology</option>
                                  <option value="Orthopedics">Orthopedics</option>
                                  <option value="General Medicine">General Medicine</option>
                                  <option value="Ophthalmology">Ophthalmology</option>
                                  <option value="Gastroenterology">Gastroenterology</option>
                                  <option value="Emergency">Emergency</option>
                                </select>
                                <span className={`px-3 py-2 text-xs font-black rounded-lg ${
                                  t.urgency === 'Emergency' ? 'bg-red-200 text-red-800 animate-pulse' :
                                  t.urgency === 'High' ? 'bg-orange-200 text-orange-800' :
                                  'bg-green-200 text-green-800'
                                }`}>
                                  {t.urgency === 'Emergency' && '🚨 '}
                                  {t.urgency === 'High' && '⚠️ '}
                                  {t.urgency === 'Low' && '✅ '}
                                  {t.urgency}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {tokens.filter(t => t.status === 'waiting').length === 0 && (
                  <div className="text-center py-16 bg-gradient-to-br from-white to-slate-50 rounded-2xl border-2 border-dashed border-slate-300 shadow-sm">
                    <p className="text-3xl mb-2">✨</p>
                    <p className="text-slate-600 font-bold text-lg">No patients are currently waiting</p>
                    <p className="text-slate-500 text-sm mt-2">All queues are clear! Great work today!</p>
                  </div>
                )}
              </div>
            )}

            {/* ANALYTICS TAB */}
            {activeTab === 'analytics' && (
              <div className="space-y-8 animate-in fade-in duration-500">
                <h2 className="text-3xl font-black text-slate-800 mb-6">Analytics</h2>

                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                  <h3 className="text-xl font-bold text-slate-800 mb-6">Department Waiting Distribution</h3>
                  <div className="h-80">
                    {stats.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={stats}>
                          <XAxis dataKey="name" />
                          <YAxis />
                          <Tooltip cursor={{ fill: '#f8fafc' }} />
                          <Bar dataKey="Waiting" fill="#6366f1" radius={[8, 8, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-full flex items-center justify-center text-slate-400">
                        No data available
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                    <h3 className="text-lg font-bold text-slate-800 mb-4">Queue Status Summary</h3>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
                        <span className="font-medium text-slate-700">Waiting</span>
                        <span className="font-bold text-indigo-600">{tokens.filter(t => t.status === 'waiting').length}</span>
                      </div>
                      <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
                        <span className="font-medium text-slate-700">Serving</span>
                        <span className="font-bold text-green-600">{tokens.filter(t => t.status === 'serving').length}</span>
                      </div>
                      <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
                        <span className="font-medium text-slate-700">Completed</span>
                        <span className="font-bold text-blue-600">{tokens.filter(t => t.status === 'completed').length}</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                    <h3 className="text-lg font-bold text-slate-800 mb-4">Urgency Breakdown</h3>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
                        <span className="font-medium text-slate-700">Emergency</span>
                        <span className="font-bold text-red-600">{tokens.filter(t => t.urgency === 'Emergency').length}</span>
                      </div>
                      <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
                        <span className="font-medium text-slate-700">High</span>
                        <span className="font-bold text-orange-600">{tokens.filter(t => t.urgency === 'High').length}</span>
                      </div>
                      <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
                        <span className="font-medium text-slate-700">Medium</span>
                        <span className="font-bold text-yellow-600">{tokens.filter(t => t.urgency === 'Medium').length}</span>
                      </div>
                      <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
                        <span className="font-medium text-slate-700">Low</span>
                        <span className="font-bold text-green-600">{tokens.filter(t => t.urgency === 'Low').length}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                  <h3 className="text-lg font-bold text-slate-800 mb-4">Advanced Analytics</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="p-4 bg-slate-50 rounded-lg">
                      <p className="text-sm text-slate-500">Avg wait per dept</p>
                      {analyticsData.avgWaitTimes.length ? analyticsData.avgWaitTimes.map(item => (
                        <div key={item.department} className="flex justify-between">
                          <span>{item.department}</span>
                          <span className="font-bold">{item.averageWait} min</span>
                        </div>
                      )) : <p className="text-xs text-slate-400">No completed queue data yet.</p>}
                    </div>

                    <div className="p-4 bg-slate-50 rounded-lg">
                      <p className="text-sm text-slate-500">Peak hours</p>
                      {analyticsData.peakHours.length ? analyticsData.peakHours.map(item => (
                        <div key={item.hour} className="flex justify-between">
                          <span>{item.hour}</span>
                          <span className="font-bold">{item.count}</span>
                        </div>
                      )) : <p className="text-xs text-slate-400">No traffic history yet.</p>}
                    </div>

                    <div className="p-4 bg-slate-50 rounded-lg">
                      <p className="text-sm text-slate-500">Department load</p>
                      {Object.entries(analyticsData.loadByDepartment).length ? Object.entries(analyticsData.loadByDepartment).map(([dept, count]) => (
                        <div key={dept} className="flex justify-between">
                          <span>{dept}</span>
                          <span className="font-bold">{count}</span>
                        </div>
                      )) : <p className="text-xs text-slate-400">No live load yet.</p>}
                    </div>
                  </div>
                </div>

              </div>
            )}

            {/* MEDICAL RECORDS TAB */}
            {activeTab === 'records' && (
              <div className="space-y-8 animate-in fade-in duration-500">
                <div>
                  <h2 className="text-3xl font-black text-slate-800 mb-2">📋 Medical Records</h2>
                  <p className="text-slate-600">Complete system medical records library</p>
                </div>

                <div className="bg-gradient-to-br from-slate-50 to-blue-50 p-8 rounded-2xl shadow-lg border-2 border-blue-200">
                  {medicalRecords.length === 0 ? (
                    <div className="py-16 text-center bg-white rounded-2xl border-2 border-dashed border-slate-300">
                      <p className="text-3xl mb-2">📭</p>
                      <p className="text-slate-600 font-bold text-lg">No medical records yet</p>
                      <p className="text-slate-500 text-sm mt-2">Medical records will appear here as doctors create them</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {medicalRecords.slice(0, 20).map((record, idx) => (
                        <div key={record._id} className="p-5 bg-white rounded-xl border-2 border-blue-300 hover:border-blue-500 transition transform hover:shadow-lg hover:scale-102">
                          <div className="flex justify-between items-start gap-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-3">
                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-600 to-cyan-600 text-white flex items-center justify-center font-bold">
                                  #{idx + 1}
                                </div>
                                <div>
                                  <p className="font-black text-slate-800 text-lg">{record.patientId?.name}</p>
                                  <p className="text-xs text-slate-500">👨‍⚕️ Doctor: {record.doctorId?.name}</p>
                                </div>
                              </div>
                              <div className="grid grid-cols-2 gap-3 mb-3">
                                <div className="bg-indigo-50 p-3 rounded-lg border border-indigo-200">
                                  <p className="text-xs text-indigo-600 font-bold uppercase mb-1\">📋 Diagnosis</p>
                                  <p className="font-semibold text-slate-800">{record.diagnosis}</p>
                                </div>
                                <div className="bg-purple-50 p-3 rounded-lg border border-purple-200">
                                  <p className="text-xs text-purple-600 font-bold uppercase mb-1\">🏥 Department</p>
                                  <p className="font-semibold text-slate-800">{record.department}</p>
                                </div>
                              </div>
                              <p className="text-xs text-slate-500\">📅 {new Date(record.visitDate).toLocaleDateString()}</p>
                            </div>
                            <div className="bg-gradient-to-br from-blue-100 to-cyan-100 p-3 rounded-lg border border-blue-300">
                              <p className="text-xs text-blue-700 font-black\">✅ ARCHIVED</p>
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
                <h2 className="text-3xl font-black text-slate-800 mb-8">🛡️ Administrator Profile</h2>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Profile Card */}
                  <div className="lg:col-span-2">
                    <div className="bg-gradient-to-br from-yellow-50 via-orange-50 to-red-50 p-8 rounded-2xl shadow-lg border-2 border-yellow-300 hover:shadow-xl transition-all">
                      {/* Header */}
                      <div className="flex items-start justify-between mb-8">
                        <div className="flex items-center space-x-6">
                          <div className="w-32 h-32 rounded-full bg-gradient-to-tr from-yellow-500 via-orange-400 to-red-500 flex items-center justify-center text-white text-5xl font-black shadow-xl border-4 border-white">
                            {user?.name?.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <h1 className="text-4xl font-black text-slate-800">{user?.name}</h1>
                            <p className="text-red-600 font-black text-xl mt-2">🛡️ System Administrator</p>
                            <div className="flex gap-2 mt-3">
                              <span className="px-3 py-1 bg-red-200 text-red-800 rounded-full text-sm font-bold">⭐ Super Admin</span>
                              <span className="px-3 py-1 bg-green-200 text-green-800 rounded-full text-sm font-bold">🔓 Full Access</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Info Cards */}
                      <div className="space-y-3">
                        <div className="flex items-center space-x-4 p-5 bg-white rounded-xl border-l-4 border-red-500 hover:shadow-md transition">
                          <Mail className="w-6 h-6 text-red-600" />
                          <div className="flex-1">
                            <p className="text-xs text-slate-500 font-bold uppercase">Email Address</p>
                            <p className="font-bold text-slate-800 text-lg break-all">{user?.email}</p>
                          </div>
                        </div>

                        <div className="flex items-center space-x-4 p-5 bg-white rounded-xl border-l-4 border-yellow-500 hover:shadow-md transition">
                          <Shield className="w-6 h-6 text-yellow-600" />
                          <div className="flex-1">
                            <p className="text-xs text-slate-500 font-bold uppercase">Authorization Level</p>
                            <p className="font-bold text-slate-800 text-lg">🔐 {user?.role?.replace('_', ' ').toUpperCase()}</p>
                          </div>
                        </div>

                        <div className="flex items-center space-x-4 p-5 bg-white rounded-xl border-l-4 border-orange-500 hover:shadow-md transition">
                          <Clock className="w-6 h-6 text-orange-600" />
                          <div className="flex-1">
                            <p className="text-xs text-slate-500 font-bold uppercase">Member Since</p>
                            <p className="font-bold text-slate-800 text-lg">January 2026 (Today)</p>
                          </div>
                        </div>

                        <div className="flex items-center space-x-4 p-5 bg-white rounded-xl border-l-4 border-green-500 hover:shadow-md transition">
                          <Activity className="w-6 h-6 text-green-600" />
                          <div className="flex-1">
                            <p className="text-xs text-slate-500 font-bold uppercase">System Status</p>
                            <p className="font-bold text-slate-800 text-lg">🟢 All Systems Operational</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Stats Sidebar */}
                  <div className="space-y-4">
                    <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-6 rounded-xl border-2 border-blue-300 shadow-lg">
                      <p className="text-sm text-blue-600 font-bold uppercase mb-2">👥 Total Users</p>
                      <p className="text-4xl font-black text-blue-700">11</p>
                      <p className="text-blue-600 text-sm mt-2">Active accounts</p>
                    </div>

                    <div className="bg-gradient-to-br from-green-50 to-green-100 p-6 rounded-xl border-2 border-green-300 shadow-lg">
                      <p className="text-sm text-green-600 font-bold uppercase mb-2">🏥 Departments</p>
                      <p className="text-4xl font-black text-green-700">6</p>
                      <p className="text-green-600 text-sm mt-2">Operating divisions</p>
                    </div>

                    <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-6 rounded-xl border-2 border-purple-300 shadow-lg">
                      <p className="text-sm text-purple-600 font-bold uppercase mb-2">📊 Records</p>
                      <p className="text-4xl font-black text-purple-700">500+</p>
                      <p className="text-purple-600 text-sm mt-2">Medical records</p>
                    </div>

                    <div className="bg-gradient-to-br from-pink-50 to-pink-100 p-6 rounded-xl border-2 border-pink-300 shadow-lg">
                      <p className="text-sm text-pink-600 font-bold uppercase mb-2">🔒 Security</p>
                      <p className="text-3xl font-black text-pink-700">A+</p>
                      <p className="text-pink-600 text-sm mt-2">Encryption grade</p>
                    </div>
                  </div>
                </div>

                {/* Logout Button */}
                <div className="flex gap-3">
                  <button onClick={logout} className="flex-1 py-4 bg-gradient-to-r from-red-600 to-red-700 text-white font-black text-lg rounded-xl hover:shadow-lg transition-all hover:scale-105">
                    🚪 Logout
                  </button>
                  <button className="flex-1 py-4 bg-gradient-to-r from-slate-600 to-slate-700 text-white font-black text-lg rounded-xl hover:shadow-lg transition-all hover:scale-105">
                    ⚙️ System Settings
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

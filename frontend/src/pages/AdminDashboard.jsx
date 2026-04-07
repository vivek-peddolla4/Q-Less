import { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Users, Clock, ArrowRight, CheckCircle2, Bell, User, Mail, Shield } from 'lucide-react';
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

  const handleReassign = async (tokenId, newDepartment) => {
    if(!newDepartment) return;
    try {
      await axios.post(`http://localhost:8000/api/queue/reassign/${tokenId}`, { department: newDepartment }, {
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

      const { data } = await axios.get(`http://localhost:8000/api/queue/all?${params.toString()}`, {
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
      const { data } = await axios.get(`http://localhost:8000/api/medical/admin/all`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMedicalRecords(data);
    } catch (err) {
      console.error('Error fetching records:', err);
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

  const fetchAnalytics = async () => {
    try {
      const facilityQuery = selectedFacility && selectedFacility !== 'default' ? `?facilityId=${selectedFacility}` : '';
      const { data } = await axios.get(`http://localhost:8000/api/queue/analytics${facilityQuery}`, {
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
    
    const newSocket = io('http://localhost:8000');
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
      await axios.post(`http://localhost:8000/api/queue/serve/${department}${query}`, {}, {
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

                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                  <h3 className="text-xl font-bold text-slate-800 mb-6 flex items-center">
                    <Users className="w-6 h-6 text-indigo-600 mr-2" />
                    Queue Overview by Department
                  </h3>
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
                        No active queues
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* LIVE QUEUES TAB */}
            {activeTab === 'queues' && (
              <div className="space-y-8 animate-in fade-in duration-500">
                <h2 className="text-3xl font-black text-slate-800 mb-6">Live Queues</h2>

                <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
                  <h3 className="text-lg font-bold text-slate-700 mb-4">Search & Filter</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <input value={queueFilters.name} onChange={(e) => setQueueFilters(prev => ({...prev, name: e.target.value}))} type="text" placeholder="Patient name" className="border rounded-lg px-3 py-2" />
                    <input value={queueFilters.email} onChange={(e) => setQueueFilters(prev => ({...prev, email: e.target.value}))} type="text" placeholder="Email" className="border rounded-lg px-3 py-2" />
                    <select value={queueFilters.status} onChange={(e) => setQueueFilters(prev => ({...prev, status: e.target.value}))} className="border rounded-lg px-3 py-2">
                      <option value="">Any status</option>
                      <option value="waiting">Waiting</option>
                      <option value="serving">Serving</option>
                      <option value="completed">Completed</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
                    <select value={queueFilters.department} onChange={(e) => setQueueFilters(prev => ({...prev, department: e.target.value}))} className="border rounded-lg px-3 py-2">
                      <option value="">Any department</option>
                      <option value="Cardiology">Cardiology</option>
                      <option value="Orthopedics">Orthopedics</option>
                      <option value="General Medicine">General Medicine</option>
                      <option value="Ophthalmology">Ophthalmology</option>
                      <option value="Gastroenterology">Gastroenterology</option>
                      <option value="Emergency">Emergency</option>
                    </select>
                    <select value={queueFilters.urgency} onChange={(e) => setQueueFilters(prev => ({...prev, urgency: e.target.value}))} className="border rounded-lg px-3 py-2">
                      <option value="">Any urgency</option>
                      <option value="Low">Low</option>
                      <option value="Medium">Medium</option>
                      <option value="High">High</option>
                      <option value="Emergency">Emergency</option>
                    </select>
                    <div className="flex items-center gap-3">
                      <input value={queueFilters.startDate} onChange={(e) => setQueueFilters(prev => ({...prev, startDate: e.target.value}))} type="date" className="border rounded-lg px-3 py-2 w-full" />
                      <input value={queueFilters.endDate} onChange={(e) => setQueueFilters(prev => ({...prev, endDate: e.target.value}))} type="date" className="border rounded-lg px-3 py-2 w-full" />
                    </div>
                  </div>
                  <div className="flex items-center gap-3 mt-4">
                    <button onClick={() => fetchQueues(queueFilters)} className="px-4 py-2 bg-indigo-600 text-white rounded-lg">Apply</button>
                    <button onClick={() => {
                      const reset = { name: '', email: '', status: '', department: '', urgency: '', startDate: '', endDate: '' };
                      setQueueFilters(reset);
                      fetchQueues(reset);
                    }} className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg">Reset</button>
                  </div>
                </div>

                {tokens.filter(t => t.status === 'serving').length > 0 && (
                  <div className="bg-green-50 border-l-4 border-green-500 p-6 rounded-2xl mb-8">
                    <h3 className="text-lg font-bold text-green-900 mb-4 flex items-center">
                      <CheckCircle2 className="w-5 h-5 mr-2 text-green-600" />
                      Currently Serving
                    </h3>
                    <div className="space-y-3">
                      {tokens.filter(t => t.status === 'serving').map(t => (
                        <div key={t._id} className="bg-white p-4 rounded-xl border border-green-200">
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                            <div>
                              <p className="font-bold text-slate-800">{t.userId?.name}</p>
                              <p className="text-sm text-slate-600">{t.issues} • {t.department}</p>
                            </div>
                            <span className="px-4 py-2 bg-green-100 text-green-800 font-bold rounded-lg text-sm">
                              <span className="animate-pulse mr-2 w-2 h-2 rounded-full bg-green-600 inline-block"></span>
                              In Progress
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
                      <div key={dept} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                        <div className="flex justify-between items-center mb-6">
                          <h3 className="text-lg font-bold text-slate-800">{dept}</h3>
                          <button 
                            onClick={() => serveNext(dept)}
                            disabled={servingInProgress}
                            className={`px-4 py-2 font-semibold rounded-lg transition flex items-center ${servingInProgress ? 'bg-slate-300 text-slate-600 cursor-not-allowed' : 'bg-indigo-600 text-white hover:bg-indigo-700'}`}
                          >
                            {servingInProgress ? 'Serving...' : 'Serve Next'} <ArrowRight className="w-4 h-4 ml-2" />
                          </button>
                        </div>
                        <div className="space-y-3">
                          {deptTokens.map((t, idx) => (
                            <div key={t._id} className={`p-4 rounded-xl border flex justify-between items-center transition ${
                              t.isEmergency ? 'bg-red-50 border-red-200' : 'bg-slate-50 border-slate-200 hover:border-indigo-300'
                            }`}>
                              <div className="flex items-center space-x-4">
                                <div className={`w-10 h-10 rounded-full font-bold text-white flex items-center justify-center ${
                                  t.urgency === 'Emergency' ? 'bg-red-500' : 'bg-indigo-500'
                                }`}>
                                  #{idx + 1}
                                </div>
                                <div>
                                  <p className="font-semibold text-slate-800">{t.userId?.name}</p>
                                  <p className="text-sm text-slate-600">{t.issues}</p>
                                </div>
                              </div>
                              <div className="flex gap-3">
                                <select 
                                  onChange={(e) => handleReassign(t._id, e.target.value)} 
                                  defaultValue={dept}
                                  className="text-xs font-semibold border border-slate-300 rounded-lg px-3 py-2 bg-white outline-none cursor-pointer"
                                >
                                  <option value="Cardiology">Cardiology</option>
                                  <option value="Orthopedics">Orthopedics</option>
                                  <option value="General Medicine">General Medicine</option>
                                  <option value="Ophthalmology">Ophthalmology</option>
                                  <option value="Gastroenterology">Gastroenterology</option>
                                  <option value="Emergency">Emergency</option>
                                </select>
                                <span className={`px-3 py-1 text-xs font-bold rounded-lg ${
                                  t.urgency === 'Emergency' ? 'bg-red-100 text-red-700' :
                                  t.urgency === 'High' ? 'bg-orange-100 text-orange-700' :
                                  'bg-green-100 text-green-700'
                                }`}>
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
                  <div className="text-center py-12 bg-slate-50 rounded-xl border-2 border-dashed border-slate-200">
                    <p className="text-slate-500 font-medium">No patients are currently waiting</p>
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
                <h2 className="text-3xl font-black text-slate-800 mb-6">Medical Records</h2>

                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                  {medicalRecords.length === 0 ? (
                    <div className="py-12 text-center">
                      <p className="text-slate-500">No medical records found</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {medicalRecords.slice(0, 20).map(record => (
                        <div key={record._id} className="p-4 bg-slate-50 rounded-xl border border-slate-200 hover:border-indigo-300 transition">
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <p className="font-bold text-slate-800">{record.patientId?.name}</p>
                              <p className="text-sm text-slate-600"><strong>Doctor:</strong> {record.doctorId?.name}</p>
                              <p className="text-sm text-slate-600"><strong>Diagnosis:</strong> {record.diagnosis}</p>
                              <p className="text-sm text-slate-600"><strong>Department:</strong> {record.department}</p>
                              <p className="text-sm text-slate-600"><strong>Date:</strong> {new Date(record.visitDate).toLocaleDateString()}</p>
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
                      <Shield className="w-5 h-5 text-purple-600" />
                      <div>
                        <p className="text-xs text-slate-500 uppercase tracking-wide">Role</p>
                        <p className="font-bold text-slate-800 capitalize">{user?.role?.replace('_', ' ')}</p>
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

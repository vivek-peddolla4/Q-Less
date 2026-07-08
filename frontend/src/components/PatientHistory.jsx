import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Clock, FileText, User, Calendar, AlertCircle, Award, TrendingUp, Stethoscope } from 'lucide-react';
import { io } from 'socket.io-client';
import { API_BASE_URL } from '../config';
import PatientFeedback from './PatientFeedback';

export default function PatientHistory({ patientId, refreshTrigger }) {
  const [medicalRecords, setMedicalRecords] = useState([]);
  const [patientHistory, setPatientHistory] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('records');
  const socketRef = useRef(null);

  useEffect(() => {
    fetchMedicalHistory();
  }, [patientId, refreshTrigger]);

  // Set up Socket.io listener for real-time medical record updates
  useEffect(() => {
    if (!patientId) {
      console.warn('PatientHistory: patientId not provided, skipping socket setup');
      return;
    }

    const socket = io(API_BASE_URL);
    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('PatientHistory socket connected, joining room for patient:', patientId);
      // Join patient's personal room
      socket.emit('joinPatientRoom', patientId);
    });

    // Listen for when a new medical record is created for this patient
    socket.on('medicalRecordCreated', (data) => {
      console.log('PatientHistory received medicalRecordCreated event:', data);
      console.log('Comparing patientId:', { received: data.patientId, expected: patientId, match: data.patientId === patientId });
      if (data.patientId === patientId || data.patientId.toString() === patientId || data.patientId.toString() === patientId.toString()) {
        console.log('PatientHistory: Refreshing medical history due to new record');
        // Refresh the medical history when a new record is created
        fetchMedicalHistory();
      }
    });

    return () => {
      console.log('PatientHistory: Closing socket');
      socket.close();
    };
  }, [patientId]);

  const fetchMedicalHistory = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('accessToken');
      if (!token) {
        console.warn('No token found for medical history fetch');
        setMedicalRecords([]);
        setPatientHistory(null);
        setLoading(false);
        return;
      }
      if (!patientId) {
        console.warn('No patientId provided to PatientHistory');
        setMedicalRecords([]);
        setPatientHistory(null);
        setLoading(false);
        return;
      }
      
      console.log('Fetching medical history for patient:', patientId);
      const [recordsRes, historyRes] = await Promise.all([
        axios.get(`${API_BASE_URL}/api/medical/records/${patientId}`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`${API_BASE_URL}/api/medical/history/${patientId}`, {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);
      
      console.log('Medical records from PatientHistory:', recordsRes.data);
      console.log('Patient history:', historyRes.data);
      setMedicalRecords(recordsRes.data);
      setPatientHistory(historyRes.data);
    } catch (err) {
      console.error('Error fetching medical history:', err.response?.data || err.message);
      // Still show empty state instead of error
      setMedicalRecords([]);
      setPatientHistory(null);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
      {/* Header */}
      <div className="mb-8">
        <h2 className="text-3xl font-black text-gray-800 mb-2">Medical History</h2>
        <p className="text-gray-500">Your complete health journey & medical records</p>
      </div>

      {/* Enhanced Statistics Dashboard */}
      {patientHistory && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          {/* Total Visits */}
          <div className="bg-gradient-to-br from-indigo-50 to-indigo-100 p-5 rounded-xl border-2 border-indigo-200 hover:shadow-lg transition-all">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-indigo-600 font-semibold text-sm">Total Visits</p>
                <p className="text-4xl font-black text-indigo-700 mt-2">{patientHistory.totalVisits}</p>
              </div>
              <Stethoscope className="w-12 h-12 text-indigo-300" />
            </div>
          </div>

          {/* Last Visit */}
          <div className="bg-gradient-to-br from-green-50 to-green-100 p-5 rounded-xl border-2 border-green-200 hover:shadow-lg transition-all">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-green-600 font-semibold text-sm">Last Visit</p>
                <p className="text-lg font-black text-green-700 mt-2">
                  {patientHistory.lastVisitDate ? new Date(patientHistory.lastVisitDate).toLocaleDateString() : 'Never'}
                </p>
              </div>
              <Calendar className="w-12 h-12 text-green-300" />
            </div>
          </div>

          {/* Blood Type */}
          <div className="bg-gradient-to-br from-red-50 to-red-100 p-5 rounded-xl border-2 border-red-200 hover:shadow-lg transition-all">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-red-600 font-semibold text-sm">Blood Type</p>
                <p className="text-4xl font-black text-red-700 mt-2">{patientHistory.bloodType || '—'}</p>
              </div>
              <Award className="w-12 h-12 text-red-300" />
            </div>
          </div>

          {/* Health Score */}
          <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-5 rounded-xl border-2 border-purple-200 hover:shadow-lg transition-all">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-purple-600 font-semibold text-sm">Health Score</p>
                <div className="flex items-baseline gap-1 mt-2">
                  <p className="text-4xl font-black text-purple-700">{Math.min(100, patientHistory.totalVisits * 20)}</p>
                  <span className="text-purple-600 text-lg">/100</span>
                </div>
              </div>
              <TrendingUp className="w-12 h-12 text-purple-300" />
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex space-x-4 border-b-2 mb-8 sticky top-0 bg-white z-10">
        <button
          onClick={() => setActiveTab('records')}
          className={`pb-4 px-6 font-black text-lg transition-all ${
            activeTab === 'records'
              ? 'border-b-4 border-indigo-600 text-indigo-600 shadow-lg'
              : 'text-gray-600 hover:text-gray-800'
          }`}
        >
          📋 Medical Records ({medicalRecords.length})
        </button>
        <button
          onClick={() => setActiveTab('profile')}
          className={`pb-4 px-6 font-black text-lg transition-all ${
            activeTab === 'profile'
              ? 'border-b-4 border-indigo-600 text-indigo-600 shadow-lg'
              : 'text-gray-600 hover:text-gray-800'
          }`}
        >
          👤 Health Profile
        </button>
      </div>

      {/* Medical Records Tab */}
      {activeTab === 'records' && (
        <div className="space-y-4">
          {medicalRecords.length === 0 ? (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-8 text-center">
              <FileText className="w-12 h-12 text-blue-400 mx-auto mb-3" />
              <h3 className="text-lg font-semibold text-blue-900 mb-2">No Medical Records Yet</h3>
              <p className="text-blue-700">Medical records are created by doctors during your consultations. Join a queue and see a doctor to get your first medical record!</p>
            </div>
          ) : (
            medicalRecords.map((record, index) => (
              <div key={record._id} className="border-2 border-gray-200 rounded-xl p-5 hover:shadow-xl hover:border-indigo-300 transition-all bg-gradient-to-br from-white to-slate-50 overflow-hidden">
                {/* Index Badge */}
                <div className="absolute top-3 right-3 bg-indigo-600 text-white w-8 h-8 rounded-full flex items-center justify-center font-black text-sm">
                  #{index + 1}
                </div>

                {/* Visit Header */}
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-lg font-black text-gray-800">{record.department}</h3>
                    <div className="flex items-center text-sm text-gray-600 mt-2">
                      <Calendar className="w-4 h-4 mr-2 text-indigo-500" />
                      {new Date(record.visitDate).toLocaleDateString()} at{' '}
                      {new Date(record.visitDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                  <div className={`px-3 py-1.5 rounded-full text-sm font-bold ${
                    record.urgency === 'Emergency' ? 'bg-red-200 text-red-800 animate-pulse' :
                    record.urgency === 'High' ? 'bg-orange-200 text-orange-800' :
                    'bg-green-200 text-green-800'
                  }`}>
                    🚨 {record.urgency}
                  </div>
                </div>

                {/* Doctor Info with Rating Button */}
                <div className="flex items-center justify-between bg-gradient-to-r from-indigo-50 to-cyan-50 p-3 rounded-lg mb-4 border border-indigo-100">
                  <div className="flex items-center">
                    <div className="w-10 h-10 bg-indigo-600 text-white rounded-full flex items-center justify-center font-bold mr-3">
                      👨‍⚕️
                    </div>
                    <div>
                      <p className="font-bold text-gray-800">Dr. {record.doctorId.name}</p>
                      {record.doctorId.specialization && (
                        <p className="text-xs text-gray-600">{record.doctorId.specialization}</p>
                      )}
                    </div>
                  </div>
                  <PatientFeedback 
                    doctorId={record.doctorId._id}
                    doctorName={record.doctorId.name}
                    medicalRecordId={record._id}
                    onSuccess={() => fetchMedicalHistory()}
                  />
                </div>

                {/* Diagnosis & Treatment */}
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="bg-blue-50 p-3 rounded-lg border-l-4 border-blue-500">
                    <h4 className="font-bold text-blue-900 text-xs mb-2 uppercase">📋 Diagnosis</h4>
                    <p className="text-gray-700 font-semibold">{record.diagnosis}</p>
                  </div>
                  <div className="bg-cyan-50 p-3 rounded-lg border-l-4 border-cyan-500">
                    <h4 className="font-bold text-cyan-900 text-xs mb-2 uppercase">💊 Treatment</h4>
                    <p className="text-gray-700 font-semibold">{record.treatment || '—'}</p>
                  </div>
                </div>

                {/* Symptoms */}
                {record.symptoms && (
                  <div className="bg-yellow-50 p-3 rounded-lg mb-4 border-l-4 border-yellow-500">
                    <h4 className="font-bold text-yellow-900 text-xs mb-2 uppercase">⚠️ Symptoms Reported</h4>
                    <p className="text-gray-700">{record.symptoms}</p>
                  </div>
                )}

                {/* Prescriptions */}
                {record.prescription?.medicines?.length > 0 && (
                  <div className="bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-300 p-4 rounded-lg mb-4 shadow-sm hover:shadow-md transition-all">
                    <h4 className="font-black text-green-900 text-sm mb-3 flex items-center">
                      <span className="text-2xl mr-2">💊</span>
                      PRESCRIPTION MEDICINES
                    </h4>
                    <div className="space-y-2">
                      {record.prescription.medicines.map((med, idx) => (
                        <div key={idx} className="bg-white p-2.5 rounded border border-green-200 hover:border-green-400 transition">
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="font-bold text-green-900">{med.name}</p>
                              <div className="flex gap-3 text-xs text-gray-600 mt-1">
                                <span className="bg-green-100 px-2 py-0.5 rounded">💪 {med.dosage}</span>
                                <span className="bg-blue-100 px-2 py-0.5 rounded">⏰ {med.frequency}</span>
                                <span className="bg-orange-100 px-2 py-0.5 rounded">📅 {med.duration}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                    {record.prescription.notes && (
                      <div className="mt-3 pt-3 border-t border-green-300 text-sm text-green-900">
                        <p className="font-semibold mb-1">📝 Prescription Notes:</p>
                        <p className="text-gray-700">{record.prescription.notes}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Follow-up */}
                {record.followUpDate && (
                  <div className="bg-gradient-to-r from-orange-100 to-red-100 border-2 border-orange-400 p-3 rounded-lg mb-4 flex items-start gap-3 shadow-sm">
                    <div className="text-2xl">📅</div>
                    <div>
                      <p className="font-black text-orange-900">FOLLOW-UP APPOINTMENT REQUIRED</p>
                      <p className="text-orange-800 font-bold mt-1">
                        {new Date(record.followUpDate).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                      </p>
                    </div>
                  </div>
                )}

                {record.notes && (
                  <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                    <p className="text-xs font-bold text-slate-700 mb-2 uppercase">📌 Additional Notes</p>
                    <p className="text-gray-700">{record.notes}</p>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* Health Profile Tab */}
      {activeTab === 'profile' && patientHistory && (
        <div className="space-y-6">
          {/* Header */}
          <h3 className="text-2xl font-black text-gray-800">Your Health Profile</h3>

          {/* Blood Type & Emergency Contact */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div className="bg-gradient-to-br from-red-50 to-red-100 p-6 rounded-xl border-2 border-red-300 hover:shadow-lg transition-all">
              <p className="text-sm text-red-600 font-black mb-2 uppercase">🩸 Blood Type</p>
              <p className="text-5xl font-black text-red-700">{patientHistory.bloodType || '—'}</p>
              <p className="text-red-600 text-sm mt-3">Important for emergencies</p>
            </div>
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-6 rounded-xl border-2 border-blue-300 hover:shadow-lg transition-all">
              <p className="text-sm text-blue-600 font-black mb-2 uppercase">📱 Emergency Contact</p>
              <p className="font-bold text-gray-800 text-lg">
                {patientHistory.emergencyContact?.name || 'Not Set'}
              </p>
              {patientHistory.emergencyContact?.phone && (
                <p className="text-blue-600 font-semibold mt-2">{patientHistory.emergencyContact.phone}</p>
              )}
            </div>
          </div>

          {/* Chronic Conditions */}
          {patientHistory.chronicConditions?.length > 0 && (
            <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-6 rounded-xl border-2 border-purple-300">
              <h4 className="font-black text-purple-900 mb-4 text-lg">⚠️ Chronic Conditions</h4>
              <div className="flex flex-wrap gap-3">
                {patientHistory.chronicConditions.map((condition, idx) => (
                  <div key={idx} className="bg-white px-4 py-2 rounded-full border-2 border-purple-400 font-bold text-purple-800 shadow-sm">
                    {condition}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Allergies */}
          {patientHistory.allergies?.length > 0 && (
            <div className="bg-gradient-to-br from-red-50 to-red-100 p-6 rounded-xl border-2 border-red-300">
              <h4 className="font-black text-red-900 mb-4 text-lg">🚫 Allergies</h4>
              <div className="flex flex-wrap gap-3">
                {patientHistory.allergies.map((allergy, idx) => (
                  <div key={idx} className="bg-white px-4 py-2 rounded-full border-2 border-red-400 font-bold text-red-800 shadow-sm">
                    {allergy}
                  </div>
                ))}
              </div>
            </div>
          )}

          {!patientHistory.chronicConditions?.length && 
           !patientHistory.allergies?.length && 
           !patientHistory.bloodType && (
            <div className="bg-gradient-to-br from-slate-50 to-slate-100 p-8 rounded-xl border-2 border-slate-300 text-center">
              <p className="text-2xl mb-2">📋</p>
              <p className="text-slate-600 font-semibold">No Health Profile Data Yet</p>
              <p className="text-slate-500 text-sm mt-2">Health profile information will be populated by your doctors during consultations</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

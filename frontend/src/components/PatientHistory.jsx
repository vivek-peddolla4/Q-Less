import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Clock, FileText, User, Calendar, AlertCircle } from 'lucide-react';
import { io } from 'socket.io-client';

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
    const socket = io('http://localhost:8000');
    socketRef.current = socket;

    socket.on('connect', () => {
      // Join patient's personal room
      socket.emit('joinPatientRoom', patientId);
    });

    // Listen for when a new medical record is created for this patient
    socket.on('medicalRecordCreated', (data) => {
      if (data.patientId === patientId) {
        // Refresh the medical history when a new record is created
        fetchMedicalHistory();
      }
    });

    return () => socket.close();
  }, [patientId]);

  const fetchMedicalHistory = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('accessToken');
      if (!token) {
        setMedicalRecords([]);
        setPatientHistory(null);
        setLoading(false);
        return;
      }
      const [recordsRes, historyRes] = await Promise.all([
        axios.get(`http://localhost:8000/api/medical/records/${patientId}`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`http://localhost:8000/api/medical/history/${patientId}`, {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);
      
      setMedicalRecords(recordsRes.data);
      setPatientHistory(historyRes.data);
    } catch (err) {
      console.error('Error fetching medical history:', err);
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
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-2">Medical History</h2>
        {patientHistory && (
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div className="bg-indigo-50 p-3 rounded">
              <p className="text-gray-600">Total Visits</p>
              <p className="text-2xl font-bold text-indigo-600">{patientHistory.totalVisits}</p>
            </div>
            <div className="bg-green-50 p-3 rounded">
              <p className="text-gray-600">Last Visit</p>
              <p className="text-lg font-semibold text-green-600">
                {patientHistory.lastVisitDate ? new Date(patientHistory.lastVisitDate).toLocaleDateString() : 'Never'}
              </p>
            </div>
            <div className="bg-red-50 p-3 rounded">
              <p className="text-gray-600">Blood Type</p>
              <p className="text-2xl font-bold text-red-600">{patientHistory.bloodType || 'Not Set'}</p>
            </div>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex space-x-4 border-b mb-6">
        <button
          onClick={() => setActiveTab('records')}
          className={`pb-3 px-4 font-semibold ${activeTab === 'records' ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-gray-600'}`}
        >
          Medical Records ({medicalRecords.length})
        </button>
        <button
          onClick={() => setActiveTab('profile')}
          className={`pb-3 px-4 font-semibold ${activeTab === 'profile' ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-gray-600'}`}
        >
          Health Profile
        </button>
      </div>

      {/* Medical Records Tab */}
      {activeTab === 'records' && (
        <div className="space-y-4">
          {medicalRecords.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No medical records found</p>
          ) : (
            medicalRecords.map((record) => (
              <div key={record._id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition">
                {/* Visit Header */}
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-800">{record.department}</h3>
                    <div className="flex items-center text-sm text-gray-600 mt-1">
                      <Calendar className="w-4 h-4 mr-2" />
                      {new Date(record.visitDate).toLocaleDateString()} at{' '}
                      {new Date(record.visitDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="inline-block bg-indigo-100 text-indigo-800 px-3 py-1 rounded-full text-sm font-semibold">
                      {record.urgency}
                    </span>
                  </div>
                </div>

                {/* Doctor Info */}
                <div className="flex items-center text-sm text-gray-700 mb-3 pb-3 border-b">
                  <User className="w-4 h-4 mr-2 text-indigo-600" />
                  <span>Dr. {record.doctorId.name}</span>
                  {record.doctorId.specialization && (
                    <span className="ml-2 text-gray-500">({record.doctorId.specialization})</span>
                  )}
                </div>

                {/* Diagnosis & Treatment */}
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <h4 className="font-semibold text-gray-800 text-sm mb-1">Diagnosis</h4>
                    <p className="text-gray-700">{record.diagnosis}</p>
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-800 text-sm mb-1">Treatment</h4>
                    <p className="text-gray-700">{record.treatment || 'Pending'}</p>
                  </div>
                </div>

                {/* Symptoms */}
                {record.symptoms && (
                  <div className="mb-4">
                    <h4 className="font-semibold text-gray-800 text-sm mb-1">Symptoms</h4>
                    <p className="text-gray-700">{record.symptoms}</p>
                  </div>
                )}

                {/* Prescriptions */}
                {record.prescription?.medicines?.length > 0 && (
                  <div className="bg-green-50 p-3 rounded mb-4">
                    <h4 className="font-semibold text-gray-800 text-sm mb-2 flex items-center">
                      <FileText className="w-4 h-4 mr-2 text-green-600" />
                      Prescription
                    </h4>
                    <div className="space-y-2">
                      {record.prescription.medicines.map((med, idx) => (
                        <div key={idx} className="text-sm">
                          <p className="font-semibold text-gray-800">{med.name}</p>
                          <p className="text-gray-600">
                            {med.dosage} • {med.frequency} • {med.duration}
                          </p>
                        </div>
                      ))}
                    </div>
                    {record.prescription.notes && (
                      <p className="text-sm text-gray-600 mt-2 pt-2 border-t border-green-200">
                        <strong>Notes:</strong> {record.prescription.notes}
                      </p>
                    )}
                  </div>
                )}

                {/* Follow-up */}
                {record.followUpDate && (
                  <div className="bg-yellow-50 p-3 rounded flex items-start">
                    <AlertCircle className="w-4 h-4 text-yellow-600 mr-2 mt-0.5" />
                    <div>
                      <p className="text-sm font-semibold text-yellow-800">Follow-up Appointment</p>
                      <p className="text-sm text-yellow-700">
                        {new Date(record.followUpDate).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                )}

                {record.notes && (
                  <div className="mt-4 pt-4 border-t">
                    <p className="text-sm text-gray-700"><strong>Notes:</strong> {record.notes}</p>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* Health Profile Tab */}
      {activeTab === 'profile' && patientHistory && (
        <div className="space-y-4">
          {/* Blood Type & Emergency Contact */}
          <div className="grid grid-cols-2 gap-6 mb-6">
            <div className="bg-red-50 p-4 rounded-lg">
              <p className="text-sm text-gray-600 mb-2">Blood Type</p>
              <p className="text-3xl font-bold text-red-600">{patientHistory.bloodType || 'Not Set'}</p>
            </div>
            <div className="bg-blue-50 p-4 rounded-lg">
              <p className="text-sm text-gray-600 mb-2">Emergency Contact</p>
              <p className="font-semibold text-gray-800">
                {patientHistory.emergencyContact?.name || 'Not Set'}
              </p>
              {patientHistory.emergencyContact?.phone && (
                <p className="text-sm text-gray-600">{patientHistory.emergencyContact.phone}</p>
              )}
            </div>
          </div>

          {/* Chronic Conditions */}
          {patientHistory.chronicConditions?.length > 0 && (
            <div className="bg-purple-50 p-4 rounded-lg">
              <h4 className="font-semibold text-gray-800 mb-2">Chronic Conditions</h4>
              <div className="flex flex-wrap gap-2">
                {patientHistory.chronicConditions.map((condition, idx) => (
                  <span key={idx} className="bg-purple-200 text-purple-800 px-3 py-1 rounded-full text-sm">
                    {condition}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Allergies */}
          {patientHistory.allergies?.length > 0 && (
            <div className="bg-red-50 p-4 rounded-lg">
              <h4 className="font-semibold text-gray-800 mb-2 flex items-center">
                <AlertCircle className="w-4 h-4 mr-2 text-red-600" />
                Allergies
              </h4>
              <div className="flex flex-wrap gap-2">
                {patientHistory.allergies.map((allergy, idx) => (
                  <span key={idx} className="bg-red-200 text-red-800 px-3 py-1 rounded-full text-sm">
                    {allergy}
                  </span>
                ))}
              </div>
            </div>
          )}

          {!patientHistory.chronicConditions?.length && 
           !patientHistory.allergies?.length && 
           !patientHistory.bloodType && (
            <p className="text-gray-500 text-center py-8">No health profile information yet</p>
          )}
        </div>
      )}
    </div>
  );
}

import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { FileText, Download } from 'lucide-react';
import { io } from 'socket.io-client';

export default function PrescriptionsView({ patientId, refreshTrigger }) {
  const [prescriptions, setPrescriptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const socketRef = useRef(null);

  useEffect(() => {
    fetchPrescriptions();
  }, [patientId, refreshTrigger]);

  // Set up Socket.io listener for real-time prescription updates
  useEffect(() => {
    const socket = io('http://localhost:8000');
    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('joinPatientRoom', patientId);
    });

    // Listen for when a new medical record (with prescription) is created
    socket.on('medicalRecordCreated', (data) => {
      if (data.patientId === patientId) {
        fetchPrescriptions();
      }
    });

    return () => socket.close();
  }, [patientId]);

  const fetchPrescriptions = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('accessToken');
      if (!token) {
        setPrescriptions([]);
        setLoading(false);
        return;
      }
      const res = await axios.get(`http://localhost:8000/api/medical/prescriptions/${patientId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setPrescriptions(res.data);
    } catch (err) {
      console.error('Error fetching prescriptions:', err);
    } finally {
      setLoading(false);
    }
  };

  const downloadPrescription = (record) => {
    const doc = `
PRESCRIPTION
Generated on: ${new Date(record.visitDate).toLocaleDateString()}

Department: ${record.department}
Doctor: Dr. ${record.doctorId.name}
${record.doctorId.specialization ? `Specialization: ${record.doctorId.specialization}` : ''}

DIAGNOSIS:
${record.diagnosis}

${record.symptoms ? `SYMPTOMS:\n${record.symptoms}\n` : ''}

MEDICINES:
${record.prescription.medicines.map(m => 
  `• ${m.name} - ${m.dosage} ${m.frequency} for ${m.duration}`
).join('\n')}

${record.prescription.notes ? `\nNOTES:\n${record.prescription.notes}` : ''}

${record.treatement ? `\nTREATMENT:\n${record.treatment}` : ''}

${record.followUpDate ? `\nFOLLOW-UP DATE: ${new Date(record.followUpDate).toLocaleDateString()}` : ''}

    `.trim();

    const element = document.createElement('a');
    element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(doc));
    element.setAttribute('download', `prescription-${record.visitDate.split('T')[0]}.txt`);
    element.style.display = 'none';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <h2 className="text-2xl font-bold text-gray-800 mb-6">My Prescriptions</h2>

      {prescriptions.length === 0 ? (
        <p className="text-gray-500 text-center py-8">No prescriptions found</p>
      ) : (
        <div className="space-y-4">
          {prescriptions.map((record) => (
            <div key={record._id} className="border border-green-200 bg-green-50 rounded-lg p-4 hover:shadow-md transition">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-800">
                    <FileText className="inline w-5 h-5 mr-2 text-green-600" />
                    {record.department}
                  </h3>
                  <p className="text-sm text-gray-600 mt-1">
                    Dr. {record.doctorId.name}
                    {record.doctorId.specialization && ` • ${record.doctorId.specialization}`}
                  </p>
                  <p className="text-sm text-gray-500 mt-1">
                    {new Date(record.visitDate).toLocaleDateString()}
                  </p>
                </div>
                <button
                  onClick={() => downloadPrescription(record)}
                  className="flex items-center bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 font-semibold"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download
                </button>
              </div>

              {/* Medicines List */}
              <div className="bg-white rounded p-3 mb-3">
                <h4 className="font-semibold text-gray-800 mb-2">Medicines</h4>
                <div className="space-y-2">
                  {record.prescription.medicines.map((med, idx) => (
                    <div key={idx} className="text-sm">
                      <p className="font-semibold text-gray-800">
                        • {med.name} <span className="text-gray-600">({med.dosage})</span>
                      </p>
                      <p className="text-gray-600 ml-4">
                        {med.frequency} for {med.duration}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {record.prescription.notes && (
                <div className="text-sm bg-yellow-50 p-2 rounded">
                  <p className="text-yellow-800">
                    <strong>Important:</strong> {record.prescription.notes}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

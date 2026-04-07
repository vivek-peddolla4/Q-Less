import { useState, useContext } from 'react';
import axios from 'axios';
import { Plus, Trash2, X } from 'lucide-react';
import { toast } from 'react-toastify';
import { AuthContext } from '../context/AuthContext';

export default function PatientMedicalForm({ onSuccess }) {
  const { user } = useContext(AuthContext);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [medicines, setMedicines] = useState([]);
  const [formData, setFormData] = useState({
    diagnosis: '',
    symptoms: '',
    treatment: '',
    prescriptionNotes: '',
    followUpDate: '',
    notes: ''
  });

  const handleAddMedicine = () => {
    setMedicines([...medicines, { name: '', dosage: '', frequency: '', duration: '' }]);
  };

  const handleRemoveMedicine = (idx) => {
    setMedicines(medicines.filter((_, i) => i !== idx));
  };

  const handleMedicineChange = (idx, field, value) => {
    const updatedMedicines = [...medicines];
    updatedMedicines[idx][field] = value;
    setMedicines(updatedMedicines);
  };

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.diagnosis.trim()) {
      toast.error('Please enter diagnosis/symptoms');
      return;
    }

    try {
      setLoading(true);
      
      // Filter medicines to only include those with name
      const filteredMedicines = medicines.filter(m => m.name && m.name.trim());
      
      const payload = {
        diagnosis: formData.diagnosis.trim(),
        symptoms: formData.symptoms.trim(),
        treatment: formData.treatment.trim(),
        followUpDate: formData.followUpDate || null,
        notes: formData.notes.trim(),
        prescription: filteredMedicines.length > 0 ? {
          medicines: filteredMedicines,
          notes: formData.prescriptionNotes.trim()
        } : null
      };

      const token = localStorage.getItem('accessToken');
      if (!token) {
        toast.error('Session expired. Please login again');
        return;
      }

      // Use patient-create endpoint - no need to pass patientId
      const response = await axios.post('http://localhost:8000/api/medical/patient-create', payload, {
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      toast.success('Medical record saved successfully');
      setIsOpen(false);
      setFormData({
        diagnosis: '',
        symptoms: '',
        treatment: '',
        prescriptionNotes: '',
        followUpDate: '',
        notes: ''
      });
      setMedicines([]);
      
      if (onSuccess) onSuccess();
    } catch (err) {
      console.error('Medical record error:', err);
      const errorMsg = err.response?.data?.message || err.response?.data?.error || err.message || 'Error saving medical record';
      toast.error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 font-semibold"
      >
        + Add Medical Record
      </button>

      {isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="sticky top-0 bg-gradient-to-r from-green-600 to-emerald-500 text-white p-6 flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-bold">Add Medical Record</h2>
                <p className="text-green-100">Record for: {user?.name}</p>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                disabled={loading}
                className="text-white hover:bg-white hover:bg-opacity-20 p-2 rounded"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              {/* Diagnosis */}
              <div>
                <label className="block text-sm font-semibold text-gray-800 mb-2">Diagnosis/Condition *</label>
                <textarea
                  name="diagnosis"
                  value={formData.diagnosis}
                  onChange={handleFormChange}
                  placeholder="Describe your condition or diagnosis..."
                  rows="4"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-600"
                  required
                />
              </div>

              {/* Symptoms */}
              <div>
                <label className="block text-sm font-semibold text-gray-800 mb-2">Symptoms (Optional)</label>
                <textarea
                  name="symptoms"
                  value={formData.symptoms}
                  onChange={handleFormChange}
                  placeholder="List any symptoms you're experiencing..."
                  rows="3"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-600"
                />
              </div>

              {/* Treatment */}
              <div>
                <label className="block text-sm font-semibold text-gray-800 mb-2">Treatment (Optional)</label>
                <textarea
                  name="treatment"
                  value={formData.treatment}
                  onChange={handleFormChange}
                  placeholder="Any treatment you're undergoing..."
                  rows="3"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-600"
                />
              </div>

              {/* Medicines */}
              <div>
                <div className="flex justify-between items-center mb-3">
                  <label className="text-sm font-semibold text-gray-800">Medicines (Optional)</label>
                  <button
                    type="button"
                    onClick={handleAddMedicine}
                    className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700 flex items-center"
                  >
                    <Plus className="w-4 h-4 mr-1" /> Add Medicine
                  </button>
                </div>

                {medicines.map((med, idx) => (
                  <div key={idx} className="bg-gray-50 p-4 rounded-lg mb-3 space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <input
                        type="text"
                        placeholder="Medicine name"
                        value={med.name}
                        onChange={(e) => handleMedicineChange(idx, 'name', e.target.value)}
                        className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-600"
                      />
                      <input
                        type="text"
                        placeholder="Dosage (e.g., 500mg)"
                        value={med.dosage}
                        onChange={(e) => handleMedicineChange(idx, 'dosage', e.target.value)}
                        className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-600"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <input
                        type="text"
                        placeholder="Frequency (e.g., 2x daily)"
                        value={med.frequency}
                        onChange={(e) => handleMedicineChange(idx, 'frequency', e.target.value)}
                        className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-600"
                      />
                      <input
                        type="text"
                        placeholder="Duration (e.g., 10 days)"
                        value={med.duration}
                        onChange={(e) => handleMedicineChange(idx, 'duration', e.target.value)}
                        className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-600"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveMedicine(idx)}
                      className="text-red-600 hover:text-red-800 text-sm flex items-center"
                    >
                      <Trash2 className="w-4 h-4 mr-1" /> Remove
                    </button>
                  </div>
                ))}
              </div>

              {/* Prescription Notes */}
              {medicines.length > 0 && (
                <div>
                  <label className="block text-sm font-semibold text-gray-800 mb-2">Prescription Notes</label>
                  <textarea
                    name="prescriptionNotes"
                    value={formData.prescriptionNotes}
                    onChange={handleFormChange}
                    placeholder="Additional prescription instructions..."
                    rows="2"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-600"
                  />
                </div>
              )}

              {/* Follow-up Date */}
              <div>
                <label className="block text-sm font-semibold text-gray-800 mb-2">Follow-up Date (Optional)</label>
                <input
                  type="date"
                  name="followUpDate"
                  value={formData.followUpDate}
                  onChange={handleFormChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-600"
                />
              </div>

              {/* Additional Notes */}
              <div>
                <label className="block text-sm font-semibold text-gray-800 mb-2">Additional Notes</label>
                <textarea
                  name="notes"
                  value={formData.notes}
                  onChange={handleFormChange}
                  placeholder="Any other relevant information..."
                  rows="2"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-600"
                />
              </div>

              {/* Buttons */}
              <div className="flex gap-3 pt-6 border-t">
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                  {loading ? 'Saving...' : 'Save Medical Record'}
                </button>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  disabled={loading}
                  className="flex-1 bg-gray-200 text-gray-800 px-6 py-3 rounded-lg hover:bg-gray-300 font-semibold disabled:opacity-50 transition"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

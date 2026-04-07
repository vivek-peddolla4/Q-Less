import { useState } from 'react';
import axios from 'axios';
import { Plus, Trash2, X } from 'lucide-react';
import { toast } from 'react-toastify';

export default function CreateMedicalRecord({ patientId, patientName, queueTokenId, onSuccess }) {
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
      toast.error('Please enter diagnosis');
      return;
    }

    try {
      setLoading(true);
      
      // Filter medicines to only include those with name
      const filteredMedicines = medicines.filter(m => m.name && m.name.trim());
      
      const payload = {
        patientId,
        diagnosis: formData.diagnosis.trim(),
        symptoms: formData.symptoms.trim(),
        treatment: formData.treatment.trim(),
        followUpDate: formData.followUpDate || null,
        notes: formData.notes.trim(),
        queueTokenId,
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

      const response = await axios.post('http://localhost:8000/api/medical/create', payload, {
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      toast.success('Medical record created successfully');
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
      const errorMsg = err.response?.data?.message || err.response?.data?.error || err.message || 'Error creating medical record';
      toast.error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 font-semibold"
      >
        + Create Medical Record
      </button>

      {isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="sticky top-0 bg-gradient-to-r from-indigo-600 to-cyan-500 text-white p-6 flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-bold">Create Medical Record</h2>
                <p className="text-indigo-100">Patient: {patientName}</p>
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
              {/* Basic Info */}
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-800 mb-2">Follow-up Date (Optional)</label>
                  <input
                    type="date"
                    name="followUpDate"
                    value={formData.followUpDate}
                    onChange={handleFormChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-600"
                  />
                </div>
              </div>

              {/* Diagnosis */}
              <div>
                <label className="block text-sm font-semibold text-gray-800 mb-2">Diagnosis *</label>
                <textarea
                  name="diagnosis"
                  value={formData.diagnosis}
                  onChange={handleFormChange}
                  placeholder="Enter the diagnosis"
                  rows="3"
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-600"
                />
              </div>

              {/* Symptoms */}
              <div>
                <label className="block text-sm font-semibold text-gray-800 mb-2">Symptoms</label>
                <textarea
                  name="symptoms"
                  value={formData.symptoms}
                  onChange={handleFormChange}
                  placeholder="Describe patient's symptoms"
                  rows="2"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-600"
                />
              </div>

              {/* Treatment */}
              <div>
                <label className="block text-sm font-semibold text-gray-800 mb-2">Treatment Plan</label>
                <textarea
                  name="treatment"
                  value={formData.treatment}
                  onChange={handleFormChange}
                  placeholder="Recommended treatment and lifestyle changes"
                  rows="2"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-600"
                />
              </div>

              {/* Prescription */}
              <div className="bg-green-50 p-4 rounded-lg">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-semibold text-gray-800">Prescription</h3>
                  <button
                    type="button"
                    onClick={handleAddMedicine}
                    className="flex items-center text-indigo-600 hover:text-indigo-700 text-sm font-semibold"
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Add Medicine
                  </button>
                </div>

                {medicines.map((med, idx) => (
                  <div key={idx} className="bg-white p-3 rounded mb-3 space-y-2">
                    <div className="grid grid-cols-3 gap-2">
                      <input
                        type="text"
                        placeholder="Medicine name"
                        value={med.name}
                        onChange={(e) => handleMedicineChange(idx, 'name', e.target.value)}
                        className="px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600"
                      />
                      <input
                        type="text"
                        placeholder="Dosage (e.g., 500mg)"
                        value={med.dosage}
                        onChange={(e) => handleMedicineChange(idx, 'dosage', e.target.value)}
                        className="px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600"
                      />
                      <input
                        type="text"
                        placeholder="Frequency (e.g., Twice daily)"
                        value={med.frequency}
                        onChange={(e) => handleMedicineChange(idx, 'frequency', e.target.value)}
                        className="px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600"
                      />
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Duration (e.g., 7 days)"
                        value={med.duration}
                        onChange={(e) => handleMedicineChange(idx, 'duration', e.target.value)}
                        className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600"
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveMedicine(idx)}
                        className="text-red-600 hover:text-red-700 p-1"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}

                <textarea
                  name="prescriptionNotes"
                  value={formData.prescriptionNotes}
                  onChange={handleFormChange}
                  placeholder="Prescription notes (e.g., take with food, avoid dairy)"
                  rows="2"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-600 text-sm"
                />
              </div>

              {/* Additional Notes */}
              <div>
                <label className="block text-sm font-semibold text-gray-800 mb-2">Additional Notes</label>
                <textarea
                  name="notes"
                  value={formData.notes}
                  onChange={handleFormChange}
                  placeholder="Any additional information for patient's records"
                  rows="2"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-600"
                />
              </div>

              {/* Buttons */}
              <div className="flex justify-end gap-4 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  disabled={loading}
                  className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-semibold disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-semibold disabled:opacity-50"
                >
                  {loading ? 'Saving...' : 'Save Medical Record'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

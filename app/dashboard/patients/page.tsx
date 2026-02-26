'use client';

import { useState, useEffect } from 'react';
import { Plus, User, ArrowRight, Trash2, Loader } from 'lucide-react';
import { fetchPatients, addPatient, updatePatient, deletePatient, logActivity } from '@/lib/database';

interface Patient {
  id: string;
  patient_id_no: string;
  last_name: string;
  first_name: string;
  middle_name?: string;
  age: number;
  birthdate: string;
  sex: string;
  contact_no: string;
  address_house_no?: string;
  address_street?: string;
  address_barangay?: string;
  municipality: string;
  province: string;
  medical_history: string;
  medications: string;
  allergy: string;
  demographics_complete: boolean;
  date_registered: string;
}

export default function PatientsPage() {
  const [showForm, setShowForm] = useState(false);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);

  const [formData, setFormData] = useState({
    patient_id_no: '',
    last_name: '',
    first_name: '',
    middle_name: '',
    age: '',
    birthdate: '',
    sex: 'Male',
    contact_no: '',
    address_house_no: '',
    address_street: '',
    address_barangay: '',
    municipality: '',
    province: '',
    medical_history: '',
    medications: '',
    allergy: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  // Inject animation keyframes
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      @keyframes fadeInSlideUp {
        from {
          opacity: 0;
          transform: translateY(20px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }
      
      @keyframes fadeInScale {
        from {
          opacity: 0;
          transform: scale(0.95);
        }
        to {
          opacity: 1;
          transform: scale(1);
        }
      }
      
      @keyframes fadeIn {
        from {
          opacity: 0;
        }
        to {
          opacity: 1;
        }
      }
      
      @keyframes slideInFromTop {
        from {
          opacity: 0;
          transform: translateY(-20px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }
    `;
    document.head.appendChild(style);
    return () => {
      document.head.removeChild(style);
    };
  }, []);

  // Load patients on mount
  useEffect(() => {
    loadPatients();
  }, []);

  const loadPatients = async () => {
    setLoading(true);
    const data = await fetchPatients();
    setPatients(data);
    setLoading(false);
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.patient_id_no.trim()) newErrors.patient_id_no = 'Patient ID is required';
    if (!formData.last_name.trim()) newErrors.last_name = 'Last name is required';
    if (!formData.first_name.trim()) newErrors.first_name = 'First name is required';
    if (!formData.age || parseInt(formData.age) < 1) newErrors.age = 'Valid age is required';
    if (!formData.birthdate) newErrors.birthdate = 'Birthdate is required';
    if (!formData.contact_no.trim()) newErrors.contact_no = 'Contact number is required';
    if (!formData.municipality.trim()) newErrors.municipality = 'Municipality is required';
    if (!formData.province.trim()) newErrors.province = 'Province is required';
    if (!formData.medical_history.trim()) newErrors.medical_history = 'Medical history is required';
    if (!formData.medications.trim()) newErrors.medications = 'Medications is required';
    if (!formData.allergy.trim()) newErrors.allergy = 'Allergy information is required';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setSubmitting(true);
    try {
      await addPatient({
        patient_id_no: formData.patient_id_no,
        last_name: formData.last_name,
        first_name: formData.first_name,
        middle_name: formData.middle_name || null,
        age: parseInt(formData.age),
        birthdate: formData.birthdate,
        sex: formData.sex,
        contact_no: formData.contact_no,
        address_house_no: formData.address_house_no || null,
        address_street: formData.address_street || null,
        address_barangay: formData.address_barangay,
        municipality: formData.municipality,
        province: formData.province,
        medical_history: formData.medical_history,
        medications: formData.medications,
        allergy: formData.allergy,
      });
      await logActivity({
        user_name: 'Current User',
        encryption_key: 'ENC_KEY_TEMP',
        action: 'edit',
        resource: `Patient: ${formData.first_name} ${formData.last_name}`,
        resource_type: 'Patient Record',
        description: `Registered new patient: ${formData.first_name} ${formData.last_name}`,
      });
      await loadPatients();
      setFormData({
        patient_id_no: '',
        last_name: '',
        first_name: '',
        middle_name: '',
        age: '',
        birthdate: '',
        sex: 'Male',
        contact_no: '',
        address_house_no: '',
        address_street: '',
        address_barangay: '',
        municipality: '',
        province: '',
        medical_history: '',
        medications: '',
        allergy: '',
      });
      setErrors({});
      setShowForm(false);
    } catch (error) {
      console.error('Error adding patient:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this patient?')) {
      await deletePatient(id);
      await logActivity({
        user_name: 'Current User',
        encryption_key: 'ENC_KEY_TEMP',
        action: 'delete',
        resource: 'Patient Record',
        resource_type: 'Patient Record',
        description: 'Deleted patient record',
      });
      await loadPatients();
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader className="w-8 h-8 text-[#3B6255] animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8" style={{
      animation: 'fadeIn 0.5s ease-out'
    }}>
      {/* Header */}
      <div className="flex items-center justify-between" style={{
        animation: 'fadeInSlideUp 0.6s ease-out',
        animationDelay: '0.1s',
        animationFillMode: 'both'
      }}>
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Patient Management</h1>
          <p className="text-gray-600 text-sm mt-1">Register and manage patient demographics and information</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-6 py-3 bg-gradient-to-r from-[#3B6255] to-green-900 text-white rounded-lg hover:shadow-lg transition font-semibold flex items-center gap-2"
        >
          {showForm ? (
            <>
              ✕ Cancel
            </>
          ) : (
            <>
              <Plus className="w-5 h-5" />
              Add New Patient
            </>
          )}
        </button>
      </div>

      {/* Add Patient Form */}
      {showForm && (
        <div className="bg-white rounded-lg shadow-lg p-8 border-l-4 border-[#3B6255]" style={{
          animation: 'fadeInSlideUp 0.6s ease-out 0.2s backwards'
        }}>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Patient Demographics Form</h2>
          <p className="text-gray-600 text-sm mb-6">Fields marked with <span className="text-red-500 font-bold">*</span> are required</p>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Patient ID Section */}
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Patient ID No. <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.patient_id_no}
                  onChange={(e) => setFormData({ ...formData, patient_id_no: e.target.value })}
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[#3B6255] focus:border-transparent outline-none transition text-gray-800 placeholder-gray-500 bg-white ${
                    errors.patient_id_no ? 'border-red-500 bg-red-50' : 'border-gray-300'
                  }`}
                  placeholder="e.g., PAT001"
                />
                {errors.patient_id_no && <p className="text-red-500 text-sm mt-1">{errors.patient_id_no}</p>}
              </div>
            </div>

            {/* Names Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Last Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.last_name}
                  onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[#3B6255] focus:border-transparent outline-none transition text-gray-800 placeholder-gray-500 bg-white ${
                    errors.last_name ? 'border-red-500 bg-red-50' : 'border-gray-300'
                  }`}
                  placeholder="Surname"
                />
                {errors.last_name && <p className="text-red-500 text-sm mt-1">{errors.last_name}</p>}
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  First Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.first_name}
                  onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[#3B6255] focus:border-transparent outline-none transition text-gray-800 placeholder-gray-500 bg-white ${
                    errors.first_name ? 'border-red-500 bg-red-50' : 'border-gray-300'
                  }`}
                  placeholder="Given name"
                />
                {errors.first_name && <p className="text-red-500 text-sm mt-1">{errors.first_name}</p>}
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Middle Name
                </label>
                <input
                  type="text"
                  value={formData.middle_name}
                  onChange={(e) => setFormData({ ...formData, middle_name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#3B6255] focus:border-transparent outline-none transition text-gray-800 placeholder-gray-500 bg-white"
                  placeholder="Optional"
                />
              </div>
            </div>

            {/* Age and Birthdate Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Age <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  value={formData.age}
                  onChange={(e) => setFormData({ ...formData, age: e.target.value })}
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[#3B6255] focus:border-transparent outline-none transition text-gray-800 placeholder-gray-500 bg-white ${
                    errors.age ? 'border-red-500 bg-red-50' : 'border-gray-300'
                  }`}
                  placeholder="Enter age"
                  min="1"
                />
                {errors.age && <p className="text-red-500 text-sm mt-1">{errors.age}</p>}
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Birthdate (mm/dd/yyyy) <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={formData.birthdate}
                  onChange={(e) => setFormData({ ...formData, birthdate: e.target.value })}
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[#3B6255] focus:border-transparent outline-none transition text-gray-800 bg-white ${
                    errors.birthdate ? 'border-red-500 bg-red-50' : 'border-gray-300'
                  }`}
                />
                {errors.birthdate && <p className="text-red-500 text-sm mt-1">{errors.birthdate}</p>}
              </div>
            </div>

            {/* Sex and Contact Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Sex <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.sex}
                  onChange={(e) => setFormData({ ...formData, sex: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#3B6255] focus:border-transparent outline-none transition text-gray-800 bg-white"
                >
                  <option>Male</option>
                  <option>Female</option>
                  <option>Others</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Contact No. <span className="text-red-500">*</span>
                </label>
                <input
                  type="tel"
                  value={formData.contact_no}
                  onChange={(e) => setFormData({ ...formData, contact_no: e.target.value })}
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[#3B6255] focus:border-transparent outline-none transition text-gray-800 placeholder-gray-500 bg-white ${
                    errors.contact_no ? 'border-red-500 bg-red-50' : 'border-gray-300'
                  }`}
                  placeholder="e.g., 09171234567"
                />
                {errors.contact_no && <p className="text-red-500 text-sm mt-1">{errors.contact_no}</p>}
              </div>
            </div>

            {/* Address Section */}
            <div className="bg-green-50 p-4 rounded-lg border border-green-200">
              <h3 className="font-semibold text-gray-800 mb-4">Address</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    House No., Street
                  </label>
                  <input
                    type="text"
                    value={formData.address_house_no}
                    onChange={(e) => setFormData({ ...formData, address_house_no: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#3B6255] focus:border-transparent outline-none transition text-gray-800 placeholder-gray-500 bg-white"
                    placeholder="Optional"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Street Name
                  </label>
                  <input
                    type="text"
                    value={formData.address_street}
                    onChange={(e) => setFormData({ ...formData, address_street: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#3B6255] focus:border-transparent outline-none transition text-gray-800 placeholder-gray-500 bg-white"
                    placeholder="Optional"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Barangay
                  </label>
                  <input
                    type="text"
                    value={formData.address_barangay}
                    onChange={(e) => setFormData({ ...formData, address_barangay: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#3B6255] focus:border-transparent outline-none transition text-gray-800 placeholder-gray-500 bg-white"
                    placeholder="Optional"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Municipality/City <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.municipality}
                    onChange={(e) => setFormData({ ...formData, municipality: e.target.value })}
                    className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[#3B6255] focus:border-transparent outline-none transition text-gray-800 placeholder-gray-500 bg-white ${
                      errors.municipality ? 'border-red-500 bg-red-50' : 'border-gray-300'
                    }`}
                    placeholder="e.g., Makati"
                  />
                  {errors.municipality && <p className="text-red-500 text-sm mt-1">{errors.municipality}</p>}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Province <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.province}
                    onChange={(e) => setFormData({ ...formData, province: e.target.value })}
                    className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[#3B6255] focus:border-transparent outline-none transition text-gray-800 placeholder-gray-500 bg-white ${
                      errors.province ? 'border-red-500 bg-red-50' : 'border-gray-300'
                    }`}
                    placeholder="e.g., NCR"
                  />
                  {errors.province && <p className="text-red-500 text-sm mt-1">{errors.province}</p>}
                </div>
              </div>
            </div>

            {/* Medical Section */}
            <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
              <h3 className="font-semibold text-gray-800 mb-4">Medical Information</h3>
              
              <div className="mb-4">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Medical History <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={formData.medical_history}
                  onChange={(e) => setFormData({ ...formData, medical_history: e.target.value })}
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[#3B6255] focus:border-transparent outline-none transition text-gray-800 placeholder-gray-500 bg-white ${
                    errors.medical_history ? 'border-red-500 bg-red-50' : 'border-gray-300'
                  }`}
                  placeholder="e.g., Hypertension, Diabetes"
                  rows={3}
                />
                {errors.medical_history && <p className="text-red-500 text-sm mt-1">{errors.medical_history}</p>}
              </div>

              <div className="mb-4">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Medications <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={formData.medications}
                  onChange={(e) => setFormData({ ...formData, medications: e.target.value })}
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[#3B6255] focus:border-transparent outline-none transition text-gray-800 placeholder-gray-500 bg-white ${
                    errors.medications ? 'border-red-500 bg-red-50' : 'border-gray-300'
                  }`}
                  placeholder="e.g., Metoprolol 50mg daily, Atorvastatin 20mg"
                  rows={3}
                />
                {errors.medications && <p className="text-red-500 text-sm mt-1">{errors.medications}</p>}
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Allergy <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={formData.allergy}
                  onChange={(e) => setFormData({ ...formData, allergy: e.target.value })}
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[#3B6255] focus:border-transparent outline-none transition text-gray-800 placeholder-gray-500 bg-white ${
                    errors.allergy ? 'border-red-500 bg-red-50' : 'border-gray-300'
                  }`}
                  placeholder="e.g., Penicillin, None"
                  rows={2}
                />
                {errors.allergy && <p className="text-red-500 text-sm mt-1">{errors.allergy}</p>}
              </div>
            </div>

            {/* Form Actions */}
            <div className="flex gap-4 pt-6 border-t border-gray-200">
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 px-6 py-3 bg-gradient-to-r from-[#3B6255] to-green-900 text-white rounded-lg hover:shadow-lg transition font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {submitting ? 'Registering...' : '✓ Register Patient'}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="flex-1 px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition font-semibold"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Patients List */}
      <div className="bg-white rounded-lg shadow-lg overflow-hidden" style={{
        animation: 'fadeInSlideUp 0.6s ease-out 0.3s backwards'
      }}>
        <div className="px-8 py-6 border-b border-gray-200">
          <h2 className="text-2xl font-bold text-gray-800">
            Registered Patients ({patients.length})
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b-2 border-gray-200">
              <tr>
                <th className="text-left py-4 px-8 font-semibold text-gray-700">Patient ID</th>
                <th className="text-left py-4 px-8 font-semibold text-gray-700">Name</th>
                <th className="text-left py-4 px-8 font-semibold text-gray-700">Age</th>
                <th className="text-left py-4 px-8 font-semibold text-gray-700">Sex</th>
                <th className="text-left py-4 px-8 font-semibold text-gray-700">Location</th>
                <th className="text-left py-4 px-8 font-semibold text-gray-700">Demographics</th>
                <th className="text-left py-4 px-8 font-semibold text-gray-700">Registered</th>
                <th className="text-left py-4 px-8 font-semibold text-gray-700">Action</th>
              </tr>
            </thead>
            <tbody>
              {patients.map((patient) => (
                <tr
                  key={patient.id}
                  className="border-b border-gray-100 hover:bg-[#F0F4F1] transition"
                >
                  <td className="py-4 px-8 font-semibold text-gray-800">{patient.patient_id_no}</td>
                  <td className="py-4 px-8 font-medium text-gray-800">
                    {patient.first_name} {patient.last_name}
                  </td>
                  <td className="py-4 px-8 text-gray-600">{patient.age}</td>
                  <td className="py-4 px-8 text-gray-600">{patient.sex}</td>
                  <td className="py-4 px-8 text-gray-600">
                    {patient.municipality}, {patient.province}
                  </td>
                  <td className="py-4 px-8">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        patient.demographics_complete
                          ? 'bg-green-100 text-green-800'
                          : 'bg-yellow-100 text-yellow-800'
                      }`}
                    >
                      {patient.demographics_complete ? '✓ Complete' : 'Incomplete'}
                    </span>
                  </td>
                  <td className="py-4 px-8 text-gray-600">{new Date(patient.date_registered).toLocaleDateString()}</td>
                  <td className="py-4 px-8">
                    <button 
                      onClick={() => {
                        setSelectedPatient(patient);
                        setShowDetailsModal(true);
                      }}
                      className="text-[#3B6255] hover:text-[#5A7669] font-semibold text-sm flex items-center gap-1 hover:underline transition"
                    >
                      View Details <ArrowRight className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Patient Details Modal */}
      {showDetailsModal && selectedPatient && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-50 flex items-center justify-center p-4" style={{
          animation: 'fadeIn 0.3s ease-out'
        }}>
          <div className="bg-white rounded-lg shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" style={{
            animation: 'slideInFromTop 0.4s ease-out'
          }}>
            {/* Modal Header */}
            <div className="sticky top-0 bg-gradient-to-r from-[#3B6255] to-green-900 text-white px-8 py-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <User className="w-6 h-6" />
                <h3 className="text-2xl font-bold">Patient Details</h3>
              </div>
              <button
                onClick={() => {
                  setShowDetailsModal(false);
                  setSelectedPatient(null);
                }}
                className="hover:bg-white hover:bg-opacity-20 p-2 rounded-lg transition"
              >
                ✕
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-8 space-y-6">
              {/* Personal Information */}
              <div className="bg-blue-50 p-6 rounded-lg border border-blue-200">
                <h4 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                  <User className="w-5 h-5 text-[#3B6255]" />
                  Personal Information
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-gray-600 uppercase">Patient ID</label>
                    <p className="text-base font-semibold text-gray-800 mt-1">{selectedPatient.patient_id_no}</p>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-600 uppercase">Full Name</label>
                    <p className="text-base font-semibold text-gray-800 mt-1">
                      {selectedPatient.first_name} {selectedPatient.middle_name ? selectedPatient.middle_name + ' ' : ''}{selectedPatient.last_name}
                    </p>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-600 uppercase">Age</label>
                    <p className="text-base font-semibold text-gray-800 mt-1">{selectedPatient.age} years old</p>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-600 uppercase">Sex</label>
                    <p className="text-base font-semibold text-gray-800 mt-1">{selectedPatient.sex}</p>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-600 uppercase">Birthdate</label>
                    <p className="text-base font-semibold text-gray-800 mt-1">
                      {new Date(selectedPatient.birthdate).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                    </p>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-600 uppercase">Contact No.</label>
                    <p className="text-base font-semibold text-gray-800 mt-1">{selectedPatient.contact_no}</p>
                  </div>
                </div>
              </div>

              {/* Address Information */}
              <div className="bg-purple-50 p-6 rounded-lg border border-purple-200">
                <h4 className="text-lg font-bold text-gray-800 mb-4">Address</h4>
                <div className="space-y-2 text-gray-700">
                  {selectedPatient.address_house_no && (
                    <p><span className="font-semibold">House No.:</span> {selectedPatient.address_house_no}</p>
                  )}
                  {selectedPatient.address_street && (
                    <p><span className="font-semibold">Street:</span> {selectedPatient.address_street}</p>
                  )}
                  {selectedPatient.address_barangay && (
                    <p><span className="font-semibold">Barangay:</span> {selectedPatient.address_barangay}</p>
                  )}
                  <p><span className="font-semibold">Municipality:</span> {selectedPatient.municipality}</p>
                  <p><span className="font-semibold">Province:</span> {selectedPatient.province}</p>
                </div>
              </div>

              {/* Medical Information */}
              <div className="bg-amber-50 p-6 rounded-lg border border-amber-200">
                <h4 className="text-lg font-bold text-gray-800 mb-4">Medical Information</h4>
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-semibold text-gray-600 uppercase">Medical History</label>
                    <p className="text-sm text-gray-700 mt-2 bg-white p-3 rounded border border-amber-100">{selectedPatient.medical_history}</p>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-600 uppercase">Medications</label>
                    <p className="text-sm text-gray-700 mt-2 bg-white p-3 rounded border border-amber-100">{selectedPatient.medications}</p>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-600 uppercase">Allergies</label>
                    <p className="text-sm text-gray-700 mt-2 bg-white p-3 rounded border border-amber-100">{selectedPatient.allergy}</p>
                  </div>
                </div>
              </div>

              {/* Registration Info */}
              <div className="bg-gray-50 p-6 rounded-lg border border-gray-200">
                <h4 className="text-lg font-bold text-gray-800 mb-4">Registration</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-gray-600 uppercase">Registered On</label>
                    <p className="text-base font-semibold text-gray-800 mt-1">
                      {new Date(selectedPatient.date_registered).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                    </p>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-600 uppercase">Demographics Status</label>
                    <p className="text-base font-semibold text-gray-800 mt-1">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        selectedPatient.demographics_complete
                          ? 'bg-green-100 text-green-800'
                          : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {selectedPatient.demographics_complete ? '✓ Complete' : 'Incomplete'}
                      </span>
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-8 py-4 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowDetailsModal(false);
                  setSelectedPatient(null);
                }}
                className="px-6 py-2 bg-gray-300 text-gray-800 rounded-lg hover:bg-gray-400 transition font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

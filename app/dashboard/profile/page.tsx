'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/authContext';
import { User, Mail, Phone, MapPin, Briefcase, Award, Edit2, Save, X } from 'lucide-react';

interface UserProfile {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  role: string;
  department: string;
  avatar: string;
  credentials: string[];
  certifications: string[];
  joinDate: string;
  address: string;
  city: string;
  province: string;
}

export default function ProfilePage() {
  const { user } = useAuth();
  const [isEditing, setIsEditing] = useState(false);

  const [profile, setProfile] = useState<UserProfile>({
    id: user?.id || 'unknown',
    fullName: user?.full_name || 'Unknown User',
    email: user?.email || '',
    phone: '+63 917 1234567',
    role: user?.role === 'faculty' ? 'Laboratory Director' : 'Medical Technologist',
    department: user?.department || 'General',
    avatar: user?.role === 'faculty' ? '👨‍⚕️' : '👤',
    credentials: user?.role === 'faculty' ? ['RMT', 'RMT'] : ['RMT'],
    certifications: user?.role === 'faculty' 
      ? ['Clinical Pathology Specialist', 'ISO 15189 Quality Manager']
      : [`Certified in ${user?.department || 'Laboratory Science'}`],
    joinDate: (user as any)?.join_date || new Date().toISOString().split('T')[0],
    address: 'Lot 5, Block 2, Medical Complex',
    city: 'Manila',
    province: 'NCR',
  });

  const [editData, setEditData] = useState(profile);

  // Update profile when user changes
  useEffect(() => {
    if (user) {
      const newProfile = {
        id: user.id,
        fullName: user.full_name,
        email: user.email,
        phone: '+63 917 1234567',
        role: user.role === 'faculty' ? 'Laboratory Director' : 'Medical Technologist',
        department: user.department,
        avatar: user.role === 'faculty' ? '👨‍⚕️' : '👤',
        credentials: user.role === 'faculty' ? ['RMT'] : ['RMT'],
        certifications: user.role === 'faculty'
          ? ['Clinical Pathology Specialist', 'ISO 15189 Quality Manager']
          : [`Certified in ${user.department}`],
        joinDate: (user as any).join_date || new Date().toISOString().split('T')[0],
        address: 'Lot 5, Block 2, Medical Complex',
        city: 'Manila',
        province: 'NCR',
      };
      setProfile(newProfile);
      setEditData(newProfile);
    }
  }, [user]);

  const handleEdit = () => {
    setIsEditing(true);
    setEditData(profile);
  };

  const handleSave = () => {
    setProfile(editData);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditData(profile);
  };

  const handleInputChange = (field: keyof UserProfile, value: any) => {
    setEditData({ ...editData, [field]: value });
  };

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
    `;
    document.head.appendChild(style);
    return () => {
      document.head.removeChild(style);
    };
  }, []);

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
          <h1 className="text-3xl font-bold text-gray-800">My Profile</h1>
          <p className="text-gray-600 text-sm mt-1">View and manage your professional information</p>
        </div>
        {!isEditing && (
          <button
            onClick={handleEdit}
            className="px-6 py-3 bg-gradient-to-r from-[#3B6255] to-green-900 text-white rounded-lg hover:shadow-lg transition font-semibold flex items-center gap-2"
          >
            <Edit2 className="w-5 h-5" />
            Edit Profile
          </button>
        )}
      </div>

      {/* Profile Card */}
      <div className="bg-white rounded-lg shadow-lg p-8 border-l-4 border-[#3B6255]" style={{
        animation: 'fadeInScale 0.6s ease-out 0.2s backwards'
      }}>
        {/* Profile Header */}
        <div className="flex items-start gap-8 pb-8 border-b border-gray-200">
          <div className="w-24 h-24 bg-gradient-to-br from-[#3B6255] to-green-900 rounded-full flex items-center justify-center text-5xl">
            {profile.avatar}
          </div>
          <div className="flex-1">
            <h2 className="text-3xl font-bold text-gray-800 mb-2">
              {isEditing ? (
                <input
                  type="text"
                  value={editData.fullName}
                  onChange={(e) => handleInputChange('fullName', e.target.value)}
                  className="w-full px-3 py-1 border border-gray-300 rounded-lg text-gray-800"
                />
              ) : (
                profile.fullName
              )}
            </h2>
            <p className="text-lg text-[#3B6255] font-semibold mb-1">
              {isEditing ? (
                <input
                  type="text"
                  value={editData.role}
                  onChange={(e) => handleInputChange('role', e.target.value)}
                  className="w-full px-3 py-1 border border-gray-300 rounded-lg text-gray-800"
                />
              ) : (
                profile.role
              )}
            </p>
            <p className="text-gray-600">
              {isEditing ? (
                <input
                  type="text"
                  value={editData.department}
                  onChange={(e) => handleInputChange('department', e.target.value)}
                  className="w-full px-3 py-1 border border-gray-300 rounded-lg text-gray-800"
                />
              ) : (
                profile.department
              )}
            </p>
          </div>
        </div>

        {/* Contact Information */}
        <div className="py-8 border-b border-gray-200">
          <h3 className="text-xl font-bold text-gray-800 mb-6 flex items-center gap-2">
            <Mail className="w-5 h-5 text-[#3B6255]" />
            Contact Information
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="text-sm font-semibold text-gray-700 mb-2 block">Email</label>
              {isEditing ? (
                <input
                  type="email"
                  value={editData.email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-800"
                />
              ) : (
                <p className="text-gray-800">{profile.email}</p>
              )}
            </div>
            <div>
              <label className="text-sm font-semibold text-gray-700 mb-2 block">
                <Phone className="w-4 h-4 inline mr-1" />
                Phone
              </label>
              {isEditing ? (
                <input
                  type="tel"
                  value={editData.phone}
                  onChange={(e) => handleInputChange('phone', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-800"
                />
              ) : (
                <p className="text-gray-800">{profile.phone}</p>
              )}
            </div>
          </div>
        </div>

        {/* Address Information */}
        <div className="py-8 border-b border-gray-200">
          <h3 className="text-xl font-bold text-gray-800 mb-6 flex items-center gap-2">
            <MapPin className="w-5 h-5 text-[#3B6255]" />
            Address
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="text-sm font-semibold text-gray-700 mb-2 block">Street Address</label>
              {isEditing ? (
                <input
                  type="text"
                  value={editData.address}
                  onChange={(e) => handleInputChange('address', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-800"
                />
              ) : (
                <p className="text-gray-800">{profile.address}</p>
              )}
            </div>
            <div>
              <label className="text-sm font-semibold text-gray-700 mb-2 block">City/Municipality</label>
              {isEditing ? (
                <input
                  type="text"
                  value={editData.city}
                  onChange={(e) => handleInputChange('city', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-800"
                />
              ) : (
                <p className="text-gray-800">{profile.city}</p>
              )}
            </div>
            <div>
              <label className="text-sm font-semibold text-gray-700 mb-2 block">Province</label>
              {isEditing ? (
                <input
                  type="text"
                  value={editData.province}
                  onChange={(e) => handleInputChange('province', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-800"
                />
              ) : (
                <p className="text-gray-800">{profile.province}</p>
              )}
            </div>
          </div>
        </div>

        {/* Professional Information */}
        <div className="py-8 border-b border-gray-200">
          <h3 className="text-xl font-bold text-gray-800 mb-6 flex items-center gap-2">
            <Briefcase className="w-5 h-5 text-[#3B6255]" />
            Professional Information
          </h3>
          <div className="space-y-6">
            <div>
              <label className="text-sm font-semibold text-gray-700 mb-3 block">Credentials</label>
              <div className="flex flex-wrap gap-2">
                {profile.credentials.map((credential, idx) => (
                  <span
                    key={idx}
                    className="px-4 py-2 bg-[#CBDED3] text-[#3B6255] rounded-full font-medium text-sm"
                  >
                    {credential}
                  </span>
                ))}
              </div>
            </div>

            <div>
              <label className="text-sm font-semibold text-gray-700 mb-3 block">Certifications</label>
              <div className="space-y-2">
                {profile.certifications.map((cert, idx) => (
                  <div key={idx} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <Award className="w-5 h-5 text-[#3B6255]" />
                    <span className="text-gray-800">{cert}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Additional Info */}
        <div className="py-8">
          <h3 className="text-xl font-bold text-gray-800 mb-4">Employment Details</h3>
          <div className="p-4 bg-[#F0F4F1] rounded-lg border border-[#CBDED3]">
            <p className="text-gray-800">
              <span className="font-semibold">Member Since:</span> {new Date(profile.joinDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        {isEditing && (
          <div className="flex gap-4 pt-6 border-t border-gray-200">
            <button
              onClick={handleSave}
              className="flex-1 px-6 py-3 bg-gradient-to-r from-[#3B6255] to-green-900 text-white rounded-lg hover:shadow-lg transition font-semibold flex items-center justify-center gap-2"
            >
              <Save className="w-5 h-5" />
              Save Changes
            </button>
            <button
              onClick={handleCancel}
              className="flex-1 px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition font-semibold flex items-center justify-center gap-2"
            >
              <X className="w-5 h-5" />
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

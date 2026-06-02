// app/dashboard/staff/departments/[id]/page.tsx
'use client';
import api from '@/lib/api';
import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { departmentsAPI, positionsAPI, staffAPI } from '@/lib/api';
import { Department, Position, Staff } from '@/lib/types';
import {
  Building,
  Users,
  ArrowLeft,
  Edit3,
  Trash2,
  Plus,
  ChevronDown,
  ChevronUp,
  UserCheck,
} from 'lucide-react';

export default function DepartmentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { hasPermission, user } = useAuth();
  const [department, setDepartment] = useState<Department | null>(null);
  const [positions, setPositions] = useState<Position[]>([]);
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedPositions, setExpandedPositions] = useState(false);
  const [expandedStaff, setExpandedStaff] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  // Prevent hydration mismatch by checking isClient
  const canEdit = isClient ? (user?.is_superuser || hasPermission('human_resource.change_departmentmodel')) : false;
  const canDelete = isClient ? (user?.is_superuser || hasPermission('human_resource.delete_departmentmodel')) : false;
  const canViewPositions = isClient ? (user?.is_superuser || hasPermission('human_resource.view_positionmodel')) : false;
  const canViewStaff = isClient ? (user?.is_superuser || hasPermission('human_resource.view_staffmodel')) : false;

  useEffect(() => {
    if (params.id) {
      fetchDepartment();
      if (canViewPositions) {
        fetchPositions();
      }
      if (canViewStaff) {
        fetchStaff();
      }
    }
  }, [params.id, canViewPositions, canViewStaff]);

  const fetchDepartment = async () => {
    try {
      const data = await departmentsAPI.get(Number(params.id));
      setDepartment(data);
    } catch (error: any) {
      setError(error.message || 'Failed to fetch department');
    } finally {
      setLoading(false);
    }
  };

  const fetchPositions = async () => {
    try {
      const data = await positionsAPI.list();
      setPositions(data.filter(pos =>
        typeof pos.department === 'object'
          ? pos.department.id === Number(params.id)
          : pos.department === Number(params.id)
      ));
    } catch (error: any) {
      console.error('Failed to fetch positions:', error);
    }
  };

  const fetchStaff = async () => {
    try {
      console.log('Fetching staff for department:', params.id);
      const response = await api.get('/api/human-resource/staff/', {
        params: {
          department: Number(params.id),
          page_size: 100
        }
      });

      // Handle the nested response structure
      const data = response.data;
      const staffData = data.results?.data || [];

      console.log('Staff data:', staffData);
      setStaffList(staffData);
    } catch (error: any) {
      console.error('Failed to fetch staff:', error);
    }
  };

  const handleDelete = async () => {
    if (!department) return;

    try {
      await departmentsAPI.delete(department.id);
      router.push('/dashboard/staff/departments');
    } catch (error: any) {
      setError(error.message || 'Failed to delete department');
      setShowDeleteModal(false);
    }
  };

  const handleGoBack = () => {
    if (window.history.length > 2) {
      router.back();
    } else {
      router.push('/dashboard/staff/departments');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading department...</p>
        </div>
      </div>
    );
  }

  if (error || !department) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Building className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Error</h2>
          <p className="text-gray-600">{error || 'Department not found'}</p>
          <button
            onClick={handleGoBack}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={handleGoBack}
          className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold text-gray-900">{department.name}</h1>
          <p className="text-gray-600">Department Details</p>
        </div>
        {canEdit && (
          <button
            onClick={() => router.push(`/dashboard/staff/departments/edit/${department.id}`)}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all"
          >
            <Edit3 className="h-4 w-4" />
            Edit Department
          </button>
        )}
      </div>

      {/* Department Info Card */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-6">
          <div className="flex items-start justify-between mb-6">
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">Department Information</h2>
              <div className="flex items-center gap-4">
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                  department.is_active
                    ? 'bg-green-100 text-green-800'
                    : 'bg-gray-100 text-gray-800'
                }`}>
                  {department.is_active ? 'Active' : 'Inactive'}
                </span>
                <span className="text-sm text-gray-600">Code: {department.code}</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {canEdit && (
                <button
                  onClick={() => router.push(`/dashboard/staff/departments/edit/${department.id}`)}
                  className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                >
                  <Edit3 className="h-4 w-4" />
                </button>
              )}
              {canDelete && (
                <button
                  onClick={() => setShowDeleteModal(true)}
                  className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Description</h3>
              <p className="text-gray-600">
                {department.description || 'No description provided'}
              </p>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Statistics</h3>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-600">Total Staff:</span>
                  <span className="font-medium">{staffList.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Positions:</span>
                  <span className="font-medium">{department.positions_count || 0}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 pt-6 border-t border-gray-100">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-gray-500">Created:</span>
                <span className="ml-2 text-gray-900">
                  {new Date(department.created_at).toLocaleDateString()}
                </span>
              </div>
              <div>
                <span className="text-gray-500">Last Updated:</span>
                <span className="ml-2 text-gray-900">
                  {new Date(department.updated_at).toLocaleDateString()}
                </span>
              </div>
              <div>
                <span className="text-gray-500">Department ID:</span>
                <span className="ml-2 text-gray-900">#{department.id}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Staff Section */}
      {isClient && (user?.is_superuser || canViewStaff) && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                <UserCheck className="h-5 w-5" />
                Staff in this Department ({staffList.length})
              </h2>
              <button
                onClick={() => setExpandedStaff(!expandedStaff)}
                className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                {expandedStaff ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </button>
            </div>

            {expandedStaff && (
              <div className="space-y-3">
                {staffList.length === 0 ? (
                  <p className="text-center text-gray-500 py-8">
                    No staff found in this department
                    {process.env.NODE_ENV === 'development' && (
                      <span className="block mt-2 text-xs">
                        Check browser console for API response
                      </span>
                    )}
                  </p>
                ) : (
                  staffList.map((staff: any) => (
                    <div
                      key={staff.id}
                      className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {staff.image_url ? (
                            <img
                              src={staff.image_url}
                              alt={staff.full_name}
                              className="w-10 h-10 rounded-full object-cover"
                            />
                          ) : (
                            <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
                              <UserCheck className="h-5 w-5 text-gray-500" />
                            </div>
                          )}
                          <div>
                            <h4 className="font-medium text-gray-900">{staff.full_name}</h4>
                            <p className="text-sm text-gray-600">
                              {staff.position_name || staff.position || 'No position'}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-gray-500">
                          <span className="flex items-center gap-1">
                            <Users className="h-4 w-4" />
                            {staff.staff_id}
                          </span>
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                            staff.status === 'active'
                              ? 'bg-green-100 text-green-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}>
                            {staff.status}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Positions Section */}
      {isClient && (user?.is_superuser || canViewPositions) && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                <Building className="h-5 w-5" />
                Positions in this Department ({positions.length})
              </h2>
              <button
                onClick={() => setExpandedPositions(!expandedPositions)}
                className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                {expandedPositions ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </button>
            </div>

            {expandedPositions && (
              <div className="space-y-3">
                {positions.length === 0 ? (
                  <p className="text-center text-gray-500 py-8">
                    No positions found in this department
                  </p>
                ) : (
                  positions.map((position) => (
                    <div
                      key={position.id}
                      className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-medium text-gray-900">{position.name}</h4>
                          <p className="text-sm text-gray-600">Code: {position.code}</p>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-gray-500">
                          <Users className="h-4 w-4" />
                          {position.staff_count || 0} staff
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="p-6">
              <div className="flex items-center justify-center w-12 h-12 bg-red-100 rounded-full mx-auto mb-4">
                <Trash2 className="h-6 w-6 text-red-600" />
              </div>
              <h3 className="text-lg font-bold text-center text-gray-900 mb-2">
                Delete Department
              </h3>
              <p className="text-center text-gray-600 mb-6">
                Are you sure you want to delete "{department.name}"? This action cannot be undone.
              </p>
              <div className="flex justify-center gap-3">
                <button
                  onClick={() => setShowDeleteModal(false)}
                  className="px-5 py-2.5 border border-gray-300 rounded-lg font-medium text-gray-700 bg-white hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  className="px-5 py-2.5 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700"
                >
                  Delete Department
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
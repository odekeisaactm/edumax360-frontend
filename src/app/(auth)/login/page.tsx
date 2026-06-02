'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { User, Lock } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const { login, loading } = useAuth();
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    rememberMe: false,
  });
  const [error, setError] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    try {
      const response = await login(formData.username, formData.password);

      const user = response.user;
      const permissions = response.permissions || [];
      const setup_status = response.setup_status || {};

      const hasSetupPermission =
        user.is_superuser ||
        permissions.includes('school_configuration.add_schoolinfomodel');

      if (hasSetupPermission) {
        if (!setup_status.school_info_exists) {
          window.location.href = '/dashboard/setup/school-info';
          return;
        } else if (!setup_status.school_settings_exists) {
          window.location.href = '/dashboard/setup/school-settings';
          return;
        }
      }

      switch (user.user_type) {
        case 'staff':
          window.location.href = '/dashboard/staff';
          break;
        case 'student':
          window.location.href = '/dashboard/student';
          break;
        case 'parent':
          window.location.href = '/dashboard/parent';
          break;
        default:
          window.location.href = '/dashboard';
      }

    } catch (err: any) {
      setError(err.message || 'Login failed. Please try again.');
    }
  };

  return (
    <div className="login-container">
      <div
        className="login-bg"
        style={{ backgroundImage: "url('/images/background.png')" }}
      >
        <div className="dark-overlay">
          <section className="min-h-screen flex items-center justify-center py-4">
            <div className="container mx-auto px-4">
              <div className="flex justify-center">
                <div className="w-full max-w-md">
                  <div className="flex flex-col items-center justify-center">
                    <div className="flex justify-center py-4">
                      <a href="#" className="logo flex items-center w-auto">
                        <img
                          className="h-12 w-auto rounded-full"
                          src="/images/logo-placeholder.png"
                          alt="School Logo"
                          style={{ background: 'white', padding: '5px' }}
                        />
                        <span className="hidden lg:block ps-2 text-white text-xl font-bold">SCHOOL PORTAL</span>
                      </a>
                    </div>

                    <div className="bg-white rounded-lg shadow-xl mb-3 overflow-hidden">
                      <div className="p-6">
                        <div className="pt-4 pb-2">
                          <h5 className="card-title text-center pb-0 text-2xl font-semibold">Portal Login</h5>
                          <p className="text-center text-sm text-gray-600">Enter your username & password to login</p>
                        </div>

                        {error && (
                          <div className="bg-red-50 border border-red-200 text-red-800 rounded-lg p-4 mb-4" role="alert">
                            <div className="flex">
                              <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                              </svg>
                              {error}
                            </div>
                          </div>
                        )}

                        <form onSubmit={handleSubmit} className="space-y-4">
                          <div>
                            <label htmlFor="yourUsername" className="block text-sm font-medium text-gray-700">Username</label>
                            <div className="form-input-group mt-1">
                              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <User className="h-5 w-5 text-gray-400" />
                              </div>
                              <input
                                type="text"
                                name="username"
                                className="form-input-with-icon"
                                id="yourUsername"
                                value={formData.username}
                                onChange={handleChange}
                                required
                                autoComplete="off"
                                placeholder="Enter your username"
                              />
                            </div>
                          </div>

                          <div>
                            <label htmlFor="yourPassword" className="block text-sm font-medium text-gray-700">Password</label>
                            <div className="form-input-group mt-1">
                              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <Lock className="h-5 w-5 text-gray-400" />
                              </div>
                              <input
                                type="password"
                                name="password"
                                className="form-input-with-icon"
                                id="yourPassword"
                                value={formData.password}
                                onChange={handleChange}
                                required
                                placeholder="Enter your password"
                              />
                            </div>
                          </div>

                          <div className="flex items-center justify-between">
                            <div className="flex items-center">
                              <input
                                id="rememberMe"
                                name="rememberMe"
                                type="checkbox"
                                checked={formData.rememberMe}
                                onChange={handleChange}
                                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                              />
                              <label htmlFor="rememberMe" className="ml-2 block text-sm text-gray-900">
                                Remember me
                              </label>
                            </div>
                            <div className="text-sm">
                              <Link href="/forgot-password" className="font-medium text-blue-600 hover:text-blue-500">
                                Forgot password?
                              </Link>
                            </div>
                          </div>

                          <div>
                            <button
                              type="submit"
                              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                              disabled={loading || !formData.username || !formData.password}
                            >
                              {loading ? (
                                <>
                                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                  </svg>
                                  Signing in...
                                </>
                              ) : (
                                'Login'
                              )}
                            </button>
                          </div>
                        </form>

                        <div className="mt-6">
                          <div className="relative">
                            <div className="absolute inset-0 flex items-center">
                              <div className="w-full border-t border-gray-300"></div>
                            </div>
                            <div className="relative flex justify-center text-sm">
                              <span className="px-2 bg-white text-gray-500">New to our platform?</span>
                            </div>
                          </div>

                          <div className="mt-6 text-center">
                            <p className="text-sm text-gray-600">
                              Contact your school administrator for login credentials
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="text-center text-white mt-8">
                      © {new Date().getFullYear()} All Rights Reserved.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
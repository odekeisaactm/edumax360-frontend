'use client';

import React, { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import {
  CheckCircle2,
  Clock,
  AlertCircle,
  Home,
  FileText,
} from 'lucide-react';

export default function ExamSubmittedPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();

  const attemptId = searchParams?.get('attempt');
  const autoSubmit = searchParams?.get('auto') === 'true';

  useEffect(() => {
    // Prevent back navigation
    window.history.pushState(null, '', window.location.href);
    window.onpopstate = () => {
      window.history.pushState(null, '', window.location.href);
    };

    return () => {
      window.onpopstate = null;
    };
  }, []);

  const handleGoDashboard = () => {
    if (!user) {
      router.push('/assessment/exam-entry');
      return;
    }

    if (user.user_type === 'student') {
      router.push('/dashboard/student');
    } else {
      router.push('/dashboard');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-blue-50 to-indigo-50 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full">
        {/* Success Card */}
        <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden">
          {/* Header */}
          <div className={`px-8 py-6 ${autoSubmit ? 'bg-amber-50' : 'bg-green-50'}`}>
            <div className="flex items-center justify-center mb-4">
              <div className={`w-20 h-20 rounded-full flex items-center justify-center ${
                autoSubmit ? 'bg-amber-100' : 'bg-green-100'
              }`}>
                {autoSubmit ? (
                  <Clock className="h-10 w-10 text-amber-600" />
                ) : (
                  <CheckCircle2 className="h-10 w-10 text-green-600" />
                )}
              </div>
            </div>
            <h1 className={`text-3xl font-bold text-center ${
              autoSubmit ? 'text-amber-900' : 'text-green-900'
            }`}>
              {autoSubmit ? 'Time Expired - Exam Auto-Submitted' : 'Exam Submitted Successfully!'}
            </h1>
            <p className={`text-center mt-2 ${
              autoSubmit ? 'text-amber-700' : 'text-green-700'
            }`}>
              {autoSubmit
                ? 'Your exam has been automatically submitted as the time limit was reached'
                : 'Your answers have been recorded and submitted'}
            </p>
          </div>

          {/* Content */}
          <div className="p-8 space-y-6">
            {/* Attempt ID */}
            <div className="bg-gray-50 rounded-xl p-4">
              <p className="text-sm text-gray-600 mb-1">Submission Reference</p>
              <code className="text-lg font-mono font-bold text-gray-900">
                {attemptId || 'N/A'}
              </code>
            </div>

            {/* Important Notice */}
            <div className={`border-2 rounded-xl p-4 ${
              autoSubmit ? 'border-amber-200 bg-amber-50' : 'border-blue-200 bg-blue-50'
            }`}>
              <div className="flex items-start gap-3">
                <AlertCircle className={`h-5 w-5 flex-shrink-0 mt-0.5 ${
                  autoSubmit ? 'text-amber-600' : 'text-blue-600'
                }`} />
                <div>
                  <h3 className={`font-bold mb-2 ${
                    autoSubmit ? 'text-amber-900' : 'text-blue-900'
                  }`}>
                    Important Information
                  </h3>
                  <ul className={`text-sm space-y-1.5 ${
                    autoSubmit ? 'text-amber-800' : 'text-blue-800'
                  }`}>
                    <li>✓ Your submission has been recorded with timestamp</li>
                    <li>✓ You cannot access or modify this exam anymore</li>
                    <li>✓ Your teacher will grade your answers</li>
                    <li>✓ Results will be available once marking is complete</li>
                    {autoSubmit && (
                      <li>✓ All answers saved up to the time limit were submitted</li>
                    )}
                  </ul>
                </div>
              </div>
            </div>

            {/* Next Steps */}
            <div>
              <h3 className="font-bold text-gray-900 mb-3">What happens next?</h3>
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-violet-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-sm font-bold text-violet-600">1</span>
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">Teacher Grades Answers</p>
                    <p className="text-sm text-gray-600">
                      Your teacher will review and mark your exam responses
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-violet-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-sm font-bold text-violet-600">2</span>
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">Results Published</p>
                    <p className="text-sm text-gray-600">
                      Once marking is complete, your results will be made available
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-violet-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-sm font-bold text-violet-600">3</span>
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">View Your Performance</p>
                    <p className="text-sm text-gray-600">
                      Check your student dashboard for your exam results and feedback
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-4">
              <button
                onClick={handleGoDashboard}
                className="flex-1 px-6 py-3 bg-violet-600 text-white font-semibold rounded-xl hover:bg-violet-700 flex items-center justify-center gap-2"
              >
                <Home className="h-5 w-5" />
                Go to Dashboard
              </button>
              <button
                onClick={() => router.push('/assessment/exam-entry')}
                className="flex-1 px-6 py-3 bg-gray-100 text-gray-700 font-semibold rounded-xl hover:bg-gray-200 flex items-center justify-center gap-2"
              >
                <FileText className="h-5 w-5" />
                Take Another Exam
              </button>
            </div>
          </div>
        </div>

        {/* Footer Note */}
        <div className="mt-6 text-center">
          <p className="text-sm text-gray-600 bg-white/50 backdrop-blur-sm px-6 py-3 rounded-full inline-block">
            Submitted on {new Date().toLocaleString()}
          </p>
        </div>
      </div>
    </div>
  );
}
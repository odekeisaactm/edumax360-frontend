'use client';

import React from 'react';
import Link from 'next/link';
import { Archive, History, FileText, UserCheck, Columns, Award, ArrowRight, Layers } from 'lucide-react';

export default function ResultArchiveLandingPage() {
  const cards = [
    {
      title: 'Past Results Viewer',
      description: 'View and edit past uploaded results by session, term, and class.',
      href: '/dashboard/staff/result/archive/past',
      icon: History,
      iconBg: 'bg-indigo-100',
      iconColor: 'text-indigo-600',
      badge: 'View & Edit',
      badgeBg: 'bg-indigo-50 text-indigo-600 border-indigo-100',
    },
    {
      title: 'Result Sheet Viewer',
      description: 'Find students by class and term then view or download their full result sheets.',
      href: '/dashboard/staff/result/archive/sheet',
      icon: FileText,
      iconBg: 'bg-emerald-100',
      iconColor: 'text-emerald-600',
      badge: 'View & Print',
      badgeBg: 'bg-emerald-50 text-emerald-600 border-emerald-100',
    },
    {
      title: 'Student Result History',
      description: 'Search any student and view their complete academic result history across all sessions.',
      href: '/dashboard/staff/result/archive/student',
      icon: UserCheck,
      iconBg: 'bg-amber-100',
      iconColor: 'text-amber-600',
      badge: 'Student Lookup',
      badgeBg: 'bg-amber-50 text-amber-600 border-amber-100',
    },
    {
      title: 'Class Broadsheet',
      description: 'Generate and download full class broadsheets for a specific term or entire session.',
      href: '/dashboard/staff/result/archive/broadsheet',
      icon: Columns,
      iconBg: 'bg-blue-100',
      iconColor: 'text-blue-600',
      badge: 'Download',
      badgeBg: 'bg-blue-50 text-blue-600 border-blue-100',
    },
    {
      title: 'Cumulative Results',
      description: 'View and analyze aggregated student performance across multiple terms in a session.',
      href: '/dashboard/staff/result/archive/cumulative',
      icon: Layers,
      iconBg: 'bg-teal-100',
      iconColor: 'text-teal-600',
      badge: 'Analytics',
      badgeBg: 'bg-teal-50 text-teal-600 border-teal-100',
    },
    {
      title: 'Prize & Award List',
      description: 'Generate ranked prize lists by class or grade level for any session and term.',
      href: '/dashboard/staff/result/archive/prizes',
      icon: Award,
      iconBg: 'bg-rose-100',
      iconColor: 'text-rose-600',
      badge: 'Rankings',
      badgeBg: 'bg-rose-50 text-rose-600 border-rose-100',
    },
  ];

  return (
    <div className="space-y-6 pb-10">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
          <div className="w-9 h-9 bg-gradient-to-br from-slate-700 to-slate-900 rounded-xl flex items-center justify-center shadow-md shadow-slate-300">
            <Archive className="h-5 w-5 text-white" />
          </div>
          Result Archive
        </h1>
        <p className="text-sm text-slate-400 mt-1 pl-12">Access and manage historical academic records</p>
      </div>

      {/* Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <Link key={card.href} href={card.href}>
              <div className="group bg-white rounded-2xl border border-slate-100 shadow-sm p-6 flex flex-col gap-4 hover:shadow-md hover:border-slate-200 transition-all duration-200 h-full">

                <div className="flex items-start justify-between">
                  <div className={`w-11 h-11 ${card.iconBg} rounded-xl flex items-center justify-center flex-shrink-0`}>
                    <Icon className={`h-5 w-5 ${card.iconColor}`} />
                  </div>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${card.badgeBg}`}>
                    {card.badge}
                  </span>
                </div>

                <div className="flex-1">
                  <h3 className="font-semibold text-slate-900 mb-1">{card.title}</h3>
                  <p className="text-sm text-slate-400 leading-relaxed">{card.description}</p>
                </div>

                <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 group-hover:text-blue-600 transition-colors">
                  Open
                  <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
                </div>

              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
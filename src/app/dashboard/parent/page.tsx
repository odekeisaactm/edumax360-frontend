'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useWard } from '@/context/WardContext';
import {
  Award, ChevronRight, Loader2, Zap, GraduationCap,
  CreditCard, Wallet, UserCircle, Briefcase, Info, BookOpen,
  Receipt, ArrowRight, Bell, HelpCircle, ArrowUpRight
} from 'lucide-react';
import { announcementsAPI, queriesAPI } from '@/lib/communication.service';
import { Announcement, Query } from '@/lib/types';

// ============================================================================
// HELPERS
// ============================================================================

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(amount || 0);
};

// ============================================================================
// STAT CARD COMPONENT
// ============================================================================

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ElementType;
  gradient: string;
  linkText: string;
  linkHref: string;
  delay?: string;
  valueColor?: string;
}

function StatCard({ title, value, icon: Icon, gradient, linkText, linkHref, delay = '0ms', valueColor = 'text-slate-900' }: StatCardProps) {
  return (
    <div
      className="relative bg-white rounded-2xl overflow-hidden shadow-sm border border-slate-100 flex flex-col justify-between h-full group hover:shadow-md transition-all duration-300 hover:-translate-y-0.5"
      style={{ animationDelay: delay }}
    >
      <div className={`absolute top-0 left-0 right-0 h-1 ${gradient}`} />

      <div className="p-5 pt-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1">{title}</p>
            <p className={`text-3xl font-black leading-none tracking-tight ${valueColor}`}>{value}</p>
          </div>
          <div className={`p-3 rounded-2xl ${gradient} bg-opacity-10`}>
            <Icon className="h-5 w-5 text-white" />
          </div>
        </div>
      </div>

      <div className="px-5 pb-4 mt-2">
        <Link
          href={linkHref}
          className="inline-flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-slate-900 transition-colors group/link"
        >
          {linkText}
          <ArrowRight className="h-3.5 w-3.5 group-hover/link:translate-x-0.5 transition-transform" />
        </Link>
      </div>
    </div>
  );
}

// ============================================================================
// MAIN DASHBOARD
// ============================================================================

export default function ParentDashboard() {
  const { selectedWard, loading: wardLoading, refreshWards } = useWard();
  const [mounted, setMounted] = useState(false);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [queries, setQueries] = useState<Query[]>([]);
  const [commsLoading, setCommsLoading] = useState(false);

  useEffect(() => {
    setMounted(true);
    refreshWards(true);
  }, [refreshWards]);

  useEffect(() => {
    if (selectedWard) {
      setCommsLoading(true);
      Promise.all([
        announcementsAPI.list({ page_size: 3 }),
        queriesAPI.list({ page_size: 3 })
      ]).then(([annRes, qRes]) => {
        setAnnouncements(annRes?.results || annRes || []);
        setQueries(qRes?.results || qRes || []);
      }).catch(console.error).finally(() => setCommsLoading(false));
    }
  }, [selectedWard]);

  if (!mounted || wardLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (!selectedWard) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center bg-white rounded-3xl border border-dashed border-slate-200 p-8 text-center">
        <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
          <GraduationCap className="w-8 h-8 text-slate-300" />
        </div>
        <h3 className="text-xl font-black text-slate-800">No Ward Selected</h3>
        <p className="text-slate-500 max-w-xs mt-2">Please select a child to view their dashboard.</p>
      </div>
    );
  }

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  const wardName = selectedWard.full_name || `${selectedWard.first_name} ${selectedWard.last_name}`;
  const parentName = selectedWard.parent_name || 'Parent';

  // EXACTLY 3 Quick Links
  const quickLinks = [
    {
      id: 1,
      name: 'View Result',
      description: 'Check latest performance and grades.',
      href: '/dashboard/parent/result',
      icon: Award,
      iconColor: 'text-indigo-600',
    },
    {
      id: 2,
      name: 'View Invoices',
      description: 'See all generated termly fee bills.',
      href: '/dashboard/parent/fees',
      icon: Receipt,
      iconColor: 'text-blue-600',
    },
    {
      id: 3,
      name: 'Make Payment',
      description: 'Upload payment proof or fund wallet.',
      href: '/dashboard/parent/fees/upload',
      icon: CreditCard,
      iconColor: 'text-emerald-600',
    }
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-10">

      {/* ── 1. HERO HEADER ── */}
      <div className="relative bg-gradient-to-r from-slate-900 via-blue-950 to-indigo-900 rounded-2xl overflow-hidden shadow-xl">
        <div className="absolute -top-16 -right-16 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-8 -left-8 w-48 h-48 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,.5) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255,255,255,.5) 1px, transparent 1px)`,
            backgroundSize: '32px 32px',
          }}
        />

        <div className="relative z-10 p-6 sm:p-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">

            {/* Avatar */}
            <div className="relative flex-shrink-0">
              <div className="h-24 w-24 rounded-2xl border-2 border-white/20 bg-white/10 shadow-lg overflow-hidden">
                {selectedWard.image_url ? (
                  <img src={selectedWard.image_url} alt="Profile" className="h-full w-full object-cover" />
                ) : (
                  <div className="h-full w-full flex items-center justify-center">
                    <UserCircle className="h-12 w-12 text-white/50" />
                  </div>
                )}
              </div>
              <span className={`absolute -bottom-1.5 -right-1.5 w-5 h-5 rounded-full border-2 border-slate-900 shadow flex items-center justify-center ${selectedWard.status === 'active' ? 'bg-emerald-400' : 'bg-red-400'}`}>
                {selectedWard.status === 'active' && <Zap className="w-2.5 h-2.5 text-slate-900" />}
              </span>
            </div>

            {/* Text */}
            <div className="flex-1 min-w-0">
              {/* Addressed to the parent */}
              <p className="text-blue-300 text-sm font-semibold mb-1 tracking-wide">{greeting}, {parentName}</p>

              <div className="mt-2 mb-1">
                <p className="text-white/60 text-[10px] uppercase tracking-widest font-bold">Viewing portal for:</p>
                <h1 className="text-2xl sm:text-3xl font-black text-white leading-tight truncate capitalize">{wardName}</h1>
              </div>

              <div className="flex flex-wrap items-center gap-2 mt-2.5">
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-white/70 bg-white/10 px-3 py-1 rounded-full">
                  <Briefcase className="h-3 w-3 text-white/50" />
                  {selectedWard.current_class_name} {selectedWard.current_class_section_name ? `· ${selectedWard.current_class_section_name}` : ''}
                </span>
                <span className="inline-flex items-center gap-1.5 text-xs font-mono text-white/50 bg-white/5 border border-white/10 px-3 py-1 rounded-full uppercase tracking-wider">
                  {selectedWard.registration_number}
                </span>
                {selectedWard.is_special_need && (
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-300 bg-amber-400/20 border border-amber-400/30 px-3 py-1 rounded-full">
                    <Info className="h-3 w-3" />
                    Special Support
                  </span>
                )}
              </div>
            </div>

            {/* Date Widget */}
            <div className="flex flex-col items-start sm:items-end gap-1 flex-shrink-0 mt-2 sm:mt-0">
              <span className="text-white/40 text-[11px] font-semibold uppercase tracking-widest">
                {new Date().toLocaleDateString('en-US', { weekday: 'short' })}
              </span>
              <span className="text-white/80 text-base font-black leading-none">
                {new Date().toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
              </span>
            </div>

          </div>
        </div>
      </div>

      {/* ── 2. WALLET STAT CARDS ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard
          title="Fee Wallet Balance"
          value={formatCurrency(Number(selectedWard.fee_balance))}
          valueColor="text-emerald-600"
          icon={Wallet}
          gradient="bg-gradient-to-br from-emerald-500 to-emerald-700"
          linkText="Fund fee wallet"
          linkHref="/dashboard/parent/wallet/fund"
          delay="0ms"
        />
        <StatCard
          title="TuckShop Wallet Balance"
          value={formatCurrency(Number(selectedWard.canteen_balance))}
          valueColor="text-amber-600"
          icon={Wallet}
          gradient="bg-gradient-to-br from-amber-400 to-orange-500"
          linkText="Fund canteen wallet"
          linkHref="/dashboard/parent/wallet/fund"
          delay="60ms"
        />
        <StatCard
          title="Academic Status"
          value={selectedWard.status === 'active' ? 'Active' : 'Inactive'}
          valueColor={selectedWard.status === 'active' ? 'text-blue-600' : 'text-slate-600'}
          icon={BookOpen}
          gradient="bg-gradient-to-br from-blue-500 to-indigo-600"
          linkText="View ward profile"
          linkHref="/dashboard/parent/ward-profile"
          delay="120ms"
        />
      </div>

      {/* ── 3. QUICK ACTIONS GRID ── */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
        <div className="flex items-center gap-2 mb-5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-sm">
            <Zap className="h-4 w-4 text-white" />
          </div>
          <h2 className="text-base font-bold text-slate-800">Quick Actions</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {quickLinks.map((link) => {
            const IconComponent = link.icon;
            return (
              <Link
                key={link.id}
                href={link.href}
                className="group relative p-5 rounded-2xl border border-slate-100 hover:border-indigo-200 hover:bg-indigo-50/30 hover:shadow-md transition-all duration-300 overflow-hidden flex flex-col"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-600/0 to-indigo-600/0 group-hover:from-indigo-600/5 group-hover:to-blue-600/5 transition-all duration-500 pointer-events-none" />

                <div className="flex items-start justify-between mb-4">
                  <div className={`p-3 rounded-xl bg-slate-50 group-hover:bg-white border border-slate-100 transition-colors shadow-sm`}>
                    <IconComponent className={`h-6 w-6 ${link.iconColor} group-hover:scale-110 transition-transform duration-300`} />
                  </div>
                  <div className="w-8 h-8 rounded-full bg-white border border-slate-100 flex items-center justify-center opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300 shadow-sm">
                    <ArrowRight className="h-4 w-4 text-indigo-600" />
                  </div>
                </div>

                <div className="mt-auto">
                  <h3 className="text-[15px] font-black text-slate-800 group-hover:text-indigo-700 leading-tight mb-1">{link.name}</h3>
                  <p className="text-xs font-medium text-slate-500 leading-snug">{link.description}</p>
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      {/* ── 4. COMMUNICATION WIDGETS ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        {/* Announcements */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden flex flex-col">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-sm">
                <Bell className="h-4 w-4 text-white" />
              </div>
              <h2 className="text-base font-bold text-slate-800">Recent Announcements</h2>
            </div>
            <Link href="/dashboard/parent/communication/announcements" className="text-[11px] font-bold text-slate-400 hover:text-indigo-600 uppercase tracking-widest transition-colors">
              View All
            </Link>
          </div>
          <div className="flex-1 p-5">
            {commsLoading ? (
              <div className="flex justify-center p-8"><Loader2 className="h-5 w-5 animate-spin text-slate-300" /></div>
            ) : announcements.length === 0 ? (
              <div className="text-center p-8 text-sm text-slate-400 font-medium">No recent announcements.</div>
            ) : (
              <div className="space-y-4">
                {announcements.map((ann, i) => (
                  <div key={i} className="flex gap-4 group">
                    <div className="w-1.5 h-1.5 rounded-full bg-orange-400 mt-2 shrink-0 group-hover:scale-150 transition-transform"></div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-800 mb-1 leading-tight group-hover:text-indigo-600 transition-colors cursor-pointer">{ann.title}</h4>
                      <p className="text-xs text-slate-500 line-clamp-2">{ann.content}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Queries */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden flex flex-col">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-sm">
                <HelpCircle className="h-4 w-4 text-white" />
              </div>
              <h2 className="text-base font-bold text-slate-800">My Helpdesk Tickets</h2>
            </div>
            <Link href="/dashboard/parent/communication/queries" className="text-[11px] font-bold text-slate-400 hover:text-indigo-600 uppercase tracking-widest transition-colors flex items-center gap-1">
              Inbox <ArrowUpRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="flex-1 p-0">
            {commsLoading ? (
              <div className="flex justify-center p-8"><Loader2 className="h-5 w-5 animate-spin text-slate-300" /></div>
            ) : queries.length === 0 ? (
              <div className="text-center p-8 text-sm text-slate-400 font-medium">You have no active queries.</div>
            ) : (
              <div className="divide-y divide-slate-100">
                {queries.map((q, i) => (
                  <Link key={i} href={`/dashboard/parent/communication/queries/${q.id}`} className="flex items-center justify-between p-4 hover:bg-slate-50 transition-colors">
                    <div>
                      <h4 className="text-sm font-bold text-slate-800 leading-tight">{q.title}</h4>
                      <p className="text-xs text-slate-500 mt-0.5">{q.query_type}</p>
                    </div>
                    <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-600">
                      {q.status}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

    </div>
  );
}
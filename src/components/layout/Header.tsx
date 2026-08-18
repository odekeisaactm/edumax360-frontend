'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { SOFTWARE_NAME } from '@/lib/constants';
import { inAppNotificationsAPI } from '@/lib/api';
import {
  Bell, User, LogOut, Menu, ChevronDown, GraduationCap, LockKeyhole, X
} from 'lucide-react';

interface HeaderProps {
  title?: string;
  onMenuClick?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ title, onMenuClick }) => {
  const router = useRouter();
  const pathname = usePathname();
  const { user, logout, getUserFullName, schoolInfo } = useAuth();

  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [marquees, setMarquees] = useState<any[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  // ─── Data Polling & LocalStorage Resolution ──────────────────────────────
  useEffect(() => {
    if (!user) return;

    const fetchNotifications = async () => {
      if (document.visibilityState !== 'visible') return;

      try {
        const res = await inAppNotificationsAPI.getRecent();
        setNotifications(res.notifications || []);
        setUnreadCount(res.unread_count || 0);

        if ((res as any).active_marquees) {
          const permanentDismissals = JSON.parse(localStorage.getItem('dismissed_marquees_permanent') || '[]');
          const sessionDismissals = JSON.parse(sessionStorage.getItem('dismissed_marquees_session') || '[]');

          const visibleMarquees = (res as any).active_marquees.filter((m: any) => {
            if (m.dismissal_behavior === 'PERMANENT' && permanentDismissals.includes(m.id)) return false;
            if (m.dismissal_behavior === 'SESSION' && sessionDismissals.includes(m.id)) return false;

            const isDashboard = pathname.endsWith('/dashboard') || pathname.split('/').length === 3;
            if (m.display_location === 'DASHBOARD_ONLY' && !isDashboard) return false;

            return true;
          });
          setMarquees(visibleMarquees);
        }
      } catch (error) {
        console.error("Failed to fetch notifications", error);
      }
    };

    fetchNotifications();
    const intervalId = setInterval(fetchNotifications, 60000);
    return () => clearInterval(intervalId);
  }, [user, pathname]);

  // ─── Batch Dismissal Logic ──────────────────────────────────────────────────
  const handleDismissMarquees = () => {
    const perm = JSON.parse(localStorage.getItem('dismissed_marquees_permanent') || '[]');
    const sess = JSON.parse(sessionStorage.getItem('dismissed_marquees_session') || '[]');

    marquees.forEach(m => {
      if (m.dismissal_behavior === 'PERMANENT') perm.push(m.id);
      if (m.dismissal_behavior === 'SESSION') sess.push(m.id);
    });

    localStorage.setItem('dismissed_marquees_permanent', JSON.stringify([...new Set(perm)]));
    sessionStorage.setItem('dismissed_marquees_session', JSON.stringify([...new Set(sess)]));

    // Hide immediately in UI
    setMarquees([]);
  };

  const handleNotificationClick = async (notif: any) => {
    setShowNotifications(false);
    if (!notif.is_read) {
      try {
        await inAppNotificationsAPI.markAsRead(notif.id);
        setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, is_read: true } : n));
        setUnreadCount(prev => Math.max(0, prev - 1));
      } catch (error) { console.error(error); }
    }
    if (notif.action_url) router.push(notif.action_url);
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('#notifications-menu')) setShowNotifications(false);
      if (!target.closest('#profile-menu')) setShowProfileMenu(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const basePath = user?.user_type === 'student' ? '/dashboard/student' : user?.user_type === 'parent' ? '/dashboard/parent' : '/dashboard/staff';
  const avatarSrc = (user as any)?.profile_image || (user as any)?.avatar || (user as any)?.profile?.image || (user as any)?.staff_profile?.image || (user as any)?.image || null;
  const schoolLogo = schoolInfo?.logo || null;
  const schoolName = schoolInfo?.name ? schoolInfo.name.split(' ').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ') : SOFTWARE_NAME;
  const schoolMotto = schoolInfo?.motto || "Empowering the future";

  // Combine multiple messages with a nice bullet separator
  const combinedMessageText = marquees.map(m => m.message).join(' ✦ ');

  return (
    <header className="fixed top-0 left-0 right-0 md:left-64 z-30 flex flex-col bg-white border-b border-slate-100 shadow-sm print:hidden">

      {/* ── 1. Main Header Navigation ── */}
      <div className="px-4 sm:px-6 bg-white z-20 relative">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-3">
            <button onClick={onMenuClick} className="md:hidden p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
              <Menu className="h-5 w-5" />
            </button>
            <div className="hidden md:flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg overflow-hidden flex-shrink-0 flex items-center justify-center bg-indigo-600">
                {schoolLogo ? <img src={schoolLogo} alt={schoolName} className="w-full h-full object-cover" /> : <GraduationCap className="h-4 w-4 text-white" />}
              </div>
              <div>
                <p className="text-sm font-bold text-slate-800 leading-tight">{schoolName}</p>
                <p className="text-[10px] text-slate-400 leading-none truncate max-w-[200px]">{schoolMotto}</p>
              </div>
            </div>
            <h1 className="md:hidden text-base font-bold text-slate-800 truncate">{title || schoolName}</h1>
          </div>

          <div className="flex items-center gap-2">
            {/* Notifications Dropdown */}
            <div className="relative" id="notifications-menu">
              <button onClick={() => { setShowNotifications(p => !p); setShowProfileMenu(false); }} className="relative p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
                <Bell className="h-5 w-5" />
                {unreadCount > 0 && <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-red-500 ring-2 ring-white" />}
              </button>

              {showNotifications && (
                <div className="absolute right-0 mt-2 w-80 bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden z-50">
                  <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                    <h3 className="text-sm font-bold text-slate-800">Notifications</h3>
                    {unreadCount > 0 && <span className="text-xs font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">{unreadCount} new</span>}
                  </div>
                  <div className="max-h-64 overflow-y-auto divide-y divide-slate-50">
                    {notifications.length === 0 ? (
                      <div className="px-4 py-6 text-sm text-slate-400 text-center">No notifications</div>
                    ) : (
                      notifications.map(n => (
                        <button key={n.id} onClick={() => handleNotificationClick(n)} className={`w-full text-left px-4 py-3 hover:bg-slate-50 transition-colors ${!n.is_read ? 'bg-indigo-50/40' : ''}`}>
                          <div className="flex items-start gap-2">
                            {!n.is_read && <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 flex-shrink-0 mt-1.5" />}
                            <div className={!n.is_read ? '' : 'pl-3.5'}>
                              <p className="text-sm text-slate-800 font-semibold">{n.title}</p>
                              <p className="text-xs text-slate-600 mt-0.5 line-clamp-2">{n.message}</p>
                            </div>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Profile Dropdown */}
            <div className="relative" id="profile-menu">
              <button onClick={() => { setShowProfileMenu(p => !p); setShowNotifications(false); }} className="flex items-center gap-2 px-2 py-1.5 rounded-xl hover:bg-slate-100 transition-colors">
                <div className="w-8 h-8 rounded-xl overflow-hidden flex-shrink-0 bg-indigo-100 flex items-center justify-center">
                  {avatarSrc ? <img src={avatarSrc} alt={getUserFullName()} className="w-full h-full object-cover" /> : schoolLogo ? <img src={schoolLogo} alt={schoolName} className="w-full h-full object-cover" /> : <User className="h-4 w-4 text-indigo-500" />}
                </div>
                <span className="hidden md:block text-sm font-semibold text-slate-700 max-w-[120px] truncate">{getUserFullName()}</span>
                <ChevronDown className="hidden md:block h-3.5 w-3.5 text-slate-400" />
              </button>

              {showProfileMenu && (
                <div className="absolute right-0 mt-2 w-52 bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden z-50">
                  <div className="px-4 py-3 border-b border-slate-100 bg-slate-50">
                    <p className="text-sm font-bold text-slate-800 truncate">{getUserFullName()}</p>
                    <p className="text-xs text-slate-400 truncate">{user?.email}</p>
                    <span className="inline-block mt-1.5 text-[10px] font-bold uppercase tracking-wide text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">{user?.user_type}</span>
                  </div>
                  <div className="py-1.5">
                    <Link href={`${basePath}/profile`} onClick={() => setShowProfileMenu(false)} className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-600 hover:bg-slate-50 hover:text-slate-800 transition-colors"><User className="h-4 w-4 text-slate-400" /> My Profile</Link>
                    <Link href={`${basePath}/change-password`} onClick={() => setShowProfileMenu(false)} className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-600 hover:bg-slate-50 hover:text-slate-800 transition-colors"><LockKeyhole className="h-4 w-4 text-slate-400" /> Change Password</Link>
                    <div className="my-1 mx-3 border-t border-slate-100" />
                    <button onClick={() => { setShowProfileMenu(false); sessionStorage.removeItem('dismissed_marquees_session'); logout(); }} className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"><LogOut className="h-4 w-4" /> Sign out</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── 2. Marquee Layer (Combined into One Bar) ── */}
      {marquees.length > 0 && (
        <div className="flex flex-col w-full border-t border-indigo-950/20 bg-gradient-to-r from-indigo-900 via-indigo-800 to-indigo-900 relative z-10">
          <div className="w-full text-white text-xs font-semibold py-2 px-4 flex items-center relative overflow-hidden group">

            {/* Left Badge */}
            <div className="flex-shrink-0 flex items-center gap-2 z-10 bg-gradient-to-r from-indigo-900 via-indigo-900 to-transparent pr-4 relative">
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
              </span>
              <span className="uppercase tracking-wider text-[10px] text-indigo-200">
                {marquees.length > 1 ? 'Announcements' : 'Announcement'}
              </span>
            </div>

            {/* Scrolling Text */}
            <div className="flex-1 overflow-hidden relative">
              <div className="animate-marquee group-hover:[animation-play-state:paused]">
                <span className="mx-4">{combinedMessageText}</span>
                <span className="mx-4 text-indigo-400/50">✦</span>
                <span className="mx-4">{combinedMessageText}</span>
              </div>
            </div>

            {/* Dismiss Button (Only show if at least one marquee is dismissible) */}
            {marquees.some(m => m.dismissal_behavior !== 'CANNOT_DISMISS') && (
              <div className="flex-shrink-0 pl-3 bg-gradient-to-l from-indigo-900 via-indigo-900 to-transparent z-10 relative">
                <button
                  onClick={handleDismissMarquees}
                  className="p-1 rounded-md text-indigo-300 hover:text-white hover:bg-indigo-700 transition-colors bg-indigo-950/50 shadow-sm"
                  title="Dismiss Announcements"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>
      )}

    </header>
  );
};
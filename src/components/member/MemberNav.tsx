"use client";

import React from 'react';
import { useRouter, usePathname } from 'next/navigation';

// Simple icon components
const HomeIcon = ({ ...props }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" {...props}>
    <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" />
  </svg>
);

const BookIcon = ({ ...props }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" {...props}>
    <path d="M17 12h-5v5h5v-5zM16 1v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2h-1V1h-2zm3 18H5V8h14v11z" />
  </svg>
);

const ListIcon = ({ ...props }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" {...props}>
    <path d="M3 13h2v-2H3v2zm0 4h2v-2H3v2zm0-8h2V7H3v2zm4 4h14v-2H7v2zm0 4h14v-2H7v2zM7 7v2h14V7H7z" />
  </svg>
);

const UserIcon = ({ ...props }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" {...props}>
    <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
  </svg>
);

interface NavItem {
  label: string;
  icon: React.ComponentType<any>;
  path: string;
}

const navItems: NavItem[] = [
  { label: 'Dashboard', icon: HomeIcon, path: '/member/dashboard' },
  { label: 'Book', icon: BookIcon, path: '/member/book' },
  { label: 'Reservations', icon: ListIcon, path: '/member/reservations' },
  { label: 'Profile', icon: UserIcon, path: '/member/profile' },
];

export default function MemberNav() {
  const router = useRouter();
  const pathname = usePathname();

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-[#ECEAE5] shadow-[0_-2px_10px_rgba(0,0,0,0.05)] z-[1000]">
      <div className="flex justify-around items-center h-[70px] max-w-7xl mx-auto">
        {navItems.map((item) => {
          const isActive = pathname === item.path;
          const Icon = item.icon;

          return (
            <div
              key={item.path}
              className={`flex flex-col items-center gap-1 cursor-pointer flex-1 py-2 transition-colors duration-200 ${
                isActive ? 'text-[#A59480]' : 'text-[#5A5A5A]'
              } hover:text-[#A59480]`}
              onClick={() => router.push(item.path)}
            >
              <Icon />
              <span className={`text-xs ${isActive ? 'font-medium' : 'font-normal'}`}>
                {item.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

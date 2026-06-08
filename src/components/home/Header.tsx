'use client';

import { BookOpen, Settings } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { UserStatus } from '@/components/AuthModal';

interface HeaderProps {
  currentUser: {
    id: string;
    phone: string;
    nickname?: string;
    role: string;
    activatedCategories?: string[];
  } | null;
  onNavigate: (tab: string) => void;
}

export function Header({ currentUser, onNavigate }: HeaderProps) {
  return (
    <header className="bg-white sticky top-0 z-50 shadow-sm">
      <div className="max-w-[970px] mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          {/* 产品标识 - 可点击返回首页 */}
          <button 
            onClick={() => {
              // 切换到首页标签
              onNavigate('practice');
            }}
            className="flex items-center gap-2.5 hover:opacity-80 transition-opacity cursor-pointer"
          >
            <div className="w-8 h-8 bg-gradient-to-br from-orange-400 to-amber-500 rounded-xl flex items-center justify-center shadow-sm">
              <BookOpen className="w-4 h-4 text-white" />
            </div>
            <span className="font-semibold text-gray-900">押题100</span>
          </button>
          
          {/* 用户信息 */}
          <div className="flex items-center gap-2">
            {currentUser?.role === 'admin' && (
              <Link href="/admin">
                <Button variant="outline" size="sm" className="rounded-xl gap-1 border-orange-200 text-orange-600 hover:bg-orange-50">
                  <Settings className="w-4 h-4" />
                  <span className="hidden sm:inline">管理</span>
                </Button>
              </Link>
            )}
            <UserStatus />
          </div>
        </div>
      </div>
    </header>
  );
}

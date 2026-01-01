import React from 'react';
import { Crown, Bell, User, Zap, Gift, FileText, Key } from 'lucide-react';

interface HeaderProps {
  onApiKeyClick: () => void;
}

const LogoIcon = () => (
  <svg viewBox="0 0 100 100" className="w-11 h-11" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* Outer Ring - Dark Blue */}
    <circle cx="50" cy="50" r="46" stroke="#0f172a" strokeWidth="4" />
    
    {/* Camera Body - Dark Blue */}
    <path d="M22 35 H78 A 4 4 0 0 1 82 39 V 76 A 4 4 0 0 1 78 80 H22 A 4 4 0 0 1 18 76 V 39 A 4 4 0 0 1 22 35 Z" fill="#0f172a" />
    <path d="M32 35 L36 26 H64 L68 35" fill="#0f172a" />
    <circle cx="26" cy="42" r="2.5" fill="white" />
    
    {/* Lens Ring - Orange */}
    <circle cx="50" cy="58" r="18" stroke="#f97316" strokeWidth="6" />
    <path d="M50 40 V76" stroke="none" /> 

    {/* Center Pixels - Blue & Orange mix */}
    <rect x="42" y="50" width="8" height="8" fill="#3b82f6" />
    <rect x="50" y="50" width="8" height="8" fill="#f97316" />
    <rect x="42" y="58" width="8" height="8" fill="#0f172a" />
    <rect x="50" y="58" width="8" height="8" fill="#3b82f6" />

    {/* Speed Lines - Orange */}
    <rect x="85" y="32" width="12" height="3" rx="1.5" fill="#f97316" />
    <rect x="85" y="40" width="16" height="3" rx="1.5" fill="#f97316" />
    <rect x="88" y="48" width="18" height="3" rx="1.5" fill="#f97316" />
    <rect x="85" y="56" width="14" height="3" rx="1.5" fill="#f97316" />
    <rect x="82" y="64" width="10" height="3" rx="1.5" fill="#f97316" />

    {/* Bottom underline accent */}
    <path d="M50 90 H85 L95 80" stroke="#0f172a" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const Header: React.FC<HeaderProps> = ({ onApiKeyClick }) => {
  return (
    <header className="w-full h-18 flex items-center justify-between px-6 py-4 fixed top-0 z-50 bg-white/70 backdrop-blur-md border-b border-white/50 transition-all duration-300">
      <div className="flex items-center space-x-3">
         <div className="flex-shrink-0 hover:scale-105 transition-transform duration-300 cursor-pointer">
            <LogoIcon />
         </div>
         <span className="font-bold text-xl tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-slate-800 to-slate-600 hidden sm:block">
            Creation Studio
         </span>
      </div>
      
      <div className="flex items-center space-x-3">
        <button className="hidden md:flex items-center space-x-1.5 px-4 py-1.5 bg-white border border-gray-200/60 rounded-full text-xs font-medium text-gray-600 hover:bg-gray-50 hover:border-gray-300 transition-all shadow-sm">
            <div className="w-3.5 h-3.5 border border-gray-400 rounded-[3px] flex items-center justify-center">
                <div className="w-1.5 h-1.5 bg-gray-400 rounded-full"></div>
            </div>
             <span>训练 LoRA</span>
        </button>

        <button className="hidden md:flex items-center space-x-1.5 px-4 py-1.5 bg-orange-50/50 text-orange-600 rounded-full text-xs font-medium border border-orange-100 hover:bg-orange-100 transition-colors">
            <Gift size={14} className="stroke-[2.5px]" />
            <span>邀请有礼</span>
        </button>
        
         <button className="w-9 h-9 flex items-center justify-center rounded-full bg-gray-100/50 text-gray-600 hover:bg-gray-200/70 hover:text-gray-900 transition-all">
            <FileText size={18} className="stroke-[2px]" />
        </button>

        <div className="hidden sm:flex items-center space-x-3 bg-white/80 border border-gray-100 rounded-full px-4 py-1.5 shadow-sm">
            <div className="flex items-center text-blue-600 text-xs font-bold border-r border-gray-200 pr-3">
                <Zap size={14} className="fill-current mr-1.5" />
                <span>20 积分</span>
            </div>
            <div className="flex items-center text-amber-600 text-xs font-bold">
                <Crown size={14} className="fill-current mr-1.5" />
                <span>会员 53折</span>
            </div>
        </div>

        <button 
            onClick={onApiKeyClick}
            className="p-2 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-full transition-colors"
            title="设置 API Key">
            <Key size={20} className="stroke-[2px]" />
        </button>

        <button className="relative p-2 text-gray-500 hover:text-gray-800 transition-colors">
            <Bell size={20} className="stroke-[2px]" />
            <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white"></span>
        </button>

        <button className="w-9 h-9 rounded-full bg-gradient-to-tr from-yellow-100 to-yellow-200 p-[2px] shadow-sm hover:shadow-md transition-all">
           <div className="w-full h-full bg-yellow-300 rounded-full flex items-center justify-center text-yellow-800 font-bold text-sm">
              U
           </div>
        </button>
      </div>
    </header>
  );
};
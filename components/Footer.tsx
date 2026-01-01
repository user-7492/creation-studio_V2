import React from 'react';
import { ChevronUp, Library } from 'lucide-react';

export const Footer: React.FC = () => {
  return (
    <div className="fixed bottom-6 right-6 z-40">
        <button className="group bg-white/90 backdrop-blur-sm px-5 py-3 rounded-full shadow-lg hover:shadow-xl border border-white/50 flex items-center space-x-3 text-gray-600 hover:text-blue-600 transition-all duration-300 transform hover:-translate-y-1">
            <Library size={18} className="text-gray-400 group-hover:text-blue-500 transition-colors" />
            <span className="text-sm font-semibold tracking-wide">灵感库</span>
            <ChevronUp size={16} className="text-gray-400 group-hover:text-blue-500" />
        </button>
    </div>
  );
};
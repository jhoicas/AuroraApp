import React from 'react';

interface LogoAuroraProps {
  className?: string;
}

export const LogoAurora: React.FC<LogoAuroraProps> = ({ className = "w-10 h-10 text-teal-600" }) => {
  return (
    <div className="flex items-center gap-3">
      <svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg" className={className}>
        <path d="M12 2L2 20H6.5L12 10L17.5 20H22L12 2Z" />
        <circle cx="12" cy="16" r="3.5" opacity="0.8"/>
      </svg>
      <span className="text-xl font-bold tracking-tight text-gray-900">
        Aurora<span className="text-teal-600">App</span>
      </span>
    </div>
  );
};

import React from 'react';

interface Props {
  /** Icon size in px */
  size?: number;
  className?: string;
}

/**
 * StaffCove logo for the app shell: the existing logo mark (cropped from img/logo.png,
 * unchanged, white background) on a rounded white tile — like img/mobile-logo — with the
 * name set as text, so it reads correctly on light and dark surfaces.
 */
export const BrandMark: React.FC<Props> = ({ size = 36, className = '' }) => (
  <div className={`flex items-center gap-2.5 min-w-0 ${className}`}>
    <span
      className="flex-shrink-0 rounded-xl overflow-hidden ring-1 ring-slate-200 dark:ring-0 shadow-sm"
      style={{ width: size, height: size, backgroundColor: '#ffffff' }}
    >
      <img src="./img/logo-mark.png" width={size} height={size} className="object-contain w-full h-full p-0.5" alt="" />
    </span>
    <span className="font-bold tracking-tight text-xl leading-none truncate">
      <span className="text-primary">Staff</span>
      <span className="bg-gradient-to-r from-amber-500 to-emerald-500 bg-clip-text text-transparent">Cove</span>
    </span>
  </div>
);

'use client';
import React from 'react';

interface ProductFeatureProps {
  icon: React.ReactNode;
  title: string;
  description: string;
}

export function ProductFeature({ icon, title, description }: ProductFeatureProps) {
  return (
    <div className="flex items-start gap-4">
      <div className="w-10 h-10 rounded-xl bg-[#0B162B] border border-blue-900/40 flex items-center justify-center text-blue-400 shrink-0 shadow-inner">
        {icon}
      </div>
      <div className="space-y-0.5">
        <h3 className="text-sm font-semibold text-white tracking-tight">{title}</h3>
        <p className="text-xs text-slate-400 leading-relaxed max-w-sm">{description}</p>
      </div>
    </div>
  );
}

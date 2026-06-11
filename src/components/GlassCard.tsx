import React from 'react';
import { cn } from '@/lib/utils';

interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  hoverGlow?: boolean;
  glowColor?: 'cyan' | 'violet' | 'pink';
}

export const GlassCard: React.FC<GlassCardProps> = ({
  children,
  className,
  hoverGlow = false,
  glowColor = 'cyan',
  ...props
}) => {
  const glowClasses = {
    cyan: 'hover:border-cyan-500/30 hover:shadow-[0_0_25px_rgba(6,182,212,0.15)]',
    violet: 'hover:border-violet-500/30 hover:shadow-[0_0_25px_rgba(139,92,246,0.15)]',
    pink: 'hover:border-pink-500/30 hover:shadow-[0_0_25px_rgba(236,72,153,0.15)]',
  };

  return (
    <div
      className={cn(
        'glassmorphism rounded-2xl p-6 transition-all duration-300 relative overflow-hidden',
        hoverGlow && glowClasses[glowColor],
        className
      )}
      {...props}
    >
      {/* Subtle background gradient reflection */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] to-transparent pointer-events-none" />
      {children}
    </div>
  );
};
export default GlassCard;

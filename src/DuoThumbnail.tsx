import React from 'react';
import { PresetGradient } from './themes';

export type DuoLayoutType = 'side' | 'stack' | 'hero' | 'vertical';

interface DuoThumbnailProps {
  type: DuoLayoutType;
  gradient: PresetGradient;
  bgType: string;
  solidColor: string;
}

export const DuoThumbnail: React.FC<DuoThumbnailProps> = ({
  type,
  gradient,
  bgType,
  solidColor,
}) => {
  const getBgStyle = (): React.CSSProperties => {
    if (bgType === 'solid') {
      return { backgroundColor: solidColor };
    }
    if (bgType === 'transparent') {
      return {
        backgroundColor: '#1e293b',
        backgroundImage: 'radial-gradient(#475569 1px, transparent 1px)',
        backgroundSize: '6px 6px',
      };
    }
    return {};
  };

  const getBgClass = (): string => {
    if (bgType === 'gradient') {
      return gradient.className;
    }
    return '';
  };

  return (
    <div 
      className={`w-full aspect-[4/3] rounded-lg overflow-hidden flex items-center justify-center relative p-1 border border-white/10 select-none shadow-sm ${getBgClass()}`}
      style={getBgStyle()}
    >
      {type === 'side' && (
        <div className="flex items-center justify-center gap-1 w-full h-full">
          <div className="w-[44%] h-[58%] rounded-[2px] bg-slate-900/90 border border-white/40 shadow-sm flex items-center justify-center">
            <div className="w-[70%] h-[50%] bg-indigo-400/40 rounded-[1px]" />
          </div>
          <div className="w-[44%] h-[58%] rounded-[2px] bg-slate-900/90 border border-white/40 shadow-sm flex items-center justify-center">
            <div className="w-[70%] h-[50%] bg-indigo-400/40 rounded-[1px]" />
          </div>
        </div>
      )}

      {type === 'stack' && (
        <div className="relative w-full h-full flex items-center justify-center">
          <div className="absolute w-[52%] h-[52%] rounded-[2px] bg-slate-900/80 border border-white/30 -translate-x-1.5 -translate-y-1 shadow-sm flex items-center justify-center">
            <div className="w-[65%] h-[45%] bg-indigo-400/30 rounded-[1px]" />
          </div>
          <div className="absolute w-[46%] h-[48%] rounded-[2px] bg-slate-900 border border-white/50 translate-x-1.5 translate-y-1 rotate-3 shadow-md z-10 flex items-center justify-center">
            <div className="w-[65%] h-[45%] bg-indigo-400/50 rounded-[1px]" />
          </div>
        </div>
      )}

      {type === 'hero' && (
        <div className="flex items-center justify-center gap-1 w-full h-full">
          <div className="w-[56%] h-[64%] rounded-[2px] bg-slate-900/90 border border-white/40 shadow-sm flex items-center justify-center">
            <div className="w-[70%] h-[50%] bg-indigo-400/40 rounded-[1px]" />
          </div>
          <div className="w-[30%] h-[42%] rounded-[2px] bg-slate-900/90 border border-white/30 shadow-sm flex items-center justify-center">
            <div className="w-[60%] h-[40%] bg-indigo-400/30 rounded-[1px]" />
          </div>
        </div>
      )}

      {type === 'vertical' && (
        <div className="flex flex-col items-center justify-center gap-1 w-full h-full">
          <div className="w-[72%] h-[32%] rounded-[2px] bg-slate-900/90 border border-white/40 shadow-sm flex items-center justify-center">
            <div className="w-[60%] h-[40%] bg-indigo-400/40 rounded-[1px]" />
          </div>
          <div className="w-[72%] h-[32%] rounded-[2px] bg-slate-900/90 border border-white/40 shadow-sm flex items-center justify-center">
            <div className="w-[60%] h-[40%] bg-indigo-400/40 rounded-[1px]" />
          </div>
        </div>
      )}
    </div>
  );
};

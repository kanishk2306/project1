import React from 'react';
import { ArtStyle } from '../types';

interface StyleCardProps {
  style: ArtStyle;
  selected: boolean;
  onSelect: (style: ArtStyle) => void;
  description: string;
  imageSrc: string;
}

export const StyleCard: React.FC<StyleCardProps> = ({ style, selected, onSelect, description, imageSrc }) => {
  return (
    <button
      onClick={() => onSelect(style)}
      className={`group relative flex flex-col items-start p-4 rounded-2xl transition-all duration-300 text-left h-full w-full overflow-hidden border
        ${selected 
          ? 'ring-2 ring-brand-500 ring-offset-2 ring-offset-slate-900 bg-slate-800 shadow-xl scale-[1.02] z-10 border-brand-500' 
          : 'border-slate-700 bg-slate-800/60 backdrop-blur-sm hover:bg-slate-800 hover:shadow-lg hover:border-brand-400 hover:-translate-y-1'
        }
      `}
    >
      {selected && (
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-brand-500 to-accent-cyan"></div>
      )}
      
      <div className="w-full aspect-video rounded-xl bg-slate-700 mb-4 overflow-hidden relative shadow-sm">
        <img 
            src={imageSrc} 
            alt={style} 
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110 opacity-90 group-hover:opacity-100" 
        />
        {selected && (
            <div className="absolute inset-0 bg-brand-900/40 backdrop-blur-[2px] flex items-center justify-center animate-fade-in">
                <div className="bg-white text-brand-600 rounded-full p-2 shadow-lg">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                </div>
            </div>
        )}
      </div>
      <h3 className={`font-bold text-lg mb-1 transition-colors ${selected ? 'text-brand-400' : 'text-slate-100 group-hover:text-brand-400'}`}>
        {style}
      </h3>
      <p className="text-sm text-slate-400 leading-relaxed group-hover:text-slate-300">
        {description}
      </p>
    </button>
  );
};
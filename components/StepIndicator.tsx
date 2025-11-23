import React from 'react';
import { AppStep } from '../types';

interface StepIndicatorProps {
  currentStep: AppStep;
}

// Adjusted steps to exclude Auth and Dashboard from the progress bar for cleaner UI
// or we can include them. Based on user request "don't show steps in top", 
// this component might be hidden in App.tsx, but we update it just in case logic is needed.
// The user previously asked to remove steps, so this component might not be rendered, 
// but we keep the logic consistent.

const steps = [
  { step: AppStep.PROMPT, label: 'Prompt' },
  { step: AppStep.STYLE, label: 'Style' },
  { step: AppStep.GENERATING, label: 'Create' },
  { step: AppStep.RESULT, label: 'Result' },
];

export const StepIndicator: React.FC<StepIndicatorProps> = ({ currentStep }) => {
  if (currentStep === AppStep.FEEDBACK || currentStep === AppStep.AUTH || currentStep === AppStep.DASHBOARD) return null;

  return (
    <div className="w-full max-w-4xl mx-auto mb-8 px-4">
      <div className="flex items-center justify-between relative">
        {/* Background Line */}
        <div className="absolute left-0 top-4 transform -translate-y-1/2 w-full h-1 bg-gray-200 -z-10 rounded-full" />
        
        {/* Active Progress Line */}
        <div 
            className="absolute left-0 top-4 transform -translate-y-1/2 h-1 bg-gradient-to-r from-brand-600 to-accent-cyan -z-10 rounded-full transition-all duration-500 ease-out"
            style={{ width: `${((currentStep - 2) / (steps.length - 1)) * 100}%` }}
        />

        {steps.map((s, index) => {
          const isActive = currentStep >= s.step;
          const isCurrent = currentStep === s.step;
          
          return (
            <div key={s.step} className="flex flex-col items-center">
              <div 
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all duration-300 z-10
                  ${isActive ? 'bg-brand-600 border-brand-600 text-white shadow-lg shadow-brand-500/30' : 'bg-white border-gray-300 text-gray-400'}
                  ${isCurrent ? 'ring-4 ring-brand-200 scale-110' : ''}
                `}
              >
                {isActive ? (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                ) : (
                    index + 1
                )}
              </div>
              <span className={`text-xs mt-2 font-bold uppercase tracking-wider transition-colors duration-300 ${isActive ? 'text-brand-600' : 'text-gray-400'}`}>
                {s.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
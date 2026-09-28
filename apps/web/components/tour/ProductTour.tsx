'use client';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowRight,
  X,
  Sparkles,
  ChevronRight,
} from 'lucide-react';

export interface TourStep {
  id: number;
  target: string; // data-tour attribute value
  title: string;
  content: string;
  placement?: 'bottom' | 'top' | 'right' | 'left';
}

export const TOUR_STEPS: TourStep[] = [
  {
    id: 1,
    target: 'nav-dashboard',
    title: 'Your command center',
    content: 'Monitor campaigns, scheduled emails, delivery activity, and system health here.',
    placement: 'right',
  },
  {
    id: 2,
    target: 'action-new-campaign',
    title: 'Create a campaign',
    content: 'Start here to send emails. You’ll choose a sender, add recipients, write your message, and configure delivery.',
    placement: 'bottom',
  },
  {
    id: 3,
    target: 'nav-campaigns',
    title: 'Campaign management',
    content: 'View every campaign, check its status, and open detailed campaign activity.',
    placement: 'right',
  },
  {
    id: 4,
    target: 'nav-scheduled',
    title: 'Scheduled emails',
    content: 'See emails waiting for delivery. ReachInbox uses BullMQ delayed jobs for durable scheduling.',
    placement: 'right',
  },
  {
    id: 5,
    target: 'nav-sent',
    title: 'Sent emails',
    content: 'Review messages that have already been processed by the delivery system.',
    placement: 'right',
  },
  {
    id: 6,
    target: 'nav-analytics',
    title: 'Analytics',
    content: 'Understand delivery activity using the real data available in your workspace.',
    placement: 'right',
  },
  {
    id: 7,
    target: 'nav-queues',
    title: 'Email infrastructure',
    content: 'Monitor workers and queue states: Waiting, Active, Delayed, Completed, and Failed.',
    placement: 'right',
  },
  {
    id: 8,
    target: 'nav-senders',
    title: 'Sender management',
    content: 'Manage the identities used to send your campaigns.',
    placement: 'right',
  },
  {
    id: 9,
    target: 'nav-integrations',
    title: 'Integrations',
    content: 'Connect and manage services such as Slack and other supported integrations.',
    placement: 'right',
  },
  {
    id: 10,
    target: 'global-search',
    title: 'Search your email data',
    content: 'Find recipients, subjects, campaigns, and sent messages quickly.',
    placement: 'bottom',
  },
  {
    id: 11,
    target: 'nav-settings',
    title: 'Workspace settings',
    content: 'Manage your account, workspace, security, notifications, and configuration.',
    placement: 'right',
  },
];

interface ProductTourProps {
  isOpen: boolean;
  onClose: (completed: boolean) => void;
}

export function ProductTour({ isOpen, onClose }: ProductTourProps) {
  const router = useRouter();
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [isFinishedModal, setIsFinishedModal] = useState(false);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const step = TOUR_STEPS[currentStepIndex];

  // Measure and scroll target into view
  const updateTargetPosition = useCallback(() => {
    if (!step || isFinishedModal) {
      setTargetRect(null);
      return;
    }

    const element = document.querySelector(`[data-tour="${step.target}"]`);
    if (element) {
      const rect = element.getBoundingClientRect();
      setTargetRect(rect);
      element.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
    } else {
      setTargetRect(null);
    }
  }, [step, isFinishedModal]);

  useEffect(() => {
    if (!isOpen) return;
    updateTargetPosition();

    const handleResize = () => updateTargetPosition();
    window.addEventListener('resize', handleResize);
    window.addEventListener('scroll', handleResize, true);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('scroll', handleResize, true);
    };
  }, [isOpen, updateTargetPosition]);

  if (!isOpen) return null;

  const handleNext = () => {
    if (currentStepIndex < TOUR_STEPS.length - 1) {
      setCurrentStepIndex((prev) => prev + 1);
    } else {
      setIsFinishedModal(true);
    }
  };

  const handleBack = () => {
    if (isFinishedModal) {
      setIsFinishedModal(false);
      return;
    }
    if (currentStepIndex > 0) {
      setCurrentStepIndex((prev) => prev - 1);
    }
  };

  const handleSkip = () => {
    onClose(true);
  };

  const handleFinish = (action?: 'compose' | 'dashboard') => {
    onClose(true);
    if (action === 'compose') {
      router.push('/dashboard/compose');
    }
  };

  // Calculate tooltip popover coordinates
  const getTooltipStyle = () => {
    if (!targetRect || typeof window === 'undefined' || !step) {
      return {
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
      };
    }

    const margin = 12;
    const tooltipWidth = 320;
    const tooltipHeight = 180;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let top = targetRect.bottom + margin;
    let left = targetRect.left;

    // Right-aligned side placement for sidebar items on larger screens
    if (step.placement === 'right' && targetRect.right + tooltipWidth + margin < viewportWidth) {
      top = Math.max(margin, Math.min(targetRect.top, viewportHeight - tooltipHeight - margin));
      left = targetRect.right + margin;
    } else if (top + tooltipHeight > viewportHeight) {
      // If overflowing bottom, position above element
      top = Math.max(margin, targetRect.top - tooltipHeight - margin);
    }

    // Ensure it doesn't overflow horizontally
    if (left + tooltipWidth > viewportWidth - margin) {
      left = viewportWidth - tooltipWidth - margin;
    }
    left = Math.max(margin, left);

    return {
      top: `${top}px`,
      left: `${left}px`,
    };
  };

  return (
    <div className="fixed inset-0 z-[100] select-none">
      {/* ─── Dark Spotlight Backdrop with SVG Cutout ────────────────────── */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none transition-all duration-300">
        <defs>
          <mask id="tour-mask">
            {/* White covers all (opaque) */}
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            {/* Black hole cut out over target element */}
            {targetRect && (
              <rect
                x={targetRect.left - 4}
                y={targetRect.top - 4}
                width={targetRect.width + 8}
                height={targetRect.height + 8}
                rx="8"
                fill="black"
              />
            )}
          </mask>
        </defs>
        {/* Semi-transparent dark overlay using the mask */}
        <rect
          x="0"
          y="0"
          width="100%"
          height="100%"
          fill="rgba(5, 10, 20, 0.78)"
          mask="url(#tour-mask)"
        />
      </svg>

      {/* ─── Glowing Highlight Ring around Real DOM Target ────────────── */}
      {targetRect && (
        <div
          className="absolute pointer-events-none rounded-lg border-2 border-blue-500 shadow-[0_0_20px_rgba(37,99,235,0.4)] transition-all duration-300 animate-pulse"
          style={{
            top: `${targetRect.top - 4}px`,
            left: `${targetRect.left - 4}px`,
            width: `${targetRect.width + 8}px`,
            height: `${targetRect.height + 8}px`,
          }}
        />
      )}

      {/* ─── Tooltip Card for Active Step ─────────────────────────────── */}
      {!isFinishedModal && step && (
        <div
          ref={tooltipRef}
          style={getTooltipStyle()}
          className="fixed z-[101] w-[320px] rounded-xl bg-[#0F172A] border border-slate-700/80 p-4 shadow-2xl shadow-black/80 text-white transition-all duration-200"
        >
          {/* Header */}
          <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-800">
            <span className="text-[11px] font-semibold text-blue-400 font-mono tracking-wider">
              Step {currentStepIndex + 1} of {TOUR_STEPS.length}
            </span>
            <button
              onClick={handleSkip}
              className="text-slate-500 hover:text-slate-300 p-1 rounded transition-colors"
              title="Skip tour"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Content */}
          <div className="py-3 space-y-1.5">
            <h4 className="text-sm font-bold text-white tracking-tight">{step.title}</h4>
            <p className="text-xs text-slate-300 leading-relaxed">{step.content}</p>
          </div>

          {/* Footer Controls */}
          <div className="flex items-center justify-between pt-2 border-t border-slate-800">
            <button
              onClick={handleSkip}
              className="text-[11px] text-slate-400 hover:text-slate-200 transition-colors"
            >
              Skip tour
            </button>

            <div className="flex items-center gap-2">
              <button
                onClick={handleBack}
                disabled={currentStepIndex === 0}
                className="px-2.5 py-1.5 rounded-lg border border-slate-700 text-xs font-medium text-slate-300 hover:bg-slate-800 disabled:opacity-30 disabled:pointer-events-none transition-colors"
              >
                Back
              </button>
              <button
                onClick={handleNext}
                className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white shadow-xs transition-colors flex items-center gap-1"
              >
                <span>{currentStepIndex === TOUR_STEPS.length - 1 ? 'Complete' : 'Next'}</span>
                <ChevronRight className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Final Completion Modal ───────────────────────────────────── */}
      {isFinishedModal && (
        <div className="fixed inset-0 z-[102] flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl bg-[#0F172A] border border-slate-700/80 p-6 shadow-2xl shadow-black/80 text-white space-y-6 text-center animate-in fade-in zoom-in-95 duration-200">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mx-auto">
              <Sparkles className="w-6 h-6" />
            </div>

            <div className="space-y-2">
              <h3 className="text-xl font-bold tracking-tight text-white">
                You’re ready to use ReachInbox
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed max-w-sm mx-auto">
                You now know where the important tools live. Create your first campaign whenever you’re ready.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
              <button
                onClick={() => handleFinish('compose')}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-md shadow-blue-600/30 transition-all flex items-center justify-center gap-2"
              >
                <span>Create Campaign</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => handleFinish('dashboard')}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 text-xs font-medium transition-colors"
              >
                Finish Tour
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

import type { ReactNode } from 'react';
import { ChevronDown, SlidersHorizontal } from 'lucide-react';

export function FrameAccordion({ children }: { children: ReactNode }) {
  return <details data-frame-advanced data-image-advanced className="inspector-frame-card">
    <summary className="inspector-frame-summary">
      <SlidersHorizontal size={16} aria-hidden="true" />
      <span>Advanced</span>
      <ChevronDown size={15} className="inspector-frame-chevron" aria-hidden="true" />
    </summary>
    <div className="inspector-advanced-content">{children}</div>
  </details>;
}

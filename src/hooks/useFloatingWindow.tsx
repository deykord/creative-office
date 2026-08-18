import React, { useCallback, useEffect, useRef, useState } from 'react';

export interface FloatingWindowBounds { x: number; y: number; width: number; height: number }
export type ResizeDirection = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

interface Options {
  initialBounds: () => FloatingWindowBounds;
  minWidth: number;
  minHeight: number;
  margin?: number;
  enabled?: boolean;
}

const clampBounds = (bounds: FloatingWindowBounds, minWidth: number, minHeight: number, margin: number): FloatingWindowBounds => {
  const maxWidth = Math.max(220, window.innerWidth - margin * 2);
  const maxHeight = Math.max(220, window.innerHeight - margin * 2);
  const width = Math.min(Math.max(Math.min(minWidth, maxWidth), bounds.width), maxWidth);
  const height = Math.min(Math.max(Math.min(minHeight, maxHeight), bounds.height), maxHeight);
  return {
    width,
    height,
    x: Math.min(Math.max(margin, bounds.x), Math.max(margin, window.innerWidth - width - margin)),
    y: Math.min(Math.max(margin, bounds.y), Math.max(margin, window.innerHeight - height - margin)),
  };
};

export function useFloatingWindow({ initialBounds, minWidth, minHeight, margin = 8, enabled = true }: Options) {
  const constrain = useCallback((bounds: FloatingWindowBounds) => clampBounds(bounds, minWidth, minHeight, margin), [margin, minHeight, minWidth]);
  const [bounds, setBounds] = useState<FloatingWindowBounds>(() => constrain(initialBounds()));
  const [interacting, setInteracting] = useState(false);
  const interactionRef = useRef<{ kind: 'drag' | 'resize'; direction?: ResizeDirection; startX: number; startY: number; bounds: FloatingWindowBounds } | null>(null);

  useEffect(() => {
    const onPointerMove = (event: PointerEvent) => {
      const interaction = interactionRef.current;
      if (!interaction || !enabled) return;
      const dx = event.clientX - interaction.startX;
      const dy = event.clientY - interaction.startY;
      if (interaction.kind === 'drag') {
        setBounds(constrain({ ...interaction.bounds, x: interaction.bounds.x + dx, y: interaction.bounds.y + dy }));
        return;
      }
      const direction = interaction.direction || 'se';
      let { x, y, width, height } = interaction.bounds;
      if (direction.includes('e')) width += dx;
      if (direction.includes('s')) height += dy;
      if (direction.includes('w')) { x += dx; width -= dx; }
      if (direction.includes('n')) { y += dy; height -= dy; }
      setBounds(constrain({ x, y, width, height }));
    };
    const stop = () => { interactionRef.current = null; setInteracting(false); };
    const keepInsideViewport = () => setBounds((current) => constrain(current));
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', stop);
    window.addEventListener('pointercancel', stop);
    window.addEventListener('resize', keepInsideViewport);
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', stop);
      window.removeEventListener('pointercancel', stop);
      window.removeEventListener('resize', keepInsideViewport);
    };
  }, [constrain, enabled]);

  const startInteraction = (event: React.PointerEvent, kind: 'drag' | 'resize', direction?: ResizeDirection) => {
    if (!enabled || event.button !== 0) return;
    if (kind === 'drag' && (event.target as HTMLElement).closest('button, input, textarea, select, a')) return;
    event.preventDefault();
    interactionRef.current = { kind, direction, startX: event.clientX, startY: event.clientY, bounds };
    setInteracting(true);
  };

  const resetBounds = () => setBounds(constrain(initialBounds()));
  const updateBounds = (next: FloatingWindowBounds) => setBounds(constrain(next));
  return { bounds, interacting, startInteraction, resetBounds, setBounds: updateBounds };
}

export const WindowResizeHandles: React.FC<{ onResizeStart: (event: React.PointerEvent, direction: ResizeDirection) => void }> = ({ onResizeStart }) => <>
  <span aria-hidden="true" onPointerDown={(event) => onResizeStart(event, 'n')} className="absolute left-4 right-4 top-0 z-40 h-1.5 touch-none cursor-n-resize" />
  <span aria-hidden="true" onPointerDown={(event) => onResizeStart(event, 's')} className="absolute bottom-0 left-4 right-4 z-40 h-1.5 touch-none cursor-s-resize" />
  <span aria-hidden="true" onPointerDown={(event) => onResizeStart(event, 'w')} className="absolute bottom-4 left-0 top-4 z-40 w-1.5 touch-none cursor-w-resize" />
  <span aria-hidden="true" onPointerDown={(event) => onResizeStart(event, 'e')} className="absolute bottom-4 right-0 top-4 z-40 w-1.5 touch-none cursor-e-resize" />
  <span aria-hidden="true" onPointerDown={(event) => onResizeStart(event, 'nw')} className="absolute left-0 top-0 z-50 h-4 w-4 touch-none cursor-nw-resize" />
  <span aria-hidden="true" onPointerDown={(event) => onResizeStart(event, 'ne')} className="absolute right-0 top-0 z-50 h-4 w-4 touch-none cursor-ne-resize" />
  <span aria-hidden="true" onPointerDown={(event) => onResizeStart(event, 'sw')} className="absolute bottom-0 left-0 z-50 h-4 w-4 touch-none cursor-sw-resize" />
  <span data-window-resize-handle="se" aria-hidden="true" onPointerDown={(event) => onResizeStart(event, 'se')} className="absolute bottom-0 right-0 z-50 h-5 w-5 touch-none cursor-se-resize"><span className="absolute bottom-1 right-1 h-2.5 w-2.5 border-b-2 border-r-2 border-white/25" /></span>
</>;

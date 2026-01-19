import React, { useRef } from 'react';

export const useDraggableScroll = () => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const isDown = useRef(false);
  const startX = useRef(0);
  const scrollLeftStart = useRef(0);
  const isDragging = useRef(false);

  const handleMouseDown = (e: React.MouseEvent) => {
    isDown.current = true;
    isDragging.current = false;
    startX.current = e.pageX;
    if (scrollRef.current) {
        scrollLeftStart.current = scrollRef.current.scrollLeft;
    }
  };

  const handleMouseLeave = () => {
    isDown.current = false;
    isDragging.current = false;
  };

  const handleMouseUp = () => {
    isDown.current = false;
    // Small timeout to allow click event to be blocked if dragging occurred
    setTimeout(() => {
        isDragging.current = false;
    }, 0);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDown.current || !scrollRef.current) return;
    e.preventDefault();
    const x = e.pageX;
    const walk = (x - startX.current) * 1.5; 
    if (Math.abs(x - startX.current) > 5) {
        isDragging.current = true;
    }
    scrollRef.current.scrollLeft = scrollLeftStart.current - walk;
  };

  const handleCaptureClick = (e: React.MouseEvent) => {
      if (isDragging.current) {
          e.preventDefault();
          e.stopPropagation();
      }
  };

  return {
    scrollRef,
    events: {
      onMouseDown: handleMouseDown,
      onMouseLeave: handleMouseLeave,
      onMouseUp: handleMouseUp,
      onMouseMove: handleMouseMove,
      onClickCapture: handleCaptureClick,
    }
  };
};
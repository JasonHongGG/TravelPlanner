import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';

interface Props {
    value: string; // HH:MM
    onChange: (value: string) => void;
    onClose: () => void;
}

const HOURS = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, '0'));
const MINUTES = Array.from({ length: 12 }, (_, i) => (i * 5).toString().padStart(2, '0')); // 5 min interval

// Individual scrolling column component
const ScrollColumn = ({
    items,
    selectedValue,
    onSelect,
    type
}: {
    items: string[];
    selectedValue: string;
    onSelect: (val: string) => void;
    type: 'hour' | 'minute';
}) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const isDragging = useRef(false);
    const lastY = useRef(0);
    const lastTime = useRef(0);
    const velocity = useRef(0);
    const rafId = useRef<number | null>(null);
    const isInitialized = useRef(false);

    const ITEM_HEIGHT = 40;
    // Create circular list (Prefix + Original + Suffix)
    const infiniteItems = [...items, ...items, ...items];
    const loopHeight = items.length * ITEM_HEIGHT;

    // Initial Center
    useLayoutEffect(() => {
        if (containerRef.current) {
            let index = items.indexOf(selectedValue);

            // Fallback: Find closest if not exact match (e.g. 10:32 -> 10:30)
            if (index === -1) {
                const valNum = parseInt(selectedValue, 10);
                if (!isNaN(valNum)) {
                    let minDiff = Infinity;
                    let closestIdx = 0;
                    items.forEach((item, idx) => {
                        const itemNum = parseInt(item, 10);
                        const diff = Math.abs(itemNum - valNum);
                        if (diff < minDiff) {
                            minDiff = diff;
                            closestIdx = idx;
                        }
                    });
                    index = closestIdx;
                } else {
                    index = 0;
                }
            }

            // Force layout read to ensure scrollHeight is calculated before setting scrollTop
            const _ = containerRef.current.scrollHeight;
            const targetScrollTop = loopHeight + (index * ITEM_HEIGHT);

            // 1. Immediate Set
            containerRef.current.scrollTop = targetScrollTop;

            // 2. Retry in next frame (often needed for new DOM elements in popovers)
            requestAnimationFrame(() => {
                if (containerRef.current) containerRef.current.scrollTop = targetScrollTop;
            });

            // 3. Retry after short delay to ensure it sticks
            setTimeout(() => {
                if (containerRef.current) containerRef.current.scrollTop = targetScrollTop;
            }, 50);

            // Enable updates after a safe delay to ensure initial scroll doesn't trigger change
            setTimeout(() => {
                isInitialized.current = true;
            }, 300);
        }
    }, []);

    // Cleanup
    useEffect(() => {
        return () => {
            if (rafId.current) cancelAnimationFrame(rafId.current);
            window.removeEventListener('mousemove', handleWindowMouseMove);
            window.removeEventListener('mouseup', handleWindowMouseUp);
        };
    }, []);

    const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
        const container = e.currentTarget;
        const currentScroll = container.scrollTop;

        // Infinite Loop Logic
        if (currentScroll < loopHeight - 100) {
            container.scrollTop = currentScroll + loopHeight;
        } else if (currentScroll >= loopHeight * 2 + 100) {
            container.scrollTop = currentScroll - loopHeight;
        }

        // Calculate selected value (always update, even during drag/inertia, for live feedback)
        if (isInitialized.current) {
            const rawIndex = Math.round(container.scrollTop / ITEM_HEIGHT);
            const normalizedIndex = rawIndex % items.length;
            const newVal = items[normalizedIndex];

            if (newVal && newVal !== selectedValue) {
                onSelect(newVal);
            }
        }
    };

    const startInertia = () => {
        if (!containerRef.current) return;

        // Friction
        velocity.current *= 0.95;

        if (Math.abs(velocity.current) > 0.5) {
            containerRef.current.scrollTop -= velocity.current;
            rafId.current = requestAnimationFrame(startInertia);
        } else {
            stopInertiaAndSnap();
        }
    };

    const stopInertiaAndSnap = () => {
        if (rafId.current) cancelAnimationFrame(rafId.current);
        rafId.current = null;

        if (containerRef.current) {
            // Re-enable snapping and let browser handle the landing
            containerRef.current.style.scrollSnapType = 'y mandatory';
            containerRef.current.style.scrollBehavior = 'smooth';
            containerRef.current.style.cursor = 'grab';
        }
    };

    const handleWindowMouseMove = (e: MouseEvent) => {
        if (!isDragging.current || !containerRef.current) return;
        e.preventDefault();

        const now = performance.now();
        const deltaY = e.clientY - lastY.current;
        const deltaTime = now - lastTime.current;

        containerRef.current.scrollTop -= deltaY;

        // Track velocity
        if (deltaTime > 0) {
            velocity.current = deltaY * 1.2; // Boost velocity for easier flicking
            // If user holds still for > 50ms, velocity should drop
            if (deltaTime > 50) velocity.current = 0;
        }

        lastY.current = e.clientY;
        lastTime.current = now;
    };

    const handleWindowMouseUp = () => {
        isDragging.current = false;
        window.removeEventListener('mousemove', handleWindowMouseMove);
        window.removeEventListener('mouseup', handleWindowMouseUp);

        if (containerRef.current) {
            containerRef.current.style.cursor = 'grab';
        }

        startInertia();
    };

    const onMouseDown = (e: React.MouseEvent) => {
        isDragging.current = true;
        lastY.current = e.clientY;
        lastTime.current = performance.now();
        velocity.current = 0;

        if (rafId.current) {
            cancelAnimationFrame(rafId.current);
            rafId.current = null;
        }

        if (containerRef.current) {
            containerRef.current.style.scrollSnapType = 'none';
            containerRef.current.style.scrollBehavior = 'auto'; // Instant updates during drag
            containerRef.current.style.cursor = 'grabbing';
        }

        window.addEventListener('mousemove', handleWindowMouseMove);
        window.addEventListener('mouseup', handleWindowMouseUp);
    };

    return (
        <div className="relative h-full flex-1 overflow-hidden group">
            <div
                ref={containerRef}
                onScroll={handleScroll}
                onMouseDown={onMouseDown}
                className="h-full overflow-y-auto w-full scrollbar-hide snap-y snap-mandatory py-[60px] cursor-grab active:cursor-grabbing"
                style={{ scrollBehavior: 'auto' }}
            >
                {infiniteItems.map((item, i) => (
                    <div
                        key={`${type}-${i}`}
                        onClick={() => {
                            if (containerRef.current && Math.abs(velocity.current) < 0.5 && !isDragging.current) {
                                containerRef.current.scrollTo({ top: i * ITEM_HEIGHT, behavior: 'smooth' });
                            }
                        }}
                        className={`
              h-[40px] flex items-center justify-center snap-center transition-all duration-200 select-none leading-none
              ${item === selectedValue
                                ? 'text-gray-900 font-bold scale-110'
                                : 'text-gray-400 font-medium scale-90 opacity-60 hover:opacity-100'
                            }
            `}
                    >
                        {item}
                    </div>
                ))}
            </div>
        </div>
    );
};

export default function TimePickerWheel({ value, onChange, onClose }: Props) {
    const [hour, setHour] = useState(value.split(':')[0] || '08');
    const [minute, setMinute] = useState(value.split(':')[1] || '00');
    const containerRef = useRef<HTMLDivElement>(null);

    // Close when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                onClose();
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [onClose]);

    const handleHourChange = (h: string) => {
        setHour(h);
        onChange(`${h}:${minute}`);
    };

    const handleMinuteChange = (m: string) => {
        setMinute(m);
        onChange(`${hour}:${m}`);
    };

    return (
        <div
            ref={containerRef}
            className="absolute z-50 mt-2 bg-white rounded-2xl shadow-xl border border-gray-100 w-[180px] overflow-hidden animate-in fade-in zoom-in-95 duration-200"
        >
            {/* Header / Arrows decorator */}
            <div className="absolute top-0 left-0 right-0 h-6 bg-gradient-to-b from-white to-transparent z-10 pointer-events-none" />
            <div className="absolute bottom-0 left-0 right-0 h-6 bg-gradient-to-t from-white to-transparent z-10 pointer-events-none" />

            {/* Center Highlight Bar */}
            <div className="absolute top-1/2 left-4 right-4 -translate-y-1/2 h-[40px] bg-brand-50/50 border-y border-brand-200 rounded-lg -z-0 pointer-events-none box-border" />

            <div className="flex h-[160px] relative z-0">
                <ScrollColumn items={HOURS} selectedValue={hour} onSelect={handleHourChange} type="hour" />
                <div className="flex items-center justify-center font-bold text-gray-400 z-20">:</div>
                <ScrollColumn items={MINUTES} selectedValue={minute} onSelect={handleMinuteChange} type="minute" />
            </div>
        </div>
    );
}

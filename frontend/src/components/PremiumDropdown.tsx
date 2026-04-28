import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';

interface Option {
    value: string;
    label: string;
    subLabel?: string;
    icon?: React.ReactNode;
}

interface PremiumDropdownProps {
    options: Option[];
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    className?: string;
    icon?: React.ReactNode;
}

export default function PremiumDropdown({
    options,
    value,
    onChange,
    placeholder = 'Select...',
    className = '',
    icon
}: PremiumDropdownProps) {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const selectedOption = options.find(opt => opt.value === value);

    return (
        <div className={`relative ${className}`} ref={dropdownRef}>
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className={`w-full px-4 py-3 bg-white border text-left rounded-xl shadow-sm flex items-center justify-between transition-all group
          ${isOpen
                        ? 'border-brand-500 ring-4 ring-brand-500/10'
                        : 'border-gray-300 hover:border-gray-400'
                    }
        `}
            >
                <div className="flex items-center gap-3 overflow-hidden">
                    {selectedOption?.icon ? (
                        <span className="text-brand-600">{selectedOption.icon}</span>
                    ) : icon ? (
                        <span className="text-gray-400 group-hover:text-gray-600 transition-colors">{icon}</span>
                    ) : null}

                    <span className={`font-medium truncate ${selectedOption ? 'text-gray-900' : 'text-gray-400'}`}>
                        {selectedOption ? selectedOption.label : placeholder}
                    </span>
                </div>

                <ChevronDown
                    className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${isOpen ? 'rotate-180 text-brand-500' : ''}`}
                />
            </button>

            {isOpen && (
                <div className="absolute z-50 w-full mt-2 bg-white border border-gray-100 rounded-xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 origin-top">
                    <div className="max-h-60 overflow-y-auto p-1 scrollbar-hide">
                        {options.map((option) => {
                            const isSelected = option.value === value;
                            return (
                                <button
                                    key={option.value}
                                    type="button"
                                    onClick={() => {
                                        onChange(option.value);
                                        setIsOpen(false);
                                    }}
                                    className={`w-full text-left px-3 py-2.5 rounded-lg flex items-center justify-between transition-all group mb-0.5
                    ${isSelected
                                            ? 'bg-brand-50 text-brand-700 font-bold'
                                            : 'text-gray-700 hover:bg-gray-50'
                                        }
                  `}
                                >
                                    <div className="flex items-center gap-3 overflow-hidden">
                                        {option.icon && (
                                            <span className={`${isSelected ? 'text-brand-600' : 'text-gray-400 group-hover:text-gray-600'}`}>
                                                {option.icon}
                                            </span>
                                        )}
                                        <div className="flex flex-col">
                                            <span className="truncate">{option.label}</span>
                                            {option.subLabel && (
                                                <span className={`text-xs ${isSelected ? 'text-brand-400' : 'text-gray-400'} font-normal`}>
                                                    {option.subLabel}
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {isSelected && <Check className="w-4 h-4 text-brand-600" />}
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}

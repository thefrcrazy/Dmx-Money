import React, { useState, useRef, useEffect } from 'react';
import { Calendar as CalendarIcon } from 'lucide-react';
import Calendar from './Calendar';
import { format, parseISO, isValid } from 'date-fns';

interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
    label?: string;
    size?: 'sm' | 'md' | 'lg';
    icon?: React.ElementType;
    rightElement?: React.ReactNode;
    containerClassName?: string;
}

const Input: React.FC<InputProps> = ({
    label,
    size = 'md',
    icon: Icon,
    rightElement,
    className = '',
    containerClassName = '',
    disabled,
    id,
    type,
    value,
    onChange,
    ...props
}) => {
    const inputId = id || (label ? `input-${label.toLowerCase().replace(/\s+/g, '-')}` : undefined);
    const [isCalendarOpen, setIsCalendarOpen] = useState(false);
    const [displayText, setDisplayText] = useState('');
    const containerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const sizes = {
        sm: "h-8 text-xs",
        md: "h-9 text-sm",
        lg: "h-11 text-base",
    };

    const EffectiveIcon = Icon || (type === 'date' ? CalendarIcon : undefined);
    const paddingLeft = EffectiveIcon ? '!pl-10' : '!pl-3';
    const paddingRight = (rightElement || type === 'date') ? '!pr-10' : '!pr-3';

    // Sync display text with value prop (YYYY-MM-DD -> DD/MM/YYYY)
    useEffect(() => {
        if (type === 'date') {
            if (value && typeof value === 'string') {
                const date = parseISO(value);
                if (isValid(date)) {
                    // Only update if not focused to avoid cursor jumping
                    if (document.activeElement !== inputRef.current) {
                        setDisplayText(format(date, 'dd/MM/yyyy'));
                    }
                } else {
                    setDisplayText(value);
                }
            } else {
                setDisplayText('');
            }
        }
    }, [value, type]);

    // Handle clicks outside to close calendar
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsCalendarOpen(false);
            }
        };
        if (isCalendarOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isCalendarOpen]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        let val = e.target.value;
        
        if (type === 'date') {
            // Keep only digits
            const digits = val.replace(/\D/g, '').substring(0, 8);
            
            // Build formatted string JJ/MM/AAAA
            let formatted = '';
            if (digits.length > 0) {
                formatted = digits.substring(0, 2);
                if (digits.length > 2) {
                    formatted += '/' + digits.substring(2, 4);
                    if (digits.length > 4) {
                        formatted += '/' + digits.substring(4, 8);
                    }
                }
            }
            
            setDisplayText(formatted);
            
            // Simple parsing for DD/MM/YYYY to trigger onChange
            if (digits.length === 8) {
                const day = digits.substring(0, 2);
                const month = digits.substring(2, 4);
                const year = digits.substring(4, 8);
                const isoDate = `${year}-${month}-${day}`;
                
                if (isValid(parseISO(isoDate))) {
                    if (onChange) {
                        const event = {
                            ...e,
                            target: { ...e.target, value: isoDate }
                        } as React.ChangeEvent<HTMLInputElement>;
                        onChange(event);
                    }
                }
            }
        } else {
            if (onChange) onChange(e);
        }
    };

    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
        if (type === 'date') {
            // Re-format on blur to ensure consistency
            if (value && typeof value === 'string') {
                const date = parseISO(value);
                if (isValid(date)) {
                    setDisplayText(format(date, 'dd/MM/yyyy'));
                }
            }
        }
        if (props.onBlur) props.onBlur(e);
    };

    const handleDateSelect = (date: Date) => {
        const isoDate = format(date, 'yyyy-MM-dd');
        setDisplayText(format(date, 'dd/MM/yyyy'));
        if (onChange) {
            const event = {
                target: { value: isoDate }
            } as React.ChangeEvent<HTMLInputElement>;
            onChange(event);
        }
        setIsCalendarOpen(false);
    };

    return (
        <div className={`space-y-1.5 ${containerClassName}`} ref={containerRef}>
            {label && (
                <label htmlFor={inputId} className="block text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider ml-1">
                    {label}
                </label>
            )}
            <div className="relative app-input-container">
                {EffectiveIcon && (
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center z-20">
                        {type === 'date' ? (
                            <button
                                type="button"
                                tabIndex={-1}
                                onClick={() => !disabled && setIsCalendarOpen(!isCalendarOpen)}
                                className="p-0.5 rounded hover:bg-gray-100 dark:hover:bg-neutral-800 text-gray-400 dark:text-gray-500 hover:text-primary-500 transition-colors cursor-pointer"
                                title="Ouvrir le calendrier"
                            >
                                <EffectiveIcon className="w-4 h-4" />
                            </button>
                        ) : (
                            <EffectiveIcon className="w-4 h-4 text-gray-400 dark:text-gray-500 pointer-events-none" />
                        )}
                    </div>
                )}
                <input
                    ref={inputRef}
                    id={inputId}
                    type={type === 'date' ? 'text' : type}
                    className={`app-input w-full ${sizes[size]} ${paddingLeft} ${paddingRight} ${className} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                    disabled={disabled}
                    placeholder={type === 'date' ? 'JJ/MM/AAAA' : props.placeholder}
                    value={type === 'date' ? displayText : value}
                    onChange={handleInputChange}
                    onBlur={handleBlur}
                    {...props}
                />
                {rightElement && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none app-input-right-element z-10">
                        {rightElement}
                    </div>
                )}

                {/* Custom Calendar Popover */}
                {type === 'date' && isCalendarOpen && !disabled && (
                    <div className="absolute top-full left-0 mt-2 z-[100]">
                        <Calendar 
                            selectedDate={value && typeof value === 'string' && isValid(parseISO(value)) ? parseISO(value) : new Date()} 
                            onDateSelect={handleDateSelect}
                            onClose={() => setIsCalendarOpen(false)}
                        />
                    </div>
                )}
            </div>
        </div>
    );
};

export default Input;
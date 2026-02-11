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
    const containerRef = useRef<HTMLDivElement>(null);

    const sizes = {
        sm: "h-8 text-xs",
        md: "h-9 text-sm",
        lg: "h-11 text-base",
    };

    const EffectiveIcon = Icon || (type === 'date' ? CalendarIcon : undefined);
    const paddingLeft = EffectiveIcon ? '!pl-10' : '!pl-3';
    const paddingRight = (rightElement || type === 'date') ? '!pr-10' : '!pr-3';

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

    const handleDateSelect = (date: Date) => {
        const dateStr = format(date, 'yyyy-MM-dd');
        if (onChange) {
            const event = {
                target: { value: dateStr }
            } as React.ChangeEvent<HTMLInputElement>;
            onChange(event);
        }
        setIsCalendarOpen(false);
    };

    const getDisplayDate = () => {
        if (type !== 'date' || !value) return value;
        const date = parseISO(value as string);
        return isValid(date) ? format(date, 'dd/MM/yyyy') : value;
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
                    <EffectiveIcon 
                        className={`absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 w-4 h-4 pointer-events-none app-input-icon z-10`} 
                    />
                )}
                <input
                    id={inputId}
                    type={type === 'date' ? 'text' : type}
                    className={`app-input w-full ${sizes[size]} ${paddingLeft} ${paddingRight} ${className} ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${type === 'date' ? 'cursor-pointer' : ''}`}
                    disabled={disabled}
                    value={type === 'date' ? getDisplayDate() : value}
                    onChange={type === 'date' ? undefined : onChange}
                    onClick={() => type === 'date' && !disabled && setIsCalendarOpen(!isCalendarOpen)}
                    readOnly={type === 'date'}
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
                            selectedDate={value ? parseISO(value as string) : new Date()} 
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
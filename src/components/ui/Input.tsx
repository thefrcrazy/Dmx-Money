import React from 'react';

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
    ...props
}) => {
    const inputId = id || (label ? `input-${label.toLowerCase().replace(/\s+/g, '-')}` : undefined);

    const sizes = {
        sm: "h-8 text-xs",
        md: "h-9 text-sm",
        lg: "h-11 text-base",
    };

    const paddingLeft = Icon ? '!pl-10' : '!pl-3';
    const paddingRight = rightElement ? '!pr-8' : '!pr-3';

    return (
        <div className={`space-y-1.5 ${containerClassName}`}>
            {label && (
                <label htmlFor={inputId} className="block text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider ml-1">
                    {label}
                </label>
            )}
            <div className="relative app-input-container">
                {Icon && (
                    <Icon className={`absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 w-4 h-4 pointer-events-none app-input-icon`} />
                )}
                <input
                    id={inputId}
                    className={`app-input w-full ${sizes[size]} ${paddingLeft} ${paddingRight} ${className} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                    disabled={disabled}
                    {...props}
                />
                {rightElement && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none app-input-right-element">
                        {rightElement}
                    </div>
                )}
            </div>
        </div>
    );
};

export default Input;

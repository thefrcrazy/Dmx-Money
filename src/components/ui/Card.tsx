import React from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
    title?: string;
    subtitle?: string;
    icon?: React.ElementType;
    action?: React.ReactNode;
    noPadding?: boolean;
}

const Card: React.FC<CardProps> = ({ 
    children, 
    className, 
    title, 
    subtitle, 
    icon: Icon,
    action,
    noPadding = false,
    ...props 
}) => {
    return (
        <div 
            className={cn(
                "bg-white dark:bg-[#121212] rounded-xl border border-gray-200 dark:border-neutral-800 shadow-sm transition-all overflow-hidden",
                className
            )} 
            {...props}
        >
            {(title || action) && (
                <div className="px-6 py-4 border-b border-gray-100 dark:border-neutral-800 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        {Icon && <Icon className="w-5 h-5 text-primary-600" />}
                        <div>
                            {title && <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 leading-none">{title}</h3>}
                            {subtitle && <p className="text-[10px] text-gray-400 mt-1">{subtitle}</p>}
                        </div>
                    </div>
                    {action && <div>{action}</div>}
                </div>
            )}
            <div className={cn(!noPadding && "p-6")}>
                {children}
            </div>
        </div>
    );
};

export default Card;
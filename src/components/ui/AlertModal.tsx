import React from 'react';
import { CheckCircle, AlertCircle } from 'lucide-react';
import Button from './Button';

interface AlertModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    message: string;
    type?: 'success' | 'error';
}

const AlertModal: React.FC<AlertModalProps> = ({
    isOpen,
    onClose,
    title,
    message,
    type = 'success'
}) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200 app-modal-overlay">
            <div className="app-card w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200 app-modal-content app-alert-modal">
                <div className="p-6 text-center app-modal-body">
                    <div className={`mx-auto w-12 h-12 rounded-full flex items-center justify-center mb-4 app-alert-icon-container ${type === 'success'
                        ? 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400'
                        : 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'
                        }`}>
                        {type === 'success' ? (
                            <CheckCircle className="w-6 h-6 app-alert-icon-success" />
                        ) : (
                            <AlertCircle className="w-6 h-6 app-alert-icon-error" />
                        )}
                    </div>

                    <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-2 app-alert-title">
                        {title}
                    </h3>

                    <p className="text-gray-600 dark:text-gray-300 mb-6 app-alert-message">
                        {message}
                    </p>

                    <Button
                        onClick={onClose}
                        className="w-full justify-center app-alert-button"
                        variant={type === 'success' ? 'primary' : 'danger'}
                    >
                        OK
                    </Button>
                </div>
            </div>
        </div>
    );
};

export default AlertModal;

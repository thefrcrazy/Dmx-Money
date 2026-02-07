import React, { useEffect } from 'react';
import { TriangleAlert } from 'lucide-react';
import Button from './Button';

interface ConfirmModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    isDangerous?: boolean;
}

const ConfirmModal: React.FC<ConfirmModalProps> = ({
    isOpen,
    onClose,
    onConfirm,
    title,
    message,
    confirmLabel = 'Confirmer',
    cancelLabel = 'Annuler',
    isDangerous = false
}) => {
    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        if (isOpen) window.addEventListener('keydown', handleEscape);
        return () => window.removeEventListener('keydown', handleEscape);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/20 app-modal-overlay"
            onClick={onClose}
        >
            <div
                className="app-formpop w-full max-w-md animate-in fade-in zoom-in duration-100 bg-white dark:bg-[#121212] app-modal-content app-confirm-modal"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="p-6 space-y-6 app-modal-body">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-200 app-confirm-title">{title}</h3>

                    <div className="flex items-start gap-4 app-confirm-message-container">
                        {isDangerous && (
                            <div className="p-2 bg-red-100 rounded-full flex-shrink-0 app-confirm-icon-wrapper">
                                <TriangleAlert className="w-6 h-6 text-red-600" />
                            </div>
                        )}
                        <div className={`text-gray-600 dark:text-gray-300 ${isDangerous ? 'pt-1' : ''} app-confirm-message`}>
                            {message}
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 app-modal-footer">
                        <Button
                            variant="secondary"
                            onClick={onClose}
                        >
                            {cancelLabel}
                        </Button>
                        <Button
                            variant={isDangerous ? 'danger' : 'primary'}
                            onClick={() => {
                                onConfirm();
                                onClose();
                            }}
                        >
                            {confirmLabel}
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ConfirmModal;

import {useEffect, useRef} from 'react';
import type {ReactNode} from 'react';

interface DialogProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    children: ReactNode;
}

export function Dialog({isOpen, onClose, title, children}: DialogProps) {
    const dialogRef = useRef<HTMLDivElement>(null);

    // Close on Escape key
    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isOpen) {
                onClose();
            }
        };

        document.addEventListener('keydown', handleEscape);
        return () => document.removeEventListener('keydown', handleEscape);
    }, [isOpen, onClose]);

    // Close on backdrop click
    const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
        if (e.target === e.currentTarget) {
            onClose();
        }
    };

    if (!isOpen) return null;

    return (
        <div
            className="dk-dialog-backdrop"
            onClick={handleBackdropClick}
        >
            <div
                ref={dialogRef}
                className="dk-dialog-container"
            >
                {/* Header */}
                <div className="dk-dialog-header">
                    <h2 className="dk-page-title">{title}</h2>
                    <button
                        onClick={onClose}
                        className="dk-text-secondary hover:dk-text-primary dk-transition"
                        aria-label="Close dialog"
                    >
                        <svg
                            className="w-6 h-6"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M6 18L18 6M6 6l12 12"
                            />
                        </svg>
                    </button>
                </div>

                {/* Content */}
                <div className="dk-dialog-content">
                    {children}
                </div>
            </div>
        </div>
    );
}

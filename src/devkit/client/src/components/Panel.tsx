import {type ReactNode, type RefObject} from "react";

interface PanelProps {
    /** Content to render inside the panel */
    children: ReactNode;
    /** Additional CSS classes to apply */
    className?: string;
    /** Border position: 'top', 'bottom', 'all', or 'none' */
    border?: 'top' | 'bottom' | 'all' | 'none';
    /** Custom padding override (defaults to p-4) */
    padding?: string;
    /** Optional ref to the underlying div element */
    innerRef?: RefObject<HTMLDivElement | null>;
}

/**
 * Panel component providing standard padding and borders for consistent UI layout.
 * Uses semantic dk-* classes for consistency.
 */
export function Panel({
    children,
    className = '',
    border = 'none',
    padding = 'dk-padding-standard',
    innerRef
}: PanelProps) {
    const borderClasses = {
        top: 'dk-border-t',
        bottom: 'dk-border-b',
        all: 'dk-border-all',
        none: ''
    };

    return (
        <div ref={innerRef} className={`${padding} ${borderClasses[border]} dk-text-primary ${className}`.trim()}>
            {children}
        </div>
    );
}

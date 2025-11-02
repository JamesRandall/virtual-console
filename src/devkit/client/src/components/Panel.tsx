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
 * Uses zinc colors for borders and neutral text colors.
 */
export function Panel({
    children,
    className = '',
    border = 'none',
    padding = 'p-4',
    innerRef
}: PanelProps) {
    const borderClasses = {
        top: 'border-t border-zinc-300',
        bottom: 'border-b border-zinc-300',
        all: 'border border-zinc-300',
        none: ''
    };

    return (
        <div ref={innerRef} className={`${padding} ${borderClasses[border]} text-zinc-200 ${className}`.trim()}>
            {children}
        </div>
    );
}

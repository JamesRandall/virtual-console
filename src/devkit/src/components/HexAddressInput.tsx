import {useState, useCallback, useEffect} from "react";

interface HexAddressInputProps {
    /** Label text to display before the input */
    label: string;
    /** Current numeric value */
    value: number;
    /** Callback when the value changes after validation */
    onChange: (value: number) => void;
    /** Optional alignment factor (e.g., 8 for byte alignment) */
    alignment?: number;
    /** Minimum allowed value (default: 0) */
    minValue?: number;
    /** Maximum allowed value */
    maxValue?: number;
    /** Number of hex digits to pad to (default: 4) */
    padLength?: number;
    /** CSS width class (default: w-20) */
    width?: string;
}

/**
 * Input component for hexadecimal address/value entry with automatic validation,
 * alignment, and formatting.
 */
export function HexAddressInput({
    label,
    value,
    onChange,
    alignment,
    minValue = 0,
    maxValue,
    padLength = 4,
    width = 'w-20'
}: HexAddressInputProps) {
    // Local state
    const [inputValue, setInputValue] = useState(
        value.toString(16).padStart(padLength, '0').toUpperCase()
    );

    // Effects
    useEffect(() => {
        // Sync local state when external value changes
        setInputValue(value.toString(16).padStart(padLength, '0').toUpperCase());
    }, [value, padLength]);

    // Event handlers
    const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        setInputValue(e.target.value.toUpperCase());
    }, []);

    const handleBlur = useCallback(() => {
        const parsed = parseInt(inputValue, 16);

        if (isNaN(parsed) || parsed < minValue || (maxValue !== undefined && parsed > maxValue)) {
            // Invalid input - revert to current value
            setInputValue(value.toString(16).padStart(padLength, '0').toUpperCase());
            return;
        }

        let finalValue = parsed;

        // Apply alignment if specified
        if (alignment) {
            if (label.toLowerCase().includes('size')) {
                // For sizes, round up to alignment
                finalValue = Math.ceil(parsed / alignment) * alignment;
            } else {
                // For addresses, round down to alignment
                finalValue = Math.floor(parsed / alignment) * alignment;
            }
        }

        // Update display value and notify parent
        setInputValue(finalValue.toString(16).padStart(padLength, '0').toUpperCase());

        if (finalValue !== value) {
            onChange(finalValue);
        }
    }, [inputValue, value, onChange, alignment, minValue, maxValue, padLength, label]);

    // Render
    return (
        <label className="flex items-center gap-2">
            <span>{label}</span>
            <input
                type="text"
                value={inputValue}
                onChange={handleChange}
                onBlur={handleBlur}
                className={`font-mono ${width} px-2 py-1 border border-zinc-300 rounded`}
            />
        </label>
    );
}

type BoundOptions = {
    min?: number;
    max?: number;
};

export function parseBoundedInt(value: unknown, defaultValue: number, options: BoundOptions = {}): number {
    const raw = typeof value === 'number'
        ? value
        : typeof value === 'string'
            ? parseInt(value, 10)
            : NaN;

    if (!Number.isFinite(raw)) return defaultValue;

    let result = Math.floor(raw as number);
    if (typeof options.min === 'number') result = Math.max(options.min, result);
    if (typeof options.max === 'number') result = Math.min(options.max, result);
    return result;
}
export function isSyntheticRecord(value: unknown): boolean {
    if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
    const record = value as Record<string, unknown>;
    if (record.is_synthetic !== true) return false;
    if (!("demo_run_id" in record)) return true;
    return typeof record.demo_run_id === "string" && record.demo_run_id.trim().length > 0;
}

export function areSyntheticRecords(values: unknown[]): boolean {
    return values.length > 0 && values.every(isSyntheticRecord);
}

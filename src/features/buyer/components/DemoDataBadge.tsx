export function DemoDataBadge({ visible }: { visible: boolean }) {
    if (!visible) return null;

    return (
        <span
            role="note"
            className="inline-flex min-h-8 max-w-full items-center gap-2 rounded-full border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-semibold leading-4 text-amber-950 shadow-sm"
        >
            <svg
                aria-hidden="true"
                viewBox="0 0 20 20"
                fill="currentColor"
                className="h-4 w-4 shrink-0 text-amber-700"
            >
                <path
                    fillRule="evenodd"
                    d="M10 2a8 8 0 1 0 0 16 8 8 0 0 0 0-16Zm0 3a.75.75 0 0 1 .75.75v4a.75.75 0 0 1-1.5 0v-4A.75.75 0 0 1 10 5Zm0 8.5a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z"
                    clipRule="evenodd"
                />
            </svg>
            <span>Dados de demonstração</span>
        </span>
    );
}

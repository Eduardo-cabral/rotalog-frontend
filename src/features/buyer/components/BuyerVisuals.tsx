import type { ReactNode } from "react";

export type BuyerIconName =
    | "arrow-left"
    | "arrow-right"
    | "box"
    | "calendar"
    | "cart"
    | "check"
    | "clock"
    | "package"
    | "refresh"
    | "search"
    | "store"
    | "tag"
    | "trash";

const iconPaths: Record<BuyerIconName, string> = {
    "arrow-left": "M19 12H5m7 7-7-7 7-7",
    "arrow-right": "M5 12h14m-7-7 7 7-7 7",
    box: "m12 3 9 4.5-9 4.5-9-4.5L12 3Zm-9 4.5V17l9 4 9-4V7.5M12 12v9",
    calendar: "M8 2v4m8-4v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14H3V6a2 2 0 0 1 2-2Z",
    cart: "M3 3h2l2.4 12h11.2l2-8H6m2 13h.01M18 20h.01",
    check: "m5 12 4 4L19 6",
    clock: "M12 8v4l3 2m6-2a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z",
    package: "M21 8a2 2 0 0 0-1-1.7l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.7l7 4a2 2 0 0 0 2 0l7-4a2 2 0 0 0 1-1.7V8Zm-9 13V12m9-4-9 5-9-5",
    refresh: "M20 7v5h-5M4 17v-5h5m-4.1-3A8 8 0 0 1 18.3 6L20 12M4 12l1.7 6A8 8 0 0 0 19.1 15",
    search: "m20 20-4.5-4.5M18 10.5a7.5 7.5 0 1 1-15 0 7.5 7.5 0 0 1 15 0Z",
    store: "M3 10h18M5 10v10h14V10M3 10l2-6h14l2 6M9 20v-6h6v6M3 10a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0",
    tag: "M20.6 13.4 11 3H4v7l10.6 9.6a2 2 0 0 0 2.8 0l3.2-3.2a2 2 0 0 0 0-3ZM7.5 7.5h.01",
    trash: "M3 6h18m-2 0-.9 14H5.9L5 6m4 0V4h6v2m-5 4v6m4-6v6",
};

export function BuyerIcon({
    name,
    className = "h-5 w-5",
}: {
    name: BuyerIconName;
    className?: string;
}) {
    return (
        <svg
            aria-hidden="true"
            className={className}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <path d={iconPaths[name]} />
        </svg>
    );
}

export function BuyerStatus({
    children,
    tone = "neutral",
    icon = "clock",
}: {
    children: ReactNode;
    tone?: "success" | "warning" | "danger" | "progress" | "neutral";
    icon?: "cart" | "check" | "clock" | "package";
}) {
    const styles = {
        success: "bg-emerald-50 text-emerald-800 ring-emerald-200",
        warning: "bg-amber-50 text-amber-900 ring-amber-200",
        danger: "bg-red-50 text-red-800 ring-red-200",
        progress: "bg-blue-50 text-blue-800 ring-blue-200",
        neutral: "bg-slate-100 text-slate-700 ring-slate-200",
    } as const;

    return (
        <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ring-1 ring-inset ${styles[tone]}`}>
            <BuyerIcon name={icon} className="h-4 w-4 shrink-0" />
            {children}
        </span>
    );
}

export function BuyerProductPlaceholder() {
    return (
        <div
            aria-hidden="true"
            className="flex h-36 items-center justify-center rounded-xl bg-gradient-to-br from-slate-50 to-blue-50 text-blue-300 sm:h-40"
        >
            <BuyerIcon name="package" className="h-12 w-12" />
        </div>
    );
}

export function BuyerEmptyState({
    icon,
    title,
    children,
    action,
}: {
    icon: "cart" | "package" | "search" | "store";
    title: string;
    children: ReactNode;
    action?: ReactNode;
}) {
    return (
        <section className="flex flex-col items-center rounded-2xl border border-slate-200 bg-white px-6 py-10 text-center shadow-sm sm:py-12">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
                <BuyerIcon name={icon} className="h-8 w-8" />
            </div>
            <h2 className="mt-5 text-lg font-bold tracking-tight text-slate-900">{title}</h2>
            <div className="mt-2 max-w-md text-sm leading-6 text-slate-600">{children}</div>
            {action && <div className="mt-6">{action}</div>}
        </section>
    );
}

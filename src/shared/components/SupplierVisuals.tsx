import type {ReactNode} from "react";
export type IconName = "home" | "orders" | "products" | "inventory" | "routes" | "account" | "arrow";
const paths: Record<IconName, string> = {
    home: "m3 10 9-7 9 7M5 9v12h5v-7h4v7h5V9",
    orders: "M8 5H5v16h14V5h-3M9 3h6v4H9zM9 12h6M9 16h4",
    products: "m3 7 9-4 9 4-9 4-9-4Zm0 0v10l9 4 9-4V7M12 11v10",
    inventory: "M3 21V8l9-5 9 5v13M8 21V11h8v10M8 15h8",
    routes: "M6 3a3 3 0 1 0 0 6 3 3 0 0 0 0-6Zm12 12a3 3 0 1 0 0 6 3 3 0 0 0 0-6ZM6 9v7a3 3 0 0 0 3 3h6M18 15V8a3 3 0 0 0-3-3h-2",
    account: "M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0ZM4 21v-2a8 8 0 0 1 16 0v2Z",
    arrow: "M5 12h14m-6-6 6 6-6 6",
};
export function SupplierIcon({name, className = "h-5 w-5"}: {name: IconName; className?: string}) {
    return <svg aria-hidden="true" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d={paths[name]}/></svg>;
}
export type StatusTone = "blue" | "success" | "danger" | "warning" | "progress" | "neutral";
export function StatusBadge({children, tone = "neutral"}: {children: ReactNode; tone?: StatusTone}) {
    return <span className={`supplier-badge supplier-badge--${tone}`}><span aria-hidden="true" className="supplier-status-dot"/>{children}</span>;
}

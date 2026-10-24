import { useEffect, useMemo, type ReactNode } from "react";
import { useAuth } from "../../auth/hooks/useAuth";
import { supplierPermissions } from "../../services/apiAuth.service";
import { OrdersRepository } from "./ordersRepository";
import { OrdersContext } from "./ordersContext";

export function ApiOrdersProvider({ children }: { children: ReactNode }) {
    const { user } = useAuth();
    const organizationId = user?.organization_id ?? "";
    if (!user || !supplierPermissions(user).includes("orders:view")) {
        return <OrdersContext.Provider value={null}>{children}</OrdersContext.Provider>;
    }
    return <SessionOrdersProvider key={`${user?.id}:${organizationId}`} organizationId={organizationId}>{children}</SessionOrdersProvider>;
}
function SessionOrdersProvider({ organizationId, children }: { organizationId: string; children: ReactNode }) {
    const repository = useMemo(() => new OrdersRepository(organizationId), [organizationId]);
    useEffect(() => {
        repository.activate();
        void repository.refresh();
        const refresh = () => { void repository.refresh(); };
        window.addEventListener("focus", refresh);
        const timer = window.setInterval(refresh, 60_000);
        return () => { repository.deactivate(); window.removeEventListener("focus", refresh); window.clearInterval(timer); };
    }, [repository]);
    return <OrdersContext.Provider value={repository}>{children}</OrdersContext.Provider>;
}

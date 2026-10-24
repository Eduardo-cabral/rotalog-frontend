import type { ReactNode } from "react";

import { NavLink } from "react-router-dom";

import { appRoutes } from "../../app/routePermissions";
import {SupplierIcon, type IconName} from "./SupplierVisuals";
import type { Permission } from "../../features/auth/mocks/users.mock";

type PortalType = "supplier" | "buyer";

type SidebarProps = {
    permissions: Permission[];
    portal?: PortalType;
    pendingOrdersCount?: number;
    organizationName?: string;
    onLogout?: () => void;
    developmentControls?: ReactNode;
};

const buyerRoutes = [
    {
        path: "/comprador/carrinho",
        label: "Meu carrinho",
        permission: "purchases:view" as Permission,
    },
    {
        path: "/comprador/compras",
        label: "Minhas compras",
        permission: "purchases:view" as Permission,
    },
];

export function Sidebar({
    permissions,
    portal = "supplier",
    pendingOrdersCount = 0,
    organizationName,
    onLogout,
    developmentControls,
}: SidebarProps) {
    const routes =
        portal === "buyer" ? buyerRoutes : appRoutes;

    const visibleItems = routes.filter((route) =>
        permissions.includes(route.permission)
    );

    if (portal === "supplier") {
        const icons: Record<string, IconName> = {"/fornecedor": "home", "/fornecedor/pedidos": "orders", "/fornecedor/produtos": "products", "/fornecedor/estoque": "inventory", "/fornecedor/rotas": "routes"};
        const supplierItems = appRoutes.filter(route => permissions.includes(route.permission) || route.path === "/fornecedor/rotas");
        return <aside className="supplier-sidebar">
            <NavLink to="/fornecedor" className="supplier-brand"><span className="supplier-brand-mark" aria-hidden="true">↯</span><span>Rota<span className="text-blue-600">Log</span></span></NavLink>
            <p className="supplier-nav-caption">ÁREA DO FORNECEDOR</p>
            <nav aria-label="Menu principal" className="space-y-1">{supplierItems.map(route => <NavLink key={route.path} to={route.path} end={route.path === "/fornecedor"} className={({isActive}) => `supplier-nav-link ${isActive ? "is-active" : ""}`}><SupplierIcon name={icons[route.path] ?? "home"}/><span>{route.label}</span>{route.path === "/fornecedor/pedidos" && pendingOrdersCount > 0 && <span className="supplier-nav-count" aria-label={`${pendingOrdersCount} ${pendingOrdersCount === 1 ? "pedido aguardando aceite" : "pedidos aguardando aceite"}`} aria-live="polite">{pendingOrdersCount}</span>}</NavLink>)}</nav>
            <div className="supplier-sidebar-bottom">
                {import.meta.env.DEV && developmentControls}
                <NavLink to="/fornecedor/conta" className={({isActive}) => `supplier-nav-link ${isActive ? "is-active" : ""}`}><SupplierIcon name="account"/>Minha conta</NavLink>
                {organizationName && <p className="mt-4 break-words px-3 text-xs text-slate-500">{organizationName}</p>}
                {onLogout && <button type="button" className="supplier-nav-link supplier-logout" onClick={onLogout}>Sair</button>}
            </div>
        </aside>;
    }

    return <aside className="h-full w-64 overflow-y-auto bg-slate-900 p-5 text-white">
        <div className="mb-10"><NavLink to="/" className="block text-2xl font-bold text-white">RotaLog</NavLink><p className="mt-1 text-sm text-slate-400">Portal do Comprador</p></div>
        <nav aria-label="Menu principal" className="space-y-2">{visibleItems.map(route=><NavLink key={route.path} to={route.path} end={route.path === "/comprador/carrinho"} className={({isActive})=>`flex items-center justify-between gap-2 rounded-lg px-4 py-3 text-sm transition-colors ${isActive ? "bg-blue-600 text-white" : "text-slate-300 hover:bg-slate-800 hover:text-white"}`}>{route.label}</NavLink>)}</nav>
        <div className="mt-8 border-t border-slate-700 pt-5"><NavLink to="/" className="block rounded-lg px-4 py-3 text-sm text-slate-300 transition-colors hover:bg-slate-800 hover:text-white">Voltar ao catálogo</NavLink></div>
    </aside>;
}

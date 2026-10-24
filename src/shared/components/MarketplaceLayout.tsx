
import { useState } from "react";
import {
    Link,
    NavLink,
    Outlet,
    useLocation,
} from "react-router-dom";

import { useAuth } from "../../features/auth/hooks/useAuth";
import { useLogout } from "../../features/auth/hooks/useLogout";
import { useCart } from "../../features/cart/hooks/useCart";
import { BuyerIcon } from "../../features/buyer/components/BuyerVisuals";
import { buyerAuthorized } from "../../features/services/apiAuth.service";
import { authMode } from "../api/config";

function CartIcon() {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-5 w-5 shrink-0"
            aria-hidden="true"
        >
            <path d="M3 3h2l2.4 12h11.2l2-8H6" />
            <path d="M8 11h11M11 7v8M16 7v8" />
            <circle cx="9" cy="20" r="1" />
            <circle cx="18" cy="20" r="1" />
        </svg>
    );
}

function MenuIcon({ kind }: { kind: "catalog" | "purchases" | "account" }) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-5 w-5 shrink-0"
            aria-hidden="true"
        >
            {kind === "catalog" && (
                <>
                    <rect x="3" y="3" width="7" height="7" rx="1" />
                    <rect x="14" y="3" width="7" height="7" rx="1" />
                    <rect x="3" y="14" width="7" height="7" rx="1" />
                    <rect x="14" y="14" width="7" height="7" rx="1" />
                </>
            )}
            {kind === "purchases" && (
                <>
                    <path d="M6 7h12l1 14H5L6 7Z" />
                    <path d="M9 8V6a3 3 0 0 1 6 0v2M9 14l2 2 4-4" />
                </>
            )}
            {kind === "account" && (
                <>
                    <circle cx="12" cy="7" r="4" />
                    <path d="M4 21v-2a8 8 0 0 1 16 0v2" />
                </>
            )}
        </svg>
    );
}

const navigation = [
    { label: "Catálogo de produtos", to: "/" },
    { label: "Minhas compras", to: "/comprador/compras" },
    { label: "Meu carrinho", to: "/comprador/carrinho" },
];

export function MarketplaceLayout() {
    const [menuOpen, setMenuOpen] = useState(false);
    const [search, setSearch] = useState("");

    const { user, isAuthenticated } = useAuth();
    const { suppliers } = useCart();
    const logout = useLogout();
    const location = useLocation();

    const isCatalog = location.pathname === "/";

    const cartCount = suppliers.reduce(
        (total, supplier) =>
            total +
            supplier.items.reduce(
                (count, item) => count + item.quantity,
                0
            ),
        0
    );
    const visibleNavigation = navigation.filter(item => {
        if (authMode !== "api") return true;
        if (item.to === "/") return !!user && buyerAuthorized(user, "catalog:read");
        if (item.to === "/comprador/compras") return !!user && buyerAuthorized(user, "purchase:read");
        return !!user && buyerAuthorized(user, "checkout:create");
    });
    const canUseCart = authMode !== "api" || (!!user && buyerAuthorized(user, "checkout:create"));

    function closeMenu() {
        setMenuOpen(false);
    }

    return (
        <div className="min-h-screen bg-[#f7f9fc] text-slate-900">
            <header className="sticky top-0 z-50 border-b border-slate-200 bg-white">
                <div className="flex h-16 items-center gap-3 px-4 sm:px-6">
                    <button
                        type="button"
                        onClick={() => setMenuOpen((open) => !open)}
                        aria-label={menuOpen ? "Fechar menu" : "Abrir menu"}
                        aria-expanded={menuOpen}
                        aria-controls="marketplace-sidebar"
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-700 lg:hidden"
                    >
                        {menuOpen ? "✕" : "☰"}
                    </button>

                    <Link
                        to="/"
                        onClick={closeMenu}
                        className="flex shrink-0 items-center gap-2"
                    >
                        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-700 text-base font-bold text-white">
                            R
                        </span>

                        <span className="text-lg font-extrabold tracking-tight">
                            RotaLog
                        </span>
                    </Link>

                    <div className="mx-auto hidden w-full max-w-[440px] md:block">
                        {isCatalog ? (
                            <label className="relative block">
                                <BuyerIcon name="search" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"/>
                                <input
                                    type="search"
                                    value={search}
                                    onChange={(event) => setSearch(event.target.value)}
                                    placeholder="Buscar produtos ou fornecedores..."
                                    aria-label="Buscar produtos"
                                    className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-4 text-sm outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100"
                                />
                            </label>
                        ) : (
                            <p className="text-center text-xs font-medium text-slate-500">
                                Marketplace RotaLog
                            </p>
                        )}
                    </div>

                    <div className="ml-auto flex shrink-0 items-center gap-2">
                        {canUseCart && <Link
                            to="/comprador/carrinho"
                            aria-label={`Carrinho de compras, ${cartCount} ${cartCount === 1 ? "item" : "itens"}`}
                            title="Meu carrinho"
                            className="inline-flex h-9 items-center rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                        >
                            <CartIcon />
                            {cartCount > 0 && (
                                <span className="ml-1.5 rounded-md bg-blue-50 px-1.5 py-0.5 text-[11px] text-blue-700">
                                    {cartCount}
                                </span>
                            )}
                        </Link>}

                        {isAuthenticated ? (
                            <button
                                type="button"
                                onClick={() => void logout()}
                                className="inline-flex h-9 items-center rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-700 transition hover:bg-red-50 hover:text-red-700"
                            >
                                Sair
                            </button>
                        ) : (
                            <Link
                                to="/login"
                                className="inline-flex h-9 items-center rounded-lg bg-blue-700 px-3 text-xs font-semibold text-white transition hover:bg-blue-800"
                            >
                                Entrar
                            </Link>
                        )}
                    </div>
                </div>

                {isCatalog && (
                    <div className="border-t border-slate-100 px-4 py-2 md:hidden">
                        <label className="relative block">
                            <BuyerIcon name="search" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"/>
                            <input
                                type="search"
                                value={search}
                                onChange={(event) => setSearch(event.target.value)}
                                placeholder="Buscar produtos..."
                                aria-label="Buscar produtos"
                                className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-3 text-sm outline-none placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100"
                            />
                        </label>
                    </div>
                )}
            </header>

            {menuOpen && (
                <button
                    type="button"
                    aria-label="Fechar menu lateral"
                    onClick={closeMenu}
                    className="fixed inset-0 z-40 bg-slate-950/40 lg:hidden"
                />
            )}

            <div className="flex min-h-[calc(100vh-64px)]">
                <aside
                    id="marketplace-sidebar"
                    className={`fixed inset-y-0 left-0 z-50 w-[230px] overflow-y-auto border-r border-slate-200 bg-white px-3 py-4 shadow-xl transition-transform duration-200 lg:sticky lg:top-16 lg:z-auto lg:h-[calc(100vh-64px)] lg:shrink-0 lg:translate-x-0 lg:shadow-none ${menuOpen ? "translate-x-0" : "-translate-x-full"
                        }`}
                >
                    <div className="mb-5 flex items-center justify-between border-b border-slate-100 pb-3 lg:hidden">
                        <span className="text-sm font-bold">Menu do comprador</span>

                        <button
                            type="button"
                            onClick={closeMenu}
                            aria-label="Fechar menu"
                            className="rounded-lg p-2 text-slate-600 hover:bg-slate-100"
                        >
                            ✕
                        </button>
                    </div>

                    <nav aria-label="Menu do comprador" className="space-y-1">
                        {visibleNavigation.map((item) => (
                            <NavLink
                                key={item.to}
                                to={item.to}
                                end={item.to === "/"}
                                onClick={closeMenu}
                                className={({ isActive }) =>
                                    `block rounded-lg px-3 py-2.5 text-[13px] font-medium transition ${isActive
                                        ? "bg-blue-50 font-semibold text-blue-700"
                                        : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                                    }`
                                }
                            >
                                <span className="flex items-center gap-2">
                                    {item.to === "/comprador/carrinho" ? <CartIcon /> : <MenuIcon kind={item.to === "/" ? "catalog" : "purchases"} />}
                                    {item.label}
                                </span>
                            </NavLink>
                        ))}

                        <Link
                            to={isAuthenticated ? "/comprador/conta" : "/login"}
                            onClick={closeMenu}
                            className="block rounded-lg px-3 py-2.5 text-[13px] font-medium text-slate-600 transition hover:bg-slate-50"
                        >
                            <span className="flex items-center gap-2">
                                <MenuIcon kind="account" />
                                Minha conta
                            </span>
                        </Link>
                    </nav>

                    <div className="mt-7 rounded-xl border border-slate-200 bg-slate-50 p-3.5">
                        <p className="text-[13px] font-bold">
                            Venda no RotaLog
                        </p>

                        <p className="mt-2 text-xs leading-5 text-slate-500">
                            Cadastre sua empresa e alcance novos compradores.
                        </p>

                        <Link
                            to="/cadastro"
                            onClick={closeMenu}
                            className="mt-3 inline-block text-xs font-semibold text-blue-700 hover:underline"
                        >
                            Começar agora →
                        </Link>
                    </div>

                    {user && (
                        <div className="mt-6 border-t border-slate-100 px-1 pt-4">
                            <p className="text-[11px] text-slate-500">
                                Conectado como
                            </p>

                            <p className="mt-1 truncate text-xs font-semibold">
                                {user.name}
                            </p>
                            {user.organizations?.find(org => org.id === user.organization_id)?.name && <p className="mt-1 break-words text-xs text-slate-500">{user.organizations.find(org => org.id === user.organization_id)?.name}</p>}
                        </div>
                    )}
                </aside>

                <div className="flex min-w-0 flex-1 flex-col">
                    <main className="w-full min-w-0 flex-1 px-4 py-5 sm:px-6 lg:px-7">
                        <div className="mx-auto w-full max-w-[1120px]">
                            <Outlet context={{ search }} />
                        </div>
                    </main>

                    <footer className="border-t border-slate-200 bg-white px-4 py-4 text-center text-[11px] text-slate-600">
                        © 2026 RotaLog. Todos os direitos reservados.
                    </footer>
                </div>
            </div>
        </div>
    );
}

import { useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { Link, NavLink, Outlet } from "react-router-dom";
import { adminAuthorized } from "../../services/apiAuth.service";
import { useAuth } from "../../auth/hooks/useAuth";
import { useLogout } from "../../auth/hooks/useLogout";
import type { CatalogProduct } from "../../products/api/catalogRepository";

export type PublicationStatus = "not-started" | "attempting" | "uncertain" | "rejected" | "published";
export type AdminWorkflow = {
    createdProduct: CatalogProduct | null;
    setCreatedProduct: Dispatch<SetStateAction<CatalogProduct | null>>;
    creationUncertain: boolean;
    setCreationUncertain: Dispatch<SetStateAction<boolean>>;
    publicationStatus: PublicationStatus;
    setPublicationStatus: Dispatch<SetStateAction<PublicationStatus>>;
    publishedProduct: CatalogProduct | null;
    setPublishedProduct: Dispatch<SetStateAction<CatalogProduct | null>>;
};
const navigation = [
    { to: "/admin", label: "Visão geral", end: true },
    { to: "/admin/products", label: "Produtos publicados", end: false },
    { to: "/admin/products/new", label: "Cadastrar produto", end: false },
];

export function AdminLayout() {
    const { user } = useAuth();
    const logout = useLogout();
    const [createdProduct, setCreatedProduct] = useState<CatalogProduct | null>(null);
    const [creationUncertain, setCreationUncertain] = useState(false);
    const [publicationStatus, setPublicationStatus] = useState<PublicationStatus>("not-started");
    const [publishedProduct, setPublishedProduct] = useState<CatalogProduct | null>(null);
    const workflow = useMemo(() => ({
        createdProduct, setCreatedProduct, creationUncertain, setCreationUncertain,
        publicationStatus, setPublicationStatus, publishedProduct, setPublishedProduct,
    }), [createdProduct, creationUncertain, publicationStatus, publishedProduct]);
    const organization = user?.organizations?.find(item => item.id === user.organization_id);
    const canWriteProducts = !!user && adminAuthorized(user, "product:write");

    return <div className="min-h-screen bg-slate-50 text-slate-900">
            <header className="border-b border-slate-200 bg-white">
                <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
                    <Link to="/admin" className="flex items-center gap-3" aria-label="RotaLog administração">
                        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-900 to-blue-700 text-lg font-bold text-white shadow-sm">R</span>
                        <span><span className="block text-lg font-extrabold tracking-tight">RotaLog</span><span className="block text-xs font-medium text-slate-500">Portal administrativo</span></span>
                    </Link>
                    <div className="flex items-center gap-3">
                        <span className="hidden text-right sm:block"><span className="block text-sm font-semibold">{user?.name}</span><span className="block text-xs text-slate-500">{organization?.name ?? "Conta administrativa"}</span></span>
                        <button type="button" onClick={() => void logout()} className="min-h-10 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700">Sair</button>
                    </div>
                </div>
            </header>
            <main className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-4 py-6 sm:px-6 sm:py-8 lg:flex-row lg:items-start lg:px-8">
                <nav aria-label="Menu administrativo" className="flex shrink-0 flex-wrap gap-1 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm lg:sticky lg:top-6 lg:w-60 lg:flex-col">
                    <p className="hidden px-3 pb-2 pt-1 text-xs font-bold uppercase tracking-[0.12em] text-slate-400 lg:block">Catálogo</p>
                    {navigation.filter(item => item.label !== "Cadastrar produto" || canWriteProducts).map(item =>
                        <NavLink key={item.to} to={item.to} end={item.end} className={({ isActive }) => `rounded-xl px-3 py-2.5 text-sm font-semibold transition ${isActive ? "bg-blue-50 text-blue-900 ring-1 ring-inset ring-blue-100" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"}`}>{item.label}</NavLink>
                    )}
                    <span className="hidden border-t border-slate-100 lg:block"/>
                    <NavLink to="/admin/account" className={({ isActive }) => `rounded-xl px-3 py-2.5 text-sm font-semibold transition ${isActive ? "bg-blue-50 text-blue-900 ring-1 ring-inset ring-blue-100" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"}`}>Minha conta</NavLink>
                </nav>
                <div className="min-w-0 flex-1">
                    <Outlet context={workflow}/>
                </div>
            </main>
            <footer className="border-t border-slate-200 bg-white px-4 py-4 text-center text-xs text-slate-500">RotaLog · Portal administrativo</footer>
        </div>;
}

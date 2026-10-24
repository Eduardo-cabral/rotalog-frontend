import {useEffect, useRef} from "react";
import {Link, useLocation} from "react-router-dom";
import {SupplierIcon} from "./SupplierVisuals";

export function SupplierHeader({name, organization, onLogout}: {name: string; organization: string; onLogout: () => void}) {
    const details = useRef<HTMLDetailsElement>(null);
    const summary = useRef<HTMLElement>(null);
    const {pathname} = useLocation();
    const initials = name.trim().split(/\s+/).slice(0, 2).map(part => part.charAt(0)).join("").toUpperCase();
    useEffect(() => {details.current?.removeAttribute("open");}, [pathname]);
    useEffect(() => {
        function close(event: MouseEvent | KeyboardEvent) {
            if (event instanceof KeyboardEvent) {
                if (event.key === "Escape" && details.current?.open) {details.current.open = false; summary.current?.focus();}
            } else if (event.target instanceof Node && !details.current?.contains(event.target)) details.current?.removeAttribute("open");
        }
        document.addEventListener("click", close); document.addEventListener("keydown", close);
        return () => {document.removeEventListener("click", close); document.removeEventListener("keydown", close);};
    }, []);
    return <header className="supplier-topbar">
        <span className="supplier-topbar-caption">Portal do fornecedor</span>
        <details ref={details} className="supplier-profile">
            <summary ref={summary} aria-label="Abrir perfil do usuário" className="supplier-profile-trigger"><span className="supplier-avatar" aria-hidden="true">{initials}</span><span className="supplier-profile-copy"><strong>{name}</strong><span>{organization} · Fornecedor</span></span><span aria-hidden="true">⌄</span></summary>
            <div className="supplier-profile-panel"><p className="text-xs text-slate-500">Sua sessão</p><p className="mt-1 break-words font-semibold">{name}</p><Link to="/fornecedor/conta"><SupplierIcon name="account"/>Minha conta</Link><button type="button" onClick={onLogout} className="text-red-700">Sair da conta</button></div>
        </details>
    </header>;
}

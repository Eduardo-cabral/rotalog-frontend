import { authMode } from "../api/config";
import { useAuth } from "../../features/auth/hooks/useAuth";
import { supplierPermissions } from "../../features/services/apiAuth.service";
import { useApiPendingOrders } from "../../features/orders/api/ordersContext";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Outlet,
  useLocation,
  useNavigate,
} from "react-router-dom";

import { getSupplierOrders, subscribeSupplierOrders } from "../../features/orders/services/supplierOrders.service";

import { Sidebar } from "./Sidebar";
import { SupplierHeader } from "./SupplierHeader";
import { SupplierDevControls } from "./SupplierDevControls";
import { useLogout } from "../../features/auth/hooks/useLogout";

import { usersMock } from "../../features/auth/mocks/users.mock";

import { organizationsMock } from "../../features/organizations/mocks/organizations.mock";

import {
  canAccessRoute,
  getFirstAllowedRoute,
  getRoutePermission,
} from "../../app/routePermissions";

export function AppLayout() {
  const { user: sessionUser } = useAuth();
  const apiMode = authMode === "api";
  const navigate = useNavigate();
  const logout = useLogout();
  const location = useLocation();

  // Usuário ativo no ambiente de demonstração
  const [activeUserId, setActiveUserId] = useState(
    usersMock[0]?.id ?? ""
  );

  // Organização ativa
  const [activeOrganizationId, setActiveOrganizationId] =
    useState(organizationsMock[0]?.id ?? "");

  const [supplierOrders, setSupplierOrders] = useState(() => apiMode ? [] : getSupplierOrders());
  const apiPendingOrders = useApiPendingOrders();

  useEffect(() => {
    if (apiMode) return;
    return subscribeSupplierOrders(() => { setSupplierOrders(getSupplierOrders()); });
  }, [apiMode]);

  const pendingOrdersCount = apiMode ? apiPendingOrders : supplierOrders.filter((order) =>
    order.organizationId === activeOrganizationId &&
    order.commercialStatus === "Aguardando aceite"
  ).length;

  // Controle do menu mobile
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDialogElement>(null);
  const menuTriggerRef = useRef<HTMLButtonElement>(null);
  const menuCloseRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 768px)");
    const handleResize = () => { if (desktop.matches) setMenuOpen(false); };
    desktop.addEventListener("change", handleResize);
    return () => desktop.removeEventListener("change", handleResize);
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const dialog = menuRef.current;
    const trigger = menuTriggerRef.current;
    dialog?.showModal();
    menuCloseRef.current?.focus();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      dialog?.close();
      document.body.style.overflow = overflow;
      if (trigger?.getClientRects().length) trigger.focus();
      else document.getElementById("supplier-main-content")?.focus();
    };
  }, [menuOpen]);

  // Identifica o usuário selecionado
  const activeUser = apiMode && sessionUser ? {
    ...sessionUser,
    organizationIds: sessionUser.organizations?.map(org => org.id) ?? [],
    permissions: supplierPermissions(sessionUser),
  } : usersMock.find(
    (user) => user.id === activeUserId
  );

  // Exibe somente organizações vinculadas ao usuário
  const allowedOrganizations = (apiMode ? sessionUser?.organizations ?? [] : organizationsMock).filter(
    (organization) =>
      activeUser?.organizationIds.includes(organization.id)
  );

  // Identifica a organização ativa e autorizada
  const activeOrganization = allowedOrganizations.find(
    (organization) =>
      organization.id === (apiMode ? sessionUser?.organization_id : activeOrganizationId)
  );

  // Troca o usuário simulado
  function handleUserChange(userId: string) {
    const selectedUser = usersMock.find(
      (user) => user.id === userId
    );

    if (!selectedUser) return;

    const firstAllowedOrganization = organizationsMock.find(
      (organization) =>
        selectedUser.organizationIds.includes(organization.id)
    );

    const firstAllowedRoute = getFirstAllowedRoute(
      selectedUser.permissions
    );

    setActiveUserId(selectedUser.id);

    setActiveOrganizationId(
      firstAllowedOrganization?.id ?? ""
    );

    setMenuOpen(false);

    // Direciona para a primeira página permitida
    if (firstAllowedRoute) {
      navigate(firstAllowedRoute, { replace: true });
    }
  }

  // Impede exibição sem usuário ou organização válida
  if (!activeUser || !activeOrganization) {
    return (
      <div
        role="alert"
        className="flex min-h-screen items-center justify-center bg-slate-100 p-6"
      >
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h1 className="text-xl font-semibold text-slate-900">
            Acesso indisponível
          </h1>

          <p className="mt-2 text-sm text-slate-600">
            Não foi possível identificar um usuário ou
            organização autorizada.
          </p>
        </div>
      </div>
    );
  }

  // Verifica a permissão utilizando a configuração centralizada
  const routeExists =
    getRoutePermission(location.pathname) !== undefined || location.pathname === "/fornecedor/conta";

  const hasAccess = location.pathname === "/fornecedor/conta" || canAccessRoute(
    location.pathname,
    activeUser.permissions
  );

  return (
    <div data-supplier-ui className="flex min-h-screen bg-slate-100 text-slate-900">
      <a href="#supplier-main-content" className="sr-only z-[120] rounded-lg bg-white px-4 py-2 text-sm font-semibold text-blue-700 focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:outline-2 focus:outline-blue-600">Ir para o conteúdo</a>
      {/* Sidebar desktop */}
      <div className="sticky top-0 hidden h-dvh shrink-0 self-start md:block">
        <Sidebar
          permissions={activeUser.permissions}
          pendingOrdersCount={pendingOrdersCount}
          organizationName={activeOrganization.name}
          onLogout={() => void logout()}
          developmentControls={!apiMode && import.meta.env.DEV ? <SupplierDevControls
            organizations={allowedOrganizations}
            users={usersMock}
            organizationId={activeOrganization.id}
            userId={activeUser.id}
            onOrganizationChange={setActiveOrganizationId}
            onUserChange={handleUserChange}
          /> : undefined}
        />
      </div>

      {/* Sidebar mobile */}
      {menuOpen && createPortal(
        <dialog ref={menuRef} id="supplier-mobile-menu" data-supplier-ui aria-label="Menu do fornecedor" aria-modal="true" onCancel={(event) => { event.preventDefault(); setMenuOpen(false); }} onClick={(event) => {
          if (event.target !== event.currentTarget) return;
          const bounds = event.currentTarget.getBoundingClientRect();
          if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) setMenuOpen(false);
        }} className="fixed inset-0 m-0 h-dvh max-h-none w-64 max-w-[calc(100%_-_2rem)] overflow-y-auto border-0 bg-slate-900 p-0 text-white shadow-xl backdrop:bg-slate-950/60 md:hidden">
          <div className="flex h-12 items-center justify-end px-3"><button ref={menuCloseRef} type="button" aria-label="Fechar menu" onClick={() => setMenuOpen(false)} className="rounded-lg px-3 py-2 text-sm text-slate-200 hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-blue-400">✕ Fechar</button></div>
          <div className="h-[calc(100dvh_-_3rem)]" onClick={(event) => { if (event.target instanceof Element && event.target.closest("a[href]")) setMenuOpen(false); }}>
            <Sidebar
          permissions={activeUser.permissions}
          pendingOrdersCount={pendingOrdersCount}
          organizationName={activeOrganization.name}
          onLogout={() => void logout()}
          developmentControls={!apiMode && import.meta.env.DEV ? <SupplierDevControls
            organizations={allowedOrganizations}
            users={usersMock}
            organizationId={activeOrganization.id}
            userId={activeUser.id}
            onOrganizationChange={setActiveOrganizationId}
            onUserChange={handleUserChange}
          /> : undefined}
        />
          </div>
        </dialog>, document.body
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <SupplierHeader name={sessionUser?.name ?? activeUser.name} organization={activeOrganization.name} onLogout={()=>void logout()}/>
        {/* Botão do menu mobile */}
        <div className="border-b border-slate-200 bg-white px-4 py-3 md:hidden">
          <button
            ref={menuTriggerRef}
            type="button"
            onClick={() => { if (!window.matchMedia("(min-width: 768px)").matches) setMenuOpen(true); }}
            aria-label="Abrir menu"
            aria-expanded={menuOpen}
            aria-haspopup="dialog"
            aria-controls={menuOpen ? "supplier-mobile-menu" : undefined}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
          >
            ☰ Menu
          </button>
        </div>

        <main id="supplier-main-content" tabIndex={-1} className="w-full min-w-0 flex-1 p-4 outline-none sm:p-6">
          {!routeExists ? (
            <div
              role="alert"
              className="mx-auto max-w-7xl rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
            >
              <p className="text-sm font-semibold text-blue-700">
                Erro 404
              </p>

              <h1 className="mt-2 text-2xl font-bold text-slate-900">
                Página não encontrada
              </h1>

              <p className="mt-2 text-sm text-slate-600">
                A página solicitada não existe no RotaLog.
                Verifique o endereço informado.
              </p>
            </div>
          ) : !hasAccess ? (
            <div
              role="alert"
              className="mx-auto max-w-7xl rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
            >
              <p className="text-sm font-semibold text-red-700">
                Erro 403
              </p>

              <h1 className="mt-2 text-2xl font-bold text-slate-900">
                Acesso não autorizado
              </h1>

              <p className="mt-2 text-sm text-slate-600">
                Este usuário não possui permissão para acessar
                esta página.
              </p>
            </div>
          ) : (
            <>
              <Outlet context={{ activeOrganization }} />
            </>
          )}
        </main>


        {/* Rodapé */}
        <footer className="border-t border-slate-200 bg-white px-4 py-3 text-center text-xs text-slate-500">
          RotaLog © 2026 — Todos os direitos reservados.
        </footer>
      </div>
    </div>
  );
}

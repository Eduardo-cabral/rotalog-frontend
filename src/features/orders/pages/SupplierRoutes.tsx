import { Link } from "react-router-dom";
import { authMode } from "../../../shared/api/config";
import { PageHeader } from "../../../shared/components/PageHeader";
import { StatusBadge, SupplierIcon } from "../../../shared/components/SupplierVisuals";
import { useApiOrders } from "../api/ordersContext";
import { formatMoney, orderLabel } from "../api/orderAdapter";
import { readableOrderState } from "../api/orderPresentation";

function ApiSupplierRoutes() {
    const { orders, loading, loaded, error, repository } = useApiOrders();
    const readyOrders = orders.filter(order => order.state === "READY_TO_DISPATCH");

    return <div className="space-y-6">
        <PageHeader title="Rotas e acompanhamento" subtitle="Organize a coleta dos pedidos preparados." />
        <section className="rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm leading-6 text-blue-950">
            <h2 className="font-semibold">A atribuição de motoristas estará disponível em breve.</h2>
            <p className="mt-1">O estado do pedido informa a preparação. A coleta e a entrega só aparecem após confirmação.</p>
        </section>
        <section aria-labelledby="ready-orders-heading" className="space-y-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                    <h2 id="ready-orders-heading" className="text-lg font-semibold text-slate-900">Pedidos prontos para coleta</h2>
                    <p className="mt-1 text-sm text-slate-600">Confira os pedidos aptos a avançar para a logística.</p>
                </div>
                <button type="button" disabled={loading} onClick={() => void repository.refresh()} className="rounded-lg border border-blue-300 px-3 py-2 text-sm font-semibold text-blue-700 disabled:cursor-not-allowed disabled:opacity-50">Atualizar pedidos</button>
            </div>
            {loading && <p role="status" aria-live="polite" className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-600">Consultando pedidos do fornecedor…</p>}
            {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-5">
                <h3 className="font-semibold text-red-900">Não foi possível consultar os pedidos</h3>
                <p className="mt-2 text-sm text-red-800">{error}</p>
                <button type="button" disabled={loading} onClick={() => void repository.refresh()} className="mt-3 rounded-lg border border-red-300 px-3 py-2 text-sm font-semibold text-red-800 disabled:opacity-50">Tentar novamente</button>
            </div>}
            {loaded && !error && readyOrders.length === 0 && <div role="status" className="rounded-xl border border-slate-200 bg-white p-6 text-center">
                <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-600"><SupplierIcon name="routes" className="h-7 w-7" /></span>
                <h3 className="mt-3 font-semibold text-slate-900">Nenhum pedido pronto para coleta</h3>
                <p className="mt-1 text-sm text-slate-600">Quando a preparação de um pedido for concluída, ele aparecerá aqui.</p>
                <Link to="/fornecedor/pedidos" className="mt-4 inline-flex rounded-lg px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50">Consultar todos os pedidos</Link>
            </div>}
            {loaded && !error && readyOrders.length > 0 && <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {readyOrders.map(order => <li key={order.id} className="min-w-0 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                        <h3 className="min-w-0 break-all font-semibold text-slate-900">{orderLabel(order, orders)}</h3>
                        <StatusBadge tone="progress">{readableOrderState(order.state)}</StatusBadge>
                    </div>
                    <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                        <div><dt className="text-xs text-slate-500">Itens</dt><dd className="mt-1 text-slate-700">{order.items.length}</dd></div>
                        <div><dt className="text-xs text-slate-500">Valor do pedido</dt><dd className="mt-1 font-semibold text-slate-900">{formatMoney(order.total)}</dd></div>
                    </dl>
                    <p className="mt-4 rounded-lg bg-slate-50 p-3 text-xs leading-5 text-slate-600">A preparação concluída não confirma coleta ou entrega.</p>
                    <Link to={`/fornecedor/pedidos?order=${encodeURIComponent(order.id)}`} className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-lg border border-blue-300 px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600">
                        Ver detalhes do pedido
                        <SupplierIcon name="arrow" />
                    </Link>
                </li>)}
            </ul>}
        </section>
    </div>;
}

function MockRoutesNotice() {
    return <div className="space-y-6">
        <PageHeader title="Rotas e acompanhamento" subtitle="Visibilidade de pedidos prontos e das informações logísticas confirmadas." />
        <section className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-950">
            <StatusBadge tone="warning">Consulta indisponível</StatusBadge>
            <h2 className="mt-4 text-lg font-semibold">Os pedidos prontos não estão disponíveis neste modo</h2>
            <p className="mt-2 leading-6">Acesse o portal conectado para consultar os pedidos preparados para coleta.</p>
        </section>
    </div>;
}

export function SupplierRoutes() {
    return authMode === "api" ? <ApiSupplierRoutes /> : <MockRoutesNotice />;
}

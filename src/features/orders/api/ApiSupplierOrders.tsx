import {orderTone} from "../../../shared/components/supplierStatus";
import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useApiOrders } from "./ordersContext";
import { adaptOrder, apiStages, formatMoney, orderLabel } from "./orderAdapter";
import { ApiOrderDeadline } from "./ApiOrderDeadline";
import { ApiOrderDetails } from "./ApiOrderDetails";
import {StatusBadge} from "../../../shared/components/SupplierVisuals";
import { preparationMessage, readableOrderState } from "./orderPresentation";

export function ApiOrdersStatus() {
    const { loading, error, repository } = useApiOrders();
    return <>{loading && <p role="status" className="rounded-lg bg-blue-50 p-3 text-sm text-blue-700">Consultando todas as páginas de pedidos…</p>}{error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error} <button type="button" onClick={() => void repository.refresh()} className="ml-2 font-semibold underline">Tentar novamente</button></div>}</>;
}
export function ApiSupplierOrders() {
    const { orders, loading, loaded, error, repository } = useApiOrders();
    const [searchParams, setSearchParams] = useSearchParams();
    const [search, setSearch] = useState("");
    const [tab, setTab] = useState<"active" | "history">("active");
    const [stateFilter, setStateFilter] = useState("");
    const selected = searchParams.get("order");
    function openDetails(id: string) {
        const next = new URLSearchParams(searchParams);
        next.set("order", id);
        setSearchParams(next);
    }
    function closeDetails() {
        const next = new URLSearchParams(searchParams);
        next.delete("order");
        setSearchParams(next, { replace: true });
    }
    const views = orders.map(adaptOrder);
    const query = search.trim().toLocaleLowerCase("pt-BR");
    const visible = views.filter(order => (!query || [order.id, order.purchase_id, order.buyer_organization_id, ...order.items.map(item => item.product.name)].some(value => value.toLocaleLowerCase("pt-BR").includes(query))) && (!stateFilter || order.state === stateFilter));
    const active = views.filter(order => order.stage !== "completed");
    const history = views.filter(order => order.stage === "completed");
    function card(order: typeof views[number]) {
        return <article key={order.id} className="min-w-0 shrink-0 rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md [overflow-wrap:anywhere]">
            <h3 className="truncate font-bold text-slate-900">{orderLabel(order, orders)}</h3>
            <div className="mt-2"><StatusBadge tone={orderTone(order.state)}>{readableOrderState(order.state)}</StatusBadge></div>
            <p className="mt-2 text-xs text-slate-500">{order.items.length} linhas · {order.items.reduce((sum, item) => sum + item.requested_quantity, 0)} unidades solicitadas</p>
            <p className="mt-1 text-xs text-slate-600">{order.items.map(item => `${item.product.name} (${item.requested_quantity})`).join(" · ")}</p>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-bold">{formatMoney(order.total)}</p><button type="button" onClick={() => openDetails(order.id)} aria-label={`Ver detalhes do ${orderLabel(order, orders)}`} className="rounded-md px-2 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-50"><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="mr-1 inline h-4 w-4"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg>Ver detalhes</button></div>
            {order.stage === "new" && <ApiOrderDeadline order={order} />}
            <p className="mt-3 border-t border-slate-100 pt-3 text-xs leading-5 text-slate-600">{preparationMessage(order.state)}</p>
        </article>;
    }
    return <div className="flex w-full min-w-0 flex-col gap-5">
        <ApiOrdersStatus />
        <section aria-label="Pesquisa e filtros de pedidos" className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-base font-semibold">Quadro de pedidos</h1><p className="text-sm text-slate-500">{loaded ? `${active.length} pedidos ativos · ${views.filter(order => order.stage === "new").length} aguardando aceite` : "Contagens indisponíveis até a consulta completa"}</p></div><div className="flex w-full min-w-0 flex-wrap gap-2 lg:w-auto"><label className="sr-only" htmlFor="supplier-order-search">Pesquisar pedido, produto ou organização compradora</label><input id="supplier-order-search" type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Pesquisar pedido ou produto..." className="w-full min-w-0 rounded-lg border border-slate-300 px-3 py-2 text-sm sm:w-56" /><label className="sr-only" htmlFor="api-order-state">Filtrar estado</label><select id="api-order-state" value={stateFilter} onChange={event => setStateFilter(event.target.value)} className="max-w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"><option value="">Todos os estados</option>{[...new Set(views.map(order => order.state))].map(state => <option key={state} value={state}>{readableOrderState(state)}</option>)}</select><button type="button" disabled={loading} onClick={() => void repository.refresh()} className="rounded-lg border border-blue-300 px-3 py-2 text-sm font-semibold text-blue-700 disabled:opacity-50">Atualizar pedidos</button></div></div></section>
        <details className="text-xs text-slate-500"><summary className="cursor-pointer font-semibold">Sobre o histórico de pedidos</summary><p className="mt-2">Pedidos entregues ainda permanecem no quadro de pedidos.</p></details>
        <div role="tablist" aria-label="Visualização dos pedidos" className="flex gap-2 border-b border-slate-200" onKeyDown={event => { if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) { event.preventDefault(); const next = event.key === "Home" ? "active" : event.key === "End" ? "history" : tab === "active" ? "history" : "active"; setTab(next); document.getElementById(`api-orders-tab-${next}`)?.focus(); } }}>{(["active", "history"] as const).map(value => <button type="button" key={value} id={`api-orders-tab-${value}`} role="tab" aria-selected={tab === value} aria-controls={`api-orders-panel-${value}`} tabIndex={tab === value ? 0 : -1} onClick={() => setTab(value)} className={`border-b-2 px-4 py-3 text-sm font-semibold ${tab === value ? "border-blue-600 bg-white text-blue-700" : "border-transparent text-slate-600"}`}>{value === "active" ? "Pedidos ativos" : "Histórico"} ({loaded ? value === "active" ? active.length : history.length : "—"})</button>)}</div>
        {loaded && !error && !orders.length && <p role="status" className="rounded-xl border border-slate-200 bg-white p-5 text-sm">Nenhum pedido encontrado para sua organização.</p>}
        {loaded && !error && orders.length>0 && !visible.some(order=>tab === "active" ? order.stage!=="completed" : order.stage==="completed") && (query || stateFilter) && <div role="status" className="rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-950"><p>Nenhum pedido corresponde aos filtros nesta aba.</p><button type="button" className="mt-2 font-semibold underline" onClick={()=>{setSearch("");setStateFilter("");}}>Limpar filtros</button></div>}
        <section id="api-orders-panel-active" role="tabpanel" aria-labelledby="api-orders-tab-active" hidden={tab !== "active"} tabIndex={0} className="w-full min-w-0 max-w-full"><div role="region" aria-label="Rolagem do quadro de pedidos" tabIndex={0} className="flex w-full min-w-0 max-w-full overscroll-contain focus-visible:outline-2 focus-visible:outline-blue-600 max-h-[max(18rem,calc(100dvh_-_12rem))] snap-x snap-mandatory items-start gap-3 overflow-auto pb-4">{apiStages.filter(stage => stage.id !== "unknown" || active.some(order => order.stage === "unknown")).map(stage => <section key={stage.id} aria-label={stage.title} className={`flex w-[min(290px,calc(100vw_-_4rem))] min-w-0 shrink-0 snap-start flex-col rounded-xl border border-slate-200 p-3 sm:w-[290px] ${stage.background}`}><div className="mb-3 flex items-center justify-between gap-2"><h2 className="flex items-center gap-2 text-sm font-bold text-slate-800"><span aria-hidden="true" className={`h-2.5 w-2.5 rounded-full ${stage.dot}`} />{stage.title}</h2><span aria-label={`${views.filter(order => order.stage === stage.id).length} pedidos na etapa ${stage.title}`} className="rounded-full bg-white px-2.5 py-1 text-xs font-bold">{loaded ? views.filter(order => order.stage === stage.id).length : "—"}</span></div><div className="flex flex-col gap-3">{visible.filter(order => order.stage === stage.id).map(card)}{loaded && !visible.some(order => order.stage === stage.id) && <p className="rounded-lg border border-dashed border-slate-300 bg-white/70 px-3 py-8 text-center text-xs text-slate-500">Nenhum pedido nesta etapa</p>}</div></section>)}</div><p className="mt-1 text-xs text-slate-600">Deslize para visualizar as etapas. Abra os detalhes para revisar e confirmar operações.</p></section>
        <section id="api-orders-panel-history" role="tabpanel" aria-labelledby="api-orders-tab-history" hidden={tab !== "history"} tabIndex={0}><p className="mb-3 text-sm text-slate-500">Pedidos finalizados, sem agrupamento por data: o contrato não informa datas de conclusão.</p><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{visible.filter(order => order.stage === "completed").map(card)}</div>{loaded && !history.length && <p className="text-sm text-slate-500">Nenhum pedido no histórico.</p>}</section>
        {selected && <ApiOrderDetails key={selected} id={selected} onClose={closeDetails} />}
    </div>;
}

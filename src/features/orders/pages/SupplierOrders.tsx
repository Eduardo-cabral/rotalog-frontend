import { getOrderStage as getStage, type OrderStage } from "../utils/orderStage";
import { getTestOrderItems } from "../services/testOrderItems";
import { getOrderDisplayIds } from "../utils/orderDisplayId";
import { shortOrderId } from "../api/orderAdapter";
import { useState } from "react";
import { useSupplierOrders } from "../hooks/useSupplierOrders";
import { useOutletContext } from "react-router-dom";

import type { Organization } from "../../organizations/mocks/organizations.mock";
import { OrderColumnFilter } from "../components/OrderColumnFilter";
import { OrderConfirmationModal, type OrderConfirmationAction } from "../components/OrderConfirmationModal";
import { OrderRejectionModal } from "../components/OrderRejectionModal";
import { OrderDetailsModal } from "../components/OrderDetailsModal";
import { OrderHistory } from "../components/OrderHistory";
import { OrderDeadline } from "../components/OrderDeadline";
import { ProductIcon } from "../../products/components/ProductIcon";
import type { SupplierOrder } from "../mocks/orders.mock";
import {
    localSupplierOrderAcceptanceService,
    changeSupplierOrderOperationalStatus,
    changeSupplierOrderStatus,
    readSupplierOrders,
    saveSupplierOrders,
    type SupplierOperationalAction,
    type SupplierOrderAction,
} from "../services/supplierOrders.service";

type OrdersContext = { activeOrganization: Organization };
type Stage = OrderStage;
type FilterColumn = "customer" | "date" | "items" | "total";
type Filters = Record<FilterColumn, string[]>;

const stages: { id: Stage; title: string; dot: string; background: string }[] = [
    { id: "new", title: "Novos", dot: "bg-blue-500", background: "bg-blue-50/70" },
    { id: "accepted", title: "Aceitos", dot: "bg-emerald-500", background: "bg-emerald-50/70" },
    { id: "separating", title: "Em separação", dot: "bg-amber-500", background: "bg-amber-50/70" },
    { id: "ready", title: "Prontos para coleta", dot: "bg-teal-500", background: "bg-teal-50/70" },
    { id: "transport", title: "Em transporte", dot: "bg-violet-500", background: "bg-violet-50/70" },
];

const filterColumns: { key: FilterColumn; title: string }[] = [
    { key: "customer", title: "Cliente" },
    { key: "date", title: "Data" },
    { key: "items", title: "Itens" },
    { key: "total", title: "Valor" },
];

function emptyFilters(): Filters {
    return { customer: [], date: [], items: [], total: [] };
}

const currencyFormatter = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

function formatDate(date: string): string {
    return new Date(`${date}T12:00:00`).toLocaleDateString("pt-BR");
}



function getFilterValue(order: SupplierOrder, column: FilterColumn): string {
    switch (column) {
        case "customer": return order.customer;
        case "date": return order.date;
        case "items": return String(order.items);
        case "total": return String(order.total);
    }
}

function displayFilterValue(column: FilterColumn, value: string): string {
    if (column === "date") return formatDate(value);
    if (column === "total") return currencyFormatter.format(Number(value));
    return value;
}

function CheckIcon() {
    return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4"><path d="m5 12 4 4L19 6" /></svg>;
}

function XIcon() {
    return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="h-4 w-4"><path d="M6 6 18 18M18 6 6 18" /></svg>;
}

export function SupplierOrders() {
    const { activeOrganization } = useOutletContext<OrdersContext>();
    const { orders, error: ordersError } = useSupplierOrders();
    const [rejectionTarget, setRejectionTarget] = useState<{ id: string; organizationId: string } | null>(null);
    const [confirmation, setConfirmation] = useState<{ id: string; organizationId: string; action: OrderConfirmationAction } | null>(null);
    const [search, setSearch] = useState("");
    const [tab, setTab] = useState<"active" | "history">("active");
    const [filtersByColumn, setFiltersByColumn] = useState<Record<string, Filters>>({});
    const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
    const [actionError, setActionError] = useState<string | null>(null);

    if (rejectionTarget && rejectionTarget.organizationId !== activeOrganization.id) {
        setRejectionTarget(null);
    }
    if (confirmation && confirmation.organizationId !== activeOrganization.id) setConfirmation(null);
    const displayIds = getOrderDisplayIds(orders);
    const organizationOrders = orders.filter((order) => order.organizationId === activeOrganization.id);
    const query = search.trim().toLocaleLowerCase("pt-BR");
    function columnKey(stage: Stage) {
        return `${activeOrganization.id}:${stage}`;
    }
    function columnFilters(stage: Stage): Filters {
        return filtersByColumn[columnKey(stage)] ?? emptyFilters();
    }
    function matchesColumnFilters(order: SupplierOrder) {
        const filters = columnFilters(getStage(order));
        return filterColumns.every(({ key }) => filters[key].length === 0 || filters[key].includes(getFilterValue(order, key)));
    }
    const searchedOrders = organizationOrders.filter((order) =>
        !query || (displayIds.get(order.id) ?? order.id).toLocaleLowerCase("pt-BR").includes(query) || order.id.toLocaleLowerCase("pt-BR").includes(query) || order.customer.toLocaleLowerCase("pt-BR").includes(query)
    );
    const activeOrders = organizationOrders.filter(order => getStage(order) !== "completed");
    const completedOrders = organizationOrders.filter(order => getStage(order) === "completed");
    const visibleOrders = searchedOrders.filter(order => getStage(order) !== "completed").filter(matchesColumnFilters);
    const hasFilters = !!query || stages.some((stage) => filterColumns.some(({ key }) => columnFilters(stage.id)[key].length > 0));
    const selectedOrder = organizationOrders.find((order) => order.id === selectedOrderId) ?? null;
    const newCount = organizationOrders.filter((order) => getStage(order) === "new").length;

    function clearFilters() {
        setSearch("");
        setFiltersByColumn((previous) => {
            const next = { ...previous };
            stages.forEach((stage) => { delete next[columnKey(stage.id)]; });
            return next;
        });
    }

    function clearColumnFilters(stage: Stage) {
        setFiltersByColumn((previous) => ({ ...previous, [columnKey(stage)]: emptyFilters() }));
    }

    function toggleFilterValue(stage: Stage, column: FilterColumn, value: string) {
        setFiltersByColumn((previous) => {
            const key = columnKey(stage);
            const filters = previous[key] ?? emptyFilters();
            return { ...previous, [key]: {
                ...filters,
                [column]: filters[column].includes(value)
                    ? filters[column].filter((item) => item !== value)
                    : [...filters[column], value],
            } };
        });
    }

    function createTestOrder() {
        if (!import.meta.env.DEV) return;
        setActionError(null);
        try {
            const id = `TESTE-${Array.from(crypto.getRandomValues(new Uint8Array(16)), (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
            const now = new Date();
            const date = new Intl.DateTimeFormat("sv-SE", {
                timeZone: "America/Manaus",
                year: "numeric", month: "2-digit", day: "2-digit",
            }).format(now);
            const currentOrders = readSupplierOrders();
            const orderItems = getTestOrderItems(activeOrganization.id, currentOrders);
            const testOrder: SupplierOrder = {
                id,
                organizationId: activeOrganization.id,
                customer: `Cliente fictício ${id.slice(-8)}`,
                date,
                total: orderItems.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0),
                items: orderItems.reduce((sum, item) => sum + item.quantity, 0),
                status: "Pendente",
                commercialStatus: "Aguardando aceite",
                financialStatus: "Pendente",
                custodyStatus: "Aguardando separação",
                timeZone: "America/Manaus",
                orderItems,
            };
            // Recarrega o armazenamento para preservar também pedidos salvos em outra aba.
            const updated = [...currentOrders, testOrder];
            saveSupplierOrders(updated);
            setTab("active");
            setSearch("");
            clearColumnFilters("new");
            document.getElementById("supplier-orders-new")?.scrollIntoView({ block: "nearest", inline: "start" });
        } catch (error) {
            setActionError(error instanceof Error ? error.message : "Não foi possível criar o pedido de teste.");
        }
    }

    function applyAction(order: SupplierOrder, action: SupplierOrderAction | SupplierOperationalAction) {
        setActionError(null);
        if (order.organizationId !== activeOrganization.id) {
            setActionError("Este pedido não pertence à organização ativa.");
            return;
        }
        if (action === "reject") {
            setRejectionTarget({ id: order.id, organizationId: order.organizationId });
            return;
        }
        setConfirmation({ id: order.id, organizationId: order.organizationId, action });
    }

    return (
        <div className="flex w-full min-w-0 flex-col gap-5">
            {(actionError || ordersError) && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{actionError || ordersError}</div>}

            <section aria-label="Pesquisa e filtros de pedidos" className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                        <h1 className="text-base font-semibold text-slate-900">Quadro de pedidos</h1>
                        <p aria-live="polite" className="text-sm text-slate-500">{tab === "active" ? `${visibleOrders.length} de ${activeOrders.length} pedidos ativos exibidos · ${newCount} aguardando aceite` : `${completedOrders.length} pedidos no histórico`}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <label htmlFor="supplier-order-search" className="sr-only">Pesquisar pedido ou cliente</label>
                        <input id="supplier-order-search" type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Pesquisar pedido ou cliente..." className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 sm:w-64" />
                        {import.meta.env.DEV && (
                            <button type="button" onClick={createTestOrder} className="rounded-lg border border-blue-300 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600">+ Pedido de teste</button>
                        )}
                        {hasFilters && <button type="button" onClick={clearFilters} className="rounded-lg px-3 py-2 text-sm font-medium text-blue-700 hover:bg-blue-50">Limpar</button>}
                    </div>
                </div>
            </section>

            <div role="tablist" aria-label="Visualização dos pedidos" className="flex flex-wrap gap-2 border-b border-slate-200" onKeyDown={event => {
                if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
                event.preventDefault();
                const next = event.key === "Home" ? "active" : event.key === "End" ? "history" : tab === "active" ? "history" : "active";
                setTab(next);
                document.getElementById(`orders-tab-${next}`)?.focus();
            }}>
                {(["active", "history"] as const).map(value => <button key={value} id={`orders-tab-${value}`} role="tab" aria-selected={tab === value} aria-controls={`orders-panel-${value}`} tabIndex={tab === value ? 0 : -1} type="button" onClick={() => setTab(value)} className={`rounded-t-lg border-b-2 px-4 py-3 text-sm font-semibold focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-blue-600 ${tab === value ? "border-blue-600 bg-white text-blue-700" : "border-transparent text-slate-600 hover:bg-white"}`}>{value === "active" ? "Pedidos ativos" : "Histórico"} <span className="ml-1 text-xs">({value === "active" ? activeOrders.length : completedOrders.length})</span></button>)}
            </div>
            <div id="orders-panel-history" role="tabpanel" aria-labelledby="orders-tab-history" hidden={tab !== "history"} tabIndex={0} className="min-w-0 focus-visible:outline-2 focus-visible:outline-blue-600">
                {tab === "history" && <OrderHistory key={activeOrganization.id} orders={orders} organizationId={activeOrganization.id} displayIds={displayIds} search={search} onDetails={setSelectedOrderId} />}
            </div>
            <section id="orders-panel-active" role="tabpanel" aria-labelledby="orders-tab-active" hidden={tab !== "active"} tabIndex={0} className="min-w-0 focus-visible:outline-2 focus-visible:outline-blue-600">
                <div role="region" aria-label="Rolagem do quadro de pedidos" tabIndex={0} className="flex max-h-[max(18rem,calc(100dvh_-_12rem))] snap-x snap-mandatory items-start gap-3 overflow-auto overscroll-y-contain pb-4 focus-visible:rounded-lg focus-visible:outline-2 focus-visible:outline-blue-600">
                    {stages.map((stage) => {
                        const stageOrders = visibleOrders.filter((order) => getStage(order) === stage.id);
                        const allStageOrders = organizationOrders.filter((order) => getStage(order) === stage.id);
                        const totalStage = allStageOrders.length;
                        return (
                            <div key={stage.id} id={`supplier-orders-${stage.id}`} className={`flex w-[275px] shrink-0 snap-start flex-col rounded-xl border border-slate-200 p-3 sm:w-[290px] ${stage.background}`}>
                                <div className="mb-3 flex shrink-0 items-center justify-between gap-2 px-1">
                                    <div className="flex items-center gap-2">
                                        <span aria-hidden="true" className={`h-2.5 w-2.5 rounded-full ${stage.dot}`} />
                                        <h2 className="text-sm font-bold text-slate-800">{stage.title}</h2>
                                    </div>
                                    <div className="flex shrink-0 items-center gap-1">
                                        <span aria-label={`${totalStage} pedidos na etapa ${stage.title}`} className="rounded-full bg-white px-2.5 py-1 text-xs font-bold tabular-nums text-slate-700 shadow-sm">{totalStage}</span>
                                        <OrderColumnFilter
                                            key={columnKey(stage.id)}
                                            title={stage.title}
                                            groups={filterColumns.map(({ key, title }) => ({
                                                key,
                                                title,
                                                selected: columnFilters(stage.id)[key],
                                                values: Array.from(new Set(allStageOrders.map((order) => getFilterValue(order, key))))
                                                    .sort((a, b) => a.localeCompare(b, "pt-BR", { numeric: true }))
                                                    .map((value) => ({ value, label: displayFilterValue(key, value) })),
                                            }))}
                                            onToggle={(key, value) => toggleFilterValue(stage.id, key as FilterColumn, value)}
                                            onClear={() => clearColumnFilters(stage.id)}
                                        />
                                    </div>
                                </div>
                                <div className="flex flex-col gap-3 p-1">
                                    {stageOrders.map((order) => (
                                        <article key={`${order.organizationId}-${order.id}`} className="min-w-0 shrink-0 rounded-xl border border-slate-200 bg-white p-3 shadow-sm [overflow-wrap:anywhere]">
                                            <h3 className="truncate font-bold text-slate-900">{displayIds.get(order.id) ?? shortOrderId(order.id)}</h3>
                                            <p className="mt-1 text-sm text-slate-700">{order.customer}</p>
                                            <div className="mt-3 flex items-center justify-between gap-2 text-xs text-slate-500">
                                                <span>{order.items} itens · {formatDate(order.date)}</span>
                                            </div>
                                            <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
                                                <p className="min-w-0 text-sm font-bold text-slate-900">{currencyFormatter.format(order.total)}</p>
                                                <button type="button" onClick={() => setSelectedOrderId(order.id)} aria-label={`Ver detalhes do pedido ${displayIds.get(order.id) ?? shortOrderId(order.id)}`} className="inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-50 focus-visible:outline-2 focus-visible:outline-blue-600"><ProductIcon name="eye" /> Ver detalhes</button>
                                            </div>
                                            {stage.id === "new" && (
                                                <div className="mt-3 flex gap-2 border-t border-slate-100 pt-3">
                                                    <button type="button" onClick={() => applyAction(order, "accept")} aria-label={`Aceitar pedido ${displayIds.get(order.id) ?? shortOrderId(order.id)}`} title="Aceitar pedido" className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-emerald-300 bg-emerald-50 px-2 py-2 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 focus-visible:outline-2 focus-visible:outline-emerald-600"><CheckIcon /> Aceitar</button>
                                                    <button type="button" onClick={() => applyAction(order, "reject")} aria-label={`Recusar pedido ${displayIds.get(order.id) ?? shortOrderId(order.id)}`} title="Recusar pedido" className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-red-300 bg-red-50 px-2 py-2 text-xs font-semibold text-red-700 hover:bg-red-100 focus-visible:outline-2 focus-visible:outline-red-600"><XIcon /> Recusar</button>
                                                </div>
                                            )}
                                            {stage.id === "new" && <div className="mt-2"><OrderDeadline order={order} /></div>}
                                            {stage.id === "accepted" && <button type="button" onClick={() => applyAction(order, "start-separation")} className="mt-3 w-full rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700">Iniciar separação</button>}
                                            {stage.id === "separating" && <button type="button" onClick={() => applyAction(order, "mark-ready")} className="mt-3 w-full rounded-lg bg-teal-700 px-3 py-2 text-xs font-semibold text-white hover:bg-teal-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700">Marcar como pronto</button>}
                                            {stage.id === "ready" && <p className="mt-3 rounded-lg bg-teal-50 px-2 py-2 text-center text-xs font-medium text-teal-800">Aguardando coleta</p>}
                                            {stage.id === "completed" && <p className="mt-3 text-xs font-semibold text-slate-600">{order.commercialStatus === "Recusado" ? "Recusado" : "Entregue"}</p>}
                                        </article>
                                    ))}
                                    {stageOrders.length === 0 && <p className="rounded-lg border border-dashed border-slate-300 bg-white/70 px-3 py-8 text-center text-xs text-slate-500">{hasFilters ? "Nenhum pedido corresponde aos filtros" : "Nenhum pedido nesta etapa"}</p>}
                                </div>
                            </div>
                        );
                    })}
                </div>
                <p className="mt-1 text-xs text-slate-600">Deslize horizontalmente para visualizar as etapas e verticalmente para ver mais pedidos em todas as colunas. Os pedidos avançam pelas ações, não por arrastar cartões.</p>
            </section>

            {confirmation?.organizationId === activeOrganization.id && organizationOrders.find((order) => order.id === confirmation.id) && (
                <OrderConfirmationModal
                    key={`${confirmation.organizationId}:${confirmation.id}:${confirmation.action}`}
                    order={organizationOrders.find((order) => order.id === confirmation.id)!}
                    displayId={displayIds.get(confirmation.id)}
                    action={confirmation.action}
                    onClose={() => setConfirmation(null)}
                    onConfirm={async () => {
                        if (confirmation.organizationId !== activeOrganization.id) throw new Error("Este pedido não pertence à organização ativa.");
                        let updated: SupplierOrder[];
                        if (confirmation.action === "accept") {
                            updated = await localSupplierOrderAcceptanceService.accept(activeOrganization.id, confirmation.id);
                        } else {
                            updated = changeSupplierOrderOperationalStatus(readSupplierOrders(), activeOrganization.id, confirmation.id, confirmation.action);
                            saveSupplierOrders(updated);
                        }
                        setConfirmation(null);
                    }}
                />
            )}
            {rejectionTarget?.organizationId === activeOrganization.id && organizationOrders.find((order) => order.id === rejectionTarget.id) && (
                <OrderRejectionModal
                    key={`${rejectionTarget.organizationId}:${rejectionTarget.id}`}
                    order={organizationOrders.find((order) => order.id === rejectionTarget.id)!}
                    displayId={displayIds.get(rejectionTarget.id)}
                    onClose={() => setRejectionTarget(null)}
                    onConfirm={(reason, justification) => {
                        const updated = changeSupplierOrderStatus(readSupplierOrders(), activeOrganization.id, rejectionTarget.id, "reject", { reason, justification });
                        saveSupplierOrders(updated);
                        setRejectionTarget(null);
                        requestAnimationFrame(() => document.getElementById("supplier-order-search")?.focus());
                    }}
                />
            )}
            {selectedOrder && <OrderDetailsModal displayId={displayIds.get(selectedOrder.id)} order={selectedOrder} activeOrganization={activeOrganization} onClose={() => setSelectedOrderId(null)} />}
        </div>
    );
}

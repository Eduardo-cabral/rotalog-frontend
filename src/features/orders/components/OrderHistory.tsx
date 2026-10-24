import { useState } from "react";
import type { SupplierOrder } from "../mocks/orders.mock";
import { getOrderHistory, getOrderHistoryDay } from "../utils/orderHistory";
import { ProductIcon } from "../../products/components/ProductIcon";
import { shortOrderId } from "../api/orderAdapter";

const input = "min-w-0 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus-visible:outline-2 focus-visible:outline-blue-600";
const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const pageSize = 20;

function HistoryMonth({ month, records, displayIds, onDetails }: { month: string; records: SupplierOrder[]; displayIds: Map<string, string>; onDetails: (id: string) => void }) {
    const [page, setPage] = useState(0);
    const current = Math.min(page, Math.max(0, Math.ceil(records.length / pageSize) - 1));
    const label = month === "unknown" ? "Conclusão/recusa não informada" : new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${month}-01T12:00:00Z`));
    return <details open className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-slate-900 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-blue-600">{label} <span className="ml-2 rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-700">{records.length} pedidos</span></summary>
        <div role="region" aria-label={`Pedidos de ${label}`} tabIndex={0} className="overflow-x-auto focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-blue-600">
            <table className="w-full min-w-[760px] text-left text-sm"><caption className="sr-only">Histórico de {label}</caption>
                <thead className="bg-slate-50 text-slate-600"><tr>{["Pedido", "Comprador", "Conclusão / recusa", "Valor", "Situação / recusa", "Detalhes"].map(text => <th key={text} scope="col" className="px-4 py-3 font-medium">{text}</th>)}</tr></thead>
                <tbody>{records.slice(current * pageSize, (current + 1) * pageSize).map(order => {
                    const displayId = displayIds.get(order.id) ?? shortOrderId(order.id);
                    const refused = order.commercialStatus === "Recusado";
                    return <tr key={order.id} className="border-t border-slate-100 align-top">
                        <td className="px-4 py-3 font-medium text-slate-900"><span className="block max-w-40 truncate" title={displayId}>{displayId}</span></td>
                        <td className="max-w-64 break-words px-4 py-3 [overflow-wrap:anywhere]">{order.customer}</td>
                        <td className="whitespace-nowrap px-4 py-3">{getOrderHistoryDay(order).split("-").reverse().join("/") || "Não informada"}</td>
                        <td className="whitespace-nowrap px-4 py-3">{currency.format(order.total)}</td>
                        <td className="max-w-80 px-4 py-3 [overflow-wrap:anywhere]"><span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${refused ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-800"}`}>{refused ? "Recusado" : "Entregue"}</span>{refused && order.rejection && <p className="mt-1 text-xs text-slate-600">{order.rejection.reason}{order.rejection.justification ? `: ${order.rejection.justification}` : ""}</p>}</td>
                        <td className="px-4 py-3"><button type="button" onClick={() => onDetails(order.id)} aria-label={`Ver detalhes do pedido ${displayId}`} className="inline-flex items-center gap-1 whitespace-nowrap rounded px-2 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-50 focus-visible:outline-2 focus-visible:outline-blue-600"><ProductIcon name="eye" />Ver detalhes</button></td>
                    </tr>;
                })}</tbody>
            </table>
        </div>
        {records.length > pageSize && <nav aria-label={`Paginação de ${label}`} className="flex flex-wrap items-center justify-end gap-3 border-t border-slate-100 px-4 py-3 text-sm text-slate-700"><button type="button" disabled={current === 0} onClick={() => setPage(current - 1)} className={`${input} disabled:opacity-50`}>Anterior</button><span>Página {current + 1} de {Math.ceil(records.length / pageSize)}</span><button type="button" disabled={(current + 1) * pageSize >= records.length} onClick={() => setPage(current + 1)} className={`${input} disabled:opacity-50`}>Próxima</button></nav>}
    </details>;
}

export function OrderHistory({ orders, organizationId, displayIds, search, onDetails }: { orders: SupplierOrder[]; organizationId: string; displayIds: Map<string, string>; search: string; onDetails: (id: string) => void }) {
    const [status, setStatus] = useState("");
    const [from, setFrom] = useState("");
    const [to, setTo] = useState("");
    const [months, setMonths] = useState({ query: "", limit: 6 });
    const queryKey = JSON.stringify([search, status, from, to]);
    const monthLimit = months.query === queryKey ? months.limit : 6;
    const groups = getOrderHistory(orders, organizationId, displayIds, { search, status, from, to });
    const invalidRange = !!from && !!to && from > to;
    return <section aria-label="Histórico de pedidos" className="flex min-w-0 flex-col gap-3">
        <div className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <label className="flex flex-col gap-1 text-xs text-slate-600">Situação<select aria-label="Situação do histórico" value={status} onChange={event => setStatus(event.target.value)} className={input}><option value="">Todas as situações</option><option value="delivered">Entregues</option><option value="refused">Recusados</option></select></label>
            <label className="flex min-w-0 flex-col gap-1 text-xs text-slate-600">De<input type="date" value={from} onChange={event => setFrom(event.target.value)} className={input} /></label>
            <label className="flex min-w-0 flex-col gap-1 text-xs text-slate-600">Até<input type="date" value={to} onChange={event => setTo(event.target.value)} className={input} /></label>
            {(status || from || to) && <button type="button" onClick={() => { setStatus(""); setFrom(""); setTo(""); }} className={`${input} text-blue-700`}>Limpar filtros do histórico</button>}
            <p role="status" className="text-sm text-slate-600">{groups.reduce((sum, group) => sum + group.records.length, 0)} pedidos encontrados</p>
        </div>
        <p className="text-xs text-slate-600">Agrupamento e período pela data registrada de conclusão ou recusa (Manaus). Pedidos sem essa data ficam no grupo “Conclusão/recusa não informada” e não entram no filtro de período.</p>
        {invalidRange && <p role="alert" className="text-sm text-red-700">A data inicial deve ser anterior ou igual à data final.</p>}
        {groups.slice(0, monthLimit).map(group => <HistoryMonth key={`${group.month}:${search}:${status}:${from}:${to}`} {...group} displayIds={displayIds} onDetails={onDetails} />)}
        {groups.length > monthLimit && <button type="button" onClick={() => setMonths({ query: queryKey, limit: monthLimit + 6 })} className={`${input} self-center`}>Mostrar mais meses ({groups.length - monthLimit} restantes)</button>}
        {groups.length === 0 && <p className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-600">Nenhum pedido finalizado corresponde à pesquisa e aos filtros.</p>}
    </section>;
}

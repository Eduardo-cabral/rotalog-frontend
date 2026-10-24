import {orderTone} from "../../../shared/components/supplierStatus";
import {useState} from "react";
import {Link} from "react-router-dom";
import {useAuth} from "../../auth/hooks/useAuth";
import {useApiOrders} from "../../orders/api/ordersContext";
import {ApiOrdersStatus} from "../../orders/api/ApiSupplierOrders";
import {ApiOrderDetails} from "../../orders/api/ApiOrderDetails";
import {adaptOrder, apiStages, formatMoney, orderLabel, orderMetrics} from "../../orders/api/orderAdapter";
import {MetricCard} from "./MetricCard";
import {PageHeader} from "../../../shared/components/PageHeader";
import {StatusBadge, SupplierIcon} from "../../../shared/components/SupplierVisuals";

export function SupplierDashboardOverview() {
    const {user} = useAuth();
    const {orders, loaded, error, loading, repository} = useApiOrders();
    const [selected, setSelected] = useState<string | null>(null);
    const views = orders.map(adaptOrder);
    const colors = ["#316BFF", "#16A34A", "#06B6D4", "#0891B2", "#8B5CF6", "#15803D", "#64748B", "#EF4444"];
    const stages = [...apiStages, {id: "completed", title: "Finalizados"}].filter(stage => stage.id !== "unknown" || views.some(order => order.stage === "unknown"));
    let offset = 0;
    const segments = stages.map((stage, index) => {
        const count = views.filter(order => order.stage === stage.id).length;
        const start = offset; offset += orders.length ? count / orders.length * 100 : 0;
        return {...stage, count, color: colors[index], segment: `${colors[index]} ${start}% ${offset}%`};
    });
    return <div className="mx-auto flex w-full min-w-0 max-w-7xl flex-col gap-6">
        <PageHeader title={`Olá, ${user?.name?.trim().split(/\s+/)[0] || "fornecedor"}!`} subtitle="Uma visão clara da sua operação, em um só lugar." actions={<button type="button" disabled={loading} onClick={()=>void repository.refresh()} className="supplier-button disabled:opacity-50">Atualizar pedidos</button>}/>
        <ApiOrdersStatus/>
        {loaded && !error && <>
            <div className="grid auto-rows-fr grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">{orderMetrics(orders).map(metric => <Link key={metric.title} to="/fornecedor/pedidos" aria-label={`${metric.title}: ${metric.value}. Ver pedidos`} className="flex rounded-xl transition hover:ring-2 hover:ring-blue-200"><MetricCard {...metric}/></Link>)}</div>
            {!orders.length && <p role="status" className="text-sm text-slate-600">Nenhum pedido encontrado para esta organização.</p>}
            <div className="grid gap-5 xl:grid-cols-2">
                <section aria-label="Resumo operacional" className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm"><p className="text-xs font-medium uppercase tracking-wider text-slate-500">Sua operação</p><h2 className="mt-3 text-xl font-semibold">Do aceite à prontidão</h2><p className="mt-2 max-w-md text-sm leading-6 text-slate-500">Acompanhe os pedidos e mantenha ofertas, depósitos e disponibilidade atualizados.</p><div className="mt-6 grid gap-2">{[["Revisar pedidos", "/fornecedor/pedidos", "orders"], ["Gerenciar produtos e depósitos", "/fornecedor/produtos", "products"], ["Consultar disponibilidade", "/fornecedor/estoque", "inventory"]].map(([label, path, icon]) => <Link key={path} to={path} className="flex items-center gap-3 rounded-lg border border-slate-100 p-3 text-sm font-medium hover:bg-blue-50"><SupplierIcon name={icon as "orders" | "products" | "inventory"}/>{label}<SupplierIcon name="arrow" className="ml-auto h-4 w-4"/></Link>)}</div></section>
                <section aria-label="Pedidos por situação" className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm"><h2 className="mb-6 text-xs font-medium uppercase tracking-wider text-slate-500">Pedidos por situação</h2><div className="supplier-status-chart"><div aria-hidden="true" className="supplier-donut" style={{background: orders.length ? `conic-gradient(${segments.map(item=>item.segment).join(",")})` : "#E5EAF2"}}><div><strong>{orders.length}</strong><span>Total</span></div></div><ul className="supplier-chart-legend">{segments.map(stage=><li key={stage.id}><i aria-hidden="true" style={{background: stage.color}}/><span>{stage.title}</span><strong>{stage.count}</strong></li>)}</ul></div></section>
            </div>
            <section aria-label="Pedidos em destaque" className="min-w-0 rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center justify-between gap-3"><div><h2 className="font-semibold">Pedidos em destaque</h2><p className="mt-1 text-xs text-slate-500">Exibindo até cinco pedidos.</p></div><Link to="/fornecedor/pedidos" className="text-xs font-semibold text-blue-700">Ver todos</Link></div>
                {views.length ? <div className="mt-5 overflow-x-auto" role="region" aria-label="Tabela de pedidos em destaque" tabIndex={0}><table className="w-full min-w-[570px] text-left text-sm"><thead className="bg-slate-50"><tr>{["Pedido", "Produtos", "Situação", "Valor", ""].map((title,index)=><th key={index} scope="col" className="px-3 py-3">{title || <span className="sr-only">Ações</span>}</th>)}</tr></thead><tbody>{views.slice(0,5).map(order=><tr key={order.id}><td className="px-3 py-4 font-semibold text-blue-700">{orderLabel(order,orders)}</td><td className="max-w-52 truncate px-3 py-4">{order.items.map(item=>item.product.name).join(", ") || "Não informado"}</td><td className="px-3 py-4"><StatusBadge tone={orderTone(order.state)}>{order.stateLabel}</StatusBadge></td><td className="whitespace-nowrap px-3 py-4 font-semibold">{formatMoney(order.total)}</td><td className="px-3 py-4"><button type="button" onClick={()=>setSelected(order.id)} className="rounded px-2 py-1 text-xs font-semibold text-blue-700">Ver detalhes</button></td></tr>)}</tbody></table></div> : <p className="py-8 text-center text-sm text-slate-500">Os pedidos aparecerão aqui após a primeira compra.</p>}
            </section>
        </>}
        <p className="text-xs text-slate-500">Os indicadores refletem a situação atual da operação; não incluem histórico financeiro mensal.</p>
        {selected && <ApiOrderDetails key={selected} id={selected} onClose={()=>setSelected(null)}/>}
    </div>;
}

import { Link } from "react-router-dom";
import {
    calculateSupplierOrderTotal,
    purchasesMock,
    type Purchase,
    type SupplierOrderStatus,
} from "../mocks/purchases.mock";
import { BuyerEmptyState, BuyerIcon, BuyerStatus } from "../../buyer/components/BuyerVisuals";
import { DemoDataBadge } from "../../buyer/components/DemoDataBadge";

function purchaseStatus(status: Purchase["status"]) {
    if (status === "COMPLETED") return { label: "Concluída", tone: "success" as const, icon: "check" as const };
    if (status === "CANCELLED") return { label: "Cancelada", tone: "danger" as const, icon: "package" as const };
    return { label: "Em andamento", tone: "progress" as const, icon: "clock" as const };
}

function orderStatus(status: SupplierOrderStatus) {
    if (status === "CONFIRMED") return { label: "Confirmado", tone: "success" as const, icon: "check" as const };
    if (status === "FAILED") return { label: "Falha no pedido", tone: "danger" as const, icon: "package" as const };
    if (status === "CANCELLED") return { label: "Cancelado", tone: "neutral" as const, icon: "package" as const };
    if (status === "PARTIAL") return { label: "Atendimento parcial", tone: "warning" as const, icon: "clock" as const };
    return { label: "Aguardando confirmação", tone: "warning" as const, icon: "clock" as const };
}

export function BuyerPurchases() {
    return (
        <div className="mx-auto w-full max-w-[960px] text-slate-900">
            <header className="mb-6">
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-blue-700">Portal do comprador</p>
                <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Minhas compras</h1>
                <p className="mt-2 text-sm leading-6 text-slate-600">Consulte o valor e o andamento dos pedidos de cada fornecedor.</p>
                {purchasesMock.length > 0 && <div className="mt-3"><DemoDataBadge visible /></div>}
            </header>

            {purchasesMock.length ? (
                <div className="space-y-4" aria-label="Histórico de compras">
                    {purchasesMock.map((purchase) => {
                        const formattedDate = new Intl.DateTimeFormat("pt-BR", {
                            dateStyle: "medium",
                            timeStyle: "short",
                        }).format(new Date(purchase.createdAt));
                        const total = purchase.supplierOrders.reduce(
                            (sum, order) => sum + calculateSupplierOrderTotal(order),
                            0,
                        );
                        const state = purchaseStatus(purchase.status);

                        return (
                            <article key={purchase.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-blue-200 hover:shadow-md sm:p-6">
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                    <div>
                                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Compra</p>
                                        <h2 className="mt-1 text-lg font-bold text-blue-950">#{purchase.id}</h2>
                                    </div>
                                    <BuyerStatus tone={state.tone} icon={state.icon}>{state.label}</BuyerStatus>
                                </div>

                                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                                    <div className="rounded-xl bg-slate-50 p-4">
                                        <p className="flex items-center gap-2 text-xs font-medium text-slate-500"><BuyerIcon name="calendar" className="h-4 w-4"/>Realizada em</p>
                                        <p className="mt-1 text-sm font-semibold text-slate-800">{formattedDate}</p>
                                    </div>
                                    <div className="rounded-xl bg-blue-50 p-4">
                                        <p className="text-xs font-medium text-blue-700">Valor previsto</p>
                                        <p className="mt-1 text-xl font-bold tabular-nums text-blue-950">
                                            {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(total)}
                                        </p>
                                    </div>
                                </div>

                                <ul className="mt-4 divide-y divide-slate-100 rounded-xl border border-slate-100 px-4">
                                    {purchase.supplierOrders.map((order, index) => {
                                        const state = orderStatus(order.status);
                                        return (
                                            <li key={order.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                                                <div className="min-w-0 flex-1">
                                                    <p className="text-sm font-semibold text-slate-900">Pedido {index + 1} · {order.supplierName}</p>
                                                    <p className="mt-1 break-words text-sm text-slate-600">{order.items.map((item) => item.productName).join(" · ")}</p>
                                                </div>
                                                <BuyerStatus tone={state.tone} icon={state.icon}>{state.label}</BuyerStatus>
                                            </li>
                                        );
                                    })}
                                </ul>

                                <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                                    <p className="text-sm text-slate-500">{purchase.supplierOrders.length} pedido(s) · situação individual por fornecedor</p>
                                    <Link to={`/comprador/compras/${purchase.id}`} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600">
                                        Ver detalhes <BuyerIcon name="arrow-right" className="h-4 w-4"/>
                                    </Link>
                                </div>
                            </article>
                        );
                    })}
                </div>
            ) : (
                <BuyerEmptyState icon="package" title="Seu histórico começa com a primeira compra">
                    <p>Quando houver uma compra, os pedidos e seus status aparecerão aqui.</p>
                    <Link to="/" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-blue-700 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-800">Explorar produtos <BuyerIcon name="arrow-right" className="h-4 w-4"/></Link>
                </BuyerEmptyState>
            )}
        </div>
    );
}

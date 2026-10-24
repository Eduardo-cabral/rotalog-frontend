
import { Link, useParams } from "react-router-dom";
import {
    calculateSupplierOrderTotal,
    getPurchaseById,
    type SupplierOrderStatus,
} from "../mocks/purchases.mock";
import { BuyerEmptyState, BuyerIcon, BuyerStatus } from "../../buyer/components/BuyerVisuals";

const currency = new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
});

const statusLabels: Record<SupplierOrderStatus, string> = {
    CONFIRMED: "Confirmado",
    PENDING: "Aguardando confirmação",
    FAILED: "Falha no pedido",
    CANCELLED: "Cancelado",
    PARTIAL: "Atendimento parcial",
};

function statusTone(status: SupplierOrderStatus) {
    if (status === "CONFIRMED") return "success" as const;
    if (status === "FAILED") return "danger" as const;
    if (status === "CANCELLED") return "neutral" as const;
    if (status === "PARTIAL") return "warning" as const;
    return "warning" as const;
}

export function BuyerPurchaseDetails() {
    const { purchaseId } = useParams<{
        purchaseId: string;
    }>();

    const purchase = getPurchaseById(purchaseId ?? "");

    if (!purchase) {
        return (
            <div className="flex min-h-[60vh] items-center justify-center p-4">
                <div className="w-full max-w-lg">
                    <BuyerEmptyState icon="search" title="Compra não encontrada">
                        <p>Não encontramos a compra solicitada.</p>
                        <Link to="/comprador/compras" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-blue-700 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-800">
                            <BuyerIcon name="arrow-left" className="h-4 w-4"/>Voltar às compras
                        </Link>
                    </BuyerEmptyState>
                </div>
            </div>
        );
    }

    const purchaseTotal = purchase.supplierOrders.reduce(
        (total, order) =>
            total + calculateSupplierOrderTotal(order),
        0
    );

    const formattedDate = new Intl.DateTimeFormat("pt-BR", {
        dateStyle: "short",
        timeStyle: "short",
    }).format(new Date(purchase.createdAt));

    return (
        <div className="w-full">
            <div className="w-full">
                <Link
                    to="/comprador/compras"
                    className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-blue-700 transition hover:bg-blue-50"
                >
                    <BuyerIcon name="arrow-left" className="h-4 w-4"/>Voltar às compras
                </Link>

                <header className="mt-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                    <p className="text-xs font-bold uppercase tracking-[0.12em] text-blue-700">Resumo da compra</p>

                    <h1 className="mt-1 text-2xl font-bold tracking-tight text-blue-950 sm:text-3xl">
                        Detalhes da compra #{purchase.id}
                    </h1>

                    <p className="mt-2 text-sm text-slate-600">
                        Compra simulada em {formattedDate}
                    </p>

                    <div className="mt-5 grid gap-3 sm:grid-cols-3">
                        <div className="rounded-xl bg-slate-50 p-4">
                            <p className="text-xs font-medium text-slate-500">Pedidos vinculados</p>
                            <p className="mt-1 text-2xl font-bold text-slate-900">
                                {purchase.supplierOrders.length}
                            </p>
                        </div>

                        <div className="rounded-xl bg-blue-50 p-4">
                            <p className="text-xs font-medium text-blue-700">Valor previsto</p>
                            <p className="mt-1 text-2xl font-bold tabular-nums text-blue-950">
                                {currency.format(purchaseTotal)}
                            </p>
                        </div>

                        <div className="flex flex-col items-start justify-center gap-2 rounded-xl bg-slate-50 p-4">
                            <p className="text-xs font-medium text-slate-500">Situação comercial</p>
                            <BuyerStatus tone={purchase.status === "CANCELLED" ? "danger" : purchase.status === "COMPLETED" ? "success" : "progress"} icon={purchase.status === "COMPLETED" ? "check" : "clock"}>
                                {purchase.status === "COMPLETED" ? "Concluída" : purchase.status === "CANCELLED" ? "Cancelada" : "Em andamento"}
                            </BuyerStatus>
                        </div>
                    </div>

                    <details className="mt-4 text-sm text-slate-500"><summary className="w-fit cursor-pointer font-semibold text-blue-700">Condições e identificadores</summary><p className="mt-2">Atendimento parcial: {purchase.acceptsPartialFulfillment ? "Autorizado" : "Não autorizado"}. Pedidos de fornecedores são acompanhados individualmente.</p><p className="mt-1 break-all">Identificador: {purchase.id}</p></details>
                </header>

                <section
                    aria-label="Pedidos por fornecedor"
                    className="mt-6 space-y-5"
                >
                    <h2 className="text-xl font-bold text-blue-950">
                        Pedidos desta compra
                    </h2>

                    {purchase.supplierOrders.map((order, index) => {
                        const subtotal = order.items.reduce(
                            (total, item) =>
                                total + item.quantity * item.unitPrice,
                            0
                        );

                        return (
                            <article
                                key={order.id}
                                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"
                            >
                                <div className="flex flex-wrap items-start justify-between gap-4">
                                    <div>
                                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Pedido {index + 1}</p>

                                        <h3 className="mt-1 text-xl font-bold">
                                            {order.supplierName}
                                        </h3>
                                    </div>

                                    <BuyerStatus tone={statusTone(order.status)} icon={order.status === "CONFIRMED" ? "check" : "clock"}>
                                        {statusLabels[order.status]}
                                    </BuyerStatus>
                                </div>

                                <div
                                    role={
                                        order.status === "FAILED"
                                            ? "alert"
                                            : undefined
                                    }
                                    className={`mt-5 rounded-lg p-4 text-sm ${order.status === "FAILED"
                                        ? "border border-red-200 bg-red-50 text-red-800"
                                        : "bg-slate-50 text-slate-700"
                                        }`}
                                >
                                    {order.statusMessage}
                                </div>

                                <div                                 className="mt-4 divide-y divide-slate-100 rounded-xl border border-slate-100 px-4">
                                    {order.items.map((item) => (
                                        <div
                                            key={item.productId}
                                            className="flex flex-wrap justify-between gap-3 py-3 text-sm"
                                        >
                                            <div>
                                                <p className="font-semibold text-slate-900">
                                                    {item.productName}
                                                </p>
                                                <p className="mt-1 text-slate-500">
                                                    {item.quantity} ×{" "}
                                                    {currency.format(item.unitPrice)}
                                                </p>
                                            </div>

                                            <span className="font-semibold tabular-nums text-slate-900">
                                                {currency.format(
                                                    item.quantity * item.unitPrice
                                                )}
                                            </span>
                                        </div>
                                    ))}
                                </div>

                                <div className="mt-4 space-y-2 rounded-xl bg-slate-50 p-4 text-sm">
                                    <div className="flex justify-between gap-3">
                                        <span>Subtotal</span>
                                        <span>{currency.format(subtotal)}</span>
                                    </div>

                                    <div className="flex justify-between gap-3">
                                        <span>Frete</span>
                                        <span>
                                            {currency.format(order.deliveryFee)}
                                        </span>
                                    </div>

                                    <div className="flex justify-between gap-3 border-t border-slate-200 pt-3 text-base font-bold text-blue-950">
                                        <span>Total previsto do pedido</span>
                                        <span className="tabular-nums">
                                            {currency.format(
                                                calculateSupplierOrderTotal(order)
                                            )}
                                        </span>
                                    </div>

                                    <p className="pt-2 text-slate-600">
                                        <strong>Previsão:</strong>{" "}
                                        {order.deliveryEstimate}
                                    </p>
                                </div>
                            </article>
                        );
                    })}
                </section>

                <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                    Esta página utiliza dados simulados. Os valores
                    apresentados são previstos, não representam
                    cobranças, pagamentos ou reembolsos efetivos.
                </div>
            </div>
        </div>
    );
}

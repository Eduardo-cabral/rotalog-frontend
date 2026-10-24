import type { ApiOrder } from "./contracts";

export const apiStages = [
    { id: "new", title: "Novos", background: "bg-blue-50/70", dot: "bg-blue-500" },
    { id: "accepted", title: "Aceitos", background: "bg-emerald-50/70", dot: "bg-emerald-500" },
    { id: "separating", title: "Em separação", background: "bg-cyan-50/70", dot: "bg-cyan-500" },
    { id: "ready", title: "Prontos para coleta", background: "bg-teal-50/70", dot: "bg-teal-500" },
    { id: "transport", title: "Em transporte", background: "bg-violet-50/70", dot: "bg-violet-500" },
    { id: "delivered", title: "Entregues", background: "bg-emerald-50/70", dot: "bg-emerald-600" },
    { id: "unknown", title: "Outros estados", background: "bg-slate-50", dot: "bg-slate-500" },
] as const;
export type ApiStage = typeof apiStages[number]["id"] | "completed";
const states: Record<string, { stage: ApiStage; label: string }> = {
    AWAITING_SUPPLIER_DECISION: { stage: "new", label: "Aguardando aceite" },
    ACCEPTED: { stage: "accepted", label: "Aceito" },
    PARTIALLY_ACCEPTED: { stage: "accepted", label: "Aceito parcialmente" },
    SEPARATING: { stage: "separating", label: "Em separação" },
    READY_TO_DISPATCH: { stage: "ready", label: "Pronto para coleta" },
    // Proposed logistics contracts: display only; no supplier commands or local archiving.
    IN_TRANSIT: { stage: "transport", label: "Em transporte" },
    AWAITING_BUYER_RECEIPT: { stage: "transport", label: "Entrega informada — aguardando confirmação do comprador" },
    DELIVERED: { stage: "delivered", label: "Entregue" },
    REFUSED: { stage: "completed", label: "Recusado" },
    CANCELLED: { stage: "completed", label: "Cancelado" },
    ACCEPTANCE_EXPIRED: { stage: "completed", label: "Aceite expirado" },
};
export function orderStateLabel(state: string): string {
    return states[state]?.label ?? state;
}
export function adaptOrder(order: ApiOrder) {
    return { ...order, stage: states[order.state]?.stage ?? "unknown", stateLabel: orderStateLabel(order.state) };
}
export type OrderView = ReturnType<typeof adaptOrder>;

// Não converte dinheiro para ponto flutuante, nem mesmo para exibição.
export function cents(value: string): bigint {
    if (!/^\d+(?:\.\d{1,2})?$/.test(value)) throw new Error("Valor monetário inválido na resposta da API.");
    const [whole, fraction = ""] = value.split(".");
    return BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0"));
}
export function formatMoney(value: string): string {
    const amount = cents(value);
    return `R$ ${(amount / 100n).toLocaleString("pt-BR")},${String(amount % 100n).padStart(2, "0")}`;
}
export function orderMetrics(orders: ApiOrder[]) {
    const views = orders.map(adaptOrder);
    return [
        { title: "Pedidos recebidos", value: orders.length },
        { title: "Aguardando aceite", value: views.filter(order => order.stage === "new").length },
        { title: "Em preparação", value: views.filter(order => order.stage === "accepted" || order.stage === "separating").length },
        { title: "Prontos para coleta", value: views.filter(order => order.stage === "ready").length },
    ];
}
export function acceptanceOpen(order: ApiOrder, now = Date.now()) {
    return order.state === "AWAITING_SUPPLIER_DECISION" && order.allowed_actions.includes("acceptance")
        && Number.isFinite(Date.parse(order.acceptance_deadline)) && Date.parse(order.acceptance_deadline) > now;
}
export function assertQuantity(value: number, max: number) {
    if (!Number.isSafeInteger(value) || value < 0 || value > max || value > 2_147_483_647) {
        throw new Error(`Informe uma quantidade inteira entre 0 e ${max}.`);
    }
}

// Presentation only: requests and copying always use the complete identifier.
export function shortOrderId(id: string): string {
    return id.length > 20 ? `${id.slice(0, 8)}…${id.slice(-8)}` : id;
}

// Display only. Collision detection uses the entire loaded organization list,
// before filters, sorting or the Dashboard's five-order limit.
export function orderLabel(order: Pick<ApiOrder, "id" | "order_number">, orders: Pick<ApiOrder, "id" | "order_number">[] = []): string {
    const number = order.order_number?.trim();
    if (number) return `Pedido ${number}`;
    const code = (id: string) => id.replace(/-/g, "").toUpperCase();
    const full = code(order.id);
    let length = 8;
    while (length < full.length && orders.some(other => other.id !== order.id && !other.order_number?.trim() && code(other.id).slice(0, length) === full.slice(0, length))) {
        length += 4;
    }
    return `Pedido #${full.slice(0, length)}`;
}

import type { SupplierOrder } from "../mocks/orders.mock";
import { shortOrderId } from "../api/orderAdapter";

const DISPLAY_IDS_KEY = "rotalog:supplier-order-display-ids:v1";

// Metadados de apresentação separados: nunca regrava os IDs dos pedidos.
export function getOrderDisplayIds(orders: SupplierOrder[]): Map<string, string> {
    const labels = new Map<string, string>();
    const reserved = new Set(orders.map((order) => order.id));
    let saved: Record<string, string> = {};
    let writable = true;
    try {
        const raw = localStorage.getItem(DISPLAY_IDS_KEY);
        if (raw) {
            const parsed: unknown = JSON.parse(raw);
            if (!parsed || typeof parsed !== "object" || Array.isArray(parsed) ||
                !Object.values(parsed).every(value => typeof value === "string" && /^TESTE-\d{3,}$/.test(value)) ||
                new Set(Object.values(parsed)).size !== Object.values(parsed).length) throw new Error("Rótulos inválidos");
            saved = parsed as Record<string, string>;
        }
    } catch { writable = false; }
    Object.values(saved).forEach(label => reserved.add(label));
    let sequence = 1;
    let changed = false;
    const actualIds = new Set(orders.map(order => order.id));
    // A primeira atribuição também independe da ordenação do Kanban/Dashboard.
    for (const order of [...orders].sort((a, b) => a.id.localeCompare(b.id))) {
        if (!/^TESTE-/i.test(order.id) || /^TESTE-\d{1,6}$/.test(order.id)) {
            labels.set(order.id, shortOrderId(order.id));
            continue;
        }
        if (labels.has(order.id)) continue;
        const previous = Object.hasOwn(saved, order.id) ? saved[order.id] : undefined;
        if (previous && !actualIds.has(previous)) {
            labels.set(order.id, previous);
            continue;
        }
        let label: string;
        do {
            label = `TESTE-${String(sequence++).padStart(3, "0")}`;
        } while (reserved.has(label));
        reserved.add(label);
        labels.set(order.id, label);
        saved = { ...saved, [order.id]: label };
        changed = true;
    }
    if (changed && writable) {
        try { localStorage.setItem(DISPLAY_IDS_KEY, JSON.stringify(saved)); }
        catch { /* A consulta permanece disponível se o armazenamento estiver cheio. */ }
    }
    return labels;
}

import type {StatusTone} from "./SupplierVisuals";
export function orderTone(state: string): StatusTone {
    if (["REFUSED", "CANCELLED", "ACCEPTANCE_EXPIRED"].includes(state)) return "danger";
    if (["DELIVERED", "COMPLETED", "CLOSED", "ACCEPTED"].includes(state)) return "success";
    if (state === "AWAITING_SUPPLIER_DECISION" || state === "PARTIALLY_ACCEPTED") return "warning";
    if (["SEPARATING", "READY_TO_DISPATCH", "IN_TRANSIT", "DISPATCHED", "PARTIALLY_DISPATCHED", "PARTIALLY_DELIVERED", "AWAITING_BUYER_RECEIPT"].includes(state)) return "progress";
    return "neutral";
}

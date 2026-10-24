import { authenticatedRequest } from "../../services/apiAuth.service";
import { ApiError } from "../../../shared/api/http";
import type { CatalogProduct } from "../../products/api/catalogRepository";
import type { ApiOrder } from "../../orders/api/contracts";
import { formatMoney } from "../../orders/api/orderAdapter";

export type Offer = { id: string; product_id: string; product_name: string; supplier_organization_id: string; supplier_name: string; warehouse_id: string; unit_price: string; currency: "BRL"; minimum_order_quantity: number; available_quantity: number; version: number; is_active: boolean };
export type Slot = { id: string; warehouse_id: string; starts_at: string; ends_at: string; total_quantity: number; reserved_quantity: number };
export type CheckoutInput = { items: { offer_id: string; quantity: number }[]; capacity_slot_id: string; accepts_partial: false };
export type Checkout = { id: string; state: string; version: number; supplier_organization_id: string; warehouse_id: string; capacity_slot_id: string; expires_at: string; total: string; currency: "BRL"; purchase_id: string | null; items: { offer_id: string; quantity: number; unit_price: string; product: CatalogProduct }[] };
export type Payment = { purchase_id: string };
export type Purchase = { id: string; checkout_id: string; state: string; supplier_orders: ApiOrder[] };
export type Page<T> = { items: T[]; total: number; page: number; page_size: number };
type Transport = <T>(path: string, options?: RequestInit, replayUnauthorized?: boolean) => Promise<T>;
const readPageSize = 25;

export class BuyerRepository {
    private organization: string;
    private transport: Transport;
    constructor(organization: string, transport: Transport = authenticatedRequest) { this.organization=organization; this.transport=transport; }
    private options(): RequestInit {
        if (!this.organization) throw new Error("Organização autenticada indisponível.");
        return { headers: { "X-Organization-Id": this.organization } };
    }
    get<T>(path: string): Promise<T> { return this.transport<T>(`/api/v1${path}`, this.options()); }
    async all<T extends { id: string }>(path: string): Promise<T[]> {
        const items: T[] = [];
        let total: number | undefined;
        for (let page = 1; ; page++) {
            const result = await this.get<Page<T>>(`${path}${path.includes("?") ? "&" : "?"}page=${page}&page_size=${readPageSize}`);
            if (!Array.isArray(result.items) || result.page !== page || result.page_size !== readPageSize || !Number.isSafeInteger(result.total) || result.total < 0 || (total!==undefined&&total!==result.total)) throw new Error("A consulta mudou. Atualize os dados.");
            total=result.total;
            items.push(...result.items);
            if (items.length > total || (result.items.length === 0 && items.length < total) || new Set(items.map(item=>item.id)).size !== items.length) throw new Error("A paginação retornada pelo servidor é inconsistente.");
            if (items.length >= result.total) return items;
        }
    }
    offers(productId?: string) { return this.all<Offer>(`/offers${productId ? `?product_id=${encodeURIComponent(productId)}` : ""}`); }
    slots(warehouse: string) { return this.all<Slot>(`/capacity-slots?warehouse_id=${encodeURIComponent(warehouse)}`); }
    private post<T>(path: string, body: unknown, key: string): Promise<T> {
        const options = this.options();
        return this.transport<T>(`/api/v1${path}`, { ...options, method: "POST", headers: { ...options.headers, "Content-Type": "application/json", "Idempotency-Key": key }, body: JSON.stringify(body) }, false);
    }
    create(input: CheckoutInput, key: string) { return this.post<Checkout>("/checkouts", input, key); }
    checkout(id: string) { return this.get<Checkout>(`/checkouts/${encodeURIComponent(id)}`); }
    async pay(id: string, version: number, key: string) {
        const result = await this.post<Payment>(`/checkouts/${encodeURIComponent(id)}/confirm-payment`, { expected_version: version }, key);
        if (!result || typeof result.purchase_id !== "string" || !result.purchase_id.trim()) throw new Error("A confirmação não retornou o identificador da compra. Consulte o checkout antes de tentar novamente.");
        return result;
    }
    private own(purchase: Purchase) {
        if (purchase.supplier_orders.some(order=>order.buyer_organization_id!==this.organization)) throw new ApiError(403);
        return purchase;
    }
    async purchases(page: number) {
        const result=await this.get<Page<Purchase>>(`/purchases?page=${page}&page_size=${readPageSize}`);
        if (!Array.isArray(result.items) || result.page !== page || result.page_size !== readPageSize || !Number.isSafeInteger(result.total) || result.total < 0 || result.items.length > readPageSize || result.items.length > result.total || new Set(result.items.map(purchase=>purchase.id)).size !== result.items.length) throw new Error("A paginação de compras retornada pelo servidor é inconsistente.");
        result.items.forEach(purchase=>this.own(purchase));
        return result;
    }
    async purchase(id: string) {
        const purchase=this.own(await this.get<Purchase>(`/purchases/${encodeURIComponent(id)}`));
        if(purchase.id!==id)throw new Error("Compra diferente da solicitada.");
        return purchase;
    }
}

export function validateCart(offers: Offer[], quantities: number[]): void {
    if (!offers.length || offers.length > 50 || new Set(offers.map(offer => offer.id)).size !== offers.length) throw new Error("Selecione de 1 a 50 ofertas distintas.");
    const first = offers[0];
    offers.forEach((offer, index) => {
        if (offer.supplier_organization_id !== first.supplier_organization_id || offer.warehouse_id !== first.warehouse_id) throw new Error("Use somente um fornecedor e um depósito por compra.");
        if (!offer.is_active || !Number.isSafeInteger(quantities[index]) || quantities[index] > 2_147_483_647 || quantities[index] < offer.minimum_order_quantity || quantities[index] > offer.available_quantity) throw new Error(`Revise quantidade mínima e disponibilidade de ${offer.product_name}.`);
    });
}
export function buyerError(error: unknown): string {
    if (error instanceof ApiError) {
        const codes: Record<string, string> = {
            CHECKOUT_EXPIRED: "A reserva expirou. Consulte o resultado antes de iniciar outra compra.",
            VERSION_CONFLICT: "Os dados foram atualizados. Consulte o checkout e revise novamente.",
            INSUFFICIENT_INVENTORY: "Estoque insuficiente. Revise as quantidades.",
            INSUFFICIENT_CAPACITY: "Capacidade insuficiente. Escolha outra janela.",
            CAPACITY_UNAVAILABLE: "Janela indisponível. Atualize a capacidade.",
            OFFER_UNAVAILABLE: "Uma oferta não está mais disponível.",
            CHECKOUT_INVALID_STATE: "O checkout mudou de situação. Consulte o resultado.",
        };
        return codes[error.code ?? ""] ?? ({401:"Sessão expirada. Entre novamente.",403:"Sem permissão para esta operação.",404:"Registro não encontrado ou não acessível à sua organização.",409:"Conflito na operação. Consulte os dados antes de continuar.",422:"Dados inválidos. Revise quantidades e condições."}[error.status] ?? "Não foi possível confirmar a operação. Consulte o resultado antes de tentar novamente.");
    }
    return error instanceof Error ? error.message : "Falha de comunicação. Consulte o resultado antes de tentar novamente.";
}
export const money = formatMoney;
export function creationRejected(error: unknown): boolean {
    return error instanceof ApiError && ([403,404,422].includes(error.status)||["INSUFFICIENT_INVENTORY","INSUFFICIENT_CAPACITY","CAPACITY_UNAVAILABLE","OFFER_UNAVAILABLE","OFFER_CONDITIONS_INVALID","DEMO_SINGLE_SUPPLIER"].includes(error.code??""));
}

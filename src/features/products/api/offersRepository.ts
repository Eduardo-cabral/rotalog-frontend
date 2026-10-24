import { authenticatedRequest } from "../../services/apiAuth.service";
import { ApiError } from "../../../shared/api/http";
import type { CatalogProduct } from "./catalogRepository";

export type Warehouse = {
    id: string; supplier_organization_id: string; name: string; address: string;
    opening_hours: string; region: string; geocoding_state: string;
    latitude: string | null; longitude: string | null; is_active: boolean;
    version: number; demo_run_id: string; is_synthetic: true;
};
export type WarehouseCreate = Pick<Warehouse, "name" | "address" | "opening_hours" | "region">;
export function warehouseValues(input: WarehouseCreate): WarehouseCreate {
    const result = {name: input.name.trim(), address: input.address.trim(), opening_hours: input.opening_hours.trim(), region: input.region.trim()};
    for (const [key, label, min, max] of [["name", "Nome", 1, 200], ["address", "Endereço", 5, 500], ["opening_hours", "Horário de funcionamento", 1, 200], ["region", "Região", 1, 100]] as const) {
        const length = Array.from(result[key]).length;
        if (length < min || length > max) throw new Error(`${label} deve conter entre ${min} e ${max} caracteres.`);
    }
    return result;
}
export function warehouseError(error: unknown): string {
    if (error instanceof ApiError) {
        const messages: Record<number, string> = {401: "Sessão expirada. Entre novamente.", 403: "Sem permissão para cadastrar depósitos.", 404: "Organização fornecedora não encontrada ou não autorizada.", 409: "Cadastro indisponível neste momento. Atualize os depósitos e revise a operação.", 422: "Dados inválidos. Revise nome, endereço, horário e região."};
        return messages[error.status] ?? "Não foi possível confirmar o cadastro do depósito.";
    }
    return error instanceof Error ? error.message : "Não foi possível cadastrar o depósito.";
}
export type Offer = {
    id: string; product_id: string; product_name: string; supplier_organization_id: string;
    supplier_name: string; warehouse_id: string; region: string; unit_price: string;
    currency: "BRL"; minimum_order_quantity: number; available_quantity: number;
    version: number; is_active: boolean; demo_run_id: string; is_synthetic: true;
};
export type OfferPage = {items: Offer[]; total: number; page: number; page_size: number};
type WarehousePage = {items: Warehouse[]; total: number; page: number; page_size: number};
type Transport = <T>(path: string, options?: RequestInit, replayUnauthorized?: boolean) => Promise<T>;

export function eligibleWarehouse(warehouse: Warehouse, organizationId: string): boolean {
    return warehouse.supplier_organization_id === organizationId && warehouse.is_active && warehouse.geocoding_state === "CONFIRMED";
}
export function offerPrice(input: string): string {
    const value = input.trim().replace(",", ".");
    if (!/^\d{1,12}(?:\.\d{1,2})?$/.test(value)) throw new Error("Informe preço de 0 a 999999999999,99 com até duas casas decimais, sem separador de milhar.");
    const [whole, fraction = ""] = value.split(".");
    return `${BigInt(whole)}.${fraction.padEnd(2, "0")}`;
}
export function minimumQuantity(input: string): number {
    if (!/^\d+$/.test(input)) throw new Error("A quantidade mínima deve ser um número inteiro positivo.");
    const value = Number(input);
    if (!Number.isSafeInteger(value) || value < 1 || value > 2_147_483_647) throw new Error("Informe quantidade mínima entre 1 e 2147483647.");
    return value;
}
export function uncertainWrite(error: unknown): boolean {
    return !(error instanceof ApiError) || error.status >= 500;
}
export function offerError(error: unknown): string {
    if (error instanceof ApiError) {
        const messages: Record<number, string> = {
            401: "Sessão expirada. Entre novamente.", 403: "Sem permissão para gerenciar ofertas ou depósitos.",
            404: "Produto publicado, oferta ou depósito não encontrado para esta organização. Atualize os dados.",
            409: "Conflito de versão ou regra de negócio: atualize as ofertas e os depósitos. Confira se a origem está ativa e com geocodificação confirmada antes de revisar a operação.",
            422: "Preço, quantidade ou outros campos inválidos. Revise os dados.",
        };
        return messages[error.status] ?? "Resposta incerta do servidor. Confira as ofertas antes de tentar novamente.";
    }
    return error instanceof Error ? error.message : "Não foi possível consultar as ofertas.";
}
export class OffersRepository {
    private organizationId: string;
    private transport: Transport;
    private pending = false;
    private uncertainCreation = false;
    private uncertainWarehouse = false;
    constructor(organizationId: string, transport: Transport = authenticatedRequest) {
        this.organizationId = organizationId; this.transport = transport;
    }
    private options(): RequestInit {
        if (!this.organizationId) throw new Error("Organização autenticada indisponível.");
        return {headers: {"X-Organization-Id": this.organizationId}};
    }
    private own(organizationId: string) {
        if (organizationId !== this.organizationId) throw new Error("Recurso retornado pertence a outra organização.");
    }
    async warehouses(): Promise<Warehouse[]> {
        const items: Warehouse[] = [];
        let page = 1, total: number | undefined;
        do {
            const response = await this.transport<WarehousePage>(`/api/v1/warehouses?page=${page}&page_size=100`, this.options());
            if (response.page !== page || response.page_size !== 100 || !Number.isSafeInteger(response.total) || response.total < 0 || (total !== undefined && total !== response.total)) throw new Error("A lista de depósitos mudou. Atualize os dados.");
            total = response.total;
            response.items.forEach(item => this.own(item.supplier_organization_id));
            items.push(...response.items);
            if (items.length > total || (!response.items.length && items.length < total) || new Set(items.map(item => item.id)).size !== items.length) throw new Error("Paginação de depósitos inconsistente.");
            page++;
        } while (items.length < total);
        return items;
    }
    warehouseNeedsReview() {return this.uncertainWarehouse;}
    acknowledgeWarehouseReview() {this.uncertainWarehouse = false;}
    async createWarehouse(input: WarehouseCreate): Promise<Warehouse> {
        const body = warehouseValues(input);
        const options = this.options();
        if (this.pending) throw new Error("Já existe uma operação em andamento.");
        if (this.uncertainWarehouse) throw new Error("Confira os depósitos antes de iniciar outro cadastro.");
        this.pending = true;
        try {
            const result = await this.transport<Warehouse>(`/api/v1/suppliers/${encodeURIComponent(this.organizationId)}/warehouses`, {...options, method: "POST", headers: {...options.headers, "Content-Type": "application/json"}, body: JSON.stringify(body)}, false);
            this.own(result.supplier_organization_id);
            if (!result.id || !result.geocoding_state || typeof result.is_active !== "boolean") throw new Error("Resposta inesperada. Consulte os depósitos para confirmar o cadastro.");
            return result;
        } catch (error) {
            if (uncertainWrite(error)) this.uncertainWarehouse = true;
            throw error;
        } finally {this.pending = false;}
    }
    async offers(page = 1): Promise<OfferPage> {
        const query = new URLSearchParams({supplier_id: this.organizationId, page: String(page), page_size: "25"});
        const response = await this.transport<OfferPage>(`/api/v1/offers?${query}`, this.options());
        response.items.forEach(item => this.own(item.supplier_organization_id));
        return response;
    }
    creationNeedsReview() {return this.uncertainCreation;}
    acknowledgeCreationReview() {this.uncertainCreation = false;}
    private async post(path: string, body: unknown, creation = false): Promise<Offer> {
        if (this.pending) throw new Error("Já existe uma operação em andamento.");
        if (creation && this.uncertainCreation) throw new Error("Confira as ofertas antes de iniciar outra criação.");
        const options = this.options();
        this.pending = true;
        try {
            // No retry of transport failures. The API currently has no creation idempotency key.
            const offer = await this.transport<Offer>(path, {...options, method:"POST", headers:{...options.headers, "Content-Type":"application/json"}, body:JSON.stringify(body)}, false);
            this.own(offer.supplier_organization_id);
            return offer;
        } catch (error) {
            if (creation && uncertainWrite(error)) this.uncertainCreation = true;
            throw error;
        } finally {this.pending = false;}
    }
    create(product: CatalogProduct, warehouse: Warehouse, price: string, quantity: string) {
        if (product.publication_state !== "PUBLISHED") throw new Error("Selecione um produto publicado.");
        if (!eligibleWarehouse(warehouse, this.organizationId)) throw new Error("Selecione um depósito próprio, ativo e com a localização confirmada.");
        const body = {product_id:product.id, warehouse_id:warehouse.id, unit_price:offerPrice(price), currency:"BRL", minimum_order_quantity:minimumQuantity(quantity)};
        return this.post(`/api/v1/suppliers/${encodeURIComponent(this.organizationId)}/offers`, body, true);
    }
    update(offer: Offer, price: string, quantity: string) {
        this.own(offer.supplier_organization_id);
        if (!offer.is_active) throw new Error("Esta oferta não está ativa.");
        return this.post(`/api/v1/offers/${encodeURIComponent(offer.id)}/price-changes`, {expected_version:offer.version, unit_price:offerPrice(price), currency:"BRL", minimum_order_quantity:minimumQuantity(quantity)});
    }
    pause(offer: Offer) {
        this.own(offer.supplier_organization_id);
        if (!offer.is_active) throw new Error("Esta oferta não está ativa.");
        return this.post(`/api/v1/offers/${encodeURIComponent(offer.id)}/pause`, {expected_version:offer.version});
    }
}

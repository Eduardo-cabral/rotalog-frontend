import { ApiError } from "../../../shared/api/http";
import { authenticatedRequest } from "../../services/apiAuth.service";
import type { ApiOrder } from "../../orders/api/contracts";
import { CatalogRepository, type CatalogPage, type CatalogProduct } from "../../products/api/catalogRepository";
import type { Offer, OfferPage } from "../../products/api/offersRepository";

type Transport = <T>(path: string, options?: RequestInit) => Promise<T>;
type Page<T> = { items: T[]; total: number; page: number; page_size: number };
export type BuyerPurchase = {
    id: string;
    checkout_id: string;
    state: string;
    supplier_orders: ApiOrder[];
    is_synthetic: true;
};
export type BuyerPurchasePage = Page<BuyerPurchase>;

const pageSize = 25;

export class BuyerReadRepository {
    private readonly organizationId: string;
    private readonly transport: Transport;
    private readonly catalog: CatalogRepository;

    constructor(organizationId: string, transport: Transport = authenticatedRequest) {
        this.organizationId = organizationId;
        this.transport = transport;
        this.catalog = new CatalogRepository(organizationId, transport);
    }

    private options(): RequestInit {
        if (!this.organizationId) {
            throw new Error("Organização autenticada indisponível.");
        }
        return { headers: { "X-Organization-Id": this.organizationId } };
    }

    private async allPages<T extends { id: string }>(loadPage: (page: number) => Promise<Page<T>>): Promise<T[]> {
        const items: T[] = [];
        let total: number | undefined;

        for (let page = 1; ; page++) {
            const result = await loadPage(page);
            if (
                result.page !== page ||
                result.page_size !== pageSize ||
                !Number.isSafeInteger(result.total) ||
                result.total < 0 ||
                (total !== undefined && total !== result.total)
            ) {
                throw new Error("A lista mudou durante a consulta. Atualize os dados.");
            }

            total = result.total;
            items.push(...result.items);
            if (
                items.length > total ||
                (result.items.length === 0 && items.length < total) ||
                new Set(items.map(item => item.id)).size !== items.length
            ) {
                throw new Error("A paginação retornada pelo servidor é inconsistente.");
            }
            if (items.length >= total) return items;
        }
    }

    products(): Promise<CatalogProduct[]> {
        return this.allPages<CatalogProduct>(async page => {
            const result: CatalogPage = await this.catalog.list(page);
            return result;
        });
    }

    offers(productId?: string): Promise<Offer[]> {
        return this.allPages<Offer>(page => {
            const query = new URLSearchParams({
                page: String(page),
                page_size: String(pageSize),
            });
            if (productId) query.set("product_id", productId);
            return this.transport<OfferPage>(`/api/v1/offers?${query}`, this.options());
        });
    }

    product(id: string): Promise<CatalogProduct> {
        return this.catalog.detail(id);
    }

    async purchases(): Promise<BuyerPurchase[]> {
        const purchases = await this.allPages<BuyerPurchase>(page =>
            this.transport<BuyerPurchasePage>(
                `/api/v1/purchases?page=${page}&page_size=${pageSize}`,
                this.options(),
            ),
        );
        purchases.forEach(purchase => this.assertPurchaseOrganization(purchase));
        return purchases;
    }

    async purchase(id: string): Promise<BuyerPurchase> {
        const purchase = await this.transport<BuyerPurchase>(
            `/api/v1/purchases/${encodeURIComponent(id)}`,
            this.options(),
        );
        this.assertPurchaseOrganization(purchase);
        if (purchase.id !== id) throw new Error("Compra diferente da solicitada.");
        return purchase;
    }

    private assertPurchaseOrganization(purchase: BuyerPurchase): void {
        if (purchase.supplier_orders.some(order => order.buyer_organization_id !== this.organizationId)) {
            throw new ApiError(403);
        }
    }
}

export function buyerReadError(error: unknown): string {
    if (error instanceof ApiError) {
        const messages: Record<number, string> = {
            401: "Sua sessão expirou. Entre novamente para continuar.",
            403: "Sua conta não tem permissão para consultar estes dados.",
            404: "O registro não foi encontrado ou não está disponível para sua organização.",
            422: "A consulta enviada não é válida.",
        };
        return messages[error.status] ?? "Não foi possível consultar o Backend. Tente novamente.";
    }
    return error instanceof Error ? error.message : "Não foi possível consultar o Backend. Tente novamente.";
}

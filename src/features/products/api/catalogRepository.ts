import { authenticatedRequest } from "../../services/apiAuth.service";
import { ApiError } from "../../../shared/api/http";

// catalog/schemas.py: ProductResponse. No price, image or inventory fields.
export type CatalogProduct = {
    id: string; name: string; brand: string; category: string; gtin: string | null;
    net_content: number; net_content_unit: "g" | "ml" | "un";
    packaging_type: string; packaging_quantity: number; gross_weight_grams: number;
    volume_cm3: number; variant_attributes: Record<string, string>;
    publication_state: string; version: number; demo_run_id: string; is_synthetic: true;
};
export type ProductCreate = Omit<CatalogProduct, "id" | "publication_state" | "version" | "demo_run_id" | "is_synthetic">;
export type CatalogPage = { items: CatalogProduct[]; total: number; page: number; page_size: number; is_synthetic: true; label: string };
type Transport = <T>(path: string, options?: RequestInit, replayUnauthorized?: boolean) => Promise<T>;
export class CatalogRepository {
    private organizationId: string;
    private transport: Transport;
    constructor(organizationId: string, transport: Transport = authenticatedRequest) {
        this.organizationId = organizationId;
        this.transport = transport;
    }
    private options(): RequestInit {
        if (!this.organizationId) throw new Error("Organização não disponível. Entre novamente.");
        return { headers: { "X-Organization-Id": this.organizationId } };
    }
    async list(page = 1, search = ""): Promise<CatalogPage> {
        const query = new URLSearchParams({page: String(page), page_size: "25"});
        if (search.trim()) query.set("search", search.trim());
        return this.transport<CatalogPage>(`/api/v1/products?${query}`, this.options());
    }
    async detail(id: string): Promise<CatalogProduct> {
        const product = await this.transport<CatalogProduct>(`/api/v1/products/${encodeURIComponent(id)}`, this.options());
        if (product.id !== id) throw new Error("Produto diferente do solicitado.");
        return product;
    }
    createProduct(product: ProductCreate): Promise<CatalogProduct> {
        const options = this.options();
        return this.transport<CatalogProduct>("/api/v1/admin/products", {
            ...options,
            method: "POST",
            headers: { ...options.headers, "Content-Type": "application/json" },
            body: JSON.stringify(product),
        }, false);
    }
    publishProduct(id: string, expectedVersion: number): Promise<CatalogProduct> {
        const options = this.options();
        return this.transport<CatalogProduct>(`/api/v1/admin/products/${encodeURIComponent(id)}/publish`, {
            ...options,
            method: "POST",
            headers: { ...options.headers, "Content-Type": "application/json" },
            body: JSON.stringify({ expected_version: expectedVersion }),
        }, false);
    }
}
export function catalogError(error: unknown): string {
    if (error instanceof ApiError) {
        const messages: Record<number, string> = {
            401: "Sessão expirada. Entre novamente.",
            403: "Sem autorização para consultar o catálogo.",
            404: "Produto não encontrado ou não publicado.",
            422: "Pesquisa inválida. Revise os dados informados.",
        };
        return messages[error.status] ?? "Não foi possível consultar o catálogo. Tente novamente.";
    }
    return error instanceof Error ? error.message : "Não foi possível consultar o catálogo.";
}
export function catalogMutationError(error: unknown, operation: "create" | "publish"): string {
    if (error instanceof ApiError) {
        const messages: Record<string, string> = {
            CAPABILITY_REQUIRED: "Sua conta não tem autorização administrativa para esta operação.",
            INVALID_SESSION: "Sua sessão expirou. Entre novamente.",
            PRODUCT_NOT_FOUND: "O produto não foi encontrado ou não está disponível para publicação.",
            PRODUCT_INCOMPLETE: "O produto está incompleto e não pode ser publicado.",
            REQUEST_VALIDATION_ERROR: "A API recusou os dados enviados. Revise os campos obrigatórios e seus formatos.",
            VERSION_CONFLICT: "A versão do produto mudou. Não foi possível publicar com a versão desta sessão.",
        };
        if (error.code && messages[error.code]) return messages[error.code];
        if (error.status === 401) return "Sua sessão expirou. Entre novamente.";
        if (error.status === 403) return "Sua conta não tem autorização administrativa para esta operação.";
        if (error.status === 404) return operation === "publish" ? "O rascunho não foi encontrado para publicação." : "O recurso solicitado não foi encontrado.";
        if (error.status === 409) return "A operação entrou em conflito com o estado atual do catálogo.";
        if (error.status === 422) return "A API recusou os dados enviados. Revise os campos obrigatórios e seus formatos.";
        if (error.status >= 500) return "O Backend retornou um erro. O resultado da operação pode ser incerto; não repita a solicitação.";
    }
    const message = error instanceof Error ? error.message : "Falha inesperada.";
    return `${message} O resultado da operação pode ser incerto; não repita a solicitação.`;
}
export function productCategory(category: string): string {
    if (category === "ALIMENTO_SECO_INDUSTRIALIZADO") return "Alimento seco industrializado";
    return category.replaceAll("_", " ").toLocaleLowerCase("pt-BR").replace(/^./, character => character.toLocaleUpperCase("pt-BR"));
}
export function catalogCategories(products: CatalogProduct[]): string[] {
    return [...new Set(products.map(product => product.category))].sort((left, right) => productCategory(left).localeCompare(productCategory(right), "pt-BR"));
}
export function publicationLabel(state: string): string {
    return state === "PUBLISHED" ? "Publicado" : state === "DRAFT" ? "Rascunho" : state;
}

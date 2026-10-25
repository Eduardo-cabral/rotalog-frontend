import { expect, test, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const organization = "33333333-3333-4333-8333-333333333333";
const outputDirectory = path.resolve("docs/pitch/img");

const buyer = {
    id: "pitch-buyer",
    name: "Comprador de demonstração",
    email: "pitch-buyer@example.invalid",
    role: "BUYER_ADMIN",
    organization_id: organization,
    organizations: [{ id: organization, name: "Organização de demonstração", role: "BUYER_ADMIN" }],
    capabilities: ["catalog:read", "checkout:create", "purchase:read"],
    demo_run_id: "pitch-run",
    is_synthetic: true,
} as const;

const product = {
    id: "pitch-product",
    name: "Arroz Tipo 1",
    brand: "RotaLog Seleção",
    category: "ALIMENTO_SECO_INDUSTRIALIZADO",
    gtin: null,
    net_content: 1000,
    net_content_unit: "g",
    packaging_type: "Fardo",
    packaging_quantity: 6,
    gross_weight_grams: 6200,
    volume_cm3: 1200,
    variant_attributes: {},
    publication_state: "PUBLISHED",
    version: 1,
    demo_run_id: "pitch-run",
    is_synthetic: true,
} as const;

const catalogProducts = [
    product,
    {
        ...product,
        id: "pitch-beans",
        name: "Feijão Carioca",
        brand: "Sabor da Terra",
        category: "ALIMENTO_SECO_INDUSTRIALIZADO",
        net_content: 1000,
        packaging_type: "Fardo",
        packaging_quantity: 10,
    },
    {
        ...product,
        id: "pitch-oil",
        name: "Óleo de Soja",
        brand: "Cooperativa Vale",
        category: "ALIMENTO_SECO_INDUSTRIALIZADO",
        net_content: 900,
        net_content_unit: "ml",
        packaging_type: "Caixa",
        packaging_quantity: 12,
    },
] as const;

const offer = {
    id: "pitch-offer",
    product_id: product.id,
    product_name: product.name,
    supplier_organization_id: "pitch-supplier",
    supplier_name: "Distribuidora Horizonte",
    warehouse_id: "pitch-warehouse",
    region: "Campinas",
    unit_price: "149.90",
    currency: "BRL",
    minimum_order_quantity: 2,
    available_quantity: 30,
    version: 1,
    is_active: true,
    demo_run_id: "pitch-run",
    is_synthetic: true,
} as const;

const catalogOffers = [
    offer,
    { ...offer, id: "pitch-beans-offer", product_id: "pitch-beans", product_name: "Feijão Carioca", unit_price: "189.50", supplier_name: "Sabor da Terra" },
    { ...offer, id: "pitch-oil-offer", product_id: "pitch-oil", product_name: "Óleo de Soja", unit_price: "132.00", supplier_name: "Cooperativa Vale" },
] as const;

const order = {
    order_number: "PED-PITCH-001",
    id: "pitch-order",
    purchase_id: "pitch-purchase",
    buyer_organization_id: organization,
    supplier_organization_id: offer.supplier_organization_id,
    warehouse_id: offer.warehouse_id,
    state: "SEPARATING",
    version: 1,
    accepts_partial: false,
    acceptance_deadline: "2026-10-26T15:00:00Z",
    currency: "BRL",
    total: "299.80",
    cancellation_reason: null,
    items: [{
        id: "pitch-item",
        offer_id: offer.id,
        product,
        unit_price: offer.unit_price,
        offer_version: 1,
        requested_quantity: 2,
        reserved_quantity: 2,
        supplier_accepted_quantity: 2,
        supplier_refused_quantity: 0,
        separated_quantity: 0,
        dispatched_quantity: 0,
        delivered_quantity: 0,
        buyer_accepted_quantity: 0,
        delivery_refused_quantity: 0,
        missing_quantity: 0,
        returning_quantity: 0,
        return_reconciled_quantity: 0,
        refunded_quantity: 0,
        financially_released_quantity: 0,
        financially_pending_quantity: 2,
    }],
    allowed_actions: [],
    is_synthetic: true,
    fulfillments: [],
} as const;

const purchase = {
    id: "pitch-purchase",
    checkout_id: "pitch-checkout",
    state: "ACTIVE",
    supplier_orders: [order],
    is_synthetic: true,
} as const;

async function prepareOutput() {
    await mkdir(outputDirectory, { recursive: true });
}

async function setupApiMocks(
    page: Page,
    options: { offerFailure?: boolean; orderState?: "ACCEPTED" | "SEPARATING" } = {},
) {
    await page.addInitScript(() => sessionStorage.setItem("rotalog:api-csrf", "pitch-csrf"));
    await page.route("http://localhost:8000/api/v1/**", async route => {
        const request = route.request();
        const url = new URL(request.url());
        const pathName = url.pathname;

        if (pathName === "/api/v1/auth/refresh") {
            return route.fulfill({
                json: {
                    access_token: "pitch-access-token",
                    token_type: "bearer",
                    expires_in: 600,
                    csrf_token: "pitch-csrf",
                    refresh_token: null,
                    user: buyer,
                },
            });
        }

        if (pathName === "/api/v1/me") return route.fulfill({ json: buyer });
        expect(request.headers()["x-organization-id"]).toBe(organization);

        if (pathName === "/api/v1/products") {
            return route.fulfill({
                json: { items: catalogProducts, total: catalogProducts.length, page: 1, page_size: 25, is_synthetic: true },
            });
        }
        if (pathName === `/api/v1/products/${product.id}`) return route.fulfill({ json: product });
        if (pathName === "/api/v1/offers") {
            if (options.offerFailure) {
                return route.fulfill({ status: 404, json: { error: { code: "OFFER_NOT_FOUND" } } });
            }
            const productId = url.searchParams.get("product_id");
            const matchingOffers = productId
                ? catalogOffers.filter(item => item.product_id === productId)
                : catalogOffers;
            return route.fulfill({
                json: { items: matchingOffers, total: matchingOffers.length, page: 1, page_size: 25, is_synthetic: true },
            });
        }
        if (pathName === "/api/v1/capacity-slots") {
            return route.fulfill({
                json: {
                    items: [{
                        id: "pitch-slot",
                        warehouse_id: offer.warehouse_id,
                        starts_at: "2026-10-27T12:00:00Z",
                        ends_at: "2026-10-27T16:00:00Z",
                        total_quantity: 50,
                        reserved_quantity: 0,
                    }],
                    total: 1,
                    page: 1,
                    page_size: 25,
                },
            });
        }
        if (pathName === "/api/v1/purchases/pitch-purchase") {
            return route.fulfill({
                json: {
                    ...purchase,
                    supplier_orders: [{ ...order, state: options.orderState ?? "ACCEPTED" }],
                },
            });
        }
        if (pathName === "/api/v1/purchases") {
            return route.fulfill({
                json: {
                    items: [{
                        ...purchase,
                        supplier_orders: [{ ...order, state: options.orderState ?? "ACCEPTED" }],
                    }],
                    total: 1,
                    page: 1,
                    page_size: 25,
                    is_synthetic: true,
                },
            });
        }
        return route.fulfill({ status: 404, json: { error: { code: "PITCH_ROUTE_NOT_MOCKED" } } });
    });
}

async function capture(page: Page, fileName: string) {
    await expect(page.getByRole("note")).toHaveText("Dados de demonstração");
    await expect(page.locator("body")).not.toContainText("Carregando");
    await page.screenshot({
        path: path.join(outputDirectory, fileName),
        fullPage: true,
        animations: "disabled",
    });
}

test.describe("capturas do pitch da jornada API com respostas interceptadas", () => {
    test.use({ viewport: { width: 1600, height: 1200 } });

    test("01 catálogo do comprador", async ({ page }) => {
        await prepareOutput();
        await setupApiMocks(page);
        await page.goto("/");
        await expect(page.getByRole("heading", { name: "Catálogo de produtos" })).toBeVisible();
        await expect(page.getByText("R$ 149,90")).toBeVisible();
        await expect(page.getByRole("heading", { name: "Feijão Carioca" })).toBeVisible();
        await expect(page.getByRole("heading", { name: "Óleo de Soja" })).toBeVisible();
        await capture(page, "01-catalogo.png");
    });

    test("02 carrinho preenchido com resumo", async ({ page }) => {
        await prepareOutput();
        await setupApiMocks(page);
        await page.goto(`/produto/${product.id}`);
        await page.getByRole("button", { name: "Adicionar ao carrinho", exact: true }).click();
        await expect(page.getByRole("status")).toContainText("Oferta adicionada");
        await page.getByRole("link", { name: "Ver carrinho" }).click();
        await expect(page).toHaveURL(/\/comprador\/carrinho$/);
        await expect(page.getByRole("heading", { name: product.name })).toBeVisible();
        await expect(page.getByLabel(`Quantidade de ${product.name}`)).toHaveValue("2");
        await expect(page.getByRole("region", { name: "Itens do carrinho" }).getByText("R$ 299,80")).toBeVisible();
        await expect(page.getByText("Subtotal consultado")).toBeVisible();
        await capture(page, "02-carrinho.png");
    });

    test("03 detalhes do pedido de demonstração", async ({ page }) => {
        await prepareOutput();
        await setupApiMocks(page);
        await page.goto("/comprador/compras/pitch-purchase");
        await expect(page.getByRole("heading", { name: "Compra #PITCH-PU" })).toBeVisible();
        await expect(page.getByRole("heading", { name: "Pedido PED-PITCH-001" })).toBeVisible();
        await expect(page.getByRole("heading", { name: "Arroz Tipo 1" })).toBeVisible();
        await expect(page.getByRole("progressbar", { name: "Etapas confirmadas da preparação" }).getByText("Pedido analisado")).toBeVisible();
        await capture(page, "03-pedido.png");
    });

    test("04 acompanhamento e linha do tempo da preparação", async ({ page }) => {
        await prepareOutput();
        await setupApiMocks(page, { orderState: "SEPARATING" });
        await page.goto("/comprador/compras/pitch-purchase");
        await expect(page.getByRole("heading", { name: "Preparação" })).toBeVisible();
        const timeline = page.getByRole("progressbar", { name: "Etapas confirmadas da preparação" });
        await expect(timeline).toBeVisible();
        await expect(timeline.getByText("Em preparação")).toBeVisible();
        await capture(page, "04-linha-do-tempo.png");
    });

    test("05 falha de consulta amigável com opção de recuperação", async ({ page }) => {
        await prepareOutput();
        await setupApiMocks(page, { offerFailure: true });
        await page.goto(`/produto/${product.id}`);
        await expect(page.getByRole("alert")).toContainText("Não foi possível concluir a consulta");
        await expect(page.getByRole("alert")).toContainText("Registro não encontrado ou não acessível à sua organização.");
        await expect(page.getByRole("button", { name: "Tentar novamente" })).toBeVisible();
        await page.screenshot({
            path: path.join(outputDirectory, "05-erro-amigavel.png"),
            fullPage: true,
            animations: "disabled",
        });
    });
});

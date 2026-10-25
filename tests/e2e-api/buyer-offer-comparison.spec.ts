import { expect, test, type Page } from "@playwright/test";

const organization = "22222222-2222-4222-8222-222222222222";
const buyer = {
    id: "buyer-user",
    name: "Comprador de demonstração",
    email: "buyer@example.invalid",
    role: "BUYER_ADMIN",
    organization_id: organization,
    organizations: [{ id: organization, name: "Organização compradora", role: "BUYER_ADMIN" }],
    capabilities: ["catalog:read", "purchase:read"],
    demo_run_id: "demo-run",
    is_synthetic: true,
} as const;

const product = {
    id: "product-1",
    name: "Arroz oficial",
    brand: "Marca oficial",
    category: "ALIMENTO_SECO_INDUSTRIALIZADO",
    gtin: null,
    net_content: 1000,
    net_content_unit: "g",
    packaging_type: "Pacote",
    packaging_quantity: 1,
    gross_weight_grams: 1050,
    volume_cm3: 1500,
    variant_attributes: {},
    publication_state: "PUBLISHED",
    version: 1,
    demo_run_id: "demo-run",
    is_synthetic: true,
} as const;

const offers = [
    {
        id: "offer-1",
        product_id: "product-1",
        product_name: "Arroz oficial",
        supplier_organization_id: "supplier-1",
        supplier_name: "Fornecedor Norte",
        warehouse_id: "warehouse-1",
        region: "Manaus",
        unit_price: "149.90",
        currency: "BRL",
        minimum_order_quantity: 4,
        available_quantity: 20,
        version: 1,
        is_active: true,
        demo_run_id: "demo-run",
        is_synthetic: true,
    },
    {
        id: "offer-2",
        product_id: "product-1",
        product_name: "Arroz oficial",
        supplier_organization_id: "supplier-2",
        supplier_name: "Fornecedor Sul",
        warehouse_id: "warehouse-2",
        region: "Itacoatiara",
        unit_price: "151.00",
        currency: "BRL",
        minimum_order_quantity: 2,
        available_quantity: 50,
        version: 1,
        is_active: true,
        demo_run_id: "demo-run",
        is_synthetic: true,
    },
] as const;

type MarkerMode = "synthetic" | "real" | "unknown";

function withMarker<T extends Record<string, unknown>>(record: T, mode: MarkerMode) {
    if (mode === "synthetic") return { ...record, is_synthetic: true, demo_run_id: "demo-run" };
    if (mode === "real") return { ...record, is_synthetic: false, demo_run_id: undefined };
    const { is_synthetic: _isSynthetic, demo_run_id: _demoRunId, ...unmarked } = record;
    return unmarked;
}

async function setup(page: Page, markerMode: MarkerMode = "synthetic") {
    await page.addInitScript(() => sessionStorage.setItem("rotalog:api-csrf", "csrf"));
    await page.route("http://localhost:8000/api/v1/**", async route => {
        const request = route.request();
        const url = new URL(request.url());
        const path = url.pathname;

        if (path === "/api/v1/auth/refresh") {
            expect(request.method()).toBe("POST");
            expect(request.headers()["x-csrf-token"]).toBe("csrf");
            return route.fulfill({
                json: {
                    access_token: "test-access",
                    token_type: "bearer",
                    expires_in: 600,
                    csrf_token: "csrf",
                    refresh_token: null,
                    user: buyer,
                },
            });
        }

        expect(request.headers().authorization).toBe("Bearer test-access");
        if (path === "/api/v1/me") return route.fulfill({ json: buyer });
        expect(request.method()).toBe("GET");
        expect(request.headers()["x-organization-id"]).toBe(organization);

        if (path === "/api/v1/products") {
            return route.fulfill({
                json: { items: [withMarker(product, markerMode)], total: 1, page: 1, page_size: 25 },
            });
        }
        if (path === "/api/v1/products/product-1") {
            return route.fulfill({ json: withMarker(product, markerMode) });
        }
        if (path === "/api/v1/offers") {
            if (url.searchParams.has("product_id")) {
                expect(url.searchParams.get("product_id")).toBe("product-1");
            }
            return route.fulfill({
                json: {
                    items: offers.map(offer => withMarker(offer, markerMode)),
                    total: offers.length,
                    page: 1,
                    page_size: 25,
                },
            });
        }
        return route.fulfill({ status: 404, json: { error: { code: "NOT_FOUND" } } });
    });
}

for (const width of [375, 1280]) {
    test(`comparação de duas ofertas sem overflow em ${width}px`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 });
        await setup(page);
        await page.goto("/");
        await expect(page.getByRole("note")).toHaveText("Dados de demonstração");
        await expect(page.getByRole("heading", { name: "Catálogo de produtos" })).toBeVisible();
        await page.goto("/produto/product-1");

        await expect(page.getByRole("note")).toHaveText("Dados de demonstração");
        await expect(page.getByRole("heading", { name: "Ofertas disponíveis" })).toBeVisible();
        await page.getByRole("checkbox", { name: /Fornecedor Norte/ }).check();
        await page.getByRole("checkbox", { name: /Fornecedor Sul/ }).check();
        await expect(page.getByRole("heading", { name: "Comparação de ofertas" })).toBeVisible();
        await expect(page.getByRole("button", { name: "Adicionar ao carrinho", exact: true })).toHaveCount(2);
        await expect(page.getByRole("button", { name: "Adicionar ao carrinho", exact: true }).first()).toBeDisabled();
        await expect(page.getByText("Menor preço unitário")).toBeVisible();
        await expect(page.getByText("Quantidade mínima").last()).toBeVisible();
        const cards = page.getByRole("region", { name: "Comparação de ofertas" }).locator("article");
        await expect(cards).toHaveCount(2);
        const firstCard = await cards.nth(0).boundingBox();
        const secondCard = await cards.nth(1).boundingBox();
        expect(firstCard).not.toBeNull();
        expect(secondCard).not.toBeNull();
        if (firstCard && secondCard) {
            if (width === 375) expect(secondCard.y).toBeGreaterThan(firstCard.y);
            else {
                expect(secondCard.x).toBeGreaterThan(firstCard.x);
                expect(secondCard.y).toBe(firstCard.y);
            }
        }
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
        const badge = await page.getByRole("note").boundingBox();
        expect(badge).not.toBeNull();
        if (badge) {
            expect(badge.x).toBeGreaterThanOrEqual(0);
            expect(badge.x + badge.width).toBeLessThanOrEqual(width);
        }
    });
}

for (const markerMode of ["real", "unknown"] as const) {
    test(`selo ausente quando os dados são ${markerMode === "real" ? "reais" : "não identificados"}`, async ({ page }) => {
        await setup(page, markerMode);
        await page.goto("/");
        await expect(page.getByRole("heading", { name: "Catálogo de produtos" })).toBeVisible();
        await expect(page.getByRole("note")).toHaveCount(0);
        await page.goto("/produto/product-1");
        await expect(page.getByRole("heading", { name: "Ofertas disponíveis" })).toBeVisible();
        await expect(page.getByRole("note")).toHaveCount(0);
    });
}

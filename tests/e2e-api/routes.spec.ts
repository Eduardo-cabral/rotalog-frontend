import { expect, test, type Page } from "@playwright/test";

const organizationId = "11111111-1111-4111-8111-111111111111";
const readyOrderId = "236b4d58-1111-4111-8111-111111111111";

type TestRole = "SUPPLIER_OPERATOR" | "BUYER_ADMIN" | "ROTALOG_ADMIN";

function makeOrder(id = readyOrderId, state = "READY_TO_DISPATCH") {
    return {
        id,
        state,
        purchase_id: "purchase-id",
        buyer_organization_id: "buyer-organization",
        supplier_organization_id: organizationId,
        warehouse_id: "warehouse-id",
        version: 7,
        accepts_partial: false,
        acceptance_deadline: "2099-01-01T00:00:00Z",
        currency: "BRL",
        total: "149.90",
        cancellation_reason: null,
        allowed_actions: [],
        is_synthetic: true,
        items: [{
            id: "line-id",
            offer_id: "offer-id",
            product: {
                id: "product-id",
                name: "Arroz fardo 6 × 5 kg",
                brand: "Marca de teste",
                category: "ALIMENTO_SECO_INDUSTRIALIZADO",
                gtin: null,
                net_content: 5000,
                net_content_unit: "g",
                packaging_type: "Fardo",
                packaging_quantity: 6,
                gross_weight_grams: 30000,
                volume_cm3: 30000,
                variant_attributes: {},
                publication_state: "PUBLISHED",
                version: 1,
                demo_run_id: "demo-run",
                is_synthetic: true,
            },
            unit_price: "149.90",
            currency: "BRL",
            offer_version: 1,
            requested_quantity: 1,
            reserved_quantity: 1,
            supplier_accepted_quantity: 1,
            supplier_refused_quantity: 0,
            separated_quantity: 1,
            dispatched_quantity: 0,
            delivered_quantity: 0,
            buyer_accepted_quantity: 0,
            delivery_refused_quantity: 0,
            missing_quantity: 0,
            returning_quantity: 0,
            return_reconciled_quantity: 0,
            refunded_quantity: 0,
            financially_released_quantity: 0,
            financially_pending_quantity: 0,
        }],
        fulfillments: [],
    };
}

async function setup(page: Page, options: { role?: TestRole; capabilities?: string[]; orders?: ReturnType<typeof makeOrder>[]; listStatus?: number; networkFailure?: boolean } = {}) {
    const role = options.role ?? "SUPPLIER_OPERATOR";
    const state = {
        orders: options.orders ?? [makeOrder()],
        listStatus: options.listStatus,
        networkFailure: options.networkFailure ?? false,
        routePosts: 0,
        orderReads: 0,
    };
    const capabilities = options.capabilities ?? (role === "SUPPLIER_OPERATOR"
        ? ["catalog:read", "offer:write", "inventory:write", "supplier_order:manage"]
        : role === "BUYER_ADMIN"
            ? ["catalog:read", "checkout:create", "purchase:read"]
            : ["catalog:read", "product:write", "warehouse:review"]);
    const user = {
        id: "test-user",
        name: "Usuário de teste",
        email: "test@example.invalid",
        role,
        organization_id: organizationId,
        organizations: [{ id: organizationId, name: "Organização de teste", role }],
        capabilities,
        demo_run_id: "demo-run",
        is_synthetic: true,
    };

    await page.addInitScript(() => sessionStorage.setItem("rotalog:api-csrf", "routes-test-csrf"));
    await page.route("http://localhost:8000/api/v1/**", async route => {
        const request = route.request();
        const url = new URL(request.url());
        const path = url.pathname;

        if (path.endsWith("/auth/refresh")) {
            return route.fulfill({ json: { access_token: "test-access", token_type: "bearer", expires_in: 600, csrf_token: "routes-test-csrf", refresh_token: null, user } });
        }
        if (path.endsWith("/me")) return route.fulfill({ json: user });
        if (path.endsWith("/auth/logout")) return route.fulfill({ status: 204 });

        if (request.method() === "POST") {
            state.routePosts++;
            return route.fulfill({ status: 500, json: { error: { code: "UNEXPECTED_WRITE" } } });
        }
        if (path === "/api/v1/supplier-orders") {
            state.orderReads++;
            if (state.networkFailure) return route.abort("failed");
            if (state.listStatus) return route.fulfill({ status: state.listStatus, json: { error: { code: state.listStatus === 403 ? "CAPABILITY_REQUIRED" : "SERVER_ERROR" } } });
            const pageNumber = Number(url.searchParams.get("page"));
            return route.fulfill({ json: { items: pageNumber === 1 ? state.orders : [], total: state.orders.length, page: pageNumber, page_size: 100, is_synthetic: true } });
        }
        if (path.startsWith("/api/v1/supplier-orders/")) {
            const order = state.orders.find(item => path.endsWith(`/${item.id}`));
            return order
                ? route.fulfill({ json: order })
                : route.fulfill({ status: 404, json: { error: { code: "SUPPLIER_ORDER_NOT_FOUND" } } });
        }
        if (path === "/api/v1/products") return route.fulfill({ json: { items: [], total: 0, page: 1, page_size: 25, is_synthetic: true } });
        if (path === "/api/v1/offers") return route.fulfill({ json: { items: [], total: 0, page: 1, page_size: Number(url.searchParams.get("page_size") ?? 25) } });
        if (path === "/api/v1/warehouses") return route.fulfill({ json: { items: [], total: 0, page: Number(url.searchParams.get("page") ?? 1), page_size: 100 } });
        if (path === "/api/v1/inventory") return route.fulfill({ json: { items: [], total: 0, page: Number(url.searchParams.get("page") ?? 1), page_size: 25 } });
        return route.fulfill({ status: 404, json: { error: { code: "NOT_FOUND" } } });
    });
    return state;
}

test("fornecedor autorizado consulta somente pedidos prontos e não recebe ação de atribuição", async ({ page }) => {
    const state = await setup(page, { orders: [makeOrder(), makeOrder("another-id", "SEPARATING")] });
    await page.goto("/fornecedor/rotas");

    await expect(page.getByRole("heading", { name: "Pedidos prontos para coleta" })).toBeVisible();
    const card = page.locator("li").filter({ hasText: "Pedido #236B4D58" });
    await expect(card).toContainText("Pronto para coleta");
    await expect(card.getByText("1", { exact: true })).toBeVisible();
    await expect(card.getByText("R$ 149,90", { exact: true })).toBeVisible();
    await expect(card.getByText(readyOrderId, { exact: true })).toHaveCount(0);
    await expect(card.getByText(/Versão/i)).toHaveCount(0);
    await expect(page.getByText("A atribuição de motoristas estará disponível em breve.")).toBeVisible();
    await expect(page.getByRole("button", { name: /atribuir motorista|criar rota/i })).toHaveCount(0);
    expect(state.routePosts).toBe(0);
});

test("pedido pronto abre os detalhes integrados sem sugerir transporte", async ({ page }) => {
    await setup(page);
    await page.goto("/fornecedor/rotas");
    await page.getByRole("link", { name: "Ver detalhes do pedido" }).click();

    await expect(page).toHaveURL(new RegExp(`/fornecedor/pedidos\\?order=${readyOrderId}`));
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText("Pronto para coleta", { exact: true })).toBeVisible();
    await expect(dialog.getByText(/não confirma coleta|não confirma.*transporte/i).first()).toBeVisible();
});

test("estado vazio de pedidos prontos apresenta acesso à lista de pedidos", async ({ page }) => {
    await setup(page, { orders: [makeOrder("separating-order", "SEPARATING")] });
    await page.goto("/fornecedor/rotas");

    await expect(page.getByRole("heading", { name: "Nenhum pedido pronto para coleta" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Consultar todos os pedidos" })).toHaveAttribute("href", "/fornecedor/pedidos");
});

test("erro de autorização permanece explícito e oferece nova consulta", async ({ page }) => {
    await setup(page, { listStatus: 403 });
    await page.goto("/fornecedor/rotas");

    await expect(page.getByRole("alert")).toContainText("Sem autorização");
    await expect(page.getByRole("button", { name: "Tentar novamente" })).toBeVisible();
});

test("falha de rede permanece explícita e permite tentar novamente", async ({ page }) => {
    await setup(page, { networkFailure: true });
    await page.goto("/fornecedor/rotas");

    await expect(page.getByRole("alert")).toContainText("Não foi possível consultar os pedidos");
    await expect(page.getByRole("button", { name: "Tentar novamente" })).toBeVisible();
});

test("offer:write isolada permite produtos, bloqueia rotas e não consulta pedidos", async ({ page }) => {
    const state = await setup(page, { capabilities: ["offer:write"] });
    await page.goto("/fornecedor/produtos");
    await expect(page.getByRole("heading", { name: "Produtos", exact: true })).toBeVisible();
    expect(state.orderReads).toBe(0);

    await page.goto("/fornecedor/rotas");
    await expect(page.getByRole("heading", { name: "Acesso não autorizado", exact: true })).toBeVisible();
    expect(state.orderReads).toBe(0);
});

test("inventory:write isolada permite estoque, bloqueia rotas e não consulta pedidos", async ({ page }) => {
    const state = await setup(page, { capabilities: ["inventory:write"] });
    await page.goto("/fornecedor/estoque");
    await expect(page.getByRole("heading", { name: "Estoque", exact: true })).toBeVisible();
    await expect(page.getByText("Nenhum registro de estoque encontrado para esta consulta.")).toBeVisible();
    expect(state.orderReads).toBe(0);

    await page.goto("/fornecedor/rotas");
    await expect(page.getByRole("heading", { name: "Acesso não autorizado", exact: true })).toBeVisible();
    expect(state.orderReads).toBe(0);
});

for (const role of ["BUYER_ADMIN", "ROTALOG_ADMIN"] as const) {
    test(`${role} não acessa a página de rotas do fornecedor`, async ({ page }) => {
        await setup(page, { role });
        await page.goto("/fornecedor/rotas");
        await expect(page).not.toHaveURL(/\/fornecedor\/rotas/);
    });
}

test("layout de rotas funciona em viewport estreito", async ({ page }) => {
    await setup(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/fornecedor/rotas");

    await expect(page.getByRole("heading", { name: "Pedidos prontos para coleta" })).toBeVisible();
    const hasHorizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect(hasHorizontalOverflow).toBe(false);
});

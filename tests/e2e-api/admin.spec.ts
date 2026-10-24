import { test, expect, type Page } from "@playwright/test";

const organization = "admin-org";
const product = {
    id: "product-001",
    name: "Arroz canônico",
    brand: "Marca exemplo",
    category: "ALIMENTO_SECO_INDUSTRIALIZADO",
    gtin: null,
    net_content: 1000,
    net_content_unit: "g",
    packaging_type: "Fardo",
    packaging_quantity: 6,
    gross_weight_grams: 6200,
    volume_cm3: 1000,
    variant_attributes: { apresentacao: "integral" },
    publication_state: "PUBLISHED",
    version: 2,
    demo_run_id: "demo",
    is_synthetic: true,
};
type Role = "ROTALOG_ADMIN" | "BUYER_ADMIN" | "SUPPLIER_OPERATOR";
type State = {
    role: Role;
    capabilities: string[];
    products: typeof product[];
    createRequests: unknown[];
    publishRequests: unknown[];
    createNetwork: boolean;
    publishNetwork: boolean;
    publishStatus: number;
    adminRequests: string[];
};

async function setup(page: Page, role: Role = "ROTALOG_ADMIN", restore = true) {
    const state: State = {
        role,
        capabilities: role === "ROTALOG_ADMIN"
            ? ["catalog:read", "product:write", "warehouse:review"]
            : role === "BUYER_ADMIN"
                ? ["catalog:read", "checkout:create", "purchase:read"]
                : ["catalog:read", "offer:write", "inventory:write", "supplier_order:manage"],
        products: [],
        createRequests: [],
        publishRequests: [],
        createNetwork: false,
        publishNetwork: false,
        publishStatus: 0,
        adminRequests: [],
    };
    if (restore) await page.addInitScript(() => sessionStorage.setItem("rotalog:api-csrf", "synthetic-csrf"));
    await page.route("http://localhost:8000/**", async route => {
        const request = route.request();
        const url = new URL(request.url());
        const path = url.pathname;
        const user = {
            id: "synthetic-user",
            name: "Administração Sintética",
            email: "admin@example.invalid",
            role: state.role,
            organization_id: organization,
            organizations: [{ id: organization, name: "Organização Sintética", role: state.role }],
            capabilities: state.capabilities,
            demo_run_id: "demo",
            is_synthetic: true,
        };
        const token = { access_token: "synthetic-token", token_type: "bearer", expires_in: 600, csrf_token: "synthetic-csrf", refresh_token: null, user };
        if (path.endsWith("/auth/login") || path.endsWith("/auth/refresh")) return route.fulfill({ json: token });
        if (path.endsWith("/auth/logout")) return route.fulfill({ status: 204 });
        if (path === "/api/v1/me") return route.fulfill({ json: user });

        state.adminRequests.push(`${request.method()} ${path}`);
        expect(request.headers()["authorization"]).toBe("Bearer synthetic-token");
        expect(request.headers()["x-organization-id"]).toBe(organization);

        if (path === "/api/v1/products" && request.method() === "GET") {
            const items = state.products.filter(item => item.publication_state === "PUBLISHED");
            const pageNumber = Number(url.searchParams.get("page") ?? "1");
            const pageSize = Number(url.searchParams.get("page_size") ?? "25");
            const search = url.searchParams.get("search")?.toLowerCase() ?? "";
            const filtered = items.filter(item => item.name.toLowerCase().includes(search));
            const start = (pageNumber - 1) * pageSize;
            return route.fulfill({ json: { items: filtered.slice(start, start + pageSize), total: filtered.length, page: pageNumber, page_size: pageSize, is_synthetic: true, label: "SIMULAÇÃO — dados sintéticos" } });
        }
        if (path === "/api/v1/admin/products" && request.method() === "POST") {
            const body = request.postDataJSON() as Record<string, unknown>;
            state.createRequests.push(body);
            state.products.push({ ...product, ...body, id: "created-product", publication_state: "DRAFT", version: 1 });
            if (state.createNetwork) return route.abort();
            return route.fulfill({ status: 201, json: state.products.at(-1) });
        }
        if (path === "/api/v1/admin/products/created-product/publish" && request.method() === "POST") {
            state.publishRequests.push(request.postDataJSON());
            if (state.publishNetwork) {
                state.products = state.products.map(item => item.id === "created-product" ? { ...item, publication_state: "PUBLISHED", version: item.version + 1 } : item);
                return route.abort();
            }
            if (state.publishStatus) return route.fulfill({ status: state.publishStatus, json: { error: { code: state.publishStatus === 409 ? "VERSION_CONFLICT" : "CAPABILITY_REQUIRED", message: "Falha sintética", request_id: "request-123" } } });
            const published = state.products.find(item => item.id === "created-product");
            if (!published) return route.fulfill({ status: 404, json: { error: { code: "PRODUCT_NOT_FOUND", message: "Produto não encontrado.", request_id: "request-123" } } });
            const response = { ...published, publication_state: "PUBLISHED", version: published.version + 1 };
            state.products = state.products.map(item => item.id === response.id ? response : item);
            return route.fulfill({ json: response });
        }
        if (path.startsWith("/api/v1/products/") && request.method() === "GET") {
            const id = path.split("/").at(-1);
            const found = state.products.find(item => item.id === id && item.publication_state === "PUBLISHED");
            return found
                ? route.fulfill({ json: found })
                : route.fulfill({ status: 404, json: { error: { code: "PRODUCT_NOT_FOUND", message: "Produto não encontrado.", request_id: "request-123" } } });
        }
        if (path === "/api/v1/offers" && request.method() === "GET") return route.fulfill({ json: { items: [], total: 0, page: 1, page_size: 100 } });
        if (path === "/api/v1/supplier-orders" && request.method() === "GET") return route.fulfill({ json: { items: [], total: 0, page: 1, page_size: 25 } });
        state.adminRequests.pop();
        return route.abort();
    });
    return state;
}

async function loginAsAdmin(page: Page) {
    await page.goto("/login");
    await page.getByLabel("E-mail", { exact: true }).fill("admin@example.invalid");
    await page.getByLabel("Senha", { exact: true }).fill("synthetic-password");
    await page.getByRole("button", { name: "Entrar", exact: true }).click();
    await expect(page).toHaveURL(/\/admin$/);
}

async function fillValidProduct(page: Page) {
    await page.getByLabel("Nome do produto").fill("Arroz integral 6x1kg");
    await page.getByLabel("Marca").fill("Marca sintética");
    await page.getByLabel("GTIN (opcional)").fill("12345678");
    await page.getByLabel("Conteúdo líquido").fill("1000");
    await page.getByLabel("Tipo de embalagem").fill("Fardo");
    await page.getByLabel("Quantidade por embalagem").fill("6");
    await page.getByLabel("Peso bruto (gramas)").fill("6200");
    await page.getByLabel("Volume (cm³)").fill("1000");
}

test("login administrativo consulta perfil e redireciona ao portal", async ({ page }) => {
    const state = await setup(page, "ROTALOG_ADMIN", false);
    await loginAsAdmin(page);
    await expect(page.getByRole("heading", { name: "Catálogo canônico" })).toBeVisible();
    expect(state.adminRequests).toEqual([]);
});

test("restaura sessão administrativa diretamente na rota protegida", async ({ page }) => {
    const state = await setup(page);
    await page.goto("/admin");
    await expect(page.getByRole("heading", { name: "Catálogo canônico" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Produtos publicados", exact: true })).toBeVisible();
    expect(state.adminRequests).toEqual([]);
});

for (const role of ["BUYER_ADMIN", "SUPPLIER_OPERATOR"] as const) {
    test(`bloqueia ${role} no portal administrativo`, async ({ page }) => {
        const state = await setup(page, role);
        await page.goto("/admin/products/new");
        await expect(page).not.toHaveURL(/\/admin/);
        await expect(page.getByRole("heading", { name: "Cadastrar produto canônico" })).toHaveCount(0);
        expect(state.adminRequests.filter(path => path.includes("/admin/products"))).toEqual([]);
    });
}

test("lista apenas publicados, pesquisa, pagina e exibe estado vazio", async ({ page }) => {
    const state = await setup(page);
    state.products = Array.from({ length: 27 }, (_, index) => ({ ...product, id: `published-${index}`, name: index === 0 ? "Arroz branco" : `Produto ${index}`, version: 1 }));
    await page.goto("/admin/products");
    await expect(page.getByRole("heading", { name: "Produtos publicados" })).toBeVisible();
    await expect(page.getByRole("article", { name: "Arroz branco" })).toBeVisible();
    await expect(page.getByLabel("Categoria nesta página")).toHaveCount(0);
    await expect(page.getByRole("img", { name: "Imagem de Arroz branco não disponível" })).toBeVisible();
    await expect(page.getByText("PUBLISHED", { exact: true })).toHaveCount(0);
    await page.getByLabel("Buscar produto").fill("arroz");
    await page.getByRole("button", { name: "Pesquisar", exact: true }).click();
    await expect(page.getByRole("article", { name: "Arroz branco" })).toBeVisible();
    await expect(page.getByText("Página 1 de 1 · 1 produto(s)")).toBeVisible();
    await page.getByLabel("Buscar produto").fill("inexistente");
    await page.getByRole("button", { name: "Pesquisar", exact: true }).click();
    await expect(page.getByRole("status")).toContainText("Nenhum produto publicado corresponde");
    state.products = [];
    await page.reload();
    await expect(page.getByRole("status")).toContainText("Ainda não há produtos publicados");
});

test("valida formulário e cria produto canônico como rascunho", async ({ page }) => {
    const state = await setup(page);
    await page.goto("/admin/products/new");
    await expect(page.getByRole("img", { name: "Imagem de novo produto não disponível" })).toBeVisible();
    await expect(page.getByRole("button", { name: /upload|adicionar imagem/i })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Características adicionais do produto" })).toBeVisible();
    await expect(page.getByLabel("Característica", { exact: true })).toHaveCount(0);
    await page.getByRole("button", { name: "Cadastrar como rascunho" }).click();
    expect(state.createRequests).toHaveLength(0);
    await fillValidProduct(page);
    await page.getByRole("button", { name: "Adicionar característica" }).click();
    await page.getByRole("button", { name: "Cadastrar como rascunho" }).click();
    await expect(page.getByRole("alert")).toContainText("Preencha a característica e a descrição");
    expect(state.createRequests).toHaveLength(0);

    await page.getByLabel("Característica", { exact: true }).nth(0).fill("Sabor");
    await page.getByLabel("Descrição", { exact: true }).nth(0).fill("Chocolate");
    await page.getByRole("button", { name: "Adicionar característica" }).click();
    await page.getByLabel("Característica", { exact: true }).nth(1).fill(" sabor ");
    await page.getByLabel("Descrição", { exact: true }).nth(1).fill("Baunilha");
    await page.getByRole("button", { name: "Cadastrar como rascunho" }).click();
    await expect(page.getByRole("alert")).toContainText("está repetida");
    expect(state.createRequests).toHaveLength(0);

    await page.getByLabel("Característica", { exact: true }).nth(1).fill("Apresentação");
    await page.getByLabel("Descrição", { exact: true }).nth(1).fill("Integral");
    await page.getByRole("button", { name: "Remover característica 1" }).click();
    await expect(page.getByLabel("Característica", { exact: true })).toHaveCount(1);
    await page.getByRole("button", { name: "Adicionar característica" }).click();
    await page.getByLabel("Característica", { exact: true }).nth(1).fill("Sabor");
    await page.getByLabel("Descrição", { exact: true }).nth(1).fill("Chocolate");
    await page.getByRole("button", { name: "Cadastrar como rascunho" }).click();
    await expect(page.getByRole("heading", { name: "Arroz integral 6x1kg" })).toBeVisible();
    await expect(page.getByText("Rascunho criado", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Publicar produto" })).toBeVisible();
    expect(state.createRequests).toHaveLength(1);
    expect(state.createRequests[0]).toEqual({
        name: "Arroz integral 6x1kg",
        brand: "Marca sintética",
        category: "ALIMENTO_SECO_INDUSTRIALIZADO",
        gtin: "12345678",
        net_content: 1000,
        net_content_unit: "g",
        packaging_type: "Fardo",
        packaging_quantity: 6,
        gross_weight_grams: 6200,
        volume_cm3: 1000,
        variant_attributes: { apresentacao: "Integral", sabor: "Chocolate" },
    });
});

test("cadastra produto sem características adicionais", async ({ page }) => {
    const state = await setup(page);
    await page.goto("/admin/products/new");
    await fillValidProduct(page);
    await page.getByRole("button", { name: "Cadastrar como rascunho" }).click();
    await expect(page.getByText("Rascunho criado", { exact: true })).toBeVisible();
    expect(state.createRequests).toHaveLength(1);
    expect(state.createRequests[0]).toMatchObject({ variant_attributes: {} });
});

test("limita a vinte características permitidas pela API", async ({ page }) => {
    await setup(page);
    await page.goto("/admin/products/new");
    for (let index = 0; index < 20; index++) {
        await page.getByRole("button", { name: "Adicionar característica" }).click();
    }
    await expect(page.getByLabel("Característica", { exact: true })).toHaveCount(20);
    await expect(page.getByRole("button", { name: "Adicionar característica" })).toBeDisabled();
    await expect(page.getByText("20 de 20", { exact: true })).toBeVisible();
});

for (const width of [360, 768, 1440]) {
    test(`portal administrativo sem overflow em ${width}px`, async ({ page }) => {
        await setup(page);
        await page.setViewportSize({ width, height: 900 });
        await page.goto("/admin/products");
        await expect(page.getByRole("heading", { name: "Produtos publicados" })).toBeVisible();
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        await page.goto("/admin/products/new");
        await expect(page.getByRole("heading", { name: "Cadastrar produto canônico" })).toBeVisible();
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    });
}

test("publica com expected_version e encontra produto no catálogo", async ({ page }) => {
    const state = await setup(page);
    await page.goto("/admin/products/new");
    await fillValidProduct(page);
    await page.getByRole("button", { name: "Cadastrar como rascunho" }).click();
    await page.getByRole("button", { name: "Publicar produto" }).click();
    await expect(page.getByText("Produto publicado", { exact: true })).toBeVisible();
    expect(state.publishRequests).toEqual([{ expected_version: 1 }]);
    await page.getByRole("link", { name: "Consultar catálogo publicado" }).click();
    await expect(page.getByRole("article", { name: "Arroz integral 6x1kg" })).toBeVisible();
    await page.getByRole("button", { name: "Ver detalhes" }).click();
    await expect(page.getByRole("dialog").getByText("Arroz integral 6x1kg")).toBeVisible();
});

test("conflito de publicação preserva rascunho e oferece somente consulta segura", async ({ page }) => {
    const state = await setup(page);
    state.publishStatus = 409;
    await page.goto("/admin/products/new");
    await fillValidProduct(page);
    await page.getByRole("button", { name: "Cadastrar como rascunho" }).click();
    await page.getByRole("button", { name: "Publicar produto" }).click();
    await expect(page.getByRole("alert")).toContainText("versão do produto mudou");
    await expect(page.getByRole("button", { name: "Publicar produto" })).toHaveCount(0);
    await page.getByRole("button", { name: "Consultar se foi publicado" }).click();
    await expect(page.getByText(/Backend não permite consultar rascunhos/)).toBeVisible();
    expect(state.publishRequests).toEqual([{ expected_version: 1 }]);
});

test("falha de rede após cadastro não repete POST e explica a limitação", async ({ page }) => {
    const state = await setup(page);
    state.createNetwork = true;
    await page.goto("/admin/products/new");
    await fillValidProduct(page);
    await page.getByRole("button", { name: "Cadastrar como rascunho" }).click();
    await expect(page.getByRole("alert")).toContainText("Resultado do cadastro não confirmado");
    await expect(page.getByRole("button", { name: "Cadastrar como rascunho" })).toHaveCount(0);
    expect(state.createRequests).toHaveLength(1);
    expect(state.publishRequests).toHaveLength(0);
});

test("falha de resposta na publicação é verificada por GET sem repetir POST", async ({ page }) => {
    const state = await setup(page);
    state.publishNetwork = true;
    await page.goto("/admin/products/new");
    await fillValidProduct(page);
    await page.getByRole("button", { name: "Cadastrar como rascunho" }).click();
    await page.getByRole("button", { name: "Publicar produto" }).click();
    await expect(page.getByRole("alert")).toContainText("resultado da operação pode ser incerto");
    await page.getByRole("button", { name: "Consultar se foi publicado" }).click();
    await expect(page.getByText("Produto publicado", { exact: true })).toBeVisible();
    expect(state.publishRequests).toEqual([{ expected_version: 1 }]);
});

test("erro 403 mantém cadastro em sessão sem publicar", async ({ page }) => {
    const state = await setup(page);
    state.publishStatus = 403;
    await page.goto("/admin/products/new");
    await fillValidProduct(page);
    await page.getByRole("button", { name: "Cadastrar como rascunho" }).click();
    await page.getByRole("button", { name: "Publicar produto" }).click();
    await expect(page.getByRole("alert")).toContainText("não tem autorização administrativa");
    await expect(page.getByText("Rascunho criado", { exact: true })).toBeVisible();
    expect(state.publishRequests).toHaveLength(1);
});

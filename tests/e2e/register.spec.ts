import { expect, test } from "@playwright/test";

const apiMode = process.env.VITE_AUTH_MODE === "api";
const registerRoute = "**/api/v1/auth/register";
const password = "Synthetic-password-12";

function registeredUser(
    email: string,
    name: string,
    organizationName: string,
    role: "BUYER_ADMIN" | "SUPPLIER_OPERATOR",
) {
    const organizationId = role === "BUYER_ADMIN" ? "buyer-org" : "supplier-org";
    return {
        id: "synthetic-user",
        email,
        name,
        role,
        organization_id: organizationId,
        organizations: [{ id: organizationId, name: organizationName, role }],
        capabilities: [],
        demo_run_id: "synthetic-demo",
        is_synthetic: true,
    };
}

async function fillRegistration(
    page: import("@playwright/test").Page,
    options: { role?: "buyer" | "supplier"; email?: string } = {},
) {
    const { role = "buyer", email = "new-user@example.invalid" } = options;
    if (role === "supplier") {
        await page.getByRole("button", { name: "Fornecedor", exact: true }).click();
    }
    await page.getByLabel(role === "buyer" ? "Nome da organização" : "Razão social").fill("Synthetic Organization");
    await page.getByLabel(role === "buyer" ? "Nome completo" : "Nome do responsável").fill("Synthetic User");
    await page.getByLabel("E-mail").fill(email);
    await page.getByLabel("Senha", { exact: true }).fill(password);
    await page.getByLabel("Confirmar senha").fill(password);
}

test("o modo mock deixa claro que não cria contas", async ({ page }) => {
    test.skip(apiMode, "Este cenário verifica a separação do modo mock.");
    let registrationRequests = 0;
    await page.route(registerRoute, async route => {
        registrationRequests++;
        await route.fulfill({ status: 201, json: {} });
    });
    await page.goto("/cadastro");
    await expect(page.getByRole("status")).toContainText("Nenhuma conta será criada");
    await expect(page.getByRole("button", { name: "Criar conta" })).toBeDisabled();
    expect(registrationRequests).toBe(0);
});

test("valida formato de e-mail, domínio sintético, tamanho e confirmação da senha", async ({ page }) => {
    test.skip(!apiMode, "Este cenário requer a configuração API com interceptação de rede.");
    let registrationRequests = 0;
    await page.route(registerRoute, async route => {
        registrationRequests++;
        await route.fulfill({ status: 201, json: {} });
    });
    await page.goto("/cadastro");
    await fillRegistration(page);
    await page.getByLabel("Nome da organização").fill("  ");
    await page.getByRole("button", { name: "Criar conta" }).click();
    await expect(page.getByRole("alert")).toContainText("nome da organização");

    await page.getByLabel("Nome da organização").fill("Synthetic Organization");
    await page.getByLabel("E-mail").fill("invalid-email");
    await page.getByRole("button", { name: "Criar conta" }).click();
    await expect(page.getByLabel("E-mail")).toHaveJSProperty("validity.valid", false);
    await expect(page.getByRole("alert")).toContainText("e-mail válido");

    await page.getByLabel("E-mail").fill("valid@example.com");
    await page.getByRole("button", { name: "Criar conta" }).click();
    await expect(page.getByRole("alert")).toContainText(".invalid");

    await page.getByLabel("E-mail").fill("valid@example.invalid");
    await page.getByLabel("Senha", { exact: true }).fill("short");
    await page.getByLabel("Confirmar senha").fill("short");
    await page.getByRole("button", { name: "Criar conta" }).click();
    await expect(page.getByRole("alert")).toContainText("12");

    await page.getByLabel("Senha", { exact: true }).fill(password);
    await page.getByLabel("Confirmar senha").fill("Different-password-12");
    await page.getByRole("button", { name: "Criar conta" }).click();
    await expect(page.getByRole("alert")).toContainText("não coincidem");
    expect(registrationRequests).toBe(0);
});

for (const account of [
    { label: "comprador", role: "buyer" as const, apiRole: "BUYER_ADMIN" as const, email: "buyer@example.invalid" },
    { label: "fornecedor", role: "supplier" as const, apiRole: "SUPPLIER_OPERATOR" as const, email: "supplier@example.invalid" },
]) {
    test(`cadastra ${account.label} com o contrato exato e encaminha ao login`, async ({ page }) => {
        test.skip(!apiMode, "Este cenário requer a configuração API com interceptação de rede.");
        let receivedBody: unknown;
        await page.route(registerRoute, async route => {
            receivedBody = route.request().postDataJSON();
            await route.fulfill({
                status: 201,
                json: registeredUser(account.email, "Synthetic User", "Synthetic Organization", account.apiRole),
            });
        });
        await page.goto("/cadastro");
        await fillRegistration(page, { role: account.role, email: account.email });
        await page.getByRole("button", { name: "Criar conta" }).click();
        await expect(page).toHaveURL(/\/login$/);
        await expect(page.getByLabel("E-mail")).toHaveValue(account.email);
        await expect(page.getByRole("status")).toContainText("Cadastro criado");
        expect(receivedBody).toEqual({
            email: account.email,
            password,
            name: "Synthetic User",
            organization_name: "Synthetic Organization",
            role: account.apiRole,
        });
        expect(await page.evaluate(() =>
            [...Object.values(localStorage), ...Object.values(sessionStorage)].join("\n"),
        )).not.toContain(password);
    });
}

test("mostra conflito de e-mail duplicado sem perder o formulário", async ({ page }) => {
    test.skip(!apiMode, "Este cenário requer a configuração API com interceptação de rede.");
    await page.route(registerRoute, route => route.fulfill({
        status: 409,
        json: { error: { code: "EMAIL_ALREADY_REGISTERED" } },
    }));
    await page.goto("/cadastro");
    await fillRegistration(page);
    await page.getByRole("button", { name: "Criar conta" }).click();
    await expect(page.getByRole("alert")).toContainText("já está cadastrado");
    await expect(page.getByLabel("E-mail")).toHaveValue("new-user@example.invalid");
});

test("informa falhas de rede e servidor sem indicar sucesso", async ({ page }) => {
    test.skip(!apiMode, "Este cenário requer a configuração API com interceptação de rede.");
    await page.route(registerRoute, route => route.abort());
    await page.goto("/cadastro");
    await fillRegistration(page);
    await page.getByRole("button", { name: "Criar conta" }).click();
    await expect(page.getByRole("alert")).toContainText("conectar ao Backend");
    await expect(page).toHaveURL(/\/cadastro$/);

    await page.unroute(registerRoute);
    await page.route(registerRoute, route => route.fulfill({
        status: 500,
        json: { error: { code: "INTERNAL_SERVER_ERROR" } },
    }));
    await page.getByRole("button", { name: "Criar conta" }).click();
    await expect(page.getByRole("alert")).toContainText("servidor não conseguiu");
    await expect(page).toHaveURL(/\/cadastro$/);
});

test("impede submissão duplicada enquanto aguarda a API", async ({ page }) => {
    test.skip(!apiMode, "Este cenário requer a configuração API com interceptação de rede.");
    let releaseRequest!: () => void;
    let requestArrived!: () => void;
    const pending = new Promise<void>(resolve => { releaseRequest = resolve; });
    const arrived = new Promise<void>(resolve => { requestArrived = resolve; });
    let requestCount = 0;
    await page.route(registerRoute, async route => {
        requestCount++;
        requestArrived();
        await pending;
        await route.fulfill({
            status: 201,
            json: registeredUser("new-user@example.invalid", "Synthetic User", "Synthetic Organization", "BUYER_ADMIN"),
        });
    });
    await page.goto("/cadastro");
    await fillRegistration(page);
    const submit = page.getByRole("button", { name: "Criar conta" });
    await submit.click();
    await arrived;
    await expect(page.getByRole("button", { name: "Enviando..." })).toBeDisabled();
    expect(requestCount).toBe(1);
    releaseRequest();
    await expect(page).toHaveURL(/\/login$/);
    expect(requestCount).toBe(1);
});

test("mantém o formulário dentro de viewports móveis e desktop", async ({ page }) => {
    test.skip(!apiMode, "Este cenário requer a configuração API com interceptação de rede.");
    await page.goto("/cadastro");
    for (const width of [360, 768, 1440]) {
        await page.setViewportSize({ width, height: 900 });
        await expect(page.getByRole("heading", { name: "Crie sua conta" })).toBeVisible();
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
        const form = await page.locator("form").boundingBox();
        expect(form).not.toBeNull();
        expect(form!.x).toBeGreaterThanOrEqual(0);
        expect(form!.x + form!.width).toBeLessThanOrEqual(width + 1);
    }
});

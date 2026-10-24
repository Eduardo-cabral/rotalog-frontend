import { test, expect, type Page } from "@playwright/test";

const key = "rotalog:supplier-orders:v1";

test.beforeEach(async ({ context }) => {
    await context.addInitScript(() => {
        sessionStorage.setItem("rotalog:mock-auth-user", JSON.stringify({ id: "test", name: "Teste", email: "teste@rotalog.test", role: "SUPPLIER_OPERATOR" }));
        // APIs ausentes quando o dev server é acessado por HTTP na rede.
        Object.defineProperty(navigator, "locks", { value: undefined });
        Object.defineProperty(crypto, "randomUUID", { value: undefined });
    });
});

async function balance(page: Page, code: string) {
    const cells = page.getByRole("row").filter({ has: page.getByRole("cell", { name: code, exact: true }) }).getByRole("cell");
    await expect(cells).toHaveCount(8);
    return { physical: Number(await cells.nth(3).innerText()), reserved: Number(await cells.nth(4).innerText()), available: Number(await cells.nth(5).innerText()) };
}

test("pedido de teste aceita sem Web Locks, atualiza as duas telas e persiste após recarregar", async ({ page, context }) => {
    await page.goto("/fornecedor/pedidos");
    const inventory = await context.newPage();
    await inventory.goto("/fornecedor/estoque");
    const before = await balance(inventory, "PROD-001");
    await page.getByRole("button", { name: "+ Pedido de teste" }).click();
    const card = page.locator("article").filter({ hasText: "Cliente fictício" });
    await expect(card).toHaveCount(1);
    const snapshot = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!), key);
    const created = snapshot.find((order: { id: string }) => order.id.startsWith("TESTE-"));
    expect(created.organizationId).toBe("fornecedor-001");
    expect(created.orderItems.map((item: { productId: string }) => item.productId)).toEqual(["PROD-001", "PROD-002"]);
    await expect(card.getByRole("heading", { name: "TESTE-001", exact: true })).toBeVisible();
    await card.getByRole("button", { name: "Ver detalhes do pedido TESTE-001", exact: true }).click();
    const details = page.getByRole("dialog");
    await expect(details.getByRole("heading", { name: "TESTE-001", exact: true })).toBeVisible();
    const currency = (value: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
    for (const item of created.orderItems) {
        const row = details.getByRole("row").filter({ hasText: item.productId });
        await expect(row.getByRole("cell").nth(0)).toContainText(item.productName);
        await expect(row.getByRole("cell").nth(1)).toHaveText(String(item.quantity));
        await expect(row.getByRole("cell").nth(2)).toHaveText(item.productId === "PROD-001" ? "Saco" : "m³");
        await expect(row.getByRole("cell").nth(3)).toHaveText(currency(item.unitPrice));
        await expect(row.getByRole("cell").nth(4)).toHaveText(currency(item.quantity * item.unitPrice));
    }
    await expect(details.getByRole("region", { name: "Resumo financeiro", exact: true })).toContainText(currency(created.orderItems.reduce((sum: number, item: { quantity: number; unitPrice: number }) => sum + item.quantity * item.unitPrice, 0)));
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    const technicalDetails = details.locator("details");
    await expect(technicalDetails).not.toHaveAttribute("open", "");
    await technicalDetails.locator("summary").click();
    await expect(technicalDetails.locator("code")).toHaveText(created.id);
    await technicalDetails.getByRole("button", { name: "Copiar identificador", exact: true }).click();
    await expect(technicalDetails.getByRole("status")).toHaveText("Identificador copiado.");
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(created.id);
    await details.getByRole("button", { name: "Fechar detalhes do pedido", exact: true }).click();
    expect(await balance(inventory, "PROD-001")).toEqual(before);
    await card.getByRole("button", { name: /^Aceitar pedido/ }).click();
    await page.getByRole("button", { name: "Confirmar aceite", exact: true }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(card.getByRole("button", { name: "Iniciar separação" })).toBeVisible();
    await expect(card.getByRole("heading", { name: "TESTE-001", exact: true })).toBeVisible();
    await expect.poll(() => balance(inventory, "PROD-001")).toEqual({ physical: before.physical, reserved: before.reserved + 1, available: before.available - 1 });
    const accepted = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!), key);
    expect(accepted.filter((order: { id: string }) => order.id !== created.id)).toEqual(snapshot.filter((order: { id: string }) => order.id !== created.id));
    await Promise.all([page.reload(), inventory.reload()]);
    await expect(card.getByRole("button", { name: "Iniciar separação" })).toBeVisible();
    expect(await balance(inventory, "PROD-001")).toEqual({ physical: before.physical, reserved: before.reserved + 1, available: before.available - 1 });
    // Uma segunda aba também acompanha mudanças de pedidos sem recarregar.
    const mirror = await context.newPage();
    await mirror.goto("/fornecedor/pedidos");
    await card.getByRole("button", { name: "Iniciar separação" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Iniciar separação", exact: true }).click();
    await expect(mirror.locator("article").filter({ hasText: "Cliente fictício" }).getByRole("button", { name: "Marcar como pronto" })).toBeVisible();
});

test("rótulos curtos persistidos, identificador técnico recolhido e miniatura do produto correspondente", async ({ page }) => {
    await page.goto("/fornecedor/pedidos");
    await page.getByRole("button", { name: "+ Pedido de teste" }).click();
    const originalId = "TESTE-3e6968b543f1c00328015ea2578537";
    const snapshot = await page.evaluate(async ({ key, originalId }) => {
        const base = JSON.parse(localStorage.getItem(key)!).find((order: { id: string }) => order.id.startsWith("TESTE-"));
        const orders = [{ ...base, id: originalId, customer: "Comprador original" }, { ...base, id: "TESTE-001", customer: "Pedido antigo" }];
        localStorage.setItem(key, JSON.stringify(orders));
        const imageModule = "/src/features/products/services/productImages.service.ts";
        const catalogModule = "/src/features/products/services/supplierProducts.service.ts";
        const { productImageStorage } = await import(imageModule);
        const catalog = await import(catalogModule);
        const canvas = document.createElement("canvas");
        canvas.width = canvas.height = 8;
        canvas.getContext("2d")!.fillRect(0, 0, 8, 8);
        const blob = await new Promise<Blob>(resolve => canvas.toBlob(blob => resolve(blob!)));
        const imageRef = await productImageStorage.put(base.organizationId, blob);
        const product = catalog.getSupplierProducts(base.organizationId).find((item: { id: string }) => item.id === base.orderItems[0].productId);
        catalog.editSupplierProduct(base.organizationId, product.id, { ...product, imageRef });
        return localStorage.getItem(key);
    }, { key, originalId });
    await page.reload();
    const card = page.locator("article").filter({ hasText: "Comprador original" });
    const label = await card.getByRole("heading").innerText();
    expect(label).toMatch(/^TESTE-\d{3,}$/);
    expect(label).not.toBe("TESTE-001");
    await card.getByRole("button", { name: /^Ver detalhes/ }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("heading", { name: label, exact: true })).toBeVisible();
    const technicalDetails = dialog.locator("details");
    await expect(technicalDetails).not.toHaveAttribute("open", "");
    await expect(technicalDetails.locator("code")).toBeHidden();
    await technicalDetails.locator("summary").click();
    await expect(technicalDetails.locator("code")).toHaveText(originalId);
    await expect(dialog.getByRole("img")).toHaveCount(1);
    await expect(dialog.getByRole("img")).toBeVisible();
    await page.keyboard.press("Escape");
    await page.evaluate(key => localStorage.setItem(key, JSON.stringify(JSON.parse(localStorage.getItem(key)!).reverse())), key);
    await page.reload();
    await expect(card.getByRole("heading")).toHaveText(label);
    await page.getByRole("searchbox").fill("Comprador original");
    await expect(card.getByRole("heading")).toHaveText(label);
    await page.goto("/fornecedor");
    await expect(page.getByRole("row").filter({ hasText: "Comprador original" }).getByRole("cell").first()).toHaveText(label);
    const after = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!), key);
    expect(after.reverse()).toEqual(JSON.parse(snapshot!));
});

test("detalhes disponíveis em todas as etapas, UUID legado curto e textos longos contidos", async ({ page }) => {
    await page.goto("/fornecedor/pedidos");
    await page.getByRole("button", { name: "+ Pedido de teste" }).click();
    const stored = await page.evaluate(key => {
        const base = JSON.parse(localStorage.getItem(key)!).find((order: { id: string }) => order.id.startsWith("TESTE-"));
        const orders = [
            { ...base, id: "TESTE-01234567-89ab-cdef-0123-456789abcdef", customer: "Comprador".repeat(60) },
            { ...base, id: "LONGO".repeat(40), commercialStatus: "Aceito" },
            { ...base, id: "SEPARANDO", commercialStatus: "Aceito", custodyStatus: "Em separação" },
            { ...base, id: "PRONTO", commercialStatus: "Aceito", custodyStatus: "Pronto para coleta" },
            { ...base, id: "TRANSPORTE", commercialStatus: "Aceito", custodyStatus: "Em transporte" },
            { ...base, id: "FINALIZADO", commercialStatus: "Aceito", custodyStatus: "Entregue", orderItems: undefined },
        ];
        localStorage.setItem(key, JSON.stringify(orders));
        return localStorage.getItem(key);
    }, key);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.reload();
    for (const stage of ["new", "accepted", "separating", "ready", "transport"]) {
        const card = page.locator(`#supplier-orders-${stage} article`);
        await card.getByRole("button", { name: /^Ver detalhes do pedido/ }).click();
        expect(await card.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
        const dialog = page.getByRole("dialog");
        await expect(dialog).toBeVisible();
        if (stage === "new") await expect(dialog.getByRole("heading", { name: /^TESTE-\d{3,}$/ })).toBeVisible();
        if (stage !== "new") await expect(card.getByRole("button", { name: /^(Aceitar|Recusar) pedido/ })).toHaveCount(0);
        await page.keyboard.press("Escape");
        await expect(dialog).toHaveCount(0);
    }
    await page.getByRole("tab", { name: /^Histórico/ }).click();
    await page.getByRole("button", { name: "Ver detalhes do pedido FINALIZADO", exact: true }).click();
    await expect(page.getByRole("dialog").getByRole("table")).toHaveCount(0);
    await page.keyboard.press("Escape");
    expect(await page.evaluate(key => localStorage.getItem(key), key)).toBe(stored);
});

test("pedido antigo sem itens exibe erro no aceite e permanece intacto", async ({ page }) => {
    await page.goto("/fornecedor/pedidos");
    await page.getByRole("button", { name: "+ Pedido de teste" }).click();
    const before = await page.evaluate(key => {
        const orders = JSON.parse(localStorage.getItem(key)!);
        delete orders.find((order: { id: string }) => order.id.startsWith("TESTE-")).orderItems;
        localStorage.setItem(key, JSON.stringify(orders));
        return localStorage.getItem(key);
    }, key);
    await page.reload();
    await page.locator("article").filter({ hasText: "Cliente fictício" }).getByRole("button", { name: /^Aceitar pedido/ }).click();
    await page.getByRole("button", { name: "Confirmar aceite", exact: true }).click();
    await expect(page.getByRole("dialog").getByRole("alert")).toContainText("Pedido sem itens válidos");
    expect(await page.evaluate(key => localStorage.getItem(key), key)).toBe(before);
});

test("aceite simultâneo do mesmo pedido em duas abas cria uma única reserva", async ({ page, context }) => {
    await page.goto("/fornecedor/pedidos");
    await page.getByRole("button", { name: "+ Pedido de teste" }).click();
    const other = await context.newPage();
    await other.goto("/fornecedor/pedidos");
    for (const tab of [page, other]) {
        await tab.locator("article").filter({ hasText: "Cliente fictício" }).getByRole("button", { name: /^Aceitar pedido/ }).click();
    }
    await Promise.all([page, other].map(tab => tab.getByRole("button", { name: "Confirmar aceite", exact: true }).click()));
    await expect.poll(async () => {
        const saved = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!), key);
        return saved.filter((order: { id: string; stockReservation?: unknown }) => order.id.startsWith("TESTE-") && order.stockReservation).length;
    }).toBe(1);
    await other.goto("/fornecedor/estoque");
    expect(await balance(other, "PROD-001")).toEqual({ physical: 120, reserved: 1, available: 119 });
});

test("dados inválidos aparecem como erro em Pedidos e Estoque sem serem apagados", async ({ page }) => {
    await page.goto("/fornecedor/pedidos");
    await page.evaluate(key => localStorage.setItem(key, "{invalid"), key);
    await page.reload();
    await expect(page.getByRole("alert")).toContainText("Pedidos salvos inválidos");
    await page.goto("/fornecedor/estoque");
    await expect(page.getByRole("alert").first()).toContainText("Pedidos salvos inválidos");
    expect(await page.evaluate(key => localStorage.getItem(key), key)).toBe("{invalid");
});

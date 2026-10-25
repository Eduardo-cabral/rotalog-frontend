import { expect, test } from "@playwright/test";

test.beforeEach(async ({ context }) => {
    await context.addInitScript(() => sessionStorage.setItem(
        "rotalog:mock-auth-user",
        JSON.stringify({
            id: "buyer-ui",
            name: "Comprador de demonstração",
            email: "comprador@rotalog.test",
            role: "BUYER_ADMIN",
        }),
    ));
});

test("catálogo destaca preço, unidade, disponibilidade e fallback visual", async ({ page }) => {
    await page.route("**/images/products/**", route => route.abort());
    await page.goto("/");
    await expect(page.getByRole("note")).toHaveText("Dados de demonstração");
    const product = page.getByRole("article").filter({ hasText: "Cimento CP II 50 kg" });
    await expect(page.getByRole("heading", { name: "Produtos disponíveis" })).toBeVisible();
    await expect(product.getByText("R$ 39,90")).toBeVisible();
    await expect(product.getByText("por saco")).toBeVisible();
    await expect(product.getByText("Disponível")).toBeVisible();
    await expect(product.getByRole("link", { name: "Ver produto" })).toBeVisible();
    await expect(product.locator("img")).toHaveCount(0);
});

test("carrinho vazio e preenchido preserva os controles e destaca os totais", async ({ page }) => {
    await page.goto("/comprador/carrinho");
    await expect(page.getByRole("heading", { name: "Seu carrinho está vazio" })).toBeVisible();
    await expect(page.getByRole("note")).toHaveCount(0);
    await page.getByRole("link", { name: /Explorar produtos/ }).click();
    await page.getByRole("link", { name: "Ver produto" }).first().click();
    await expect(page.getByRole("note")).toHaveText("Dados de demonstração");
    await page.getByRole("button", { name: "Adicionar ao carrinho" }).click();
    await expect(page).toHaveURL(/\/comprador\/carrinho$/);
    await expect(page.getByRole("note")).toHaveText("Dados de demonstração");
    await expect(page.getByRole("heading", { name: "Resumo da compra" })).toBeVisible();
    await expect(page.getByText("Subtotal dos produtos")).toBeVisible();
    await expect(page.getByRole("button", { name: "Revisar condições da compra" })).toBeDisabled();
    await page.getByRole("checkbox").first().check();
    await expect(page.getByRole("button", { name: "Revisar condições da compra" })).toBeEnabled();
    await page.getByRole("button", { name: "Revisar condições da compra" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Condições revisadas" })).toBeVisible();
    await expect(page.getByRole("note")).toHaveText("Dados de demonstração");
});

test("histórico e detalhes mostram estados em linguagem clara", async ({ page }) => {
    await page.goto("/comprador/compras");
    await expect(page.getByRole("heading", { name: "Minhas compras" })).toBeVisible();
    await expect(page.getByRole("note")).toHaveText("Dados de demonstração");
    await expect(page.getByText("#COMP-001")).toBeVisible();
    await expect(page.getByText("Valor previsto").first()).toBeVisible();
    await expect(page.getByText("Aguardando confirmação")).toBeVisible();
    await page.getByRole("link", { name: "Ver detalhes" }).nth(1).click();
    await expect(page.getByRole("note")).toHaveText("Dados de demonstração");
    await expect(page.getByRole("link", { name: "Voltar às compras" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Detalhes da compra #COMP-002" })).toBeVisible();
    await expect(page.getByText("Falha no pedido").first()).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("páginas do comprador permanecem responsivas em celular, tablet e desktop", async ({ page }) => {
    for (const width of [360, 375, 768, 1280, 1440]) {
        await page.setViewportSize({ width, height: 900 });
        for (const route of ["/", "/produto/produto-001", "/comprador/carrinho", "/comprador/compras", "/comprador/compras/COMP-001"]) {
            await page.goto(route);
            expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `${route} em ${width}px`).toBe(true);
            const badge = page.getByRole("note");
            if (await badge.count()) {
                const box = await badge.boundingBox();
                expect(box, `${route} em ${width}px`).not.toBeNull();
                if (box) {
                    expect(box.x, `${route} em ${width}px`).toBeGreaterThanOrEqual(0);
                    expect(box.x + box.width, `${route} em ${width}px`).toBeLessThanOrEqual(width);
                }
            }
        }
    }
});

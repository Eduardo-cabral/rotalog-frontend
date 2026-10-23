import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { MemoryRouter, Outlet, Route, Routes } from "react-router-dom";
import type { ReactNode } from "react";
import { BuyerApiCatalog } from "./BuyerApiCatalog";
import { BuyerApiProductDetails } from "./BuyerApiProductDetails";
import { BuyerApiPurchaseDetails } from "./BuyerApiPurchases";

const mocks = vi.hoisted(() => ({
    products: vi.fn(),
    offers: vi.fn(),
    product: vi.fn(),
    purchase: vi.fn(),
    purchases: vi.fn(),
}));

vi.mock("../../auth/hooks/useAuth", () => ({
    useAuth: () => ({
        user: { organization_id: "buyer-org", capabilities: ["catalog:read", "purchase:read"] },
    }),
}));

vi.mock("./BuyerReadRepository", () => ({
    BuyerReadRepository: vi.fn(function () {
        return mocks;
    }),
    buyerReadError: (error: unknown) => error instanceof Error ? error.message : "Falha",
}));

const product = {
    id: "product-1",
    name: "Arroz",
    brand: "Marca",
    category: "ALIMENTO_SECO_INDUSTRIALIZADO",
    net_content: 5000,
    net_content_unit: "g",
    packaging_type: "SACO",
    packaging_quantity: 6,
};
const offer = {
    id: "offer-1",
    product_id: "product-1",
    product_name: "Arroz",
    supplier_name: "Fornecedor real",
    supplier_organization_id: "supplier-org",
    warehouse_id: "warehouse",
    region: "Manaus",
    unit_price: "149.90",
    currency: "BRL",
    minimum_order_quantity: 1,
    available_quantity: 20,
    version: 1,
    is_active: true,
    demo_run_id: "run",
    is_synthetic: true,
};
const lowerOffer = {
    ...offer,
    id: "offer-2",
    supplier_name: "Fornecedor menor",
    unit_price: "4.00",
};
const purchase = {
    id: "purchase-1",
    checkout_id: "checkout-1",
    state: "CONFIRMED",
    is_synthetic: true,
    supplier_orders: [{
        id: "order-1",
        buyer_organization_id: "buyer-org",
        state: "AWAITING_SUPPLIER_DECISION",
        total: "149.90",
        items: [{
            id: "item-1",
            product,
            requested_quantity: 1,
            supplier_accepted_quantity: 0,
            separated_quantity: 0,
            unit_price: "149.90",
        }],
    }],
};

function renderRoute(path: string, element: ReactNode, route: string) {
    return render(
        <MemoryRouter initialEntries={[path]}>
            <Routes>
                <Route element={<Outlet context={{ search: "" }} />}>
                    <Route path={route} element={element} />
                </Route>
            </Routes>
        </MemoryRouter>,
    );
}

beforeEach(() => {
    mocks.products.mockResolvedValue([product]);
    mocks.offers.mockResolvedValue([offer, lowerOffer]);
    mocks.product.mockResolvedValue(product);
    mocks.purchase.mockResolvedValue(purchase);
    mocks.purchases.mockResolvedValue([purchase]);
});

afterEach(() => {
    cleanup();
    vi.clearAllMocks();
});

test("renders API products using the lowest active offer price", async () => {
    renderRoute("/", <BuyerApiCatalog />, "/");

    expect(await screen.findByRole("heading", { name: "Arroz" })).toBeTruthy();
    expect(screen.getByText("R$ 4,00")).toBeTruthy();
    expect(screen.getByText(/menor oferta por Fornecedor menor/)).toBeTruthy();
});

test("renders product offers and their API price", async () => {
    renderRoute("/produto/product-1", <BuyerApiProductDetails />, "/produto/:productId");

    expect(await screen.findByRole("heading", { name: "Ofertas dos fornecedores" })).toBeTruthy();
    expect(screen.getByText("Fornecedor real")).toBeTruthy();
    expect(screen.getByText("R$ 149,90")).toBeTruthy();
});

test("shows explicit empty and error states for API catalog data", async () => {
    mocks.products.mockResolvedValueOnce([]);
    mocks.offers.mockResolvedValueOnce([]);
    renderRoute("/", <BuyerApiCatalog />, "/");
    expect(await screen.findByText("Não há produtos publicados disponíveis para esta organização.")).toBeTruthy();

    cleanup();
    mocks.products.mockRejectedValueOnce(new Error("Backend indisponível"));
    renderRoute("/", <BuyerApiCatalog />, "/");
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(screen.getByText("Backend indisponível")).toBeTruthy();
});

test("renders API purchase and linked supplier-order state", async () => {
    renderRoute("/comprador/compras/purchase-1", <BuyerApiPurchaseDetails />, "/comprador/compras/:purchaseId");

    expect(await screen.findByText("Situação da compra: CONFIRMED")).toBeTruthy();
    expect(screen.getByText("Aguardando aceite")).toBeTruthy();
    expect(screen.getByText("Arroz")).toBeTruthy();
    await waitFor(() => expect(mocks.purchase).toHaveBeenCalledWith("purchase-1"));
});

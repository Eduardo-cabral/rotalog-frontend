import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import App from "../App";
import { AuthProvider } from "../features/auth/context/AuthProvider";
import { CartProvider } from "../features/cart/context/CartProvider";

vi.mock("../shared/api/config", () => ({
    authMode: "mock",
    apiUrl: "http://localhost:8000",
}));

afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    localStorage.clear();
    sessionStorage.clear();
});

test("renders the initial marketplace screen without calling the API", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    render(
        <AuthProvider>
            <CartProvider>
                <App />
            </CartProvider>
        </AuthProvider>,
    );

    expect(
        screen.getByRole("heading", {
            name: "Tudo para o seu negócio em um só lugar",
        }),
    ).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Categorias" })).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
});

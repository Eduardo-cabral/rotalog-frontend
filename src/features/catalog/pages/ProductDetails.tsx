
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useCart } from "../../cart/hooks/useCart";
import { authMode } from "../../../shared/api/config";
import { DemoDataBadge } from "../../buyer/components/DemoDataBadge";

import {
    catalogProducts,
    formatPrice,
} from "../mocks/products.mock";

export function ProductDetails() {
    const { addToCart } = useCart();
    const navigate = useNavigate();
    const { productId } = useParams<{ productId: string }>();
    const [quantity, setQuantity] = useState(1);

    const product = catalogProducts.find(
        (item) => item.id === productId
    );

    function handleAddToCart() {
        if (!product || !product.available) return;

        addToCart({
            supplierId: product.supplierId,
            supplierName: product.supplier,
            productId: product.id,
            productName: product.name,
            quantity,
            unitPrice: product.price,
        });

        navigate("/comprador/carrinho");
    }

    if (!product) {
        return (
            <section className="mx-auto flex min-h-[360px] max-w-5xl items-center justify-center">
                <div className="w-full rounded-xl border border-slate-200 bg-white px-6 py-12 text-center">
                    <h1 className="text-xl font-semibold text-slate-900">
                        Produto não encontrado
                    </h1>

                    <p className="mt-2 text-sm text-slate-500">
                        O produto solicitado não está disponível no catálogo.
                    </p>

                    <Link
                        to="/"
                        className="mt-6 inline-flex rounded-lg bg-blue-700 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-blue-800"
                    >
                        Voltar ao catálogo
                    </Link>
                </div>
            </section>
        );
    }

    const subtotal = product.price * quantity;

    return (
        <div className="mx-auto w-full max-w-[1120px] text-slate-900">
            <nav
                aria-label="Navegação"
                className="mb-5 flex flex-wrap items-center gap-2 text-xs text-slate-500"
            >
                <Link
                    to="/"
                    className="transition hover:text-blue-700"
                >
                    Catálogo
                </Link>

                <span aria-hidden="true">/</span>

                <span>{product.category}</span>

                <span aria-hidden="true">/</span>

                <span className="font-medium text-slate-800">
                    {product.name}
                </span>
            </nav>

            <div className="mb-5"><DemoDataBadge visible={authMode === "mock"}/></div>

            <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
                {/* Imagem do produto */}
                <section
                    aria-label={`Imagem de ${product.name}`}
                    className="overflow-hidden rounded-xl border border-slate-200 bg-white"
                >
                    <div className="flex h-[280px] items-center justify-center bg-white p-4 sm:h-[360px] lg:h-[420px]">
                        <img
                            src={product.image}
                            alt={product.name}
                            className="h-full w-full object-contain"
                        />
                    </div>
                </section>

                {/* Informações e compra */}
                <section className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
                    <span className="inline-flex rounded-md bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-blue-700">
                        {product.category}
                    </span>

                    <h1 className="mt-3 text-[22px] font-bold leading-tight tracking-tight sm:text-2xl">
                        {product.name}
                    </h1>

                    <p className="mt-2 text-[13px] text-slate-500">
                        Vendido por{" "}
                        <span className="font-medium text-slate-700">
                            {product.supplier}
                        </span>
                    </p>

                    <div className="mt-5 border-t border-slate-100 pt-5">
                        <p className="text-[26px] font-bold tracking-tight text-blue-700">
                            {formatPrice(product.price)}
                        </p>

                        <p className="mt-0.5 text-xs text-slate-500">
                            Preço por {product.unit}
                        </p>
                    </div>

                    <div className="mt-4 flex items-center gap-2">
                        <span
                            className={`h-2 w-2 rounded-full ${product.available
                                    ? "bg-emerald-500"
                                    : "bg-red-500"
                                }`}
                            aria-hidden="true"
                        />

                        <span
                            className={`text-xs font-medium ${product.available
                                    ? "text-emerald-700"
                                    : "text-red-700"
                                }`}
                        >
                            {product.available
                                ? "Produto disponível"
                                : "Produto indisponível"}
                        </span>
                    </div>

                    <div className="mt-5 border-t border-slate-100 pt-5">
                        <label
                            id="product-quantity-label"
                            className="block text-xs font-semibold text-slate-700"
                        >
                            Quantidade
                        </label>

                        <div
                            role="group"
                            aria-labelledby="product-quantity-label"
                            className="mt-2 inline-flex h-10 items-center overflow-hidden rounded-lg border border-slate-200"
                        >
                            <button
                                type="button"
                                onClick={() =>
                                    setQuantity((current) => Math.max(1, current - 1))
                                }
                                disabled={quantity <= 1}
                                aria-label="Diminuir quantidade"
                                className="flex h-full w-10 items-center justify-center text-base text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                                −
                            </button>

                            <span className="min-w-10 text-center text-sm font-semibold">
                                {quantity}
                            </span>

                            <button
                                type="button"
                                onClick={() =>
                                    setQuantity((current) => current + 1)
                                }
                                aria-label="Aumentar quantidade"
                                className="flex h-full w-10 items-center justify-center text-base text-slate-700 transition hover:bg-slate-50"
                            >
                                +
                            </button>
                        </div>
                    </div>

                    <div className="mt-5 flex items-center justify-between gap-4 rounded-lg bg-slate-50 px-4 py-3">
                        <span className="text-sm text-slate-600">
                            Subtotal
                        </span>

                        <span className="text-lg font-bold tracking-tight">
                            {formatPrice(subtotal)}
                        </span>
                    </div>

                    <button
                        type="button"
                        onClick={handleAddToCart}
                        disabled={!product.available}
                        className="mt-3 flex h-11 w-full items-center justify-center rounded-lg bg-blue-700 px-5 text-sm font-semibold text-white transition hover:bg-blue-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                    >
                        Adicionar ao carrinho
                    </button>

                    <p className="mt-3 text-center text-xs leading-5 text-slate-500">
                        Revise os produtos e as condições no carrinho antes
                        de realizar sua compra.
                    </p>
                </section>
            </div>

            {/* Descrição */}
            <section className="mt-5 rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
                <h2 className="text-base font-semibold text-slate-900">
                    Descrição do produto
                </h2>

                <p className="mt-3 max-w-4xl text-sm leading-6 text-slate-600">
                    {product.description}
                </p>
            </section>
        </div>
    );
}

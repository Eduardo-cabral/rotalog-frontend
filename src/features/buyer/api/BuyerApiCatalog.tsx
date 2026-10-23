import { useEffect, useMemo, useState } from "react";
import { Link, useOutletContext } from "react-router-dom";
import { cents, formatMoney } from "../../orders/api/orderAdapter";
import { useAuth } from "../../auth/hooks/useAuth";
import { productCategory, type CatalogProduct } from "../../products/api/catalogRepository";
import type { Offer } from "../../products/api/offersRepository";
import { BuyerReadRepository, buyerReadError } from "./BuyerReadRepository";

type MarketplaceContext = { search: string };
type CatalogData = { products: CatalogProduct[]; offers: Offer[] };
type LoadState = { key: string; data?: CatalogData; error?: string };
const card = "rounded-xl border border-slate-200 bg-white p-5 shadow-sm";

function packageDescription(product: CatalogProduct): string {
    return `${product.packaging_quantity} × ${product.net_content} ${product.net_content_unit} · ${product.packaging_type}`;
}

export function BuyerApiCatalog() {
    const { search } = useOutletContext<MarketplaceContext>();
    const { user } = useAuth();
    const repository = useMemo(
        () => new BuyerReadRepository(user?.organization_id ?? ""),
        [user?.organization_id],
    );
    const [result, setResult] = useState<LoadState>({ key: "" });
    const [revision, setRevision] = useState(0);
    const requestKey = `${user?.organization_id ?? ""}:${revision}`;

    useEffect(() => {
        let active = true;
        void Promise.all([repository.products(), repository.offers()])
            .then(([products, offers]) => {
                if (active) setResult({ key: requestKey, data: { products, offers } });
            })
            .catch(reason => {
                if (active) setResult({ key: requestKey, error: buyerReadError(reason) });
            });
        return () => {
            active = false;
        };
    }, [repository, requestKey]);

    const loading = result.key !== requestKey;
    const data = result.key === requestKey ? result.data : undefined;
    const error = result.key === requestKey ? result.error ?? "" : "";

    const filteredProducts = useMemo(() => {
        if (!data) return [];
        const term = search.trim().toLocaleLowerCase("pt-BR");
        return data.products.filter(product => {
            const productOffers = data.offers.filter(offer => offer.product_id === product.id);
            return !term ||
                [product.name, product.brand, product.category, ...productOffers.map(offer => offer.supplier_name)]
                    .some(value => value.toLocaleLowerCase("pt-BR").includes(term));
        });
    }, [data, search]);

    if (loading) {
        return <p className={card} role="status" aria-live="polite">Carregando produtos e ofertas...</p>;
    }
    if (error) {
        return (
            <section className="rounded-xl border border-red-200 bg-red-50 p-5" role="alert">
                <h1 className="font-semibold text-red-800">Não foi possível carregar o catálogo</h1>
                <p className="mt-2 text-sm text-red-700">{error}</p>
                <button className="mt-4 rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white" onClick={() => setRevision(value => value + 1)}>
                    Tentar novamente
                </button>
            </section>
        );
    }

    return (
        <div className="mx-auto w-full max-w-[1120px] text-slate-900">
            <header className="rounded-xl bg-gradient-to-r from-[#122a55] to-[#1d4d94] px-6 py-7 text-white sm:px-8">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-blue-200">Marketplace RotaLog</p>
                <h1 className="mt-2 text-2xl font-bold sm:text-[28px]">Produtos e ofertas disponíveis</h1>
                <p className="mt-3 max-w-xl text-sm leading-5 text-blue-100">
                    Consulte produtos publicados e os preços informados pelos fornecedores.
                </p>
            </header>

            <section className="mt-7" aria-labelledby="buyer-products-title">
                <div className="flex flex-wrap items-end justify-between gap-3">
                    <div>
                        <h2 id="buyer-products-title" className="text-lg font-bold">Catálogo de produtos</h2>
                        <p className="mt-1 text-xs text-slate-500">Preços e condições vêm das ofertas ativas retornadas pelo Backend.</p>
                    </div>
                    <span className="text-xs font-medium text-slate-500">{filteredProducts.length} produto(s)</span>
                </div>

                {filteredProducts.length === 0 ? (
                    <div className={`${card} mt-4 text-center`}>
                        <h3 className="font-semibold">Nenhum produto encontrado</h3>
                        <p className="mt-2 text-sm text-slate-500">
                            {data?.products.length ? "Tente outro termo de busca." : "Não há produtos publicados disponíveis para esta organização."}
                        </p>
                    </div>
                ) : (
                    <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                        {filteredProducts.map(product => {
                            const activeOffers = data?.offers.filter(offer =>
                                offer.product_id === product.id && offer.is_active,
                            ) ?? [];
                            const lowestPrice = activeOffers.reduce<Offer | undefined>(
                                (lowest, offer) =>
                                    !lowest || cents(offer.unit_price) < cents(lowest.unit_price)
                                        ? offer
                                        : lowest,
                                undefined,
                            );
                            return (
                                <article key={product.id} className={`${card} flex min-w-0 flex-col`}>
                                    <span className="w-fit rounded-md bg-blue-50 px-2 py-1 text-[11px] font-semibold text-blue-700">
                                        {productCategory(product.category)}
                                    </span>
                                    <h3 className="mt-3 text-base font-bold">{product.name}</h3>
                                    <p className="mt-1 text-sm text-slate-600">{product.brand}</p>
                                    <p className="mt-2 text-xs text-slate-500">{packageDescription(product)}</p>
                                    <div className="mt-auto pt-5">
                                        {lowestPrice ? (
                                            <>
                                                <p className="text-xs text-slate-500">A partir de</p>
                                                <p className="text-xl font-bold text-slate-900">{formatMoney(lowestPrice.unit_price)}</p>
                                                <p className="mt-1 text-xs text-slate-500">
                                                    {activeOffers.length} oferta(s) ativa(s) · menor oferta por {lowestPrice.supplier_name}
                                                </p>
                                            </>
                                        ) : (
                                            <p className="text-sm font-medium text-slate-500">Sem ofertas ativas</p>
                                        )}
                                        <Link
                                            to={`/produto/${product.id}`}
                                            className="mt-4 flex min-h-10 items-center justify-center rounded-lg bg-blue-700 px-4 text-xs font-semibold text-white hover:bg-blue-800"
                                        >
                                            Ver ofertas
                                        </Link>
                                    </div>
                                </article>
                            );
                        })}
                    </div>
                )}
            </section>
        </div>
    );
}

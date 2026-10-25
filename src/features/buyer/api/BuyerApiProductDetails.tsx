import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { formatMoney } from "../../orders/api/orderAdapter";
import { useAuth } from "../../auth/hooks/useAuth";
import { productCategory, type CatalogProduct } from "../../products/api/catalogRepository";
import type { Offer } from "../../products/api/offersRepository";
import { BuyerReadRepository, buyerReadError } from "./BuyerReadRepository";
import {
    OfferComparisonPanel,
    OfferComparisonSelector,
    OfferComparisonStatus,
} from "./BuyerOfferComparison";
import { useOfferComparison } from "./useBuyerOfferComparison";

type Details = { product: CatalogProduct; offers: Offer[] };
type LoadState = { key: string; data?: Details; error?: string };

export function BuyerApiProductDetails() {
    const { productId = "" } = useParams<{ productId: string }>();
    const { user } = useAuth();
    const repository = useMemo(
        () => new BuyerReadRepository(user?.organization_id ?? ""),
        [user?.organization_id],
    );
    const [result, setResult] = useState<LoadState>({ key: "" });
    const [revision, setRevision] = useState(0);
    const requestKey = `${user?.organization_id ?? ""}:${productId}:${revision}`;
    const data = result.key === requestKey ? result.data : undefined;
    const { activeOffers, selectedOfferIds, selectedOffers, toggleOffer } = useOfferComparison(
        data?.offers ?? [],
        data?.product.id ?? productId,
    );

    useEffect(() => {
        let active = true;
        void Promise.all([repository.product(productId), repository.offers(productId)])
            .then(([product, offers]) => {
                if (active) setResult({ key: requestKey, data: { product, offers } });
            })
            .catch(reason => {
                if (active) setResult({ key: requestKey, error: buyerReadError(reason) });
            });
        return () => {
            active = false;
        };
    }, [productId, repository, requestKey]);

    const loading = result.key !== requestKey;
    const error = result.key === requestKey ? result.error ?? "" : "";
    if (loading) return <p className="rounded-xl border border-slate-200 bg-white p-5" role="status">Carregando produto e ofertas...</p>;
    if (error || !data) {
        return (
            <section className="rounded-xl border border-red-200 bg-red-50 p-5" role="alert">
                <h1 className="font-semibold text-red-800">Não foi possível consultar este produto</h1>
                <p className="mt-2 text-sm text-red-700">{error || "Produto não encontrado."}</p>
                <button className="mt-4 rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white" onClick={() => setRevision(value => value + 1)}>
                    Tentar novamente
                </button>
                <Link to="/" className="ml-4 text-sm font-semibold text-blue-700">Voltar ao catálogo</Link>
            </section>
        );
    }
    return (
        <div className="mx-auto w-full max-w-[1120px] text-slate-900">
            <Link to="/" className="text-sm font-medium text-blue-700 hover:underline">← Voltar ao catálogo</Link>
            <header className="mt-5 rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                <span className="inline-flex rounded-md bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-blue-700">
                    {productCategory(data.product.category)}
                </span>
                <h1 className="mt-3 text-2xl font-bold">{data.product.name}</h1>
                <p className="mt-2 text-sm text-slate-600">{data.product.brand}</p>
                <p className="mt-3 text-sm text-slate-500">
                    {data.product.packaging_quantity} × {data.product.net_content} {data.product.net_content_unit} · {data.product.packaging_type}
                </p>
            </header>

            <section className="mt-6" aria-labelledby="product-offers-title">
                <h2 id="product-offers-title" className="text-lg font-bold">Ofertas dos fornecedores</h2>
                {activeOffers.length === 0 ? (
                    <p className="mt-3 rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-600">
                        Não há ofertas ativas para este produto.
                    </p>
                ) : (
                    <ul className="mt-3 grid gap-3">
                        {activeOffers.map(offer => (
                            <li key={offer.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                                <OfferComparisonSelector
                                    offer={offer}
                                    selected={selectedOfferIds.includes(offer.id)}
                                    selectedCount={selectedOffers.length}
                                    activeOfferCount={activeOffers.length}
                                    onChange={selected => toggleOffer(offer.id, selected)}
                                />
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                    <div>
                                        <h3 className="font-semibold">{offer.supplier_name}</h3>
                                        <p className="mt-1 text-sm text-slate-500">{offer.region}</p>
                                    </div>
                                    <p className="text-lg font-bold text-blue-700">{formatMoney(offer.unit_price)}</p>
                                </div>
                                <p className="mt-3 text-xs text-slate-600">
                                    Pedido mínimo: {offer.minimum_order_quantity} · Quantidade disponível: {offer.available_quantity}
                                </p>
                            </li>
                        ))}
                    </ul>
                )}
                {activeOffers.length === 1 && (
                    <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                        Há apenas uma oferta ativa. A comparação fica disponível quando houver pelo menos duas.
                    </p>
                )}
                {activeOffers.length >= 2 && (
                    <>
                        <OfferComparisonStatus selectedCount={selectedOffers.length} />
                        <OfferComparisonPanel offers={selectedOffers} />
                    </>
                )}
            </section>
        </div>
    );
}

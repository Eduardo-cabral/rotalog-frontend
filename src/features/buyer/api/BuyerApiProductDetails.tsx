import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { cents, formatMoney } from "../../orders/api/orderAdapter";
import { useAuth } from "../../auth/hooks/useAuth";
import { productCategory, type CatalogProduct } from "../../products/api/catalogRepository";
import type { Offer } from "../../products/api/offersRepository";
import { BuyerReadRepository, buyerReadError } from "./BuyerReadRepository";

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
    const [offerSelection, setOfferSelection] = useState<{ requestKey: string; ids: string[] }>({ requestKey: "", ids: [] });
    const requestKey = `${user?.organization_id ?? ""}:${productId}:${revision}`;

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
    const data = result.key === requestKey ? result.data : undefined;
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

    const activeOffers = data.offers.filter(offer => offer.product_id === data.product.id && offer.is_active);
    const selectedOfferIds = offerSelection.requestKey === requestKey ? offerSelection.ids : [];
    const selectedOffers = selectedOfferIds
        .map(id => activeOffers.find(offer => offer.id === id))
        .filter((offer): offer is Offer => offer !== undefined);
    const lowestSelectedPrice = selectedOffers.length === 2
        ? cents(selectedOffers[0].unit_price) < cents(selectedOffers[1].unit_price)
            ? cents(selectedOffers[0].unit_price)
            : cents(selectedOffers[1].unit_price)
        : undefined;

    function toggleOffer(offerId: string, selected: boolean) {
        setOfferSelection(current => {
            const currentIds = current.requestKey === requestKey ? current.ids : [];
            if (!selected) return { requestKey, ids: currentIds.filter(id => id !== offerId) };
            if (currentIds.includes(offerId) || currentIds.length >= 2) return current;
            return { requestKey, ids: [...currentIds, offerId] };
        });
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
                                <label className="mb-3 inline-flex items-center gap-2 text-sm font-medium text-slate-700">
                                    <input
                                        type="checkbox"
                                        checked={selectedOfferIds.includes(offer.id)}
                                        disabled={activeOffers.length < 2 || (selectedOfferIds.length === 2 && !selectedOfferIds.includes(offer.id))}
                                        onChange={event => toggleOffer(offer.id, event.currentTarget.checked)}
                                        aria-label={`Selecionar ${offer.supplier_name}, ${formatMoney(offer.unit_price)} para comparação`}
                                        className="h-4 w-4 accent-blue-700 disabled:cursor-not-allowed"
                                    />
                                    Selecionar para comparação
                                </label>
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
                        <p className="mt-3 text-sm text-slate-600" role="status" aria-live="polite">
                            {selectedOffers.length} de 2 ofertas selecionadas.
                            {selectedOfferIds.length === 2 && " Desmarque uma para escolher outra."}
                        </p>
                        {selectedOffers.length === 2 && (
                            <section className="mt-5 rounded-xl border border-blue-100 bg-blue-50/60 p-4 sm:p-5" aria-labelledby="offer-comparison-title">
                                <h3 id="offer-comparison-title" className="text-base font-bold text-slate-900">Comparação de ofertas</h3>
                                <p className="mt-1 text-sm text-slate-600">
                                    O destaque considera somente o preço unitário; avalie também o pedido mínimo e a disponibilidade.
                                </p>
                                <div className="mt-4 grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
                                    {selectedOffers.map(offer => (
                                        <article key={offer.id} className="min-w-0 rounded-lg border border-slate-200 bg-white p-4">
                                            <div className="flex min-w-0 flex-wrap items-start justify-between gap-2">
                                                <h4 className="min-w-0 break-words font-semibold">{offer.supplier_name}</h4>
                                                {lowestSelectedPrice !== undefined && cents(offer.unit_price) === lowestSelectedPrice && (
                                                    <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800">
                                                        Menor preço unitário
                                                    </span>
                                                )}
                                            </div>
                                            <dl className="mt-3 space-y-2 text-sm">
                                                <div className="flex flex-wrap justify-between gap-x-3 gap-y-1 border-t border-slate-100 pt-2">
                                                    <dt className="text-slate-600">Preço unitário</dt>
                                                    <dd className="font-semibold">{formatMoney(offer.unit_price)}</dd>
                                                </div>
                                                <div className="flex flex-wrap justify-between gap-x-3 gap-y-1">
                                                    <dt className="text-slate-600">Fornecedor</dt>
                                                    <dd className="break-words text-right font-medium">{offer.supplier_name}</dd>
                                                </div>
                                                <div className="flex flex-wrap justify-between gap-x-3 gap-y-1">
                                                    <dt className="text-slate-600">Quantidade mínima</dt>
                                                    <dd className="font-medium">{offer.minimum_order_quantity}</dd>
                                                </div>
                                                <div className="flex flex-wrap justify-between gap-x-3 gap-y-1">
                                                    <dt className="text-slate-600">Disponibilidade</dt>
                                                    <dd className="font-medium">{offer.available_quantity}</dd>
                                                </div>
                                            </dl>
                                        </article>
                                    ))}
                                </div>
                            </section>
                        )}
                    </>
                )}
            </section>
        </div>
    );
}

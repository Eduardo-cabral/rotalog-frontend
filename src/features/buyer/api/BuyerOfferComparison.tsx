import { cents, formatMoney } from "../../orders/api/orderAdapter";
import type { ComparableOffer } from "./useBuyerOfferComparison";

export function OfferComparisonSelector({
    offer,
    selected,
    selectedCount,
    activeOfferCount,
    onChange,
}: {
    offer: ComparableOffer;
    selected: boolean;
    selectedCount: number;
    activeOfferCount: number;
    onChange: (selected: boolean) => void;
}) {
    return (
        <label className="mb-3 inline-flex min-h-11 items-center gap-2 text-sm font-medium text-slate-700">
            <input
                type="checkbox"
                checked={selected}
                disabled={activeOfferCount < 2 || (selectedCount === 2 && !selected)}
                onChange={event => onChange(event.currentTarget.checked)}
                aria-label={`Selecionar ${offer.supplier_name}, ${formatMoney(offer.unit_price)} para comparação`}
                className="h-4 w-4 accent-blue-700 disabled:cursor-not-allowed"
            />
            Selecionar para comparação
        </label>
    );
}

export function OfferComparisonStatus({ selectedCount }: { selectedCount: number }) {
    return (
        <p className="mt-3 text-sm text-slate-600" role="status" aria-live="polite">
            {selectedCount} de 2 ofertas selecionadas.
            {selectedCount === 2 && " Desmarque uma para escolher outra."}
        </p>
    );
}

export function OfferComparisonPanel({ offers }: { offers: ComparableOffer[] }) {
    if (offers.length !== 2) return null;
    const firstPrice = cents(offers[0].unit_price);
    const secondPrice = cents(offers[1].unit_price);
    const lowestSelectedPrice = firstPrice < secondPrice ? firstPrice : secondPrice;

    return (
        <section
            className="mt-5 min-w-0 rounded-xl border border-blue-100 bg-blue-50/60 p-4 sm:p-5"
            aria-labelledby="offer-comparison-title"
        >
            <h3 id="offer-comparison-title" className="text-base font-bold text-slate-900">Comparação de ofertas</h3>
            <p className="mt-1 text-sm text-slate-600">
                O destaque considera somente o preço unitário; avalie também o pedido mínimo e a disponibilidade.
            </p>
            <div className="mt-4 grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
                {offers.map(offer => (
                    <article key={offer.id} className="min-w-0 rounded-lg border border-slate-200 bg-white p-4">
                        <div className="flex min-w-0 flex-wrap items-start justify-between gap-2">
                            <h4 className="min-w-0 break-words font-semibold">{offer.supplier_name}</h4>
                            {cents(offer.unit_price) === lowestSelectedPrice && (
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
    );
}

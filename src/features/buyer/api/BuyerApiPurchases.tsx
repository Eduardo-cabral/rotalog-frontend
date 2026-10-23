import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { orderStateLabel, formatMoney } from "../../orders/api/orderAdapter";
import { useAuth } from "../../auth/hooks/useAuth";
import type { BuyerPurchase } from "./BuyerReadRepository";
import { BuyerReadRepository, buyerReadError } from "./BuyerReadRepository";

type PurchaseLoadState = { key: string; purchase?: BuyerPurchase; error?: string };

function useBuyerPurchase(purchaseId: string) {
    const { user } = useAuth();
    const repository = useMemo(
        () => new BuyerReadRepository(user?.organization_id ?? ""),
        [user?.organization_id],
    );
    const [result, setResult] = useState<PurchaseLoadState>({ key: "" });
    const [revision, setRevision] = useState(0);
    const requestKey = `${user?.organization_id ?? ""}:${purchaseId}:${revision}`;

    useEffect(() => {
        let active = true;
        void repository.purchase(purchaseId)
            .then(value => {
                if (active) setResult({ key: requestKey, purchase: value });
            })
            .catch(reason => {
                if (active) setResult({ key: requestKey, error: buyerReadError(reason) });
            });
        return () => {
            active = false;
        };
    }, [purchaseId, repository, requestKey]);

    const current = result.key === requestKey ? result : undefined;
    return {
        purchase: current?.purchase,
        error: current?.error ?? "",
        loading: !current,
        retry: () => setRevision(value => value + 1),
    };
}

export function BuyerApiPurchaseList() {
    const { user } = useAuth();
    const repository = useMemo(
        () => new BuyerReadRepository(user?.organization_id ?? ""),
        [user?.organization_id],
    );
    const [result, setResult] = useState<{ key: string; purchases?: BuyerPurchase[]; error?: string }>({ key: "" });
    const [revision, setRevision] = useState(0);
    const requestKey = `${user?.organization_id ?? ""}:${revision}`;

    useEffect(() => {
        let active = true;
        void repository.purchases()
            .then(value => {
                if (active) setResult({ key: requestKey, purchases: value });
            })
            .catch(reason => {
                if (active) setResult({ key: requestKey, error: buyerReadError(reason) });
            });
        return () => {
            active = false;
        };
    }, [repository, requestKey]);

    const current = result.key === requestKey ? result : undefined;
    const loading = !current;
    const error = current?.error ?? "";
    const purchases = current?.purchases ?? [];
    if (loading) return <p className="rounded-xl border border-slate-200 bg-white p-5" role="status">Carregando compras...</p>;
    if (error) {
        return (
            <section className="rounded-xl border border-red-200 bg-red-50 p-5" role="alert">
                <h1 className="font-semibold text-red-800">Não foi possível carregar suas compras</h1>
                <p className="mt-2 text-sm text-red-700">{error}</p>
                <button className="mt-4 rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white" onClick={() => setRevision(value => value + 1)}>Tentar novamente</button>
            </section>
        );
    }

    return (
        <section className="mx-auto w-full max-w-[960px] text-slate-900">
            <h1 className="text-2xl font-bold">Minhas compras</h1>
            <p className="mt-2 text-sm text-slate-600">Compras e situações retornadas pelo Backend.</p>
            {purchases.length === 0 ? (
                <div className="mt-6 rounded-xl border border-slate-200 bg-white p-8 text-center">
                    <h2 className="font-semibold">Nenhuma compra encontrada</h2>
                    <p className="mt-2 text-sm text-slate-500">As compras disponíveis para sua organização aparecerão aqui.</p>
                </div>
            ) : (
                <ul className="mt-5 space-y-3">
                    {purchases.map((purchase, index) => (
                        <li key={purchase.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                            <Link to={`/comprador/compras/${encodeURIComponent(purchase.id)}`} className="flex flex-wrap items-center justify-between gap-3">
                                <span className="font-semibold">Compra {index + 1}</span>
                                <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-800">
                                    {purchase.state.replaceAll("_", " ")}
                                </span>
                            </Link>
                            <p className="mt-2 text-sm text-slate-500">{purchase.supplier_orders.length} pedido(s) vinculado(s)</p>
                        </li>
                    ))}
                </ul>
            )}
        </section>
    );
}

export function BuyerApiPurchaseDetails() {
    const { purchaseId = "" } = useParams<{ purchaseId: string }>();
    const { purchase, error, loading, retry } = useBuyerPurchase(purchaseId);

    if (loading) return <p className="rounded-xl border border-slate-200 bg-white p-5" role="status">Carregando detalhes da compra...</p>;
    if (error || !purchase) {
        return (
            <section className="rounded-xl border border-red-200 bg-red-50 p-5" role="alert">
                <h1 className="font-semibold text-red-800">Não foi possível consultar esta compra</h1>
                <p className="mt-2 text-sm text-red-700">{error || "Compra não encontrada."}</p>
                <button className="mt-4 rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white" onClick={retry}>Tentar novamente</button>
                <Link to="/comprador/compras" className="ml-4 text-sm font-semibold text-blue-700">Voltar às compras</Link>
            </section>
        );
    }

    return (
        <section className="mx-auto w-full max-w-[960px] text-slate-900">
            <Link to="/comprador/compras" className="text-sm font-medium text-blue-700 hover:underline">← Voltar às compras</Link>
            <header className="mt-5 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-xs font-semibold text-blue-700">RotaLog • Portal do Comprador</p>
                <h1 className="mt-2 text-2xl font-bold">Detalhes da compra</h1>
                <p className="mt-2 text-sm text-slate-600">Situação da compra: {purchase.state.replaceAll("_", " ")}</p>
                <p className="mt-1 text-sm text-slate-600">{purchase.supplier_orders.length} pedido(s) vinculado(s)</p>
            </header>
            <section className="mt-6 space-y-4" aria-label="Pedidos vinculados à compra">
                {purchase.supplier_orders.map((order, index) => (
                    <article key={order.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                            <h2 className="font-semibold">Pedido do fornecedor {index + 1}</h2>
                            <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-800">{orderStateLabel(order.state)}</span>
                        </div>
                        <p className="mt-2 text-sm text-slate-600">Valor informado pelo Backend: {formatMoney(order.total)}</p>
                        <div className="mt-4 divide-y divide-slate-100">
                            {order.items.map(item => (
                                <div key={item.id} className="flex flex-wrap justify-between gap-3 py-3 text-sm">
                                    <div>
                                        <p className="font-medium">{item.product.name}</p>
                                        <p className="mt-1 text-xs text-slate-500">
                                            Solicitado: {item.requested_quantity} · Aceito: {item.supplier_accepted_quantity} · Separado: {item.separated_quantity}
                                        </p>
                                    </div>
                                    <span className="font-semibold">{formatMoney(item.unit_price)} / unidade</span>
                                </div>
                            ))}
                        </div>
                    </article>
                ))}
            </section>
        </section>
    );
}

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CatalogRepository, catalogError, productCategory, publicationLabel, type CatalogProduct } from "./catalogRepository";
import { ProductImage } from "../../../shared/components/ProductImage";

export function ApiCatalogDetails({ id, repository, onClose }: {id: string; repository: CatalogRepository; onClose: () => void}) {
    const [product, setProduct] = useState<CatalogProduct | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [attempt, setAttempt] = useState(0);
    const dialog = useRef<HTMLDialogElement>(null);
    const titleId = useId();
    useEffect(() => {
        let active = true;
        void repository.detail(id).then(value => { if (active) setProduct(value); }).catch(failure => { if (active) setError(catalogError(failure)); });
        return () => { active = false; };
    }, [repository, id, attempt]);
    useEffect(() => {
        const previous = document.activeElement;
        const element = dialog.current;
        element?.showModal();
        const overflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => { element?.close(); document.body.style.overflow = overflow; if (previous instanceof HTMLElement && previous.isConnected) previous.focus(); };
    }, []);
    return createPortal(<dialog ref={dialog} data-supplier-ui aria-labelledby={titleId} onCancel={event => {event.preventDefault(); onClose();}} className="fixed inset-0 m-auto max-h-[calc(100dvh_-_1.5rem)] w-[calc(100%_-_1.5rem)] max-w-3xl overflow-y-auto rounded-2xl border-0 bg-white p-5 text-slate-900 shadow-xl [overflow-wrap:anywhere] backdrop:bg-slate-950/60">
        <header className="flex items-start justify-between gap-3"><h2 id={titleId} className="text-xl font-semibold">Detalhes do produto</h2><button type="button" onClick={onClose} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">Fechar</button></header>
        {!product && !error && <p role="status" className="mt-4">Carregando produto…</p>}
        {error && <div role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}<button type="button" onClick={() => {setError(null); setAttempt(value => value + 1);}} className="ml-2 underline">Tentar novamente</button></div>}
        {product && <><div className="mt-5 grid gap-4 sm:grid-cols-[9rem_minmax(0,1fr)] sm:items-center"><ProductImage name={product.name} className="h-36 w-full sm:h-36"/><div><h3 className="text-lg font-bold">{product.name}</h3><p className="mt-1 text-sm text-slate-600">{product.brand}</p></div></div><dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2">{[
            ["Marca", product.brand], ["Categoria", productCategory(product.category)],
            ["Conteúdo", `${product.net_content} ${product.net_content_unit}`],
            ["Embalagem", `${product.packaging_type} · ${product.packaging_quantity} unidades`],
            ["GTIN", product.gtin ?? "Não informado"], ["Publicação", publicationLabel(product.publication_state)],
            ["Peso bruto", `${product.gross_weight_grams} g`], ["Volume", `${product.volume_cm3} cm³`],
        ].map(([label, value]) => <div key={label}><dt className="text-slate-500">{label}</dt><dd className="mt-1">{value}</dd></div>)}</dl>
        {Object.keys(product.variant_attributes).length > 0 && <section className="mt-4"><h3 className="font-semibold">Atributos da variante</h3><dl className="mt-2 space-y-2 text-sm">{Object.entries(product.variant_attributes).map(([label, value]) => <div key={label}><dt className="text-slate-500">{label}</dt><dd>{value}</dd></div>)}</dl></section>}
        </>}
    </dialog>, document.body);
}

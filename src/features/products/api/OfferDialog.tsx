import {useEffect, useId, useRef, useState} from "react";
import {createPortal} from "react-dom";
import {CatalogRepository, catalogError, type CatalogPage, type CatalogProduct} from "./catalogRepository";
import {eligibleWarehouse, minimumQuantity, offerPrice, type Offer, type Warehouse} from "./offersRepository";

export type OfferSelection = {kind:"create";product?:CatalogProduct} | {kind:"edit" | "pause"; offer:Offer};
export type OfferCommand = {product:CatalogProduct | null; warehouse:Warehouse | null; price:string; quantity:string};
const field = "mt-1 w-full min-w-0 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm";
const button = "rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium disabled:opacity-50";
export function OfferDialog({selection, organizationId, warehouses, pending, error, failed, onClose, onConfirm}: {
    selection:OfferSelection; organizationId:string; warehouses:Warehouse[]; pending:boolean;
    error:string | null; failed:boolean; onClose:()=>void; onConfirm:(command:OfferCommand)=>Promise<void>;
}) {
    const dialog = useRef<HTMLDialogElement>(null);
    const titleId = useId();
    const [price, setPrice] = useState(selection.kind === "create" ? "" : selection.offer.unit_price);
    const [quantity, setQuantity] = useState(selection.kind === "create" ? "1" : String(selection.offer.minimum_order_quantity));
    const [product, setProduct] = useState<CatalogProduct | null>(selection.kind==="create"?selection.product??null:null);
    const [warehouseId, setWarehouseId] = useState("");
    const [search, setSearch] = useState("");
    const [query, setQuery] = useState({search:"", page:1});
    const [products, setProducts] = useState<CatalogPage | null>(null);
    const [productError, setProductError] = useState<string | null>(null);
    const [validation, setValidation] = useState<string | null>(null);
    const [review, setReview] = useState(selection.kind === "pause");
    const [checking, setChecking] = useState(false);
    const busy = pending || checking;
    const eligible = warehouses.filter(item => eligibleWarehouse(item, organizationId));
    const warehouse = eligible.find(item => item.id === warehouseId) ?? null;
    useEffect(() => {
        if (selection.kind !== "create") return;
        let active = true;
        void new CatalogRepository(organizationId).list(query.page, query.search).then(data => {if (active) setProducts(data);}).catch(failure => {if (active) setProductError(catalogError(failure));});
        return () => {active = false;};
    }, [organizationId, selection.kind, query]);
    useEffect(() => {
        const previous = document.activeElement;
        const element = dialog.current;
        element?.showModal();
        const overflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => {element?.close(); document.body.style.overflow = overflow; if (previous instanceof HTMLElement && previous.isConnected) previous.focus();};
    }, []);
    async function prepare() {
        setValidation(null);
        try {
            offerPrice(price); minimumQuantity(quantity);
            if (selection.kind === "create" && (!product || !warehouse)) throw new Error("Selecione produto publicado e depósito elegível.");
            if (product && product.publication_state !== "PUBLISHED") throw new Error("O produto selecionado não está publicado.");
            setReview(true);
        } catch (failure) {setValidation(failure instanceof Error ? failure.message : "Revise os dados.");}
    }
    async function chooseProduct(id:string) {
        if (!id) {setProduct(null);return;}
        setChecking(true); setProductError(null); setProduct(null);
        try {
            const detail = await new CatalogRepository(organizationId).detail(id);
            if (detail.publication_state !== "PUBLISHED") throw new Error("O produto não está publicado.");
            setProduct(detail);
        } catch (failure) {setProductError(catalogError(failure));}
        finally {setChecking(false);}
    }
    const title = selection.kind === "create" ? "Criar oferta" : selection.kind === "edit" ? "Alterar oferta" : "Pausar oferta";
    return createPortal(<dialog ref={dialog} data-supplier-ui aria-labelledby={titleId} onCancel={event=>{event.preventDefault();if (!busy) onClose();}} className="fixed inset-0 m-auto max-h-[calc(100dvh_-_1.5rem)] w-[calc(100%_-_1.5rem)] max-w-3xl overflow-y-auto rounded-2xl border-0 bg-white p-5 text-slate-900 shadow-xl [overflow-wrap:anywhere] backdrop:bg-slate-950/60">
        <header className="flex items-start justify-between gap-3"><h2 id={titleId} className="text-xl font-semibold">{title}</h2><button type="button" disabled={busy} onClick={onClose} className={button}>Fechar</button></header>
        {(validation || error) && <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{validation ?? error}</p>}
        {failed && <p className="mt-2 text-sm text-slate-600">Feche esta revisão e atualize as ofertas e os depósitos antes de iniciar outra tentativa. Nenhuma operação será repetida automaticamente.</p>}
        {!review && <fieldset disabled={busy || failed} className="mt-4 space-y-4">
            {selection.kind === "create" && <>
                <form onSubmit={event=>{event.preventDefault();setProducts(null);setProduct(null);setProductError(null);setQuery({search:search.trim(),page:1});}} className="flex flex-wrap gap-2"><label className="min-w-0 flex-1 text-sm">Pesquisar produto por nome<input type="search" maxLength={200} value={search} onChange={event=>setSearch(event.target.value)} className={field}/></label><button type="submit" className={`${button} self-end`}>Buscar produto</button></form>
                {productError && <p role="alert" className="text-sm text-red-700">{productError}</p>}
                {!products && !productError && <p role="status" className="text-sm">Carregando produtos…</p>}
                {products && <><label className="block text-sm">Produto publicado<select value={product?.id ?? ""} onChange={event=>void chooseProduct(event.target.value)} className={field}><option value="">Selecione um produto</option>{(product&&!products.items.some(item=>item.id===product.id)?[product,...products.items]:products.items).filter(item=>item.publication_state === "PUBLISHED").map(item=><option value={item.id} key={item.id}>{item.name} · {item.brand}</option>)}</select></label>{!products.items.length && <p className="text-sm text-slate-500">Nenhum produto publicado encontrado.</p>}<nav aria-label="Páginas da seleção de produto" className="flex flex-wrap items-center gap-2 text-xs"><button type="button" className={button} disabled={busy || query.page <= 1} onClick={()=>{setProducts(null);setProduct(null);setQuery({...query,page:query.page-1});}}>Produtos anteriores</button><span>Página {products.page}</span><button type="button" className={button} disabled={busy || products.page * products.page_size >= products.total} onClick={()=>{setProducts(null);setProduct(null);setQuery({...query,page:query.page+1});}}>Próximos produtos</button></nav></>}
                <label className="block text-sm">Depósito elegível<select value={warehouseId} onChange={event=>setWarehouseId(event.target.value)} className={field}><option value="">Selecione um depósito</option>{eligible.map(item=><option key={item.id} value={item.id}>{item.name} · {item.region}</option>)}</select></label>
                {!eligible.length && <p className="text-sm text-amber-800">Nenhum depósito elegível. Para receber ofertas, o depósito precisa estar ativo e com o endereço confirmado.</p>}
            </>}
            {selection.kind === "edit" && <p className="font-medium">{selection.offer.product_name}</p>}
            <div className="grid gap-4 sm:grid-cols-2"><label className="text-sm">Preço unitário (R$)<input inputMode="decimal" value={price} maxLength={16} onChange={event=>setPrice(event.target.value)} placeholder="0,00" className={field}/></label><label className="text-sm">Quantidade mínima de pedido<input inputMode="numeric" value={quantity} maxLength={10} onChange={event=>setQuantity(event.target.value)} className={field}/></label></div>
            <p className="text-xs text-slate-500">Preço em reais, sem separador de milhar e com até duas casas decimais. Quantidade mínima inteira, de pelo menos 1.</p>
            <button type="button" onClick={()=>void prepare()} className={button}>Revisar oferta</button>
        </fieldset>}
        {review && <section aria-label="Revisão da oferta" className="mt-4 space-y-3 rounded-xl bg-slate-50 p-4 text-sm"><h3 className="font-semibold">{selection.kind === "pause" ? "Confirmar pausa" : "Confira antes de confirmar"}</h3><p className="font-medium">{selection.kind === "create" ? product?.name : selection.offer.product_name}</p>
            {selection.kind === "create" && <p>Depósito: {warehouse?.name} · {warehouse?.address}</p>}
            {selection.kind !== "pause" && <><p>Preço unitário: R$ {offerPrice(price).replace(".", ",")}</p><p>Quantidade mínima: {minimumQuantity(quantity)}</p></>}
            {selection.kind === "pause" && <p>A oferta deixará de aparecer na lista de ofertas ativas. A reativação não está disponível no momento.</p>}
            <div className="flex flex-wrap gap-2">{selection.kind !== "pause" && <button type="button" disabled={busy || failed} className={button} onClick={()=>setReview(false)}>Voltar</button>}<button type="button" disabled={busy || failed} aria-busy={pending} onClick={()=>void onConfirm({product,warehouse,price,quantity})} className={`rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-50 ${selection.kind === "pause" ? "supplier-action--warning" : "supplier-action--success"}`}>{pending ? "Processando…" : selection.kind === "create" ? "Confirmar criação" : selection.kind === "edit" ? "Confirmar alteração" : "Confirmar pausa"}</button></div>
        </section>}
        <footer className="mt-4"><button type="button" disabled={busy} onClick={onClose} className={button}>Cancelar</button></footer>
    </dialog>,document.body);
}

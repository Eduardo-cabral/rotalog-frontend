import type {ReactNode} from "react";
import type {ProductsTab} from "./SupplierProductsTabs";
import type {CatalogProduct} from "./catalogRepository";
import {SupplierWarehouses} from "./SupplierWarehouses";
import {useEffect, useMemo, useRef, useState} from "react";
import {useLocation} from "react-router-dom";
import {formatMoney} from "../../orders/api/orderAdapter";
import {OffersRepository, eligibleWarehouse, offerError, warehouseError as warehouseCreationError, type WarehouseCreate, type OfferPage, type Warehouse} from "./offersRepository";
import {OfferDialog, type OfferCommand, type OfferSelection} from "./OfferDialog";

import {WarehouseDialog} from "./WarehouseDialog";
import {StatusBadge} from "../../../shared/components/SupplierVisuals";

const button = "rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium disabled:opacity-50";
export function SupplierOffers({organizationId,tab,onTabChange,renderCatalog}:{organizationId:string;tab:ProductsTab;onTabChange:(tab:ProductsTab)=>void;renderCatalog:(create:(product:CatalogProduct)=>void,canCreate:boolean)=>ReactNode}) {
    const {hash}=useLocation();
    const anchorReached=useRef(false);
    const repository = useMemo(()=>new OffersRepository(organizationId),[organizationId]);
    const [warehouses,setWarehouses] = useState<Warehouse[] | null>(null);
    const [warehouseError,setWarehouseError] = useState<string | null>(null);
    const [offers,setOffers] = useState<OfferPage | null>(null);
    const [listError,setListError] = useState<string | null>(null);
    const [query,setQuery] = useState({page:1,refresh:0});
    const [selection,setSelection] = useState<OfferSelection | null>(null);
    const [warehouseDialog,setWarehouseDialog] = useState(false);
    const [warehouseMutationError,setWarehouseMutationError] = useState<string | null>(null);
    const [warehouseSuccess,setWarehouseSuccess] = useState<string | null>(null);
    const [warehouseUncertain,setWarehouseUncertain] = useState(false);
    const [warehouseReviewed,setWarehouseReviewed] = useState(false);
    const [pending,setPending] = useState(false);
    const submitting = useRef(false);
    const mounted = useRef(true);
    const [error,setError] = useState<string | null>(null);
    const [failed,setFailed] = useState(false);
    const [success,setSuccess] = useState<string | null>(null);
    const [needsReview,setNeedsReview] = useState(false);
    const [checked,setChecked] = useState(false);
    const [reviewedAfterFailure,setReviewedAfterFailure] = useState(false);
    useEffect(()=>{
        if(hash!=="#minhas-ofertas"){anchorReached.current=false;return;}
        if(offers&&warehouses&&!anchorReached.current){
            document.getElementById("minhas-ofertas")?.scrollIntoView({block:"start"});
            anchorReached.current=true;
        }
    },[hash,offers,warehouses]);
    useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
    useEffect(()=>{
        let active=true;
        const reviewingWarehouse=repository.warehouseNeedsReview();
        void repository.offers(query.page).then(value=>{if(active){setOffers(value);setFailed(false);if(repository.creationNeedsReview())setReviewedAfterFailure(true);}}).catch(failure=>{if(active)setListError(offerError(failure));});
        void repository.warehouses().then(value=>{if(active){setWarehouses(value);if(reviewingWarehouse)setWarehouseReviewed(true);}}).catch(failure=>{if(active)setWarehouseError(offerError(failure));});
        return()=>{active=false;};
    },[repository,query]);
    function refresh(page=query.page) {
        setOffers(null);setWarehouses(null);setListError(null);setWarehouseError(null);
        setQuery(previous=>({page,refresh:previous.refresh+1}));
    }
    function choose(value:OfferSelection) {setError(null);setFailed(false);setSuccess(null);setSelection(value);}
    async function confirm(command:OfferCommand) {
        if(!selection || submitting.current)return;
        submitting.current=true;setPending(true);setError(null);
        try {
            if(selection.kind === "create") {
                if(!command.product || !command.warehouse)throw new Error("Selecione produto e depósito.");
                await repository.create(command.product,command.warehouse,command.price,command.quantity);
            } else if(selection.kind === "edit") await repository.update(selection.offer,command.price,command.quantity);
            else await repository.pause(selection.offer);
            if(!mounted.current)return;
            setSuccess(selection.kind === "create" ? "Oferta criada com sucesso." : selection.kind === "edit" ? "Oferta atualizada com sucesso." : "Oferta pausada. Ela não aparece mais na lista de ofertas ativas.");
            setSelection(null);refresh(1);
        } catch(failure) {
            if(!mounted.current)return;
            const uncertain=repository.creationNeedsReview();
            setNeedsReview(uncertain);setChecked(false);setReviewedAfterFailure(false);setFailed(true);
            setError(`${offerError(failure)}${uncertain ? " A criação pode ter sido concluída. Confira a listagem antes de iniciar outra tentativa." : ""}`);
        } finally {submitting.current=false;if(mounted.current)setPending(false);}
    }
    async function confirmWarehouse(values:WarehouseCreate) {
        if(submitting.current)return;
        submitting.current=true;setPending(true);setWarehouseMutationError(null);setWarehouseSuccess(null);
        try {
            await repository.createWarehouse(values);
            if(!mounted.current)return;
            setWarehouseDialog(false);
            setWarehouseSuccess("Depósito cadastrado. Ele poderá receber ofertas após a confirmação do endereço.");
            refresh();
        } catch(failure) {
            if(!mounted.current)return;
            const uncertain=repository.warehouseNeedsReview();
            setWarehouseUncertain(uncertain);setWarehouseReviewed(false);
            setWarehouseMutationError(`${warehouseCreationError(failure)}${uncertain ? " O cadastro pode ter sido concluído. Feche o formulário, atualize e confira os depósitos antes de cadastrar novamente." : ""}`);
        } finally {submitting.current=false;if(mounted.current)setPending(false);}
    }
    const canCreate = offers !== null && !listError && warehouses !== null && warehouses.some(item=>eligibleWarehouse(item,organizationId)) && !warehouseError && !pending && !warehouseDialog && !needsReview && !failed;
    return <section aria-label="Depósitos e ofertas" className="min-w-0 space-y-4">
        <div id="products-panel-warehouses" role="tabpanel" aria-labelledby="products-tab-warehouses" hidden={tab!=="warehouses"} tabIndex={0}><SupplierWarehouses warehouses={warehouses} warehouseError={warehouseError} warehouseSuccess={warehouseSuccess} warehouseMutationError={warehouseMutationError} warehouseDialog={warehouseDialog} warehouseUncertain={warehouseUncertain} warehouseReviewed={warehouseReviewed} pending={pending} selection={selection} organizationId={organizationId} refresh={()=>refresh()} onCreate={()=>{setWarehouseMutationError(null);setWarehouseSuccess(null);setWarehouseDialog(true);}} onReview={()=>{repository.acknowledgeWarehouseReview();setWarehouseUncertain(false);setWarehouseMutationError(null);}}/></div>
        <div id="products-panel-offers" role="tabpanel" aria-labelledby="products-tab-offers" hidden={tab!=="offers"} tabIndex={0}>
        <section id="minhas-ofertas" aria-label="Minhas ofertas" className="min-w-0 rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><header className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-base font-semibold">Minhas ofertas {offers && <span className="text-sm font-normal text-slate-500">({offers.total} ativas)</span>}</h2><button type="button" className={button} disabled={!canCreate} onClick={()=>choose({kind:"create"})}>Criar oferta para produto existente</button></header>
            <p className="mt-2 text-xs text-slate-500">Ofertas ativas. A consulta de pausadas e a reativação ainda não estão disponíveis.</p>
            <div className="mt-3 flex flex-wrap gap-3 text-sm"><button type="button" className={button} disabled={pending||selection!==null} onClick={()=>refresh()}>Atualizar ofertas</button>{warehouses&&!warehouses.some(item=>eligibleWarehouse(item,organizationId))&&<button type="button" className="text-blue-700 underline" onClick={()=>onTabChange("warehouses")}>Cadastre ou regularize um depósito para criar ofertas</button>}</div>
            {success && <p role="status" className="mt-3 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{success}</p>}
            {error && !selection && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
            {failed && !selection && <p className="mt-2 text-sm text-slate-600">Atualize a lista para revisar os dados antes de tentar novamente.</p>}
            {needsReview && <div className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900"><p>Não há garantia de idempotência na criação. Use “Atualizar ofertas” e confira todas as páginas, o produto e o depósito antes de liberar uma nova tentativa.</p><label className="mt-2 flex items-start gap-2"><input type="checkbox" checked={checked} onChange={event=>setChecked(event.target.checked)}/>Conferi as ofertas e entendo que uma nova tentativa pode duplicar uma oferta.</label><button type="button" className={`${button} mt-2`} disabled={!checked || !offers || !reviewedAfterFailure || pending} onClick={()=>{repository.acknowledgeCreationReview();setNeedsReview(false);setFailed(false);setError(null);setChecked(false);}}>Liberar nova tentativa após conferência</button></div>}
            {!offers && !listError && <p role="status" className="mt-3 text-sm">Carregando ofertas…</p>}
            {(listError || warehouseError) && <p role="alert" className="mt-3 text-sm text-red-700">{listError || warehouseError}</p>}
            {offers && <>{!offers.items.length ? <p className="py-6 text-center text-sm text-slate-500">Nenhuma oferta ativa nesta página.</p> : <div role="region" aria-label="Tabela de ofertas ativas" tabIndex={0} className="mt-3 max-w-full overflow-x-auto"><table className="w-full min-w-[700px] text-left text-sm"><caption className="sr-only">Ofertas ativas do fornecedor autenticado</caption><thead className="bg-slate-50"><tr>{["Produto","Depósito","Preço unitário","Quantidade mínima","Ações"].map(label=><th scope="col" key={label} className="px-3 py-3 font-medium">{label}</th>)}</tr></thead><tbody>{offers.items.map(offer=><tr key={offer.id} className="border-t border-slate-100"><td className="max-w-64 break-words px-3 py-3 [overflow-wrap:anywhere]">{offer.product_name}<div className="mt-1"><StatusBadge tone="success">Ativa</StatusBadge></div></td><td className="px-3 py-3">{warehouses?.find(item=>item.id===offer.warehouse_id)?.name ?? "Depósito não disponível na consulta"}<span className="block text-xs text-slate-500">{offer.region}</span></td><td className="px-3 py-3">{formatMoney(offer.unit_price)}</td><td className="px-3 py-3">{offer.minimum_order_quantity}</td><td className="px-3 py-3"><div className="flex flex-wrap gap-2"><button type="button" className={button} disabled={pending || warehouseDialog || failed || !offer.is_active} onClick={()=>choose({kind:"edit",offer})}>Alterar oferta</button><button type="button" className={`${button} supplier-action--warning`} disabled={pending || warehouseDialog || failed || !offer.is_active} onClick={()=>choose({kind:"pause",offer})}>Pausar oferta</button></div></td></tr>)}</tbody></table></div>}<nav aria-label="Páginas de ofertas" className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm"><p>Página {offers.page} de {Math.max(1,Math.ceil(offers.total/offers.page_size))}</p><div className="flex gap-2"><button className={button} type="button" disabled={pending || offers.page<=1} onClick={()=>refresh(offers.page-1)}>Ofertas anteriores</button><button className={button} type="button" disabled={pending || offers.page*offers.page_size>=offers.total} onClick={()=>refresh(offers.page+1)}>Próximas ofertas</button></div></nav></>}
        </section>
        </div>
        <div id="products-panel-catalog" role="tabpanel" aria-labelledby="products-tab-catalog" hidden={tab!=="catalog"} tabIndex={0}>{renderCatalog(product=>{onTabChange("offers");choose({kind:"create",product});},canCreate)}</div>
        {warehouseDialog && <WarehouseDialog pending={pending} error={warehouseMutationError} uncertain={warehouseUncertain} onClose={()=>setWarehouseDialog(false)} onConfirm={confirmWarehouse}/>}
        {selection && <OfferDialog selection={selection} organizationId={organizationId} warehouses={warehouses ?? []} pending={pending} error={error} failed={failed} onClose={()=>{setSelection(null);}} onConfirm={confirm}/>}
    </section>;
}

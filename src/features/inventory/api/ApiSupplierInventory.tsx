import {StatusBadge} from "../../../shared/components/SupplierVisuals";
import {useEffect,useMemo,useRef,useState} from "react";
import {Link} from "react-router-dom";
import {useAuth} from "../../auth/hooks/useAuth";
import {PageHeader} from "../../../shared/components/PageHeader";
import {InventoryRepository,inventoryError,type Inventory,type InventoryPage,type InventoryReferences} from "./inventoryRepository";
import {InventoryAdjustmentDialog} from "./InventoryAdjustmentDialog";

const button="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium disabled:opacity-50";
const field="min-w-0 max-w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm";
function dateLabel(value:string):string {
    const date=new Date(value);
    return Number.isFinite(date.getTime())?new Intl.DateTimeFormat("pt-BR",{dateStyle:"short",timeStyle:"short"}).format(date):"Não informado";
}
const sourceLabel=(source:string)=>source==="MANUAL"?"Manual":source;
const missingProduct="Produto não disponível na consulta de ofertas ativas";
export function ApiSupplierInventory() {
    const {user}=useAuth();
    return <SessionInventory key={`${user?.id}:${user?.organization_id}`} organizationId={user?.organization_id??""}/>;
}
function SessionInventory({organizationId}:{organizationId:string}) {
    const repository=useMemo(()=>new InventoryRepository(organizationId),[organizationId]);
    const [query,setQuery]=useState({page:1,warehouseId:"",offerId:"",refresh:0});
    const [result,setResult]=useState<{page:InventoryPage;refs:InventoryReferences}|null>(null);
    const [error,setError]=useState<string|null>(null);
    const [selected,setSelected]=useState<Inventory|null>(null);
    const [pending,setPending]=useState(false);
    const submitting=useRef(false);
    const mounted=useRef(true);
    const [mutationError,setMutationError]=useState<string|null>(null);
    const [failed,setFailed]=useState(false);
    const [success,setSuccess]=useState<string|null>(null);
    useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
    useEffect(()=>{
        let active=true;
        void (async()=>{
            const refs=await repository.loadReferences();
            if(!active)return;
            const page=await repository.list(query.page,query);
            if(active){setResult({page,refs});setFailed(false);}
        })().catch(failure=>{if(active)setError(inventoryError(failure));});
        return()=>{active=false;};
    },[repository,query]);
    function refresh(change:Partial<typeof query>={}) {
        setResult(null);setError(null);setMutationError(null);
        setQuery(previous=>({...previous,...change,refresh:previous.refresh+1}));
    }
    async function confirm(sellable:string,safety:string,reason:string) {
        if(!selected||submitting.current)return;
        submitting.current=true;setPending(true);setMutationError(null);
        try {
            await repository.adjust(selected,sellable,safety,reason);
            if(!mounted.current)return;
            setSelected(null);setSuccess("Ajuste de estoque confirmado.");refresh();
        } catch(failure) {if(mounted.current){setMutationError(inventoryError(failure));setFailed(true);}}
        finally{submitting.current=false;if(mounted.current)setPending(false);}
    }
    const name=(item:Inventory)=>result?.refs.offers.find(offer=>offer.id===item.offer_id)?.product_name??missingProduct;
    const warehouseName=(item:Inventory)=>result?.refs.warehouses.find(warehouse=>warehouse.id===item.warehouse_id)?.name??"Depósito não disponível";
    const unresolved=result?.page.items.filter(item=>!result.refs.offers.some(offer=>offer.id===item.offer_id))??[];
    return <div className="flex w-full min-w-0 flex-col gap-4">
        <PageHeader title="Estoque" subtitle="Consulte os saldos oficiais por oferta e depósito." actions={<button type="button" className={button} disabled={pending||selected!==null} onClick={()=>refresh()}>Atualizar estoque</button>}/>
        <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-slate-600">Disponível para novas vendas e reservado no RotaLog.</p><Link to="/fornecedor/produtos#minhas-ofertas" className="text-sm font-medium text-blue-700">Criar oferta para outro produto</Link></div>
        <details aria-label="Catálogo, ofertas e saldos" className="text-sm text-slate-500"><summary className="cursor-pointer">Como interpretar os saldos</summary><p className="mt-2">Produtos sem oferta não aparecem nesta lista. “Reservado no RotaLog” é a quantidade já reservada, ainda não refletida no saldo informado pelo fornecedor. O disponível efetivo considera as reservas e o estoque de segurança.</p></details>
        {success&&<p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{success}</p>}
        {mutationError&&!selected&&<p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{mutationError} Atualize os saldos antes de outro ajuste.</p>}
        {!result&&!error&&<p role="status" className="rounded-lg bg-blue-50 p-3 text-sm text-blue-700">Carregando estoque, depósitos e ofertas…</p>}
        {error&&<div role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}<div className="mt-2 flex flex-wrap gap-3"><button type="button" className="underline" onClick={()=>refresh()}>Tentar novamente</button><button type="button" className="underline" onClick={()=>refresh({page:1,warehouseId:"",offerId:""})}>Limpar filtros e consultar</button></div></div>}
        {result&&<>
            <section aria-label="Posição de estoque" className="min-w-0 rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><header className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-base font-semibold">Posição de estoque <span className="text-sm font-normal text-slate-500">({result.page.total} registros)</span></h2><div className="flex min-w-0 flex-wrap gap-2"><label className="sr-only" htmlFor="inventory-warehouse">Filtrar por depósito</label><select id="inventory-warehouse" className={field} value={query.warehouseId} onChange={event=>refresh({page:1,warehouseId:event.target.value,offerId:""})}><option value="">Todos os depósitos</option>{result.refs.warehouses.map(item=><option key={item.id} value={item.id}>{item.name}{item.is_active?"":" (inativo)"}</option>)}</select><label className="sr-only" htmlFor="inventory-offer">Filtrar por oferta</label><select id="inventory-offer" className={field} value={query.offerId} onChange={event=>refresh({page:1,offerId:event.target.value})}><option value="">Todas as ofertas</option>{result.refs.offers.filter(item=>!query.warehouseId||item.warehouse_id===query.warehouseId).map(item=><option key={item.id} value={item.id}>{item.product_name} · {result.refs.warehouses.find(warehouse=>warehouse.id===item.warehouse_id)?.name??"Depósito não disponível"}</option>)}{[...new Map(unresolved.map(item=>[item.offer_id,item])).values()].map(item=><option key={item.offer_id} value={item.offer_id}>Oferta não identificada</option>)}</select><button type="button" className={button} onClick={()=>refresh({page:1,warehouseId:"",offerId:""})}>Limpar filtros</button></div></header>
            {unresolved.length>0&&<p className="mt-3 text-xs text-amber-800">Alguns produtos não puderam ser identificados na consulta de ofertas ativas. Os saldos originais estão preservados.</p>}
            {!result.page.items.length?<p role="status" className="py-8 text-center text-sm text-slate-500">Nenhum registro de estoque encontrado para esta consulta.</p>:<div role="region" aria-label="Saldos oficiais de estoque" tabIndex={0} className="mt-4 max-h-[65dvh] max-w-full overflow-auto focus-visible:outline-2 focus-visible:outline-blue-600"><table className="w-full min-w-[720px] text-left text-sm"><caption className="sr-only">Saldos oficiais por oferta e depósito</caption><thead className="sticky top-0 bg-slate-50"><tr>{["Produto","Depósito","Disponível","Reservado no RotaLog","Situação","Ações"].map(label=><th scope="col" key={label} className="px-3 py-3 font-medium text-slate-600">{label}</th>)}</tr></thead><tbody>{result.page.items.map(item=><tr key={item.id} className="border-t border-slate-100"><td className="max-w-64 break-words px-3 py-3 [overflow-wrap:anywhere]">{name(item)}<details className="mt-2 text-xs text-slate-500"><summary className="cursor-pointer font-medium">Detalhes do estoque</summary><dl className="mt-2 space-y-2">{[
                ["Físico",item.external_physical_quantity??"Não informado"],["Vendável externo",item.external_sellable_quantity],["Estoque de segurança",item.safety_stock_quantity],["Origem",sourceLabel(item.source)],["Última atualização recebida",dateLabel(item.received_at)],["Origem observada em",dateLabel(item.source_observed_at)],["Última reconciliação",item.last_reconciled_at?dateLabel(item.last_reconciled_at):"Não informada"],
            ].map(([label,value])=><div key={label}><dt>{label}</dt><dd className="font-medium text-slate-700">{value}</dd></div>)}</dl></details></td><td className="px-3 py-3">{warehouseName(item)}</td><td className="px-3 py-3"><strong>{item.effective_sellable_quantity}</strong><span className="mt-1 block text-xs text-slate-500">Disponível efetivo</span></td><td className="px-3 py-3">{item.rotalog_reserved_not_reflected_quantity}</td><td className="px-3 py-3"><StatusBadge tone={item.effective_sellable_quantity===0?"warning":"success"}>{item.effective_sellable_quantity===0?"Sem disponibilidade":"Com disponibilidade"}</StatusBadge><span className="mt-1 block text-xs text-slate-500">{item.freshness_state==="FRESH"?"Atualizado":item.freshness_state==="STALE"?"Desatualizado":item.freshness_state}</span></td><td className="px-3 py-3"><button type="button" disabled={pending||failed||!result.refs.warehouses.find(warehouse=>warehouse.id===item.warehouse_id)?.is_active} className={button} onClick={()=>{setMutationError(null);setSuccess(null);setSelected(item);}}>Ajustar vendável</button></td></tr>)}</tbody></table></div>}
            <nav aria-label="Paginação do estoque" className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm"><p aria-live="polite">Página {result.page.page} de {Math.max(1,Math.ceil(result.page.total/result.page.page_size))} · {result.page.total} registros</p><div className="flex gap-2"><button type="button" className={button} disabled={pending||result.page.page<=1} onClick={()=>refresh({page:query.page-1})}>Anterior</button><button type="button" className={button} disabled={pending||result.page.page*result.page.page_size>=result.page.total} onClick={()=>refresh({page:query.page+1})}>Próxima</button></div></nav></section>
        </>}
        <details aria-label="Histórico de movimentações" className="text-sm text-slate-500"><summary className="cursor-pointer">Histórico de movimentações</summary><p className="mt-2 text-sm text-slate-500">O histórico de ajustes ainda não está disponível.</p></details>
        {selected&&<InventoryAdjustmentDialog item={selected} productName={name(selected)} warehouseName={warehouseName(selected)} pending={pending} error={mutationError} failed={failed} onClose={()=>setSelected(null)} onConfirm={confirm}/>}
    </div>;
}

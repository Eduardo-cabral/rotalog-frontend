import {useEffect,useId,useRef,useState} from "react";
import {createPortal} from "react-dom";
import {adjustmentValues,type Inventory} from "./inventoryRepository";

const button="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium disabled:opacity-50";
const field="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm";
export function InventoryAdjustmentDialog({item,productName,warehouseName,pending,error,failed,onClose,onConfirm}:{
    item:Inventory; productName:string; warehouseName:string; pending:boolean; error:string | null; failed:boolean;
    onClose:()=>void; onConfirm:(sellable:string,safety:string,reason:string)=>Promise<void>;
}) {
    const dialog=useRef<HTMLDialogElement>(null);
    const titleId=useId();
    const [sellable,setSellable]=useState(String(item.external_sellable_quantity));
    const [safety,setSafety]=useState(String(item.safety_stock_quantity));
    const [reason,setReason]=useState("");
    const [review,setReview]=useState(false);
    const [validation,setValidation]=useState<string | null>(null);
    useEffect(()=>{
        const previous=document.activeElement;
        const element=dialog.current;element?.showModal();
        const overflow=document.body.style.overflow;document.body.style.overflow="hidden";
        return()=>{element?.close();document.body.style.overflow=overflow;if(previous instanceof HTMLElement&&previous.isConnected)previous.focus();};
    },[]);
    function prepare() {
        try {adjustmentValues(item,sellable,safety,reason);setValidation(null);setReview(true);}
        catch(failure){setValidation(failure instanceof Error?failure.message:"Revise o ajuste.");}
    }
    return createPortal(<dialog ref={dialog} data-supplier-ui aria-labelledby={titleId} onCancel={event=>{event.preventDefault();if(!pending)onClose();}} className="fixed inset-0 m-auto max-h-[calc(100dvh_-_1.5rem)] w-[calc(100%_-_1.5rem)] max-w-3xl overflow-y-auto rounded-2xl border-0 bg-white p-5 text-slate-900 shadow-xl [overflow-wrap:anywhere] backdrop:bg-slate-950/60">
        <header className="flex items-start justify-between gap-3"><h2 id={titleId} className="text-xl font-semibold">Ajustar estoque vendável</h2><button type="button" disabled={pending} onClick={onClose} className={`${button} shrink-0`}>Fechar</button></header>
        <p className="mt-3 text-sm text-slate-600">Este ajuste informa valores de estoque vendável e de segurança. Não registra uma entrada ou saída física e não altera reservas.</p>
        <section aria-label="Saldos atuais" className="mt-4 rounded-xl bg-slate-50 p-4 text-sm"><h3 className="font-semibold">{productName}</h3><p className="mt-1">Depósito: {warehouseName}</p><dl className="mt-3 grid gap-3 sm:grid-cols-2">{[
            ["Estoque físico",item.external_physical_quantity ?? "Não informado"],["Vendável externo",item.external_sellable_quantity],
            ["Reservado ainda não refletido",item.rotalog_reserved_not_reflected_quantity],["Estoque de segurança",item.safety_stock_quantity],["Disponibilidade efetiva",item.effective_sellable_quantity],
        ].map(([label,value])=><div key={label}><dt className="text-slate-500">{label}</dt><dd>{value}</dd></div>)}</dl>
        </section>
        {(validation||error)&&<p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{validation??error}</p>}
        {failed&&<p className="mt-2 text-sm text-slate-600">O resultado pode precisar de conferência. Feche o formulário e use Atualizar estoque antes de revisar outro ajuste. Nenhum ajuste será repetido automaticamente.</p>}
        {!review&&<fieldset disabled={pending||failed} className="mt-4 space-y-4"><div className="grid gap-4 sm:grid-cols-2"><label className="block text-sm">Novo estoque vendável<input inputMode="numeric" value={sellable} maxLength={10} onChange={event=>setSellable(event.target.value)} className={field}/></label><label className="block text-sm">Novo estoque de segurança<input inputMode="numeric" value={safety} maxLength={10} onChange={event=>setSafety(event.target.value)} className={field}/></label></div><label className="block text-sm">Justificativa<textarea value={reason} minLength={5} maxLength={500} onChange={event=>setReason(event.target.value)} className={field} rows={3}/><span className="text-xs text-slate-500">De 5 a 500 caracteres.</span></label><button type="button" className={button} onClick={prepare}>Revisar ajuste</button></fieldset>}
        {review&&<section aria-label="Revisão do ajuste" className="mt-4 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm"><h3 className="font-semibold">Confira os valores antes de confirmar</h3><p className="mt-2">Vendável externo: {item.external_sellable_quantity} → {Number(sellable)}</p><p>Estoque de segurança: {item.safety_stock_quantity} → {Number(safety)}</p><p className="mt-2 whitespace-pre-wrap">Justificativa: {reason.trim()}</p><p className="mt-2 text-xs text-slate-600">Os limites e a disponibilidade serão conferidos antes de confirmar o ajuste.</p><div className="mt-3 flex flex-wrap gap-2"><button type="button" disabled={pending||failed} className={button} onClick={()=>setReview(false)}>Voltar</button><button type="button" disabled={pending||failed} aria-busy={pending} className="supplier-action--success rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-50" onClick={()=>void onConfirm(sellable,safety,reason)}>{pending?"Processando…":"Confirmar ajuste"}</button></div></section>}
        <footer className="mt-4"><button type="button" disabled={pending} onClick={onClose} className={button}>Cancelar</button></footer>
    </dialog>,document.body);
}

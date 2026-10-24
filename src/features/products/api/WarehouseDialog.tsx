import {useEffect, useId, useRef, useState} from "react";
import {createPortal} from "react-dom";
import {warehouseValues, type WarehouseCreate} from "./offersRepository";

export function WarehouseDialog({pending, error, uncertain, onClose, onConfirm}: {
    pending: boolean; error: string | null; uncertain: boolean;
    onClose: () => void; onConfirm: (values: WarehouseCreate) => Promise<void>;
}) {
    const dialog = useRef<HTMLDialogElement>(null);
    const title = useId();
    const [values, setValues] = useState<WarehouseCreate>({name: "", address: "", opening_hours: "", region: ""});
    const [validation, setValidation] = useState<string | null>(null);
    useEffect(() => {
        const previous = document.activeElement;
        const element = dialog.current;
        const overflow = document.body.style.overflow;
        element?.showModal();
        document.body.style.overflow = "hidden";
        return () => {element?.close(); document.body.style.overflow = overflow; if (previous instanceof HTMLElement && previous.isConnected) previous.focus();};
    }, []);
    const button = "rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium disabled:opacity-50";
    return createPortal(<dialog ref={dialog} data-supplier-ui aria-labelledby={title} onCancel={event => {event.preventDefault(); if (!pending) onClose();}} className="fixed inset-0 m-auto max-h-[calc(100dvh_-_1.5rem)] w-[calc(100%_-_1.5rem)] max-w-xl overflow-y-auto rounded-2xl border-0 bg-white p-5 text-slate-900 shadow-xl backdrop:bg-slate-950/60">
        <h2 id={title} className="text-xl font-semibold">Cadastrar depósito</h2>
        <p className="mt-3 text-sm text-slate-600">Após o cadastro, aguarde a confirmação do endereço. Somente depósitos ativos e com o endereço confirmado podem receber ofertas.</p>
        {(validation || error) && <p role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{validation ?? error}</p>}
        <form className="mt-4 space-y-4" onSubmit={event => {
            event.preventDefault();
            if (pending || uncertain) return;
            setValidation(null);
            try {void onConfirm(warehouseValues(values));} catch (failure) {setValidation(failure instanceof Error ? failure.message : "Revise os dados.");}
        }}>
            <fieldset disabled={pending || uncertain} className="space-y-4">
                {([['name', 'Nome do depósito', 200], ['address', 'Endereço completo', 500], ['opening_hours', 'Horário de funcionamento', 200], ['region', 'Região', 100]] as const).map(([key, label, max]) => <label key={key} className="block text-sm">{label}<input required maxLength={max} value={values[key]} onChange={event => {setValidation(null); setValues(previous => ({...previous, [key]: event.target.value}));}} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" /></label>)}
                <button type="submit" aria-busy={pending} className="supplier-action--success rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-50">{pending ? "Cadastrando depósito…" : "Confirmar cadastro"}</button>
            </fieldset>
            <button type="button" disabled={pending} className={button} onClick={onClose}>Fechar</button>
        </form>
    </dialog>, document.body);
}

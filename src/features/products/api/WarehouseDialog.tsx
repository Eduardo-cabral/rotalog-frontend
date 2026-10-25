import {useEffect, useId, useRef, useState} from "react";
import {createPortal} from "react-dom";
import {warehouseServiceRegions, warehouseValues, type WarehouseCreate, type WarehouseFormValues} from "./offersRepository";

const initialValues: WarehouseFormValues = {
    name: "", postalCode: "", number: "", street: "", district: "",
    municipality: "", state: "", opening_hours: "", region: "",
};

export function WarehouseDialog({pending, error, uncertain, onClose, onConfirm}: {
    pending: boolean; error: string | null; uncertain: boolean;
    onClose: () => void; onConfirm: (values: WarehouseCreate) => Promise<void>;
}) {
    const dialog = useRef<HTMLDialogElement>(null);
    const title = useId();
    const [values, setValues] = useState<WarehouseFormValues>(initialValues);
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
    function update<K extends keyof WarehouseFormValues>(field: K, value: WarehouseFormValues[K]) {
        setValidation(null);
        setValues(current => ({...current, [field]: value}));
    }
    const inputClass = "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100";
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
                <label className="block text-sm font-medium">Nome do depósito<input required maxLength={200} value={values.name} onChange={event => update("name", event.target.value)} className={inputClass} /></label>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <label className="block text-sm font-medium">CEP<input required inputMode="numeric" autoComplete="postal-code" placeholder="00000-000" pattern="[0-9]{5}-?[0-9]{3}" maxLength={9} value={values.postalCode} onChange={event => {
                        const digits = event.target.value.replace(/\D/g, "").slice(0, 8);
                        update("postalCode", digits.length > 5 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : digits);
                    }} className={inputClass} /></label>
                    <label className="block text-sm font-medium">Número<input required maxLength={20} autoComplete="address-line2" placeholder="Nº ou S/N" value={values.number} onChange={event => update("number", event.target.value)} className={inputClass} /></label>
                </div>
                <label className="block text-sm font-medium">Rua ou avenida<input required maxLength={200} autoComplete="address-line1" placeholder="Nome da via" value={values.street} onChange={event => update("street", event.target.value)} className={inputClass} /></label>
                <label className="block text-sm font-medium">Bairro<input required maxLength={120} autoComplete="address-level3" placeholder="Nome do bairro" value={values.district} onChange={event => update("district", event.target.value)} className={inputClass} /></label>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-[minmax(0,1fr)_6rem]">
                    <label className="block text-sm font-medium">Município<input required maxLength={120} autoComplete="address-level2" placeholder="Município" value={values.municipality} onChange={event => update("municipality", event.target.value)} className={inputClass} /></label>
                    <label className="block text-sm font-medium">UF<input required minLength={2} maxLength={2} autoComplete="address-level1" placeholder="UF" value={values.state} onChange={event => update("state", event.target.value.replace(/[^a-z]/gi, "").slice(0, 2).toLocaleUpperCase("pt-BR"))} className={inputClass} /></label>
                </div>
                <fieldset className="space-y-2">
                    <legend className="text-sm font-medium">Região de atendimento</legend>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        {warehouseServiceRegions.map(region => <label key={region} className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700">
                            <input required type="radio" name="warehouse-region" value={region} checked={values.region === region} onChange={() => update("region", region)} className="accent-blue-600" />
                            {region}
                        </label>)}
                    </div>
                    <p className="text-xs text-slate-500">A região selecionada é informativa; ela não valida os limites geográficos nem comprova a localização do depósito.</p>
                </fieldset>
                <label className="block text-sm font-medium">Horário de funcionamento<input required maxLength={200} placeholder="Ex.: 08:00 às 17:00" value={values.opening_hours} onChange={event => update("opening_hours", event.target.value)} className={inputClass} /></label>
                <button type="submit" aria-busy={pending} className="supplier-action--success rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-50">{pending ? "Cadastrando depósito…" : "Confirmar cadastro"}</button>
            </fieldset>
            <button type="button" disabled={pending} className={button} onClick={onClose}>Fechar</button>
        </form>
    </dialog>, document.body);
}

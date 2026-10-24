import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { rejectionReasons, type OrderRejectionReason, type SupplierOrder } from "../mocks/orders.mock";
import { shortOrderId } from "../api/orderAdapter";

type Props = {
    order: SupplierOrder;
    displayId?: string;
    onClose: () => void;
    onConfirm: (reason: OrderRejectionReason, justification: string) => void;
};

export function OrderRejectionModal({ order, displayId, onClose, onConfirm }: Props) {
    const dialogRef = useRef<HTMLDialogElement>(null);
    const reasonRef = useRef<HTMLSelectElement>(null);
    const [reason, setReason] = useState<OrderRejectionReason | "">("");
    const [justification, setJustification] = useState("");
    const [error, setError] = useState<string | null>(null);
    const id = useId();

    useEffect(() => {
        const previous = document.activeElement;
        const dialog = dialogRef.current;
        dialog?.showModal();
        reasonRef.current?.focus();
        const overflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => {
            dialog?.close();
            document.body.style.overflow = overflow;
            if (previous instanceof HTMLElement && previous.isConnected) previous.focus();
        };
    }, []);

    function submit(event: FormEvent) {
        event.preventDefault();
        if (!reason || !justification.trim()) {
            setError("Selecione um motivo e informe uma justificativa não vazia.");
            return;
        }
        try {
            onConfirm(reason, justification);
        } catch (failure) {
            setError(failure instanceof Error ? failure.message : "Não foi possível recusar o pedido.");
        }
    }

    const fieldClass = "mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100";
    return createPortal(
        <dialog data-supplier-ui ref={dialogRef} aria-labelledby={`${id}-title`} aria-describedby={`${id}-description`} onCancel={(event) => { event.preventDefault(); onClose(); }} onClick={(event) => {
            if (event.target === event.currentTarget) {
                const bounds = event.currentTarget.getBoundingClientRect();
                if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) onClose();
            }
        }} className="fixed inset-0 m-auto max-h-[calc(100dvh_-_1.5rem)] w-[calc(100%_-_1.5rem)] max-w-lg overflow-y-auto rounded-2xl border-0 bg-white p-0 text-slate-900 shadow-2xl [overflow-wrap:anywhere] backdrop:bg-slate-950/60">
            <form onSubmit={submit} className="p-5 sm:p-6">
                <header className="flex items-start justify-between gap-3">
                    <h2 id={`${id}-title`} className="text-xl font-bold">Recusar pedido {displayId ?? shortOrderId(order.id)}</h2>
                    <button type="button" onClick={onClose} aria-label="Fechar recusa do pedido" className="rounded-lg p-1 text-slate-500 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-blue-600">✕</button>
                </header>
                <p id={`${id}-description`} className="mt-2 text-sm text-slate-600">Informe o motivo e a justificativa para recusar o pedido de {order.customer}. Todos os campos são obrigatórios.</p>
                <label htmlFor={`${id}-reason`} className="mt-5 block text-sm font-semibold">Motivo</label>
                <select ref={reasonRef} id={`${id}-reason`} required value={reason} onChange={(event) => setReason(event.target.value as OrderRejectionReason | "")} className={fieldClass}>
                    <option value="">Selecione um motivo</option>
                    {rejectionReasons.map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
                <label htmlFor={`${id}-justification`} className="mt-4 block text-sm font-semibold">Justificativa</label>
                <textarea id={`${id}-justification`} required rows={4} value={justification} onChange={(event) => setJustification(event.target.value)} aria-describedby={error ? `${id}-error` : undefined} className={`${fieldClass} resize-y`} />
                {error && <p id={`${id}-error`} role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
                <footer className="mt-5 flex justify-end gap-2">
                    <button type="button" onClick={onClose} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-blue-600">Cancelar</button>
                    <button type="submit" disabled={!reason || !justification.trim()} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600 disabled:cursor-not-allowed disabled:opacity-50">Confirmar recusa</button>
                </footer>
            </form>
        </dialog>, document.body
    );
}

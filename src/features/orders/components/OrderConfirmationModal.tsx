import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { SupplierOrder } from "../mocks/orders.mock";
import type { SupplierOperationalAction } from "../services/supplierOrders.service";
import { shortOrderId } from "../api/orderAdapter";

export type OrderConfirmationAction = "accept" | SupplierOperationalAction;

const content = {
    accept: { title: "Confirmar aceite do pedido", message: 'O pedido será aceito e movido para "Aceitos".', button: "Confirmar aceite" },
    "start-separation": { title: "Confirmar início da separação", message: 'O pedido será movido para "Em separação" para iniciar a preparação.', button: "Iniciar separação" },
    "mark-ready": { title: "Confirmar prontidão do pedido", message: 'O pedido será movido para "Prontos para coleta" e aguardará a logística.', button: "Marcar como pronto" },
} satisfies Record<OrderConfirmationAction, { title: string; message: string; button: string }>;

type Props = {
    order: SupplierOrder;
    displayId?: string;
    action: OrderConfirmationAction;
    onClose: () => void;
    onConfirm: () => void | Promise<void>;
};

export function OrderConfirmationModal({ order, displayId, action, onClose, onConfirm }: Props) {
    const dialogRef = useRef<HTMLDialogElement>(null);
    const cancelRef = useRef<HTMLButtonElement>(null);
    const confirmingRef = useRef(false);
    const [pending, setPending] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const id = useId();
    const copy = content[action];

    useEffect(() => {
        const previous = document.activeElement;
        const dialog = dialogRef.current;
        dialog?.showModal();
        cancelRef.current?.focus();
        const overflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => {
            dialog?.close();
            document.body.style.overflow = overflow;
            if (previous instanceof HTMLElement && previous.isConnected) previous.focus();
            else document.getElementById("supplier-order-search")?.focus();
        };
    }, []);

    async function confirm() {
        if (confirmingRef.current) return;
        confirmingRef.current = true;
        setPending(true);
        setError(null);
        try {
            await onConfirm();
        } catch (failure) {
            confirmingRef.current = false;
            setPending(false);
            setError(failure instanceof Error ? failure.message : "Não foi possível atualizar o pedido.");
        }
    }

    return createPortal(
        <dialog data-supplier-ui ref={dialogRef} aria-modal="true" aria-labelledby={`${id}-title`} aria-describedby={`${id}-description`} onCancel={(event) => { event.preventDefault(); if (!confirmingRef.current) onClose(); }} onClick={(event) => {
            if (confirmingRef.current || event.target !== event.currentTarget) return;
            const bounds = event.currentTarget.getBoundingClientRect();
            if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) onClose();
        }} className="fixed inset-0 m-auto max-h-[calc(100dvh_-_1.5rem)] w-[calc(100%_-_1.5rem)] max-w-lg overflow-y-auto rounded-2xl border-0 bg-white p-0 text-slate-900 shadow-2xl [overflow-wrap:anywhere] backdrop:bg-slate-950/60">
            <div className="p-5 sm:p-6">
                <h2 id={`${id}-title`} className="text-xl font-bold">{copy.title}</h2>
                <p className="mt-3 break-words text-sm font-semibold">{displayId ?? shortOrderId(order.id)} · {order.customer}</p>
                <p id={`${id}-description`} className="mt-2 text-sm text-slate-600">{copy.message}</p>
                {error && <p role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
                <footer className="mt-6 flex flex-wrap justify-end gap-2">
                    <button ref={cancelRef} type="button" disabled={pending} onClick={onClose} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-blue-600">Cancelar</button>
                    <button type="button" disabled={pending} aria-busy={pending} onClick={() => void confirm()} className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700">{pending ? "Processando…" : copy.button}</button>
                </footer>
            </div>
        </dialog>, document.body
    );
}

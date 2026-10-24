
import { useEffect, useRef } from "react";

import type { Organization } from "../../organizations/mocks/organizations.mock";
import { ProductImage } from "./ProductImage";
import { createPortal } from "react-dom";
import { useModalBackground } from "../../../shared/hooks/useModalBackground";

import type {
    SupplierProduct,
    ProductAvailability,
} from "../mocks/products.mock";

type ProductDetailsModalProps = {
    product: SupplierProduct;
    activeOrganization: Organization;
    onClose: () => void;
};

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
});

const availabilityStyles: Record<
    ProductAvailability,
    string
> = {
    Disponível: "bg-green-100 text-green-800",
    "Estoque baixo": "bg-amber-100 text-amber-800",
    Indisponível: "bg-red-100 text-red-800",
};

export function ProductDetailsModal({
    product,
    activeOrganization,
    onClose,
}: ProductDetailsModalProps) {
    const dialogRef = useRef<HTMLDivElement>(null);
    const overlayRef = useRef<HTMLDivElement>(null);
    useModalBackground(overlayRef);
    const closeButtonRef = useRef<HTMLButtonElement>(null);
    const onCloseRef = useRef(onClose);

    useEffect(() => {
        onCloseRef.current = onClose;
    }, [onClose]);

    useEffect(() => {
        const previousFocusedElement = document.activeElement;

        closeButtonRef.current?.focus();

        function handleKeyDown(event: KeyboardEvent) {
            if (event.key === "Escape") {
                event.preventDefault();
                onCloseRef.current();
                return;
            }

            if (event.key !== "Tab") return;

            const dialog = dialogRef.current;
            if (!dialog) return;

            const focusableElements =
                dialog.querySelectorAll<HTMLElement>(
                    'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
                );

            const elements = Array.from(focusableElements);

            if (elements.length === 0) {
                event.preventDefault();
                dialog.focus();
                return;
            }

            const firstElement = elements[0];
            const lastElement = elements[elements.length - 1];

            if (
                event.shiftKey &&
                (document.activeElement === firstElement ||
                    !dialog.contains(document.activeElement))
            ) {
                event.preventDefault();
                lastElement.focus();
            } else if (
                !event.shiftKey &&
                (document.activeElement === lastElement ||
                    !dialog.contains(document.activeElement))
            ) {
                event.preventDefault();
                firstElement.focus();
            }
        }

        function handleFocusIn(event: FocusEvent) {
            const dialog = dialogRef.current;

            if (
                dialog &&
                event.target instanceof Node &&
                !dialog.contains(event.target)
            ) {
                closeButtonRef.current?.focus();
            }
        }

        document.addEventListener("keydown", handleKeyDown);
        document.addEventListener("focusin", handleFocusIn);

        return () => {
            document.removeEventListener("keydown", handleKeyDown);
            document.removeEventListener("focusin", handleFocusIn);

            if (
                previousFocusedElement instanceof HTMLElement &&
                previousFocusedElement.isConnected
            ) {
                previousFocusedElement.focus();
            }
        };
    }, []);

    if (product.organizationId !== activeOrganization.id) {
        return null;
    }

    return createPortal(
        <div
            ref={overlayRef}
            data-supplier-ui
            className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 p-4"
            onMouseDown={(event) => {
                if (event.target === event.currentTarget) {
                    onClose();
                }
            }}
        >
            <div
                ref={dialogRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby="product-details-title"
                tabIndex={-1}
                className="flex max-h-[calc(100dvh_-_2rem)] w-full min-w-0 max-w-xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl [overflow-wrap:anywhere]"
            >
                {/* Cabeçalho */}
                <div className="flex shrink-0 items-start justify-between border-b border-slate-200 p-6">
                    <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-500">
                            Detalhes do produto
                        </p>

                        <h2
                            id="product-details-title"
                            className="mt-1 text-2xl font-bold text-slate-900"
                        >
                            {product.name}
                        </h2>

                        <p className="mt-1 text-sm text-slate-500">
                            Código: {product.id}
                        </p>
                    </div>

                    <button
                        ref={closeButtonRef}
                        type="button"
                        onClick={onClose}
                        aria-label="Fechar detalhes do produto"
                        className="shrink-0 rounded-lg px-3 py-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                    >
                        ✕
                    </button>
                </div>

                {/* Conteúdo */}
                <div role="region" aria-label="Conteúdo dos detalhes do produto" tabIndex={0} className="min-h-0 space-y-6 overflow-y-auto p-6 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-blue-600">
                    <ProductImage organizationId={activeOrganization.id} imageRef={product.imageRef} name={product.name} className="h-40 w-full" />
                    <div>
                        <p className="mb-2 text-sm text-slate-500">
                            Disponibilidade
                        </p>

                        <span
                            className={`inline-flex rounded-full px-3 py-1 text-sm font-medium ${availabilityStyles[product.availability]
                                }`}
                        >
                            {product.availability}
                        </span>
                    </div>

                    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                        <div>
                            <p className="text-sm text-slate-500">
                                Categoria
                            </p>
                            <p className="mt-1 font-semibold text-slate-900">
                                {product.category}
                            </p>
                        </div>

                        <div>
                            <p className="text-sm text-slate-500">
                                Unidade de medida
                            </p>
                            <p className="mt-1 font-semibold text-slate-900">
                                {product.unit}
                            </p>
                        </div>

                        <div>
                            <p className="text-sm text-slate-500">
                                Quantidade em estoque
                            </p>
                            <p className="mt-1 font-semibold text-slate-900">
                                {product.stock}
                            </p>
                        </div>

                        <div>
                            <p className="text-sm text-slate-500">
                                Organização
                            </p>
                            <p className="mt-1 font-semibold text-slate-900">
                                {activeOrganization.name}
                            </p>
                        </div>
                    </div>

                    <div className="rounded-xl bg-slate-50 p-5">
                        <p className="text-sm text-slate-500">
                            Preço unitário
                        </p>

                        <p className="mt-1 text-2xl font-bold text-slate-900">
                            {currencyFormatter.format(product.price)}
                        </p>
                    </div>

                </div>

                {/* Rodapé */}
                <div className="flex shrink-0 justify-end border-t border-slate-200 p-5">
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                    >
                        Fechar
                    </button>
                </div>
            </div>
        </div>, document.body
    );
}

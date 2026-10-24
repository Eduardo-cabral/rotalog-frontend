import { orderStateLabel } from "./orderAdapter";

// Presentation only: official states, filters and command payloads remain unchanged.
export function purchaseStateLabel(state: string): string {
    return ({ACTIVE:"Em andamento",CANCELLED:"Cancelada"} as Record<string,string>)[state] ?? "Situação não reconhecida";
}
export function checkoutStateLabel(state: string): string {
    return ({READY_FOR_PAYMENT:"Aguardando confirmação do pagamento",CONVERTED:"Compra confirmada",EXPIRED:"Reserva expirada"} as Record<string,string>)[state] ?? "Situação não reconhecida";
}
export function readableOrderState(state: string): string {
    const label=orderStateLabel(state);
    return label===state ? "Situação não reconhecida" : label;
}
export function preparationMessage(state: string): string {
    return ({
        AWAITING_SUPPLIER_DECISION:"Aguardando análise do fornecedor.",
        ACCEPTED:"Pedido aceito. A separação pode ser iniciada.",
        PARTIALLY_ACCEPTED:"Aceite parcial informado. Confira as quantidades por produto.",
        SEPARATING:"Preparação em andamento. Confira os lotes e as quantidades separadas.",
        READY_TO_DISPATCH:"Preparação concluída. A prontidão não confirma coleta ou entrega.",
        REFUSED:"Pedido recusado pelo fornecedor.",
        CANCELLED:"Pedido cancelado. Consulte os detalhes disponíveis.",
        ACCEPTANCE_EXPIRED:"O prazo de aceite deste pedido foi encerrado.",
    } as Record<string,string>)[state] ?? "Confira a situação oficial e as quantidades deste pedido.";
}

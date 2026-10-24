import { useRef, useState, type ReactNode } from "react";
import { useAuth } from "../../auth/hooks/useAuth";
import { CartProvider } from "../../cart/context/CartProvider";
import { CartContext } from "../../cart/context/CartContext";
import { authMode } from "../../../shared/api/config";
import { BuyerRepository, validateCart } from "./buyerRepository";
import { BuyerContext, type Stored, type BuyerValue } from "./buyerContext";

function read(key: string): Stored {
    try {
        const value = JSON.parse(sessionStorage.getItem(key) ?? "null") as Stored | null;
        if (value && Array.isArray(value.lines) && value.lines.every(line => line.offer && typeof line.offer.id === "string" && Number.isSafeInteger(line.quantity) && line.quantity > 0) && (value.attempt === null || (value.attempt && typeof value.attempt.key === "string" && value.attempt.input && Array.isArray(value.attempt.input.items)))) return value;
    } catch { /* Invalid local data cannot authorize a commercial operation. */ }
    return { lines: [], attempt: null };
}
function BuyerProvider({ scope, children }: {scope: string; children: ReactNode}) {
    const { user } = useAuth();
    const repository = new BuyerRepository(user!.organization_id!);
    const key = `rotalog:api-buyer:v1:${scope}`;
    const [state, setState] = useState<Stored>(() => read(key));
    const current = useRef(state);
    function save(next: Stored) {
        sessionStorage.setItem(key, JSON.stringify(next));
        current.current = next;
        setState(next);
    }
    function editable() { if (current.current.attempt) throw new Error("Há uma reserva ou operação em análise. Consulte seu resultado antes de alterar o carrinho."); }
    const value: BuyerValue = {
        ...state, repository,
        add(offer, quantity, replace = false) {
            editable();
            let lines = current.current.lines;
            const otherOrigin = lines.some(line => line.offer.supplier_organization_id !== offer.supplier_organization_id || line.offer.warehouse_id !== offer.warehouse_id);
            if (otherOrigin && !replace) throw new Error("Este carrinho pertence a outro fornecedor ou depósito.");
            if (otherOrigin) lines = [];
            const previous = lines.find(line => line.offer.id === offer.id);
            const next = [...lines.filter(line => line.offer.id !== offer.id), {offer, quantity: quantity + (previous?.quantity ?? 0)}];
            validateCart(next.map(line => line.offer), next.map(line => line.quantity));
            save({ lines: next, attempt: null });
        },
        update(id, quantity) {
            editable();
            const lines = current.current.lines.map(line => line.offer.id === id ? {...line,quantity} : line);
            validateCart(lines.map(line=>line.offer),lines.map(line=>line.quantity));
            save({lines,attempt:null});
        },
        remove(id) { editable(); save({lines:current.current.lines.filter(line=>line.offer.id!==id),attempt:null}); },
        saveAttempt(attempt) { save({...current.current,attempt}); },
        complete() { save({lines:[],attempt:null}); },
    };
    const suppliers = state.lines.length ? [{supplierId:state.lines[0].offer.supplier_organization_id,supplierName:state.lines[0].offer.supplier_name,deliveryFee:0,deliveryEstimate:"",deliveryPolicy:"",items:state.lines.map(line=>({id:line.offer.id,productName:line.offer.product_name,quantity:line.quantity,unitPrice:Number(line.offer.unit_price)}))}] : [];
    return <BuyerContext.Provider value={value}><CartContext.Provider value={{suppliers,clearCart:()=>{editable();save({lines:[],attempt:null});},addToCart:()=>{throw new Error("Selecione uma oferta oficial.");},removeFromCart:(_supplier,id)=>value.remove(id),updateQuantity:(_supplier,id,quantity)=>value.update(id,quantity)}}>{children}</CartContext.Provider></BuyerContext.Provider>;
}
export function CartSession({children}: {children: ReactNode}) {
    const {user} = useAuth();
    if (authMode === "api" && user?.role === "BUYER_ADMIN" && user.organization_id) {
        const scope = `${user.id}:${user.organization_id}:${(user as {demo_run_id?:string}).demo_run_id ?? ""}`;
        return <BuyerProvider key={scope} scope={scope}>{children}</BuyerProvider>;
    }
    // Mock cart is never mounted for API sessions (including suppliers and visitors).
    if (authMode === "api") return <CartContext.Provider value={{suppliers:[],clearCart:()=>{},addToCart:()=>{},removeFromCart:()=>{},updateQuantity:()=>{}}}>{children}</CartContext.Provider>;
    return <CartProvider>{children}</CartProvider>;
}

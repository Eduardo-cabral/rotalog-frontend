import { createContext, useContext } from "react";
import type { BuyerRepository, Checkout, CheckoutInput, Offer } from "./buyerRepository";
export type CartLine = { offer: Offer; quantity: number };
export type Attempt = { key: string; input: CheckoutInput; checkout?: Checkout; payment?: { key: string; version: number }; uncertain?: boolean };
export type Stored = { lines: CartLine[]; attempt: Attempt | null };
export type BuyerValue = Stored & { repository: BuyerRepository; add: (offer: Offer, quantity: number, replace?: boolean) => void; update: (id: string, quantity: number) => void; remove: (id: string) => void; saveAttempt: (attempt: Attempt | null) => void; complete: () => void };
export const BuyerContext = createContext<BuyerValue | null>(null);
export function useBuyer() { const value=useContext(BuyerContext);if(!value)throw new Error("Sessão do comprador indisponível.");return value; }

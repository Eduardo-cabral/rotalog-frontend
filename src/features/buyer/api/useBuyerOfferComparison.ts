import { useState } from "react";

export type ComparableOffer = {
    id: string;
    product_id: string;
    is_active: boolean;
    supplier_name: string;
    unit_price: string;
    minimum_order_quantity: number;
    available_quantity: number;
    region?: string;
};

export function useOfferComparison<T extends ComparableOffer>(offers: T[], productId: string) {
    const activeOffers = offers.filter(offer => offer.product_id === productId && offer.is_active);
    const [selection, setSelection] = useState<{ productId: string; ids: string[] }>({ productId, ids: [] });
    const selectedOfferIds = selection.productId === productId
        ? selection.ids.filter(id => activeOffers.some(offer => offer.id === id))
        : [];
    const selectedOffers = selectedOfferIds
        .map(id => activeOffers.find(offer => offer.id === id))
        .filter((offer): offer is T => offer !== undefined);

    function toggleOffer(offerId: string, selected: boolean) {
        setSelection(current => {
            const currentIds = current.productId === productId
                ? current.ids.filter(id => activeOffers.some(offer => offer.id === id))
                : [];
            if (!selected) return { productId, ids: currentIds.filter(id => id !== offerId) };
            if (currentIds.includes(offerId) || currentIds.length >= 2) return current;
            return { productId, ids: [...currentIds, offerId] };
        });
    }

    return { activeOffers, selectedOfferIds, selectedOffers, toggleOffer };
}

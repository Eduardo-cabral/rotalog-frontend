import type {KeyboardEvent} from "react";
export type ProductsTab = "offers" | "catalog" | "warehouses";
const productTabs = [{id:"offers",label:"Minhas ofertas"},{id:"catalog",label:"Catálogo"},{id:"warehouses",label:"Meus depósitos"}] as const;
export function SupplierProductsTabs({value,onChange}: {value:ProductsTab;onChange:(value:ProductsTab)=>void}) {
    function navigate(event:KeyboardEvent<HTMLDivElement>) {
        const index=productTabs.findIndex(tab=>tab.id===value);
        const next=event.key==="Home"?0:event.key==="End"?2:event.key==="ArrowRight"?(index+1)%3:event.key==="ArrowLeft"?(index+2)%3:-1;
        if(next<0)return;
        event.preventDefault();onChange(productTabs[next].id);document.getElementById(`products-tab-${productTabs[next].id}`)?.focus();
    }
    return <div role="tablist" aria-label="Gestão de produtos" onKeyDown={navigate} className="supplier-product-tabs">{productTabs.map(tab=><button key={tab.id} id={`products-tab-${tab.id}`} type="button" role="tab" aria-selected={value===tab.id} aria-controls={`products-panel-${tab.id}`} tabIndex={value===tab.id?0:-1} onClick={()=>onChange(tab.id)}>{tab.label}</button>)}</div>;
}

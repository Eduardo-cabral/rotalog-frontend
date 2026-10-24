import {Link,useLocation,useNavigate} from "react-router-dom";
import {useAuth} from "../../auth/hooks/useAuth";
import {PageHeader} from "../../../shared/components/PageHeader";
import {SupplierOffers} from "./SupplierOffers";
import {SupplierCatalog} from "./SupplierCatalog";
import {SupplierProductsTabs,type ProductsTab} from "./SupplierProductsTabs";
export function ApiSupplierProducts() {
    const {user}=useAuth();
    return <SessionProducts key={`${user?.id}:${user?.organization_id}`} organizationId={user?.organization_id??""}/>;
}
function SessionProducts({organizationId}:{organizationId:string}) {
    const location=useLocation();
    const navigate=useNavigate();
    const tab:ProductsTab=location.hash==="#catalogo"?"catalog":location.hash==="#depositos"?"warehouses":"offers";
    function setTab(next:ProductsTab) {navigate({pathname:location.pathname,search:location.search,hash:next==="catalog"?"#catalogo":next==="warehouses"?"#depositos":"#minhas-ofertas"},{replace:true});}
    return <div className="flex min-w-0 flex-col gap-5"><PageHeader title="Produtos" subtitle="Gerencie suas ofertas, consulte o catálogo e organize seus depósitos." actions={<Link to="/fornecedor/estoque" className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium">Consultar estoque das minhas ofertas</Link>}/><SupplierProductsTabs value={tab} onChange={setTab}/><SupplierOffers organizationId={organizationId} tab={tab} onTabChange={setTab} renderCatalog={(create,canCreate)=><SupplierCatalog organizationId={organizationId} onCreateOffer={create} canCreate={canCreate}/>}/></div>;
}

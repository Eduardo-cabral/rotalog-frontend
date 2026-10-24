import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link, useNavigate, useOutletContext, useParams } from "react-router-dom";
import { useAuth } from "../../auth/hooks/useAuth";
import { buyerAuthorized } from "../../services/apiAuth.service";
import { catalogCategories, CatalogRepository, productCategory, type CatalogProduct } from "../../products/api/catalogRepository";
import { cents, orderLabel } from "../../orders/api/orderAdapter";
import { checkoutStateLabel, purchaseStateLabel, readableOrderState } from "../../orders/api/orderPresentation";
import { OrderQuantities, ReadOnlyBatches } from "../../orders/components/OrderOperationalSummary";
import { orderTone } from "../../../shared/components/supplierStatus";
import { useBuyer, type Attempt } from "./buyerContext";
import { BuyerRepository, buyerError, creationRejected, money, validateCart, type Checkout, type Offer, type Purchase, type Slot } from "./buyerRepository";
import { BuyerEmptyState, BuyerIcon, BuyerStatus } from "../components/BuyerVisuals";
import { ProductCategoryFilter } from "../../../shared/components/ProductCategoryFilter";
import { ProductImage } from "../../../shared/components/ProductImage";

const button = "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600";
const secondaryButton = "inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-800 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600";
const card = "rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6";
function formatCents(value: bigint) {
    return money(`${value / 100n}.${String(value % 100n).padStart(2, "0")}`);
}
function statusTone(tone: ReturnType<typeof orderTone>) {
    if (tone === "danger" || tone === "warning" || tone === "success" || tone === "progress") return tone;
    return "neutral";
}
function buyerOrderTone(state: string) {
    return state === "READY_TO_DISPATCH" ? "success" : orderTone(state);
}
function useRepository() {
    const {user} = useAuth();
    return useMemo(()=>new BuyerRepository(user?.organization_id ?? ""),[user?.organization_id]);
}
const purchaseRefreshInterval = 10_000;
const purchaseRequests = new Map<string, Promise<Purchase>>();
function purchaseRequest(repository: BuyerRepository, purchaseId: string, key: string): Promise<Purchase> {
    const existing = purchaseRequests.get(key);
    if (existing) return existing;
    const request = repository.purchase(purchaseId);
    purchaseRequests.set(key,request);
    const remove = () => {if (purchaseRequests.get(key)===request) purchaseRequests.delete(key);};
    void request.then(remove,remove);
    return request;
}
function usePurchaseDetails(repository: BuyerRepository, purchaseId: string, organizationId: string) {
    const key = `${organizationId}:${purchaseId}`;
    const [state, setState] = useState<{key:string;value?:Purchase;error:string;loading:boolean;refreshing:boolean}>({key,value:undefined,error:"",loading:true,refreshing:false});
    const refreshRef = useRef<(queueIfBusy?:boolean)=>void>(()=>{});
    useEffect(() => {
        let active = true;
        let inFlight = false;
        let refreshQueued = false;
        let terminal = false;
        let interval = 0;
        async function load(background: boolean, queueIfBusy = false) {
            if (!active || (background && document.visibilityState !== "visible")) return;
            if (inFlight) {
                if (queueIfBusy) refreshQueued = true;
                return;
            }
            if (background && terminal) return;
            inFlight = true;
            setState(previous => ({
                key,
                value: previous.key===key?previous.value:undefined,
                error: previous.key===key && previous.value ? previous.error : "",
                loading: !previous.value || previous.key!==key,
                refreshing: background,
            }));
            try {
                const purchase = await purchaseRequest(repository,purchaseId,key);
                if (!active) return;
                terminal = purchase.state === "CANCELLED";
                if (terminal && interval) {window.clearInterval(interval);interval=0;}
                setState({key,value:purchase,error:"",loading:false,refreshing:false});
            } catch (failure) {
                if (!active) return;
                const message = buyerError(failure);
                setState(previous => previous.key===key && previous.value
                    ? {...previous,error:message,loading:false,refreshing:false}
                    : {key,error:message,loading:false,refreshing:false});
            } finally {
                inFlight = false;
                if (active && refreshQueued) {
                    refreshQueued = false;
                    window.setTimeout(() => void load(true), 0);
                }
            }
        }

        refreshRef.current = queueIfBusy => {void load(true,queueIfBusy);};
        void load(false);
        interval = window.setInterval(() => {
            if (document.visibilityState === "visible" && !terminal) void load(true);
        }, purchaseRefreshInterval);
        function onVisibilityChange() {
            if (document.visibilityState === "visible" && !terminal) void load(true,true);
        }
        document.addEventListener("visibilitychange",onVisibilityChange);
        return () => {
            active = false;
            if (interval) window.clearInterval(interval);
            document.removeEventListener("visibilitychange",onVisibilityChange);
            refreshRef.current = () => {};
        };
    },[repository,purchaseId,key]);
    const current = state.key===key?state:{key,value:undefined,error:"",loading:true,refreshing:false};
    return {...current,reload:()=>refreshRef.current(true)};
}
function useRead<T>(load:()=>Promise<T>, dependencies: unknown[]) {
    const [value,setValue]=useState<T>();
    const [error,setError]=useState("");
    const [loading,setLoading]=useState(true);
    const [revision,setRevision]=useState(0);
    useEffect(()=>{
        let active=true;
        setLoading(true);setError("");setValue(undefined);
        void load().then(data=>{if(active)setValue(data);}).catch(reason=>{if(active)setError(buyerError(reason));}).finally(()=>{if(active)setLoading(false);});
        return ()=>{active=false;};
        // The caller supplies the identity and query dependencies.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    },[...dependencies,revision]);
    return {value,error,loading,reload:()=>setRevision(value=>value+1)};
}
function Result({loading,error,reload,children}:{loading:boolean;error:string;reload:()=>void;children:ReactNode}) {
    if(loading)return <div role="status" aria-live="polite" className={card}><p className="font-semibold text-blue-950">Carregando dados...</p><p className="mt-2 text-sm text-slate-500">Aguarde a consulta das informações atualizadas.</p></div>;
    if(error)return <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-5"><p className="font-semibold text-red-800">Não foi possível concluir a consulta</p><p className="mt-2 text-sm text-red-700">{error}</p><button className={`${button} mt-3`} onClick={reload}>Tentar novamente</button></div>;
    return <>{children}</>;
}
function Pager({page,total,size,onChange}:{page:number;total:number;size:number;onChange:(page:number)=>void}) {
    return <nav aria-label="Paginação" className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-3 sm:px-4"><button className={secondaryButton} disabled={page===1} onClick={()=>onChange(page-1)}><BuyerIcon name="arrow-left" className="h-4 w-4"/>Anterior</button><span className="px-2 text-sm font-medium text-slate-600">Página {page} de {Math.max(1,Math.ceil(total/size))}</span><button className={secondaryButton} disabled={page*size>=total} onClick={()=>onChange(page+1)}>Próxima<BuyerIcon name="arrow-right" className="h-4 w-4"/></button></nav>;
}
export function ApiBuyerCatalog() {
    const {user,isLoading}=useAuth();
    if(isLoading)return <p role="status">Verificando sessão...</p>;
    if(!user)return <section className={card}><h1 className="text-2xl font-bold">Catálogo de produtos</h1><p className="my-4">Entre para consultar produtos, preços e disponibilidade atualizados.</p><Link className={button} to="/login">Entrar</Link></section>;
    if(user.role!=="BUYER_ADMIN")return <section className={card}><p>Acesse seu portal para consultar o catálogo e gerenciar suas ofertas.</p><Link to="/fornecedor">Portal do fornecedor</Link></section>;
    if(!buyerAuthorized(user))return <p role="alert">Sem permissão para consultar o catálogo desta organização.</p>;
    return <CatalogContent key={user.organization_id} />;
}
function CatalogContent() {
    const {user}=useAuth();
    const {search=""}=useOutletContext<{search:string}>();
    const [page,setPage]=useState(1);
    const [query,setQuery]=useState(search);
    const [category,setCategory]=useState("");
    const repository=useRepository();
    const products=useMemo(()=>new CatalogRepository(user!.organization_id!),[user]);
    // A search change resets pagination before issuing the next query.
    const actualPage=query===search?page:1;
    const result=useRead(async()=>({products:await products.list(actualPage,search),offers:await repository.offers()}),[repository,user?.organization_id,actualPage,search]);
    const publishedProducts = result.value?.products.items.filter(product => product.publication_state === "PUBLISHED") ?? [];
    const categories = catalogCategories(publishedProducts);
    const activeCategory = categories.includes(category) ? category : "";
    const visibleProducts = publishedProducts.filter(product => !activeCategory || product.category === activeCategory);
    return <div>
        <header className="mb-6 overflow-hidden rounded-2xl bg-gradient-to-br from-[#102957] via-blue-900 to-blue-700 px-5 py-6 text-white sm:px-8 sm:py-8">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-blue-200">Marketplace RotaLog</p>
            <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">Catálogo de produtos</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-blue-100">Compare produtos e ofertas atuais de fornecedores para sua organização.</p>
            <div className="mt-5 flex max-w-2xl items-center gap-3 rounded-xl border border-white/20 bg-white/10 px-4 py-3 md:hidden">
                <BuyerIcon name="search" className="h-5 w-5 shrink-0 text-blue-100"/>
                <span className="min-w-0 text-sm text-blue-50">Use a busca no topo para encontrar produtos e fornecedores.</span>
            </div>
        </header>
        <Result {...result}>
            <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
                <div><h2 className="text-lg font-bold text-slate-900">Produtos disponíveis</h2><p className="mt-1 text-sm text-slate-500">Preços e disponibilidade confirmados nas ofertas atuais.</p></div>
                <span className="rounded-full bg-slate-100 px-3 py-1.5 text-sm font-semibold text-slate-600">{result.value?.products.total ?? 0} produto(s)</span>
            </div>
            <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
                <ProductCategoryFilter categories={categories} value={activeCategory} onChange={setCategory} label="Categoria nesta página"/>
            </div>
            {visibleProducts.length ? <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{visibleProducts.map(product=>{
                const offers=result.value!.offers.filter(offer=>offer.product_id===product.id && offer.is_active && offer.available_quantity>=offer.minimum_order_quantity);
                const cheapest=offers.reduce<Offer|undefined>((best,offer)=>!best||cents(offer.unit_price)<cents(best.unit_price)?offer:best,undefined);
                const productUnit = product.packaging_type.trim();
                const details = `${product.packaging_quantity} ${product.packaging_quantity === 1 ? "unidade" : "unidades"}${productUnit ? ` por ${productUnit.toLocaleLowerCase("pt-BR")}` : ""}`;
                return <article className="group flex min-w-0 flex-col rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md sm:p-5" key={product.id}>
                    <ProductImage name={product.name}/>
                    <div className="mt-4 flex min-h-7 flex-wrap items-center justify-between gap-2">
                        <div className="flex min-w-0 flex-wrap items-center gap-2">
                            <span className="max-w-[65%] truncate text-xs font-medium text-slate-500">{product.brand || "Produto"}</span>
                            <span className="rounded-full bg-blue-50 px-2 py-1 text-[11px] font-semibold text-blue-800">{productCategory(product.category)}</span>
                        </div>
                        {cheapest ? <BuyerStatus tone="success" icon="check">Disponível</BuyerStatus> : <BuyerStatus tone="neutral" icon="clock">Sem oferta</BuyerStatus>}
                    </div>
                    <h3 className="mt-3 min-h-12 text-base font-bold leading-6 text-slate-900">{product.name}</h3>
                    <p className="mt-1 text-sm text-slate-500">{details}</p>
                    <div className="mt-auto pt-5">
                        {cheapest ? <><p className="text-xs font-medium text-slate-500">Menor preço disponível</p><p className="mt-1 text-2xl font-bold tracking-tight text-blue-900">{money(cheapest.unit_price)}</p><p className="mt-1 text-xs text-slate-500">por {productUnit ? productUnit.toLocaleLowerCase("pt-BR") : "unidade comercial"}</p><p className="mt-1 text-xs text-slate-500">Oferta de {cheapest.supplier_name}</p></> : <p className="text-sm font-medium text-slate-600">Nenhuma oferta disponível no momento.</p>}
                        <Link className={`${button} mt-5 w-full`} to={`/produto/${encodeURIComponent(product.id)}`}>Ver produto<BuyerIcon name="arrow-right" className="h-4 w-4"/></Link>
                    </div>
                </article>;
            })}</div> : publishedProducts.length ? <BuyerEmptyState icon="search" title="Nenhum produto nesta categoria"><p>Escolha outra categoria para ver os produtos desta página.</p></BuyerEmptyState> : <BuyerEmptyState icon="search" title="Nenhum produto publicado encontrado"><p>Revise sua busca ou tente novamente mais tarde.</p></BuyerEmptyState>}
            <Pager page={actualPage} size={25} total={result.value?.products.total??0} onChange={next=>{setCategory("");setQuery(search);setPage(next);}}/>
        </Result>
    </div>;
}
export function ApiBuyerProductDetails() {
    const {productId=""}=useParams();
    const {user}=useAuth();
    const repository=useRepository();
    const result=useRead(async()=>({product:await new CatalogRepository(user!.organization_id!).detail(productId),offers:await repository.offers(productId)}),[repository,productId]);
    return <div><Link className={`${secondaryButton} mb-5`} to="/"><BuyerIcon name="arrow-left" className="h-4 w-4"/>Voltar ao catálogo</Link><div><Result {...result}>{result.value&&<><ProductInformation product={result.value.product}/><div className="my-5 flex flex-wrap items-end justify-between gap-2"><div><h2 className="text-xl font-bold text-blue-950">Ofertas disponíveis</h2><p className="mt-1 text-sm text-slate-500">Preço por unidade comercial e quantidade informados pelo fornecedor.</p></div></div><div className="grid gap-4 lg:grid-cols-2">{result.value.offers.filter(offer=>offer.is_active).map(offer=><OfferCard key={offer.id} offer={offer} packagingType={result.value!.product.packaging_type}/>)}</div>{!result.value.offers.length&&<BuyerEmptyState icon="store" title="Nenhuma oferta disponível"><p>Este produto ainda não possui ofertas ativas.</p></BuyerEmptyState>}</>}</Result></div></div>;
}
function ProductInformation({product}:{product:CatalogProduct}) {
    return <section className={`${card} grid gap-5 sm:grid-cols-[180px_minmax(0,1fr)] sm:items-center`}><ProductImage name={product.name} className="h-40 w-full sm:h-44"/><div><p className="text-xs font-semibold uppercase tracking-wide text-blue-700">{product.brand || "Produto"}</p><h1 className="mt-2 text-2xl font-bold text-blue-950">{product.name}</h1><p className="mt-2 text-sm text-slate-600">{product.packaging_type} · {product.packaging_quantity} unidades</p><details className="mt-4"><summary className="cursor-pointer text-sm font-semibold text-blue-700">Detalhes do produto</summary><dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">{Object.entries({"Conteúdo":`${product.net_content} ${product.net_content_unit}`,"GTIN":product.gtin??"Não informado","Peso bruto":`${product.gross_weight_grams} g`,"Volume":`${product.volume_cm3} cm³`,...product.variant_attributes}).map(([key,value])=><div key={key}><dt className="font-semibold">{key}</dt><dd className="text-slate-600">{String(value)}</dd></div>)}</dl></details></div></section>;
}
function OfferCard({offer,packagingType}:{offer:Offer;packagingType:string}) {
    const {user}=useAuth();
    const cart=useBuyer();
    const [quantity,setQuantity]=useState(offer.minimum_order_quantity);
    const [error,setError]=useState("");
    const [message,setMessage]=useState("");
    const [replace,setReplace]=useState(false);
    const other=cart.lines.some(line=>line.offer.supplier_organization_id!==offer.supplier_organization_id||line.offer.warehouse_id!==offer.warehouse_id);
    function add(replaceOrigin=false) {
        try{cart.add(offer,quantity,replaceOrigin);setMessage("Oferta adicionada ao carrinho.");setError("");setReplace(false);}catch(reason){setError(buyerError(reason));}
    }
    const available = offer.available_quantity >= offer.minimum_order_quantity;
    return <article className={`${card} flex flex-col`}><div className="flex flex-wrap items-start justify-between gap-3"><div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-700"><BuyerIcon name="store" className="h-5 w-5"/></span><div><p className="text-xs font-medium text-slate-500">Fornecedor</p><h3 className="font-bold text-slate-900">{offer.supplier_name}</h3></div></div><BuyerStatus tone={available?"success":"warning"} icon={available?"check":"clock"}>{available?"Disponível":"Indisponível"}</BuyerStatus></div><p className="mt-5 text-2xl font-bold text-blue-900">{money(offer.unit_price)}<span className="ml-1 text-xs font-medium text-slate-500">por unidade comercial ({packagingType.toLocaleLowerCase("pt-BR")})</span></p><p className="mt-2 text-sm text-slate-600">Mínimo {offer.minimum_order_quantity} · Disponível na consulta: {offer.available_quantity}</p><label className="my-4 flex items-center gap-3 text-sm font-semibold">Quantidade<input aria-label={`Quantidade de ${offer.product_name} em ${offer.supplier_name}`} className="w-24 rounded-lg border border-slate-300 px-3 py-2.5" type="number" min={offer.minimum_order_quantity} max={offer.available_quantity} value={quantity} onChange={event=>setQuantity(Number(event.target.value))}/></label><button className={`${button} mt-auto`} disabled={!buyerAuthorized(user!,"checkout:create")||!!cart.attempt||!available} onClick={()=>{setMessage("");if(other)setReplace(true);else add();}}>Adicionar ao carrinho<BuyerIcon name="cart" className="h-4 w-4"/></button>{replace&&<div role="alert" className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3"><p className="text-sm text-amber-950">Esta oferta é de outro fornecedor ou depósito. Substituir os itens atuais?</p><button className={`${button} mt-3`} onClick={()=>add(true)}>Substituir carrinho</button><button className={`${secondaryButton} mt-2 w-full`} onClick={()=>setReplace(false)}>Manter itens</button></div>}{message&&<p role="status" className="mt-3 text-sm text-emerald-800">{message} <Link className="font-semibold text-blue-700 underline" to="/comprador/carrinho">Ver carrinho</Link></p>}{error&&<p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}</article>;
}

export function ApiBuyerCart() {
    const cart=useBuyer();
    const repository=useRepository();
    const navigate=useNavigate();
    const [slots,setSlots]=useState<Slot[]>([]);
    const [slotId,setSlotId]=useState("");
    const [loading,setLoading]=useState(false);
    const [error,setError]=useState("");
    const [now,setNow]=useState(()=>Date.now());
    const lock=useRef(false);
    const mounted=useRef(true);
    useEffect(()=>{mounted.current=true;const timer=setInterval(()=>setNow(Date.now()),1000);return()=>{mounted.current=false;clearInterval(timer);};},[]);
    const warehouse=cart.lines[0]?.offer.warehouse_id;
    useEffect(()=>{
        let active=true;
        if(!warehouse)return;
        void repository.slots(warehouse).then(items=>{if(active)setSlots(items);}).catch(reason=>{if(active)setError(buyerError(reason));});
        return()=>{active=false;};
    },[repository,warehouse]);
    async function run(action:()=>Promise<void>) {
        if(lock.current)return;
        lock.current=true;setLoading(true);setError("");
        try{await action();}catch(reason){if(mounted.current)setError(buyerError(reason));}finally{lock.current=false;if(mounted.current)setLoading(false);}
    }
    function confirmed(checkout:Checkout) {
        if(checkout.purchase_id){cart.complete();navigate(`/comprador/compras/${encodeURIComponent(checkout.purchase_id)}`,{replace:true});return true;}return false;
    }
    async function create() {
        const offers=await repository.offers();
        const selected=cart.lines.map(line=>offers.find(offer=>offer.id===line.offer.id));
        if(selected.some(offer=>!offer))throw new Error("Oferta indisponível. Revise o carrinho.");
        validateCart(selected as Offer[],cart.lines.map(line=>line.quantity));
        const capacity=await repository.slots(warehouse!);
        const slot=capacity.find(item=>item.id===slotId&&item.warehouse_id===warehouse&&Date.parse(item.ends_at)>Date.now()&&item.total_quantity-item.reserved_quantity>=cart.lines.reduce((sum,line)=>sum+line.quantity,0));
        if(!slot)throw new Error("Escolha uma janela com capacidade suficiente.");
        if(!mounted.current)return;
        const attempt:Attempt={key:crypto.randomUUID(),input:{items:cart.lines.map(line=>({offer_id:line.offer.id,quantity:line.quantity})),capacity_slot_id:slotId,accepts_partial:false},uncertain:true};
        cart.saveAttempt(attempt);
        try {
            const checkout=await repository.create(attempt.input,attempt.key);
            if(mounted.current)cart.saveAttempt({...attempt,checkout,uncertain:false});
        } catch(reason) {
            if(mounted.current && creationRejected(reason)) cart.saveAttempt(null);
            throw reason;
        }
    }
    async function recover() {
        const attempt=cart.attempt!;
        // Unknown creation is only resent after this explicit action, with the same body and key.
        try {
            const checkout=attempt.checkout?await repository.checkout(attempt.checkout.id):await repository.create(attempt.input,attempt.key);
            if(!mounted.current||confirmed(checkout))return;
            cart.saveAttempt({...attempt,checkout,uncertain:false});
        } catch(reason) {
            if(mounted.current && !attempt.checkout && creationRejected(reason))cart.saveAttempt(null);
            throw reason;
        }
    }
    async function pay() {
        const attempt=cart.attempt!;
        const checkout=await repository.checkout(attempt.checkout!.id);
        if(!mounted.current||confirmed(checkout))return;
        if(checkout.state!=="READY_FOR_PAYMENT"||Date.parse(checkout.expires_at)<=Date.now()) {cart.saveAttempt({...attempt,checkout,uncertain:false});throw new Error("Checkout indisponível ou expirado. Consulte o resultado.");}
        if(checkout.version!==attempt.checkout!.version||checkout.total!==attempt.checkout!.total){cart.saveAttempt({...attempt,checkout,payment:undefined});throw new Error("Os valores ou a versão mudaram. Revise a compra antes de confirmar.");}
        const payment=attempt.payment??{key:crypto.randomUUID(),version:checkout.version};
        cart.saveAttempt({...attempt,checkout,payment,uncertain:true});
        const result=await repository.pay(checkout.id,payment.version,payment.key);
        if(!mounted.current)return;
        cart.complete();navigate(`/comprador/compras/${encodeURIComponent(result.purchase_id)}`,{replace:true});
    }
    const checkout=cart.attempt?.checkout;
    const expired=!!checkout&&Date.parse(checkout.expires_at)<=now;
    const itemSubtotal = cart.lines.reduce((sum, line) => sum + cents(line.offer.unit_price) * BigInt(line.quantity), 0n);
    const displayedTotal = checkout ? money(checkout.total) : formatCents(itemSubtotal);
    const itemCount = cart.lines.reduce((sum, line) => sum + line.quantity, 0);
    return <div className="space-y-6">
        <header className="flex flex-wrap items-end justify-between gap-3">
            <div><p className="text-xs font-bold uppercase tracking-[0.12em] text-blue-700">Portal do comprador</p><h1 className="mt-1 text-2xl font-bold tracking-tight text-blue-950 sm:text-3xl">Meu carrinho</h1><p className="mt-2 text-sm text-slate-600">Revise os itens e as condições da compra.</p></div>
            {!!cart.lines.length && <BuyerStatus tone="progress" icon="cart">{itemCount} {itemCount === 1 ? "unidade" : "unidades"}</BuyerStatus>}
        </header>
        {error&&<p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</p>}
        {loading&&<p role="status" className="rounded-xl bg-blue-50 px-4 py-3 text-sm font-medium text-blue-800">Processando solicitação...</p>}
        {!cart.lines.length&&!cart.attempt ? <BuyerEmptyState icon="cart" title="Seu carrinho está vazio."><p>Explore as ofertas e encontre os produtos certos para sua empresa.</p><Link className={button} to="/">Explorar produtos<BuyerIcon name="arrow-right" className="h-4 w-4"/></Link></BuyerEmptyState> :
        <>
            {!!cart.lines.length && <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
                <section aria-label="Itens do carrinho" className="min-w-0 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <h2 className="text-lg font-bold text-slate-900">Produtos selecionados</h2>
                        <Link className="inline-flex items-center gap-1.5 text-sm font-semibold text-blue-700 hover:underline" to="/"><BuyerIcon name="arrow-left" className="h-4 w-4"/>Continuar comprando</Link>
                    </div>
                    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                        {cart.lines.map((line,index)=>{
                            const subtotal = cents(line.offer.unit_price) * BigInt(line.quantity);
                            return <article key={line.offer.id} className={`flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5 ${index ? "border-t border-slate-100" : ""}`}>
                                <div className="min-w-0 flex-1">
                                    <p className="text-xs font-medium text-slate-500">{line.offer.supplier_name}</p>
                                    <h3 className="mt-1 text-base font-bold leading-6 text-slate-900">{line.offer.product_name}</h3>
                                    <p className="mt-1 text-sm text-slate-600">{money(line.offer.unit_price)} <span className="text-slate-500">por unidade comercial da oferta</span></p>
                                    <details className="mt-2 text-xs text-slate-500"><summary className="w-fit cursor-pointer font-medium text-blue-700">Disponibilidade consultada</summary><p className="mt-1">Mínimo {line.offer.minimum_order_quantity} · Disponível na consulta: {line.offer.available_quantity}</p></details>
                                </div>
                                <div className="flex flex-wrap items-center justify-between gap-4 sm:justify-end">
                                    <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">Quantidade<input aria-label={`Quantidade de ${line.offer.product_name}`} className="w-24 rounded-lg border border-slate-300 px-3 py-2.5 text-center font-semibold tabular-nums focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100" type="number" min={line.offer.minimum_order_quantity} max={line.offer.available_quantity} disabled={!!cart.attempt||loading} value={line.quantity} onChange={event=>{try{cart.update(line.offer.id,Number(event.target.value));setError("");}catch(reason){setError(buyerError(reason));}}}/></label>
                                    <div className="min-w-28 text-right"><p className="text-xs text-slate-500">Subtotal</p><p className="mt-1 text-lg font-bold tabular-nums text-blue-950">{formatCents(subtotal)}</p></div>
                                    <button aria-label={`Remover ${line.offer.product_name}`} className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg px-3 text-sm font-semibold text-red-700 transition hover:bg-red-50 disabled:opacity-50" disabled={!!cart.attempt||loading} onClick={()=>cart.remove(line.offer.id)}><BuyerIcon name="trash" className="h-4 w-4"/>Remover</button>
                                </div>
                            </article>;
                        })}
                    </div>
                </section>
                <aside className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm xl:sticky xl:top-24">
                    <h2 className="text-lg font-bold text-slate-900">Resumo</h2>
                    <p className="mt-1 text-sm text-slate-500">{cart.lines.length} {cart.lines.length === 1 ? "produto" : "produtos"} · {itemCount} {itemCount === 1 ? "unidade" : "unidades"}</p>
                    <div className="mt-5 flex items-center justify-between gap-3 border-t border-slate-100 pt-4 text-sm"><span className="text-slate-600">{checkout ? "Total oficial" : "Subtotal consultado"}</span><span className="text-lg font-bold tabular-nums text-blue-900">{displayedTotal}</span></div>
                    {!checkout && <p className="mt-2 text-xs leading-5 text-slate-500">O total oficial será confirmado na revisão da reserva.</p>}
                    {!cart.attempt&&<div className="mt-5 space-y-3 border-t border-slate-100 pt-5">
                        <label className="block text-sm font-semibold text-slate-800" htmlFor="buyer-slot">Período de atendimento</label>
                        <p className="text-xs leading-5 text-slate-500">Escolha quando o fornecedor poderá atender este pedido. A capacidade livre indica quantas unidades ainda cabem nesse período.</p>
                        <select id="buyer-slot" className="w-full rounded-xl border border-slate-300 bg-white p-3 text-sm focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100" value={slotId} onChange={event=>setSlotId(event.target.value)}><option value="">Selecione um período</option>{slots.filter(slot=>Date.parse(slot.ends_at)>now&&slot.total_quantity-slot.reserved_quantity>=cart.lines.reduce((sum,line)=>sum+line.quantity,0)).map(slot=><option key={slot.id} value={slot.id}>{new Date(slot.starts_at).toLocaleString("pt-BR")} até {new Date(slot.ends_at).toLocaleString("pt-BR")} · Capacidade livre: {slot.total_quantity-slot.reserved_quantity}</option>)}</select>
                        <button className={`${secondaryButton} w-full`} disabled={loading} onClick={()=>void run(async()=>setSlots(await repository.slots(warehouse!)))}><BuyerIcon name="refresh" className="h-4 w-4"/>Atualizar capacidade</button>
                        <p className="text-xs leading-5 text-slate-500">Ao continuar, será criada uma reserva de checkout para este período. Ela não confirma o pagamento; os valores serão revisados antes da confirmação.</p>
                        <button className={`${button} w-full`} disabled={!slotId||loading} onClick={()=>void run(create)}>Reservar período e revisar compra<BuyerIcon name="arrow-right" className="h-4 w-4"/></button>
                    </div>}
                </aside>
            </div>}
            {cart.attempt&&<section className={`${card} space-y-4`}><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl font-bold text-blue-950">Revisão da compra</h2>{checkout&&<BuyerStatus tone={checkout.state==="READY_FOR_PAYMENT"?"warning":checkout.state==="CONVERTED"?"success":"neutral"} icon={checkout.state==="CONVERTED"?"check":"clock"}>{checkoutStateLabel(checkout.state)}</BuyerStatus>}</div>{checkout&&<><p className="text-sm text-slate-600">Validade da reserva: {new Date(checkout.expires_at).toLocaleString("pt-BR")}</p><p className="text-xs text-slate-500">Os preços abaixo são por unidade comercial, conforme cada oferta confirmada.</p><ul className="divide-y divide-slate-100 rounded-xl border border-slate-100 px-4">{checkout.items.map(item=><li key={item.offer_id} className="flex flex-wrap justify-between gap-2 py-3 text-sm"><span>{item.product.name} · {item.quantity} × {money(item.unit_price)}</span><span className="font-semibold">{formatCents(cents(item.unit_price)*BigInt(item.quantity))}</span></li>)}</ul><p className="flex flex-wrap justify-between gap-3 rounded-xl bg-blue-50 p-4 text-lg font-bold text-blue-950"><span>Total oficial:</span><span>{money(checkout.total)}</span></p></>}{expired&&<p role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">Prazo da reserva encerrado. Consulte a situação antes de continuar; a liberação não é confirmada automaticamente.</p>}{cart.attempt.uncertain&&<p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">Resultado ainda não confirmado. Não inicie outra compra. Consulte ou recupere esta operação com a mesma chave.</p>}<div className="flex flex-wrap gap-3"><button className={secondaryButton} disabled={loading} onClick={()=>void run(recover)}>{checkout?"Consultar resultado":"Recuperar criação com a mesma chave"}</button>{checkout?.state==="READY_FOR_PAYMENT"&&!expired&&!cart.attempt.uncertain&&<button className={`${button} bg-emerald-700 hover:bg-emerald-800`} disabled={loading} onClick={()=>void run(pay)}>Confirmar pagamento<BuyerIcon name="check" className="h-4 w-4"/></button>}{checkout?.state==="EXPIRED"&&<button className={secondaryButton} disabled={loading} onClick={()=>cart.saveAttempt(null)}>Revisar carrinho após expiração confirmada</button>}</div><details className="text-sm text-slate-500"><summary className="w-fit cursor-pointer font-semibold text-blue-700">Detalhes e limites da reserva</summary><p className="mt-2">Não há cancelamento de reserva por esta interface. Sair da página não confirma a liberação do estoque.</p></details></section>}
        </>}
    </div>;
}

export function ApiBuyerPurchases() {
    const repository=useRepository();
    const [page,setPage]=useState(1);
    const result=useRead(()=>repository.purchases(page),[repository,page]);
    return <div className="space-y-5">
        <header className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.12em] text-blue-700">Portal do comprador</p><h1 className="mt-1 text-2xl font-bold tracking-tight text-blue-950 sm:text-3xl">Minhas compras</h1><p className="mt-2 text-sm text-slate-600">Veja os valores e o andamento de cada pedido.</p></div><button className={secondaryButton} disabled={result.loading} onClick={result.reload}><BuyerIcon name="refresh" className="h-4 w-4"/>Atualizar compras</button></header>
        <Result {...result}>
            <div className="space-y-4">{result.value?.items.map(purchase=>{
                const total=purchase.supplier_orders.reduce((sum,order)=>sum+cents(order.total),0n);
                const tone=purchase.state==="CANCELLED"?"danger":purchase.state==="ACTIVE"?"progress":"neutral";
                return <article className={`${card} transition hover:border-blue-200 hover:shadow-md`} key={purchase.id}>
                    <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Estado comercial da compra</p><h2 className="mt-1 text-lg font-bold text-blue-950">Compra #{purchase.id.slice(0,8).toUpperCase()}</h2></div><BuyerStatus tone={tone} icon={tone==="danger"?"package":tone==="progress"?"clock":"check"}>{purchaseStateLabel(purchase.state)}</BuyerStatus></div>
                    <div className="mt-5 grid gap-3 sm:grid-cols-2">
                        <div className="rounded-xl bg-slate-50 p-4"><p className="text-xs font-medium text-slate-500">Valor da compra</p><p className="mt-1 text-xl font-bold tabular-nums text-blue-950">{formatCents(total)}</p></div>
                        <div className="rounded-xl bg-slate-50 p-4"><p className="text-xs font-medium text-slate-500">Pedidos vinculados</p><p className="mt-1 text-xl font-bold text-slate-900">{purchase.supplier_orders.length}</p></div>
                    </div>
                    <ul className="mt-4 divide-y divide-slate-100 rounded-xl border border-slate-100 px-4">{purchase.supplier_orders.map(order=>{const orderStatusTone=buyerOrderTone(order.state);return <li key={order.id} className="flex flex-wrap items-center justify-between gap-3 py-3"><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><span className="text-sm font-semibold text-slate-800">{orderLabel(order,purchase.supplier_orders)}</span><span className="text-xs font-medium text-slate-500">Situação operacional</span><BuyerStatus tone={statusTone(orderStatusTone)} icon={orderStatusTone==="danger"?"package":orderStatusTone==="success"?"check":orderStatusTone==="progress"?"package":"clock"}>{readableOrderState(order.state)}</BuyerStatus></div><p className="mt-1 break-words text-sm text-slate-600">{order.items.map(item=>item.product.name).join(" · ") || "Produtos não informados"}</p></div><p className="text-sm font-bold tabular-nums text-slate-800">{money(order.total)}</p></li>;})}</ul>
                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-slate-500">O estado comercial da compra e a situação operacional de cada pedido são acompanhados separadamente.</p><Link className={button} to={`/comprador/compras/${encodeURIComponent(purchase.id)}`}>Ver detalhes<BuyerIcon name="arrow-right" className="h-4 w-4"/></Link></div>
                </article>;
            })}</div>
            {result.value?.items.length===0&&<BuyerEmptyState icon="package" title="Seu histórico começa com a primeira compra"><p>Nenhuma compra encontrada para sua organização.</p><Link className={button} to="/">Explorar produtos<BuyerIcon name="arrow-right" className="h-4 w-4"/></Link></BuyerEmptyState>}
            <Pager page={page} total={result.value?.total??0} size={25} onChange={setPage}/>
        </Result>
    </div>;
}
function PreparationProgress({state}:{state:string}) {
    const steps = [
        {states:["AWAITING_SUPPLIER_DECISION"],label:"Aguardando fornecedor"},
        {states:["ACCEPTED","PARTIALLY_ACCEPTED"],label:"Pedido analisado"},
        {states:["SEPARATING"],label:"Em preparação"},
        {states:["READY_TO_DISPATCH"],label:"Preparação concluída"},
    ];
    const active = steps.findIndex(step=>step.states.includes(state));
    if(active<0) return <section className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4"><h3 className="font-semibold text-slate-900">Preparação</h3><p className="mt-1 text-sm text-slate-600">Não há uma etapa de preparação aplicável a esta situação.</p></section>;
    return <section aria-label="Progresso da preparação" className="mt-4 rounded-xl border border-blue-100 bg-blue-50/60 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold text-blue-950">Preparação</h3><span className="text-xs font-medium text-blue-800">{steps[active].label}</span></div>
        <div role="progressbar" aria-label="Etapas confirmadas da preparação" aria-valuemin={0} aria-valuemax={steps.length-1} aria-valuenow={active} className="mt-4 grid grid-cols-4 gap-2">
            {steps.map((step,index)=><div key={step.label} className="min-w-0"><div className={`h-1.5 rounded-full ${index<=active?"bg-blue-600":"bg-blue-100"}`}/><p className={`mt-2 text-[11px] leading-4 ${index===active?"font-semibold text-blue-900":"text-slate-500"}`}>{step.label}</p></div>)}
        </div>
        <p className="mt-3 text-xs text-slate-600">Exibimos somente etapas confirmadas pela situação atual do pedido. Isso não confirma coleta, transporte ou entrega.</p>
    </section>;
}

export function ApiBuyerPurchaseDetails() {
    const {purchaseId=""}=useParams();
    const {user}=useAuth();
    const repository=useRepository();
    const result=usePurchaseDetails(repository,purchaseId,user?.organization_id??"");
    return <div className="space-y-5">
        <Link className={`${secondaryButton} w-fit`} to="/comprador/compras"><BuyerIcon name="arrow-left" className="h-4 w-4"/>Voltar às compras</Link>
        <Result loading={result.loading} error={result.value?"":result.error} reload={result.reload}>{result.value&&<>
            <header className={`${card} flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between`}>
                <div><p className="text-xs font-bold uppercase tracking-[0.12em] text-blue-700">Resumo da compra</p><h1 className="mt-1 text-2xl font-bold tracking-tight text-blue-950 sm:text-3xl">Compra #{result.value.id.slice(0,8).toUpperCase()}</h1><p className="mt-2 text-sm text-slate-600">{result.value.supplier_orders.length} pedido(s) vinculado(s)</p></div>
                <div className="flex flex-wrap items-end justify-between gap-4 sm:justify-end"><div><p className="text-xs font-medium text-slate-500">Valor total</p><p className="mt-1 text-2xl font-bold tabular-nums text-blue-950">{formatCents(result.value.supplier_orders.reduce((sum,order)=>sum+cents(order.total),0n))}</p></div><button className={secondaryButton} disabled={result.refreshing} onClick={result.reload}><BuyerIcon name="refresh" className="h-4 w-4"/>Atualizar situação</button></div>
            </header>
            <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-xs text-slate-500">
                <p role="status" aria-live="polite">{result.refreshing?"Atualizando situação…":result.value.state==="CANCELLED"?"Compra cancelada; atualização automática pausada.":"Atualização automática a cada 10 segundos."}</p>
                {result.error&&<p className="flex flex-wrap items-center gap-2 text-amber-800"><span>Não foi possível atualizar. Exibindo a última situação recebida.</span><button type="button" className="font-semibold underline" onClick={result.reload}>Tentar novamente</button></p>}
            </div>
            <section aria-label="Situação comercial da compra" className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-semibold text-slate-900">Situação comercial</h2><p className="mt-1 text-sm text-slate-600">Estado geral da compra, separado do andamento dos pedidos.</p></div><BuyerStatus tone={result.value.state==="CANCELLED"?"danger":result.value.state==="ACTIVE"?"progress":"neutral"} icon={result.value.state==="CANCELLED"?"package":result.value.state==="ACTIVE"?"clock":"check"}>{purchaseStateLabel(result.value.state)}</BuyerStatus></div></section>
            {result.value.supplier_orders.map((order,index)=><article className={card} key={order.id}>
                <header className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Situação operacional do pedido</p><h2 className="mt-1 text-lg font-bold text-blue-950">{orderLabel(order,result.value!.supplier_orders)}</h2></div><BuyerStatus tone={statusTone(buyerOrderTone(order.state))} icon={buyerOrderTone(order.state)==="success"?"check":buyerOrderTone(order.state)==="danger"?"package":buyerOrderTone(order.state)==="progress"?"package":"clock"}>{readableOrderState(order.state)}</BuyerStatus></header>
                <section aria-label={`Produtos do pedido ${index+1}`} className="mt-5 divide-y divide-slate-100 rounded-xl border border-slate-100 px-4">
                    {order.items.map(item=><div key={item.id} className="flex flex-wrap items-center justify-between gap-3 py-4"><div className="min-w-0 flex-1"><h3 className="font-semibold text-slate-900">{item.product.name}</h3><p className="mt-1 text-sm text-slate-500">{item.product.brand ? `${item.product.brand} · ` : ""}{item.requested_quantity} × {money(item.unit_price)} por {item.product.packaging_type || "unidade comercial"}</p></div><p className="text-right text-sm font-bold tabular-nums text-slate-900">{formatCents(cents(item.unit_price)*BigInt(item.requested_quantity))}</p></div>)}
                    {!order.items.length&&<p className="py-4 text-sm text-slate-500">Nenhum produto informado neste pedido.</p>}
                </section>
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-blue-50 p-4"><span className="text-sm font-semibold text-blue-950">Total oficial do pedido</span><span className="text-xl font-bold tabular-nums text-blue-950">{money(order.total)}</span></div>
                <PreparationProgress state={order.state}/>
                <details className="mt-4 rounded-xl border border-slate-200 p-4 text-sm"><summary className="w-fit cursor-pointer font-semibold text-blue-700">Detalhes do pedido e quantidades</summary><div className="mt-3 space-y-4"><OrderQuantities items={order.items}/><ReadOnlyBatches order={order}/><dl className="grid gap-2 border-t border-slate-100 pt-3 text-xs text-slate-600 sm:grid-cols-2"><div><dt className="font-semibold">Atendimento</dt><dd>{order.accepts_partial?"Parcial permitido":"Integral"}</dd></div>{order.cancellation_reason&&<div><dt className="font-semibold">Motivo do cancelamento</dt><dd>{order.cancellation_reason}</dd></div>}</dl></div></details>
            </article>)}
            {!result.value.supplier_orders.length&&<BuyerEmptyState icon="package" title="Nenhum pedido informado"><p>Esta compra ainda não possui pedidos disponíveis para consulta.</p></BuyerEmptyState>}
        </>}</Result>
    </div>;
}

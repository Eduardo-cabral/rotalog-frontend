import {test,expect,type Page} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const organization='buyer-org';
const product={id:'official-product',name:'Arroz oficial',brand:'Marca oficial',category:'ALIMENTO_SECO_INDUSTRIALIZADO',gtin:null,net_content:1000,net_content_unit:'g',packaging_type:'Fardo',packaging_quantity:6,gross_weight_grams:6200,volume_cm3:1000,variant_attributes:{},publication_state:'PUBLISHED',version:1,demo_run_id:'demo',is_synthetic:true};
const offer={id:'offer-one',product_id:product.id,product_name:product.name,supplier_organization_id:'supplier-org',supplier_name:'Distribuidora oficial',warehouse_id:'warehouse',unit_price:'149.90',currency:'BRL',minimum_order_quantity:2,available_quantity:20,version:1,is_active:true,demo_run_id:'demo',is_synthetic:true};
const slot={id:'slot',warehouse_id:'warehouse',starts_at:'2026-01-01T00:00:00Z',ends_at:'2099-01-01T00:00:00Z',total_quantity:100,reserved_quantity:0};
const order={id:'supplier-order',purchase_id:'purchase',buyer_organization_id:organization,supplier_organization_id:'supplier-org',warehouse_id:'warehouse',state:'AWAITING_SUPPLIER_DECISION',total:'299.80',items:[{id:'item',offer_id:offer.id,product,unit_price:'149.90',requested_quantity:2,supplier_accepted_quantity:0,separated_quantity:0,dispatched_quantity:0,delivered_quantity:0}],fulfillments:[],allowed_actions:[],version:1,is_synthetic:true};
async function setup(page:Page,restore=true) {
    const state={role:'BUYER_ADMIN' as 'BUYER_ADMIN'|'SUPPLIER_OPERATOR',capabilities:['catalog:read','checkout:create','purchase:read'],org:organization,products:[product],offers:[offer],orderStates:['AWAITING_SUPPLIER_DECISION'],delayOffers:0,network:false,createFail:0,createStatus:0,payFail:0,payStatus:0,purchaseStatus:0,purchaseGets:0,purchaseState:'ACTIVE',purchaseFailNext:false,purchaseDelay:0,purchaseInFlight:0,maxPurchaseInFlight:0,emptyPurchases:false,foreign:false,created:[] as {key:string;body:unknown}[],payments:[] as {key:string;body:unknown}[],confirmed:false,checkoutVersion:1,expired:false,unknown:[] as string[]};
    if(restore)await page.addInitScript(()=>sessionStorage.setItem('rotalog:api-csrf','test-csrf'));
    await page.route('http://localhost:8000/**',async route=>{
        const request=route.request(),url=new URL(request.url()),path=url.pathname;
        const user={id:state.role==='BUYER_ADMIN'?'buyer':'supplier',name:'Usuário Sintético',email:'user@example.invalid',role:state.role,organization_id:state.org,organizations:[{id:state.org,name:'Organização Sintética',role:state.role}],capabilities:state.capabilities,demo_run_id:'demo',is_synthetic:true};
        const checkout=()=>({id:'checkout',state:state.confirmed?'CONVERTED':state.expired?'EXPIRED':'READY_FOR_PAYMENT',version:state.checkoutVersion,supplier_organization_id:'supplier-org',warehouse_id:'warehouse',capacity_slot_id:slot.id,expires_at:state.expired?'2020-01-01T00:00:00Z':'2099-01-01T00:00:00Z',total:'299.80',currency:'BRL',items:[{offer_id:offer.id,quantity:2,unit_price:'149.90',product}],purchase_id:state.confirmed?'purchase':null,is_synthetic:true});
        const purchase={id:'purchase',checkout_id:'checkout',state:state.purchaseState,supplier_orders:state.orderStates.map((orderState,index)=>({...order,id:index?`supplier-order-${index}`:order.id,state:orderState,buyer_organization_id:state.foreign?'another-org':state.org})),is_synthetic:true};
        const list=(items:unknown[])=>({items,total:items.length,page:Number(url.searchParams.get('page')??1),page_size:Number(url.searchParams.get('page_size')??25),is_synthetic:true});
        if(path.endsWith('/auth/login')||path.endsWith('/auth/refresh'))return route.fulfill({json:{access_token:'test',token_type:'bearer',expires_in:600,csrf_token:'test-csrf',refresh_token:null,user}});
        if(path==='/api/v1/me')return route.fulfill({json:user});
        if(path.endsWith('/auth/logout'))return route.fulfill({status:204});
        expect(request.headers()['authorization']).toBe('Bearer test');
        expect(request.headers()['x-organization-id']).toBe(state.org);
        if(state.network)return route.abort();
        if(path==='/api/v1/products')return route.fulfill({json:list(state.products)});
        if(path===`/api/v1/products/${product.id}`)return route.fulfill({json:product});
        if(path==='/api/v1/offers'){if(state.delayOffers)await new Promise(resolve=>setTimeout(resolve,state.delayOffers));return route.fulfill({json:list(state.offers)});}
        if(path==='/api/v1/supplier-orders')return route.fulfill({json:list(state.confirmed?[{...order,acceptance_deadline:'2099-01-01T00:00:00Z',accepts_partial:false,currency:'BRL',is_synthetic:true}]:[])});
        if(path==='/api/v1/supplier-orders/supplier-order')return route.fulfill({json:{...order,acceptance_deadline:'2099-01-01T00:00:00Z',accepts_partial:false,currency:'BRL',is_synthetic:true}});
        if(path==='/api/v1/capacity-slots')return route.fulfill({json:list([slot])});
        if(path==='/api/v1/checkouts'&&request.method()==='POST'){
            state.created.push({key:request.headers()['idempotency-key'],body:request.postDataJSON()});
            if(state.createStatus)return route.fulfill({status:state.createStatus,json:{error:{code:'INSUFFICIENT_INVENTORY'}}});
            if(state.createFail-- >0)return route.abort();
            return route.fulfill({status:201,json:checkout()});
        }
        if(path==='/api/v1/checkouts/checkout')return route.fulfill({json:checkout()});
        if(path==='/api/v1/checkouts/checkout/confirm-payment'){
            state.payments.push({key:request.headers()['idempotency-key'],body:request.postDataJSON()});
            if(state.payStatus)return route.fulfill({status:state.payStatus,json:{error:{code:state.payStatus===401?'SESSION_EXPIRED':'VERSION_CONFLICT'}}});
            if(state.payFail-- >0)return route.abort();
            state.confirmed=true;
            return route.fulfill({json:{purchase_id:'purchase',supplier_order_ids:['supplier-order'],payment_id:'payment',payment_state:'CAPTURED',total:'299.80',currency:'BRL',is_synthetic:true}});
        }
        if(path==='/api/v1/purchases')return route.fulfill({json:list(state.emptyPurchases?[]:[purchase])});
        if(path==='/api/v1/purchases/purchase'){
            state.purchaseGets++;state.purchaseInFlight++;state.maxPurchaseInFlight=Math.max(state.maxPurchaseInFlight,state.purchaseInFlight);
            try {
                if(state.purchaseDelay)await new Promise(resolve=>setTimeout(resolve,state.purchaseDelay));
                if(state.network)return route.abort();
                if(state.purchaseFailNext){state.purchaseFailNext=false;return route.fulfill({status:503,json:{error:{code:'TEMPORARY_FAILURE'}}});}
                return state.purchaseStatus?route.fulfill({status:state.purchaseStatus,json:{error:{code:'PURCHASE_NOT_FOUND'}}}):route.fulfill({json:purchase});
            } finally {state.purchaseInFlight--;}
        }
        state.unknown.push(`${request.method()} ${path}`);
        return route.abort();
    });
    return state;
}
test('router API preserva catálogo, detalhes do produto, lista e detalhes de compras',async({page})=>{
    const state=await setup(page);
    await page.goto('/');
    await expect(page.getByRole('heading',{name:'Catálogo de produtos',exact:true})).toBeVisible();
    await expect(page.getByRole('note')).toHaveText('Dados de demonstração');
    await page.getByRole('link',{name:'Ver produto',exact:true}).click();
    await expect(page.getByRole('heading',{name:product.name,exact:true})).toBeVisible();
    await expect(page.getByRole('heading',{name:'Ofertas disponíveis',exact:true})).toBeVisible();
    await expect(page.getByRole('note')).toHaveText('Dados de demonstração');

    await page.goto('/comprador/compras');
    await expect(page.getByRole('heading',{name:'Minhas compras',exact:true})).toBeVisible();
    await expect(page.getByRole('note')).toHaveText('Dados de demonstração');
    await page.getByRole('link',{name:'Ver detalhes',exact:true}).click();
    await expect(page).toHaveURL(/\/comprador\/compras\/purchase$/);
    await expect(page.getByRole('heading',{name:'Compra #PURCHASE',exact:true})).toBeVisible();
    await expect(page.getByRole('heading',{name:product.name,exact:true})).toBeVisible();
    await expect(page.getByRole('note')).toHaveText('Dados de demonstração');
    expect(state.unknown).toEqual([]);
});
async function add(page:Page) {
    await page.goto(`/produto/${product.id}`);
    await page.getByRole('button',{name:'Adicionar ao carrinho',exact:true}).first().click();
    await expect(page.getByRole('status')).toContainText('Oferta adicionada');
    await page.goto('/comprador/carrinho');
}
async function reserve(page:Page) {
    await page.getByLabel('Período de atendimento',{exact:true}).selectOption('slot');
    await page.getByRole('button',{name:'Reservar período e revisar compra'}).click();
}
test('jornada do comprador via router com respostas API interceptadas',async({page})=>{
    const state=await setup(page,false);
    await page.goto('/login');
    await page.getByLabel('E-mail',{exact:true}).fill('buyer@example.invalid');
    await page.getByLabel('Senha',{exact:true}).fill('synthetic-only-password');
    await page.getByRole('button',{name:'Entrar',exact:true}).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole('heading',{name:product.name,exact:true})).toBeVisible();
    await expect(page.getByRole('note')).toHaveText('Dados de demonstração');
    await expect(page.getByLabel('Categoria nesta página')).toHaveCount(0);
    await expect(page.getByRole('img',{name:`Imagem de ${product.name} não disponível`})).toBeVisible();
    await expect(page.getByText('R$ 149,90',{exact:true}).first()).toBeVisible();
    await expect(page.getByText('Oferta de Distribuidora oficial',{exact:true})).toBeVisible();
    await add(page);await reserve(page);
    await expect(page.getByRole('note')).toHaveText('Dados de demonstração');
    await expect(page.getByText('por unidade comercial da oferta',{exact:true})).toBeVisible();
    await expect(page.getByText('Total oficial:',{exact:true}).locator('..')).toContainText('R$ 299,80');
    await expect(page.getByText('Os preços abaixo são por unidade comercial, conforme cada oferta confirmada.',{exact:true})).toBeVisible();
    expect(state.payments).toHaveLength(0);
    expect(state.created[0].body).toEqual({items:[{offer_id:offer.id,quantity:2}],capacity_slot_id:'slot',accepts_partial:false});
    await page.getByRole('button',{name:'Confirmar pagamento'}).click();
    await expect(page).toHaveURL(/comprador\/compras\/purchase$/);
    await expect(page.getByRole('note')).toHaveText('Dados de demonstração');
    await expect(page.getByText('Aguardando', {exact:false}).first()).toBeVisible();
    expect(state.payments).toHaveLength(1);
    expect(state.payments[0].body).toEqual({expected_version:1});
    await expect(page.getByRole('heading',{name:'Compra #PURCHASE',exact:true})).toBeVisible();
    await expect(page.getByText('Pedido #SUPPLIER', {exact:true})).toBeVisible();
    await expect(page.getByText('purchase', {exact:true})).toHaveCount(0);
    await expect(page.getByText('supplier-order', {exact:true})).toHaveCount(0);
    await page.goto('/comprador/compras');
    await expect(page.getByRole('note')).toHaveText('Dados de demonstração');
    await expect(page.getByRole('link',{name:/Ver detalhes/}).first()).toBeVisible();
    expect(state.unknown).toEqual([]);
});
test('catálogo considera a menor oferta ativa com estoque para o mínimo e informa a unidade',async({page})=>{
    const state=await setup(page);
    state.offers=[
        offer,
        {...offer,id:'offer-cheaper',supplier_name:'Distribuidora Econômica',unit_price:'4.00'},
        {...offer,id:'offer-inactive',supplier_name:'Oferta inativa',unit_price:'1.00',is_active:false},
        {...offer,id:'offer-unavailable',supplier_name:'Oferta sem estoque mínimo',unit_price:'0.50',available_quantity:1},
    ];
    await page.goto('/');
    await expect(page.getByText('R$ 4,00',{exact:true})).toBeVisible();
    await expect(page.getByText('Oferta de Distribuidora Econômica',{exact:true})).toBeVisible();
    await expect(page.getByText('por fardo',{exact:true})).toBeVisible();
    await page.goto(`/produto/${product.id}`);
    await expect(page.getByText('R$ 149,90',{exact:false})).toBeVisible();
    await expect(page.getByText('R$ 4,00',{exact:false})).toBeVisible();
    await expect(page.getByText('R$ 1,00',{exact:true})).toHaveCount(0);
    await expect(page.getByText('por unidade comercial (fardo)',{exact:false}).first()).toBeVisible();
    expect(state.created).toHaveLength(0);
});
test('criação incerta não é repetida automaticamente e recupera a mesma chave após recarga',async({page})=>{
    const state=await setup(page);state.createFail=1;
    await add(page);await reserve(page);
    await expect(page.getByRole('button',{name:'Recuperar criação com a mesma chave'})).toBeEnabled();
    expect(state.created).toHaveLength(1);
    await page.reload();
    await page.getByRole('button',{name:'Recuperar criação com a mesma chave'}).click();
    await expect(page.getByText('Total oficial:')).toBeVisible();
    expect(state.created).toHaveLength(2);
    expect(state.created[1]).toEqual(state.created[0]);
    expect(state.payments).toHaveLength(0);
});
test('pagamento incerto exige consulta e ação explícita, preservando idempotência',async({page})=>{
    const state=await setup(page);state.payFail=1;
    await add(page);await reserve(page);
    await page.getByRole('button',{name:'Confirmar pagamento'}).click();
    await expect(page.getByRole('alert').filter({hasText:'Resultado ainda'})).toBeVisible();
    await expect(page.getByRole('button',{name:'Consultar resultado'})).toBeEnabled();
    expect(state.payments).toHaveLength(1);
    await page.getByRole('button',{name:'Consultar resultado'}).click();
    await page.getByRole('button',{name:'Confirmar pagamento'}).click();
    await expect(page).toHaveURL(/compras\/purchase$/);
    expect(state.payments[1]).toEqual(state.payments[0]);
});
test('pagamento processado com resposta perdida é encontrado sem novo pagamento',async({page})=>{
    const state=await setup(page);state.payFail=1;
    await add(page);await reserve(page);
    await page.getByRole('button',{name:'Confirmar pagamento'}).click();
    await expect(page.getByRole('alert').filter({hasText:'Resultado ainda'})).toBeVisible();await expect(page.getByRole('button',{name:'Consultar resultado'})).toBeEnabled();state.confirmed=true;
    await page.getByRole('button',{name:'Consultar resultado'}).click();
    await expect(page).toHaveURL(/compras\/purchase$/);expect(state.payments).toHaveLength(1);
});
test('expiração confirmada permite revisão sem afirmar cancelamento local',async({page})=>{
    const state=await setup(page);
    await add(page);await reserve(page);state.expired=true;
    await page.getByRole('button',{name:'Consultar resultado'}).click();
    await expect(page.getByRole('button',{name:'Confirmar pagamento'})).toHaveCount(0);
    await expect(page.getByText('Prazo da reserva encerrado.')).toBeVisible();
    await page.getByRole('button',{name:'Revisar carrinho após expiração confirmada'}).click();
    await expect(page.getByRole('button',{name:'Reservar período e revisar compra'})).toBeVisible();
    expect(state.payments).toHaveLength(0);
});
test('mudança de versão exige nova revisão antes de pagar',async({page})=>{
    const state=await setup(page);await add(page);await reserve(page);await expect(page.getByText('Total oficial:')).toBeVisible();state.checkoutVersion=2;
    await page.getByRole('button',{name:'Confirmar pagamento'}).click();
    await expect(page.getByRole('alert')).toContainText('versão mudaram');expect(state.payments).toHaveLength(0);
    await page.getByRole('button',{name:'Confirmar pagamento'}).click();
    await expect(page).toHaveURL(/compras\/purchase$/);expect(state.payments[0].body).toEqual({expected_version:2});
});
test('comprador não acessa fornecedor; capacidade ausente bloqueia checkout',async({page})=>{
    const state=await setup(page);state.capabilities=['catalog:read','purchase:read'];
    await page.goto('/fornecedor/pedidos');await expect(page).toHaveURL(/\/$/);
    await page.goto('/comprador/carrinho');await expect(page.getByRole('alert')).toContainText('Acesso não autorizado');expect(state.created).toHaveLength(0);
});
test('comprador com purchase:read entra no histórico sem obter permissões de catálogo ou checkout',async({page})=>{
    const state=await setup(page,false);state.capabilities=['purchase:read'];
    await page.goto('/login');
    await page.getByLabel('E-mail',{exact:true}).fill('buyer@example.invalid');
    await page.getByLabel('Senha',{exact:true}).fill('synthetic-only-password');
    await page.getByRole('button',{name:'Entrar',exact:true}).click();
    await expect(page).toHaveURL(/\/comprador\/compras$/);
    await expect(page.getByRole('heading',{name:'Minhas compras',exact:true})).toBeVisible();
    await expect(page.getByRole('link',{name:/Carrinho de compras/})).toHaveCount(0);
    await page.goto('/');await expect(page).toHaveURL(/\/comprador\/compras$/);
    await page.goto(`/produto/${product.id}`);await expect(page.getByRole('alert')).toContainText('Acesso não autorizado');
    await page.goto('/comprador/carrinho');await expect(page.getByRole('alert')).toContainText('Acesso não autorizado');
    expect(state.created).toHaveLength(0);expect(state.payments).toHaveLength(0);
});
test('compra de outra organização e 404 não exibem seus itens',async({page})=>{
    const state=await setup(page);state.foreign=true;
    await page.goto('/comprador/compras/purchase');await expect(page.getByRole('alert')).toContainText('Sem permissão para esta operação.');
    await expect(page.getByText('Total oficial:')).toHaveCount(0);
    state.foreign=false;state.purchaseStatus=404;
    await page.getByRole('button',{name:'Tentar novamente'}).click();await expect(page.getByRole('alert')).toContainText('não encontrado');
});
test('nova organização não herda carrinho nem reserva anterior',async({page})=>{
    const state=await setup(page);await add(page);state.org='another-buyer-org';
    await page.reload();await expect(page.getByText('Seu carrinho está vazio.')).toBeVisible();expect(state.created).toHaveLength(0);
});
test('limites de quantidade e confirmação para substituir origem',async({page})=>{
    const state=await setup(page);state.offers=[offer,{...offer,id:'other',supplier_organization_id:'other',supplier_name:'Outro fornecedor'}];
    await page.goto(`/produto/${product.id}`);
    await page.getByRole('button',{name:'Adicionar ao carrinho',exact:true}).first().click();
    await page.getByRole('button',{name:'Adicionar ao carrinho',exact:true}).last().click();
    await expect(page.getByText('Esta oferta é de outro fornecedor ou depósito.')).toBeVisible();
    await page.getByRole('button',{name:'Manter itens',exact:true}).click();
    await page.goto('/comprador/carrinho');
    await page.getByLabel('Quantidade de Arroz oficial',{exact:true}).fill('1');
    await expect(page.getByRole('alert')).toContainText('quantidade mínima');expect(state.created).toHaveLength(0);
});
test('mobile: catálogo, detalhes e carrinho sem transbordamento horizontal',async({page})=>{
    await setup(page);await page.setViewportSize({width:390,height:844});
    for(const path of ['/',`/produto/${product.id}`]){
        await page.goto(path);await expect(page.getByRole('heading',{name:product.name,exact:true})).toBeVisible();
        expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
    }
    await page.getByRole('button',{name:'Adicionar ao carrinho',exact:true}).click();await page.goto('/comprador/carrinho');
    await expect(page.getByRole('heading',{name:'Meu carrinho',exact:true})).toBeVisible();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
});
test('catálogo vazio, falha de comunicação e histórico vazio não usam mocks',async({page})=>{
    const state=await setup(page);state.products=[];
    await page.goto('/');await expect(page.getByRole('heading',{name:'Nenhum produto publicado encontrado'})).toBeVisible();
    state.emptyPurchases=true;await page.goto('/comprador/compras');await expect(page.getByText('Nenhuma compra encontrada para sua organização.')).toBeVisible();
    state.network=true;await page.reload();await expect(page.getByRole('alert')).toContainText('conectar');
    state.network=false;await page.getByRole('button',{name:'Tentar novamente'}).click();await expect(page.getByText('Nenhuma compra encontrada para sua organização.')).toBeVisible();
    expect(state.created).toHaveLength(0);
});
test('rejeição definitiva de estoque permite corrigir sem manter reserva fictícia',async({page})=>{
    const state=await setup(page);state.createStatus=409;
    await add(page);await reserve(page);
    await expect(page.getByRole('alert')).toContainText('Estoque insuficiente');
    await expect(page.getByRole('button',{name:'Reservar período e revisar compra'})).toBeVisible();
    expect(state.created).toHaveLength(1);expect(state.payments).toHaveLength(0);
});
test('401 no pagamento encerra sessão e não reenvia a operação',async({page})=>{
    const state=await setup(page);await add(page);await reserve(page);state.payStatus=401;
    await page.getByRole('button',{name:'Confirmar pagamento'}).click();
    await expect(page).toHaveURL(/\/login$/);expect(state.payments).toHaveLength(1);
});
test('visitante é encaminhado ao login sem produtos fictícios',async({page})=>{
    const state=await setup(page,false);await page.goto('/');
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByText('Bem-vindo de volta',{exact:true})).toBeVisible();
    await expect(page.getByRole('heading',{name:product.name,exact:true})).toHaveCount(0);expect(state.created).toHaveLength(0);
});
for(const width of [1440,390])test(`revisão visual do comprador em ${width}px`,async({page},testInfo)=>{
    await setup(page);await page.setViewportSize({width,height:900});
    await page.goto('/');await expect(page.getByRole('heading',{name:product.name,exact:true})).toBeVisible();
    await page.screenshot({path:testInfo.outputPath(`buyer-catalog-${width}.png`),fullPage:true});
    await add(page);await reserve(page);await expect(page.getByText('Total oficial:')).toBeVisible();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
    await page.screenshot({path:testInfo.outputPath(`buyer-checkout-${width}.png`),fullPage:true});
    await page.getByRole('button',{name:'Confirmar pagamento'}).click();await expect(page).toHaveURL(/compras\/purchase$/);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
    await page.screenshot({path:testInfo.outputPath(`buyer-purchase-${width}.png`),fullPage:true});
});
test('compra confirmada pode ser correlacionada ao pedido no portal do fornecedor',async({page})=>{
    const state=await setup(page);await add(page);await reserve(page);
    await page.getByRole('button',{name:'Confirmar pagamento'}).click();await expect(page).toHaveURL(/compras\/purchase$/);
    await page.getByRole('button',{name:'Sair',exact:true}).click();await expect(page).toHaveURL(/\/login$/);
    state.role='SUPPLIER_OPERATOR';state.org='supplier-org';state.capabilities=['catalog:read','offer:write','inventory:write','supplier_order:manage'];
    await page.getByLabel('E-mail',{exact:true}).fill('supplier@example.invalid');await page.getByLabel('Senha',{exact:true}).fill('synthetic-only-password');
    await page.getByRole('button',{name:'Entrar',exact:true}).click();await expect(page).toHaveURL(/\/fornecedor$/);
    await page.goto('/fornecedor/pedidos');await expect(page.getByText(product.name,{exact:false}).first()).toBeVisible();
    await expect(page.getByRole('region',{name:'Rolagem do quadro de pedidos'})).toContainText('299,80');
    expect(state.payments).toHaveLength(1);expect(state.unknown).toEqual([]);
});
test('logout durante revalidação não cria reserva com sessão anterior',async({page})=>{
    const state=await setup(page);await add(page);state.delayOffers=700;
    const response=page.waitForResponse(response=>new URL(response.url()).pathname==='/api/v1/offers');
    await reserve(page);await page.getByRole('button',{name:'Sair',exact:true}).click();await expect(page).toHaveURL(/\/login$/);
    await response;expect(state.created).toHaveLength(0);expect(state.payments).toHaveLength(0);
});
test('rejeição definitiva durante recuperação libera somente o formulário local',async({page})=>{
    const state=await setup(page);state.createFail=1;
    await add(page);await reserve(page);await expect(page.getByRole('button',{name:'Recuperar criação com a mesma chave'})).toBeEnabled();
    state.createStatus=409;await page.getByRole('button',{name:'Recuperar criação com a mesma chave'}).click();
    await expect(page.getByRole('alert')).toContainText('Estoque insuficiente');
    await expect(page.getByRole('button',{name:'Reservar período e revisar compra'})).toBeVisible();
    expect(state.created[1]).toEqual(state.created[0]);expect(state.payments).toHaveLength(0);
});
test('histórico rejeita resposta com pedidos de outra organização',async({page})=>{
    const state=await setup(page);state.foreign=true;
    await page.goto('/comprador/compras');await expect(page.getByRole('alert')).toContainText('Sem permissão para esta operação.');
    await expect(page.getByRole('link',{name:/Ver detalhes/})).toHaveCount(0);
});
for(const width of [1440,390])test(`compras refinadas: rótulos, quantidades e logística honesta em ${width}px`,async({page},testInfo)=>{
    const state=await setup(page);await page.setViewportSize({width,height:900});await page.goto('/comprador/compras');
    await expect(page.getByText('Estado comercial da compra',{exact:true})).toBeVisible();
    await expect(page.getByText('Em andamento',{exact:true})).toHaveClass(/bg-blue-50/);
    await expect(page.getByText('Estado oficial: ACTIVE',{exact:true})).not.toBeVisible();
    await expect(page.getByText('Aguardando aceite',{exact:true})).toHaveClass(/bg-amber-50/);
    await expect(page.getByText('Situação operacional',{exact:true})).toBeVisible();
    await page.screenshot({path:testInfo.outputPath(`purchase-history-${width}.png`),fullPage:true});
    await page.getByRole('link',{name:/Ver detalhes/}).click();
    await expect(page.getByRole('link',{name:'Voltar às compras'})).toBeVisible();
    await expect(page.getByRole('region',{name:'Situação comercial da compra'})).toContainText('Em andamento');
    await expect(page.getByRole('region',{name:'Progresso da preparação'})).toContainText('Aguardando fornecedor');
    await expect(page.getByText('Total oficial do pedido')).toBeVisible();
    await page.getByText('Detalhes do pedido e quantidades').click();
    for(const label of ['Produtos e quantidades','Lotes de atendimento'])await expect(page.getByRole('region',{name:label,exact:true})).toBeVisible();
    await expect(page.getByText('não confirma coleta, transporte ou entrega')).toBeVisible();
    await expect(page.getByRole('link',{name:/GPS|comprovante|rastrear/i})).toHaveCount(0);
    await expect(page.getByRole('button',{name:/receber|confirmar entrega/i})).toHaveCount(0);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
    await page.screenshot({path:testInfo.outputPath(`purchase-details-${width}.png`),fullPage:true});
    const accessibility=await new AxeBuilder({page}).analyze();expect(accessibility.violations).toEqual([]);
    expect(state.created).toHaveLength(0);expect(state.payments).toHaveLength(0);expect(state.unknown).toEqual([]);
});
test('badges operacionais usam cores acessíveis sem substituir o estado comercial',async({page})=>{
    const state=await setup(page);
    state.orderStates=['AWAITING_SUPPLIER_DECISION','SEPARATING','READY_TO_DISPATCH','REFUSED','CANCELLED'];
    await page.goto('/comprador/compras');
    await expect(page.getByText('Em andamento',{exact:true})).toHaveClass(/bg-blue-50/);
    for(const [label,color] of [['Aguardando aceite','bg-amber-50'],['Em separação','bg-blue-50'],['Pronto para coleta','bg-emerald-50'],['Recusado','bg-red-50'],['Cancelado','bg-red-50']]) {
        await expect(page.getByText(label,{exact:true})).toHaveClass(new RegExp(color));
    }
    expect(state.created).toHaveLength(0);expect(state.payments).toHaveLength(0);
});

test('detalhes da compra atualizam badge e progresso a cada dez segundos sem recarregar',async({page})=>{
    await page.clock.install();
    const state=await setup(page);
    let pageLoads=0;page.on('load',()=>pageLoads++);
    await page.goto('/comprador/compras/purchase');
    await expect(page.getByRole('progressbar',{name:'Etapas confirmadas da preparação'})).toHaveAttribute('aria-valuenow','0');
    await expect.poll(()=>state.purchaseGets).toBe(1);
    expect(state.purchaseGets).toBe(1);
    state.orderStates=['SEPARATING'];
    const update=page.waitForResponse(response=>new URL(response.url()).pathname==='/api/v1/purchases/purchase');
    await page.clock.fastForward(10_000);
    await update;
    await expect(page.getByText('Em separação',{exact:true})).toBeVisible();
    await expect(page.getByRole('progressbar',{name:'Etapas confirmadas da preparação'})).toHaveAttribute('aria-valuenow','2');
    await expect(page.getByText('Atualização automática a cada 10 segundos.',{exact:true})).toBeVisible();
    expect(pageLoads).toBe(1);
    expect(state.purchaseGets).toBe(2);
    expect(state.created).toHaveLength(0);expect(state.payments).toHaveLength(0);
});

test('falha temporária mantém a última situação e a próxima consulta atualiza',async({page})=>{
    await page.clock.install();
    const state=await setup(page);
    await page.goto('/comprador/compras/purchase');
    await expect(page.getByRole('progressbar',{name:'Etapas confirmadas da preparação'}).getByText('Aguardando fornecedor',{exact:true})).toBeVisible();
    await expect.poll(()=>state.purchaseGets).toBe(1);
    state.purchaseFailNext=true;
    const failedUpdate=page.waitForResponse(response=>new URL(response.url()).pathname==='/api/v1/purchases/purchase'&&response.status()===503);
    await page.clock.fastForward(10_000);
    await failedUpdate;
    await expect(page.getByRole('progressbar',{name:'Etapas confirmadas da preparação'}).getByText('Aguardando fornecedor',{exact:true})).toBeVisible();
    await expect(page.getByText('Não foi possível atualizar. Exibindo a última situação recebida.',{exact:true})).toBeVisible();
    state.orderStates=['READY_TO_DISPATCH'];
    const recovered=page.waitForResponse(response=>new URL(response.url()).pathname==='/api/v1/purchases/purchase'&&response.status()===200);
    await page.clock.fastForward(10_000);
    await recovered;
    await expect(page.getByText('Pronto para coleta',{exact:true})).toBeVisible();
    await expect(page.getByText('Não foi possível atualizar. Exibindo a última situação recebida.',{exact:true})).toHaveCount(0);
});

test('suspende polling em aba oculta e consulta imediatamente ao retornar',async({page})=>{
    await page.clock.install();
    const state=await setup(page);
    await page.goto('/comprador/compras/purchase');
    await expect(page.getByRole('progressbar',{name:'Etapas confirmadas da preparação'})).toBeVisible();
    await expect.poll(()=>state.purchaseGets).toBe(1);
    await page.evaluate(()=>{
        let visibility:'visible'|'hidden'='visible';
        Object.defineProperty(document,'visibilityState',{configurable:true,get:()=>visibility});
        Object.defineProperty(window,'setTestVisibility',{configurable:true,value:(value:'visible'|'hidden')=>{visibility=value;document.dispatchEvent(new Event('visibilitychange'));}});
    });
    await page.evaluate(()=>window.setTestVisibility('hidden'));
    await page.clock.fastForward(20_000);
    expect(state.purchaseGets).toBe(1);
    state.orderStates=['ACCEPTED'];
    const resumed=page.waitForResponse(response=>new URL(response.url()).pathname==='/api/v1/purchases/purchase');
    await page.evaluate(()=>window.setTestVisibility('visible'));
    await resumed;
    await expect(page.getByRole('progressbar',{name:'Etapas confirmadas da preparação'}).getByText('Pedido analisado',{exact:true})).toBeVisible();
    expect(state.purchaseGets).toBe(2);
});

test('não sobrepõe consultas, encerra polling ao sair e pausa automaticamente em compra cancelada',async({page})=>{
    await page.clock.install();
    const state=await setup(page);
    await page.goto('/comprador/compras/purchase');
    await expect(page.getByRole('progressbar',{name:'Etapas confirmadas da preparação'})).toBeVisible();
    await expect.poll(()=>state.purchaseGets).toBe(1);
    state.purchaseDelay=2_000;
    const first=page.waitForResponse(response=>new URL(response.url()).pathname==='/api/v1/purchases/purchase');
    await page.clock.fastForward(10_000);
    await first;
    await expect.poll(()=>state.maxPurchaseInFlight).toBe(1);
    await page.getByRole('link',{name:'Voltar às compras'}).click();
    await expect(page).toHaveURL(/\/comprador\/compras$/);
    await expect(page.getByRole('heading',{name:'Minhas compras',exact:true})).toBeVisible();
    await expect.poll(()=>state.purchaseInFlight).toBe(0);
    const callsAfterExit=state.purchaseGets;
    await page.clock.fastForward(20_000);
    expect(state.purchaseGets).toBe(callsAfterExit);

    state.purchaseDelay=0;state.purchaseState='CANCELLED';
    await page.goto('/comprador/compras/purchase');
    await expect(page.getByText('Compra cancelada; atualização automática pausada.',{exact:true})).toBeVisible();
    const terminalCalls=state.purchaseGets;
    await page.clock.fastForward(20_000);
    expect(state.purchaseGets).toBe(terminalCalls);
});

test('sessão expirada durante a atualização automática segue o redirecionamento de autenticação',async({page})=>{
    await page.clock.install();
    const state=await setup(page);
    await page.goto('/comprador/compras/purchase');
    await expect(page.getByRole('progressbar',{name:'Etapas confirmadas da preparação'})).toBeVisible();
    state.purchaseStatus=401;
    await page.clock.fastForward(10_000);
    await expect(page).toHaveURL(/\/login$/);
    expect(state.created).toHaveLength(0);expect(state.payments).toHaveLength(0);
});

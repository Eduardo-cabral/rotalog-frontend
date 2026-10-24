import {test,expect,type Page} from '@playwright/test';
const org='11111111-1111-4111-8111-111111111111';
const warehouse={id:'warehouse',supplier_organization_id:org,name:'Depósito Central',address:'Rua Central, 100',region:'Manaus',opening_hours:'08h às 18h',geocoding_state:'CONFIRMED',is_active:true,version:1,demo_run_id:'demo',is_synthetic:true,latitude:null,longitude:null};
function balance(index=0) {
    return {id:`balance-${index}`,offer_id:`offer-${index}`,warehouse_id:index===25?'warehouse-2':'warehouse',external_physical_quantity:index===0?null:30,external_sellable_quantity:index===1?3:20,rotalog_reserved_not_reflected_quantity:3,safety_stock_quantity:index===1?0:2,effective_sellable_quantity:index===1?0:15,version:4,source:'MANUAL',external_version:null,freshness_state:'FRESH',source_observed_at:'2026-10-22T12:00:00Z',received_at:'2026-10-22T12:00:00Z',last_reconciled_at:null,demo_run_id:'demo',is_synthetic:true};
}
async function setup(page:Page) {
    const state={items:Array.from({length:27},(_,i)=>balance(i)),posts:[] as Record<string,unknown>[],queries:[] as string[],network:false,status:0,conflict:false,uncertain:false,foreign:false,malformed:false};
    await page.addInitScript(()=>{
        sessionStorage.setItem('rotalog:api-csrf','csrf');
        localStorage.setItem('rotalog:supplier-products:v1:11111111-1111-4111-8111-111111111111',JSON.stringify([{id:'LOCAL',name:'Produto local proibido'}]));
    });
    await page.route('http://localhost:8000/api/v1/**',async route=>{
        const request=route.request(),url=new URL(request.url()),path=url.pathname;
        const user={id:'user',name:'Fornecedor',email:'supplier@example.invalid',role:'SUPPLIER_OPERATOR',organization_id:org,organizations:[{id:org,name:'Fornecedor',role:'SUPPLIER_OPERATOR'}],capabilities:['catalog:read','offer:write','inventory:write','supplier_order:manage'],demo_run_id:'demo',is_synthetic:true};
        if(path.endsWith('/auth/refresh'))return route.fulfill({json:{access_token:'access',token_type:'bearer',expires_in:600,csrf_token:'csrf',refresh_token:null,user}});
        if(path.endsWith('/me'))return route.fulfill({json:user});
        expect(request.headers()['authorization']).toBe('Bearer access');expect(request.headers()['x-organization-id']).toBe(org);
        if(path==='/api/v1/supplier-orders')return route.fulfill({json:{items:[],total:0,page:1,page_size:100}});
        if(path==='/api/v1/products') {
            const products=Array.from({length:28},(_,i)=>({id:`product-${i}`,name:i===0?'Arroz oficial':i===27?'Produto sem oferta':`Produto ${i+1}`,brand:'Marca oficial',category:'ALIMENTO_SECO_INDUSTRIALIZADO',gtin:null,net_content:1000,net_content_unit:'g',packaging_type:'Pacote',packaging_quantity:1,gross_weight_grams:1050,volume_cm3:1500,variant_attributes:{},publication_state:'PUBLISHED',version:1,demo_run_id:'demo',is_synthetic:true}));
            const filtered=products.filter(item=>item.name.includes(url.searchParams.get('search')??''));
            const number=Number(url.searchParams.get('page'));
            return route.fulfill({json:{items:filtered.slice((number-1)*25,number*25),total:filtered.length,page:number,page_size:25,is_synthetic:true}});
        }
        if(path==='/api/v1/warehouses')return route.fulfill({json:{items:[{...warehouse,supplier_organization_id:state.foreign?'other':org},{...warehouse,id:'warehouse-2',name:'Depósito Norte'}],total:2,page:1,page_size:100}});
        if(path==='/api/v1/offers') {
            expect(url.searchParams.get('supplier_id')).toBe(org);
            const offers=Array.from({length:27},(_,i)=>({id:`offer-${i}`,product_id:`product-${i}`,product_name:i===0?'Arroz oficial':`Produto ${i+1}`,supplier_organization_id:org,supplier_name:'Fornecedor',warehouse_id:i===25?'warehouse-2':'warehouse',region:'Manaus',unit_price:'10.00',currency:'BRL',minimum_order_quantity:1,available_quantity:15,version:1,is_active:true,demo_run_id:'demo',is_synthetic:true})).filter((_,i)=>i!==1);
            const number=Number(url.searchParams.get('page'));
            return route.fulfill({json:{items:offers.slice((number-1)*25,number*25),total:offers.length,page:number,page_size:25}});
        }
        if(path==='/api/v1/inventory/manual-adjustments') {
            const body=request.postDataJSON();state.posts.push(body);
            if(state.conflict)return route.fulfill({status:409,json:{error:{code:'VERSION_CONFLICT',request_id:'inventory-request-123',details:{},message:'internal message'}}});
            const item=state.items.find(row=>row.offer_id===body.offer_id&&row.warehouse_id===body.warehouse_id)!;
            expect(body.expected_version).toBe(item.version);
            expect(body.external_sellable_quantity).toBeGreaterThanOrEqual(item.rotalog_reserved_not_reflected_quantity+body.safety_stock_quantity);
            Object.assign(item,{external_sellable_quantity:body.external_sellable_quantity,safety_stock_quantity:body.safety_stock_quantity,effective_sellable_quantity:body.external_sellable_quantity-item.rotalog_reserved_not_reflected_quantity-body.safety_stock_quantity,version:item.version+1});
            if(state.uncertain)return route.abort('failed');
            return route.fulfill({json:item});
        }
        if(path==='/api/v1/inventory') {
            expect(request.method()).toBe('GET');state.queries.push(url.search);
            if(state.network)return route.abort('failed');
            if(state.status)return route.fulfill({status:state.status,json:{error:{code:'TEST_ERROR',request_id:'request-123'}}});
            const filtered=state.items.filter(item=>(!url.searchParams.get('warehouse_id')||item.warehouse_id===url.searchParams.get('warehouse_id'))&&(!url.searchParams.get('offer_id')||item.offer_id===url.searchParams.get('offer_id')));
            const number=Number(url.searchParams.get('page'));
            return route.fulfill({json:{items:state.malformed?[{...balance(),effective_sellable_quantity:'invalid'}]:filtered.slice((number-1)*25,number*25),total:filtered.length,page:number,page_size:25,is_synthetic:true}});
        }
        throw new Error(`Unexpected endpoint: ${path}`);
    });
    return state;
}
const stockRow=(page:Page)=>page.getByRole('row').filter({has:page.getByRole('cell',{name:'Arroz oficial',exact:false})});
async function openAdjustment(page:Page) {
    await stockRow(page).getByRole('button',{name:'Ajustar vendável',exact:true}).click();
    return page.getByRole('dialog');
}
async function reviewAdjustment(page:Page) {
    const dialog=await openAdjustment(page);
    await dialog.getByLabel('Novo estoque vendável',{exact:true}).fill('25');
    await dialog.getByLabel('Novo estoque de segurança',{exact:true}).fill('4');
    await dialog.getByLabel('Justificativa',{exact:false}).fill('Conferência de saldo');
    await dialog.getByRole('button',{name:'Revisar ajuste',exact:true}).click();
    return dialog;
}
test('saldos oficiais, físico nulo, reservado, zero e vínculos não resolvidos',async({page},testInfo)=>{
    const state=await setup(page);await page.goto('/fornecedor/estoque');
    const row=stockRow(page);
    await expect(row.getByRole('cell',{name:'15 Disponível efetivo',exact:true})).toBeVisible();
    await expect(row.getByText('20',{exact:true})).not.toBeVisible();
    await expect(page.getByRole('columnheader')).toHaveCount(6);
    await page.screenshot({path:testInfo.outputPath('estoque-simplificado.png'),fullPage:true});
    await row.getByText('Detalhes do estoque',{exact:true}).click();await expect(row.getByText('Não informado',{exact:true})).toBeVisible();
    await expect(row.getByText('offer-0',{exact:true})).toHaveCount(0);
    await expect(row.getByText('warehouse',{exact:true})).toHaveCount(0);
    await expect(row.getByText(/versão/i)).toHaveCount(0);
    await expect(row.getByText('20',{exact:true})).toBeVisible();
    await expect(row.getByRole('cell',{name:'3',exact:true})).toBeVisible();
    await expect(row.getByText('Com disponibilidade',{exact:true})).toBeVisible();
    await expect(page.getByText('Sem disponibilidade',{exact:true})).toBeVisible();
    await expect(page.getByRole('cell',{name:/Produto não disponível na consulta de ofertas ativas/})).toBeVisible();
    await expect(page.getByLabel('Histórico de movimentações',{exact:true})).toContainText('O histórico de ajustes ainda não está disponível.');
    await expect(page.getByText('Produto local proibido')).toHaveCount(0);expect(state.posts).toHaveLength(0);
});
test('paginação e filtros por depósito e oferta usam valores oficiais',async({page})=>{
    const state=await setup(page);await page.goto('/fornecedor/estoque');
    await page.getByRole('button',{name:'Próxima',exact:true}).click();
    await expect(page.getByText('Página 2 de 2 · 27 registros')).toBeVisible();
    await page.getByLabel('Filtrar por depósito',{exact:true}).selectOption('warehouse-2');
    await expect(page.getByText('Página 1 de 1 · 1 registros')).toBeVisible();
    await page.getByLabel('Filtrar por oferta',{exact:true}).selectOption('offer-25');
    await expect(page.getByRole('cell',{name:'Produto 26',exact:false})).toBeVisible();
    expect(state.queries.some(query=>query.includes('warehouse_id=warehouse-2')&&query.includes('offer_id=offer-25'))).toBe(true);
    await page.getByRole('button',{name:'Limpar filtros',exact:true}).click();
    await expect(stockRow(page)).toBeVisible();
});
test('catálogo sem oferta não gera saldo e navegação mantém criação real disponível',async({page})=>{
    const state=await setup(page);state.items=[balance(),balance(1)];
    await page.goto('/fornecedor/estoque');
    await page.getByText('Como interpretar os saldos',{exact:true}).click();
    await expect(page.getByLabel('Catálogo, ofertas e saldos',{exact:true})).toContainText('Produtos sem oferta não aparecem nesta lista.');
    await expect(page.getByText('Página 1 de 1 · 2 registros')).toBeVisible();
    await page.getByRole('link',{name:'Criar oferta para outro produto',exact:true}).click();
    await expect(page).toHaveURL(/\/fornecedor\/produtos#minhas-ofertas$/);
    const offers=page.getByRole('region',{name:'Minhas ofertas',exact:true});
    await expect(offers.getByRole('button',{name:'Criar oferta para produto existente',exact:true})).toBeEnabled();
    await page.getByRole('tab',{name:'Catálogo',exact:true}).click();
    await page.getByRole('searchbox',{name:'Pesquisar por nome',exact:true}).fill('Produto sem oferta');
    await page.getByRole('button',{name:'Pesquisar',exact:true}).click();
    await expect(page.getByRole('cell',{name:'Produto sem oferta',exact:true})).toBeVisible();
    await page.getByText('Produto não encontrado?',{exact:true}).click();
    await expect(page.getByRole('button',{name:'Solicitar cadastro de produto',exact:true})).toBeDisabled();
    await expect(page.getByLabel('Solicitação de novos produtos',{exact:true})).toContainText('A inclusão de novos produtos por esta área ainda não está disponível.');
    await page.getByRole('link',{name:'Consultar estoque das minhas ofertas',exact:true}).click();
    await expect(page).toHaveURL(/\/fornecedor\/estoque$/);
    await expect(page.getByText('Página 1 de 1 · 2 registros')).toBeVisible();
    await expect(page.getByRole('region',{name:'Saldos oficiais de estoque'}).getByText('Produto sem oferta')).toHaveCount(0);
    expect(state.items).toHaveLength(2);expect(state.posts).toHaveLength(0);
});
test('revisão e ajuste válido preservam reservas e enviam versão',async({page})=>{
    const state=await setup(page);await page.goto('/fornecedor/estoque');const dialog=await reviewAdjustment(page);
    await expect(dialog.getByText('offer-0',{exact:true})).toHaveCount(0);
    await expect(dialog.getByText('warehouse',{exact:true})).toHaveCount(0);
    await expect(dialog.getByText(/versão/i)).toHaveCount(0);
    expect(state.posts).toHaveLength(0);
    await dialog.getByRole('button',{name:'Confirmar ajuste',exact:true}).click();
    await expect(page.getByText('Ajuste de estoque confirmado.',{exact:true})).toBeVisible();
    await stockRow(page).getByText('Detalhes do estoque',{exact:true}).click();
    await expect(stockRow(page).getByText('25',{exact:true})).toBeVisible();
    await expect(stockRow(page).getByRole('cell',{name:'3',exact:true})).toBeVisible();
    expect(state.posts).toEqual([{offer_id:'offer-0',warehouse_id:'warehouse',external_sellable_quantity:25,safety_stock_quantity:4,expected_version:4,reason:'Conferência de saldo'}]);
});
test('ajuste que consome reservas e justificativa insuficiente são bloqueados',async({page})=>{
    const state=await setup(page);await page.goto('/fornecedor/estoque');const dialog=await openAdjustment(page);
    await dialog.getByLabel('Novo estoque vendável',{exact:true}).fill('4');
    await dialog.getByLabel('Justificativa',{exact:false}).fill('Conferência de saldo');
    await dialog.getByRole('button',{name:'Revisar ajuste',exact:true}).click();
    await expect(dialog.getByRole('alert')).toContainText('reservas');
    await dialog.getByLabel('Novo estoque vendável',{exact:true}).fill('20');
    await dialog.getByLabel('Justificativa',{exact:false}).fill('oi');
    await dialog.getByRole('button',{name:'Revisar ajuste',exact:true}).click();
    await expect(dialog.getByRole('alert')).toContainText('justificativa');expect(state.posts).toHaveLength(0);
});
test('conflito preserva diagnóstico seguro e exige consulta antes de novo ajuste',async({page})=>{
    const state=await setup(page);state.conflict=true;await page.goto('/fornecedor/estoque');const dialog=await reviewAdjustment(page);
    await dialog.getByRole('button',{name:'Confirmar ajuste',exact:true}).click();
    await expect(dialog.getByRole('alert')).toContainText('inventory-request-123');
    await expect(dialog.getByRole('alert')).not.toContainText('internal message');
    await expect(dialog.getByRole('button',{name:'Confirmar ajuste',exact:true})).toBeDisabled();
    await dialog.getByRole('button',{name:'Fechar',exact:true}).click();
    await expect(stockRow(page).getByRole('button',{name:'Ajustar vendável',exact:true})).toBeDisabled();
    await page.getByRole('button',{name:'Atualizar estoque',exact:true}).click();
    await expect(stockRow(page).getByRole('button',{name:'Ajustar vendável',exact:true})).toBeEnabled();expect(state.posts).toHaveLength(1);
});
test('resposta perdida não repete ajuste e permite conferir saldo persistido',async({page})=>{
    const state=await setup(page);state.uncertain=true;await page.goto('/fornecedor/estoque');const dialog=await reviewAdjustment(page);
    await dialog.getByRole('button',{name:'Confirmar ajuste',exact:true}).click();
    await expect(dialog.getByRole('alert')).toContainText('conectar');
    await expect(dialog.getByRole('button',{name:'Confirmar ajuste',exact:true})).toBeDisabled();
    await dialog.getByRole('button',{name:'Fechar',exact:true}).click();
    await page.getByRole('button',{name:'Atualizar estoque',exact:true}).click();
    await stockRow(page).getByText('Detalhes do estoque',{exact:true}).click();
    await expect(stockRow(page).getByText('25',{exact:true})).toBeVisible();expect(state.posts).toHaveLength(1);
});
test('vazio, rede e resposta inválida não usam fallback local',async({page})=>{
    const state=await setup(page);state.items=[];await page.goto('/fornecedor/estoque');
    await expect(page.getByText('Nenhum registro de estoque encontrado para esta consulta.')).toBeVisible();
    state.network=true;await page.getByRole('button',{name:'Atualizar estoque',exact:true}).click();
    await expect(page.getByRole('alert')).toContainText('conectar');
    state.network=false;state.malformed=true;state.items=[balance()];
    await page.getByRole('button',{name:'Atualizar estoque',exact:true}).click();
    await expect(page.getByRole('alert')).toContainText('Quantidades inválidas');
    await expect(page.getByText('Produto local proibido')).toHaveCount(0);
});
test('recursos de outra organização são rejeitados',async({page})=>{
    const state=await setup(page);state.foreign=true;await page.goto('/fornecedor/estoque');
    await expect(page.getByRole('alert')).toContainText('outra organização');
    await expect(page.getByRole('button',{name:'Ajustar vendável',exact:true})).toHaveCount(0);
});
test('erros HTTP mantêm mensagens seguras e permitem nova consulta',async({page})=>{
    const state=await setup(page);state.status=403;await page.goto('/fornecedor/estoque');
    await expect(page.getByRole('alert')).toContainText('Sem permissão');
    state.status=404;await page.getByRole('button',{name:'Tentar novamente',exact:true}).click();
    await expect(page.getByRole('alert')).toContainText('não encontrado');
    state.status=422;await page.getByRole('button',{name:'Tentar novamente',exact:true}).click();
    await expect(page.getByRole('alert')).toContainText('inválidas');
    state.status=0;await page.getByRole('button',{name:'Limpar filtros e consultar',exact:true}).click();
    await expect(stockRow(page)).toBeVisible();
});
test('sessão inválida no estoque segue autenticação existente',async({page})=>{
    const state=await setup(page);state.status=401;await page.goto('/fornecedor/estoque');
    await expect(page).toHaveURL(/\/login$/);expect(state.posts).toHaveLength(0);
});
for(const width of [360,768,1440]) {
    test(`estoque e revisão acessíveis em ${width}px`,async({page},testInfo)=>{
        await page.setViewportSize({width,height:900});const state=await setup(page);state.items=[balance()];
        await page.goto('/fornecedor/estoque');
        await expect(stockRow(page)).toBeVisible();
        expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
        const dialog=await reviewAdjustment(page);await expect(dialog).toBeVisible();
        await page.screenshot({path:testInfo.outputPath('estoque-ajuste.png'),fullPage:true});
        expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
        await page.keyboard.press('Escape');await expect(dialog).toHaveCount(0);
        await expect(stockRow(page).getByRole('button',{name:'Ajustar vendável',exact:true})).toBeFocused();
    });
}

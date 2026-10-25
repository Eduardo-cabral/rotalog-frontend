import {test,expect,type Page} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
const org='11111111-1111-4111-8111-111111111111';
const warehouse={id:'warehouse',supplier_organization_id:org,name:'Depósito Central',address:'Rua Central, 100',region:'Manaus',opening_hours:'08h às 18h',geocoding_state:'CONFIRMED',is_active:true,version:1,demo_run_id:'demo',is_synthetic:true,latitude:null,longitude:null};
const product={id:'product',name:'Arroz oficial',brand:'Marca',category:'ALIMENTO_SECO_INDUSTRIALIZADO',gtin:null,net_content:1000,net_content_unit:'g',packaging_type:'Pacote',packaging_quantity:1,gross_weight_grams:1050,volume_cm3:1000,variant_attributes:{},publication_state:'PUBLISHED',version:1,demo_run_id:'demo',is_synthetic:true};
const offer={id:'offer',product_id:product.id,product_name:product.name,supplier_organization_id:org,supplier_name:'Fornecedor',warehouse_id:warehouse.id,region:'Manaus',unit_price:'10.00',currency:'BRL',minimum_order_quantity:1,available_quantity:0,is_active:true,version:1,demo_run_id:'demo',is_synthetic:true};
async function setup(page:Page) {
    const state={warehouses:[{...warehouse},{...warehouse,id:'pending',name:'Origem pendente',geocoding_state:'PENDING'},{...warehouse,id:'inactive',name:'Origem inativa',is_active:false}],offers:[] as typeof offer[],posts:[] as {path:string;body:Record<string,unknown>}[],conflict:false,uncertain:false,network:false,foreign:false};
    await page.addInitScript(()=>sessionStorage.setItem('rotalog:api-csrf','csrf'));
    await page.route('http://localhost:8000/api/v1/**',async route=>{
        const request=route.request(),url=new URL(request.url()),path=url.pathname;
        const user={id:'user',name:'Fornecedor',email:'supplier@example.invalid',role:'SUPPLIER_OPERATOR',organization_id:org,organizations:[{id:org,name:'Fornecedor',role:'SUPPLIER_OPERATOR'}],capabilities:['catalog:read','offer:write','inventory:write','supplier_order:manage'],demo_run_id:'demo',is_synthetic:true};
        if(path.endsWith('/auth/refresh'))return route.fulfill({json:{access_token:'access',token_type:'bearer',expires_in:600,csrf_token:'csrf',refresh_token:null,user}});
        if(path.endsWith('/me'))return route.fulfill({json:user});
        expect(request.headers()['authorization']).toBe('Bearer access');
        expect(request.headers()['x-organization-id']).toBe(org);
        if(path==='/api/v1/supplier-orders')return route.fulfill({json:{items:[],total:0,page:1,page_size:100}});
        if(path==='/api/v1/products')return route.fulfill({json:{items:[product],total:1,page:1,page_size:25,is_synthetic:true}});
        if(path==='/api/v1/products/product')return route.fulfill({json:product});
        if(request.method()==='POST') {
            state.posts.push({path,body:request.postDataJSON()});
            if(path===`/api/v1/suppliers/${org}/warehouses`) {
                if(state.conflict)return route.fulfill({status:422,json:{error:{code:'VALIDATION_ERROR'}}});
                const created={...warehouse,...request.postDataJSON(),id:'created-warehouse',geocoding_state:'PENDING',latitude:null,longitude:null};
                state.warehouses.push(created);
                if(state.uncertain)return route.abort('failed');
                await new Promise(resolve=>setTimeout(resolve,300));
                return route.fulfill({status:201,json:created});
            }
            if(state.conflict)return route.fulfill({status:409,json:{error:{code:'VERSION_CONFLICT'}}});
            if(path===`/api/v1/suppliers/${org}/offers`) {
                const body=request.postDataJSON();state.offers.push({...offer,unit_price:body.unit_price,minimum_order_quantity:body.minimum_order_quantity});
                if(state.uncertain)return route.abort('failed');
                return route.fulfill({status:201,json:state.offers[0]});
            }
            expect(request.postDataJSON().expected_version).toBe(state.offers[0].version);
            if(path.endsWith('/price-changes')) {
                const body=request.postDataJSON();Object.assign(state.offers[0],{unit_price:body.unit_price,minimum_order_quantity:body.minimum_order_quantity,version:state.offers[0].version+1});
                return route.fulfill({json:state.offers[0]});
            }
            if(path.endsWith('/pause')) {const paused={...state.offers[0],is_active:false,version:state.offers[0].version+1};state.offers=[];return route.fulfill({json:paused});}
            throw new Error(`Unexpected mutation: ${path}`);
        }
        if(state.network)return route.abort('failed');
        if(path==='/api/v1/warehouses')return route.fulfill({json:{items:state.warehouses,total:state.warehouses.length,page:1,page_size:100}});
        if(path==='/api/v1/offers') {
            expect(url.searchParams.get('supplier_id')).toBe(org);
            const items=state.foreign?[{...offer,supplier_organization_id:'other'}]:state.offers;
            return route.fulfill({json:{items,total:items.length,page:1,page_size:25}});
        }
        throw new Error(`Unexpected path: ${path}`);
    });
    return state;
}
async function fillWarehouse(page:Page) {
    await page.getByRole('tab',{name:'Meus depósitos',exact:true}).click();
    await page.getByRole('button',{name:'Cadastrar depósito',exact:true}).click();
    const dialog=page.getByRole('dialog');
    await dialog.getByLabel('Nome do depósito',{exact:true}).fill('Depósito Norte');
    await dialog.getByLabel('CEP',{exact:true}).fill('69000-000');
    await dialog.getByLabel('Número',{exact:true}).fill('42');
    await dialog.getByLabel('Rua ou avenida',{exact:true}).fill('Rua Norte');
    await dialog.getByLabel('Bairro',{exact:true}).fill('Centro');
    await dialog.getByLabel('Município',{exact:true}).fill('Manaus');
    await dialog.getByLabel('UF',{exact:true}).fill('AM');
    await dialog.getByLabel('Horário de funcionamento',{exact:true}).fill('08h às 18h');
    await dialog.getByRole('radio',{name:'Zona Norte',exact:true}).check();
    return dialog;
}
test('abas preservam pesquisa, permitem teclado e abrem oferta para produto do catálogo',async({page})=>{
    const state=await setup(page);await page.goto('/fornecedor/produtos');
    await expect(page.getByRole('tab',{name:'Minhas ofertas',exact:true})).toHaveAttribute('aria-selected','true');
    await expect(page.getByRole('region',{name:'Catálogo oficial',exact:true})).not.toBeVisible();
    const catalog=page.getByRole('tab',{name:'Catálogo',exact:true});
    await catalog.click();
    await page.getByRole('searchbox',{name:'Pesquisar por nome',exact:true}).fill('Pesquisa preservada');
    await page.getByRole('tab',{name:'Meus depósitos',exact:true}).click();
    await catalog.click();
    await expect(page.getByRole('searchbox',{name:'Pesquisar por nome',exact:true})).toHaveValue('Pesquisa preservada');
    await catalog.focus();await page.keyboard.press('ArrowRight');
    await expect(page.getByRole('tab',{name:'Meus depósitos',exact:true})).toBeFocused();
    await page.keyboard.press('Home');
    await expect(page.getByRole('tab',{name:'Minhas ofertas',exact:true})).toBeFocused();
    await catalog.click();
    await page.getByRole('button',{name:'Criar oferta para Arroz oficial',exact:true}).click();
    const dialog=page.getByRole('dialog');
    await expect(dialog.getByRole('combobox',{name:'Produto publicado',exact:true})).toHaveValue(product.id);
    await dialog.getByLabel('Preço unitário (R$)',{exact:true}).fill('19,90');
    await page.evaluate(()=>{location.hash='#depositos';});
    await expect(dialog.getByLabel('Preço unitário (R$)',{exact:true})).toHaveValue('19,90');
    await page.keyboard.press('Escape');expect(state.posts).toHaveLength(0);
});
test('estados de carregamento e erro do novo catálogo permanecem explícitos',async({page},testInfo)=>{
    await setup(page);
    let release!: () => void;
    const gate=new Promise<void>(resolve=>{release=resolve;});
    await page.route('http://localhost:8000/api/v1/products?**',async route=>{await gate;await route.fulfill({status:500,json:{error:{code:'SERVER_ERROR'}}});});
    await page.goto('/fornecedor/produtos',{waitUntil:'domcontentloaded'});
    await page.getByRole('tab',{name:'Catálogo',exact:true}).click();
    await expect(page.getByText('Carregando catálogo…',{exact:true})).toBeVisible();
    await page.screenshot({path:testInfo.outputPath('supplier-loading.png'),fullPage:true});
    release();
    const error=page.getByRole('region',{name:'Catálogo oficial',exact:true}).getByRole('alert');
    await expect(error).toBeVisible();
    await expect(error.getByRole('button',{name:'Tentar novamente'})).toBeVisible();
    await page.screenshot({path:testInfo.outputPath('supplier-error.png'),fullPage:true});
});
for (const width of [1440, 390]) {
    test(`novo portal: navegação, conta, acessibilidade e telas em ${width}px`,async({page},testInfo)=>{
        test.setTimeout(120_000);
        const state=await setup(page);state.offers=[{...offer}];
        await page.setViewportSize({width,height:1000});
        for (const [name,path] of [['dashboard','/fornecedor'],['produtos','/fornecedor/produtos'],['pedidos','/fornecedor/pedidos'],['rotas','/fornecedor/rotas'],['conta','/fornecedor/conta']]) {
            await page.goto(path);
            await expect(page.getByRole('main').getByRole('heading',{level:1})).toBeVisible();
            await expect(page.locator('.supplier-topbar .supplier-brand')).toHaveCount(0);
            if(name==='dashboard')await expect(page.getByRole('heading',{name:'Pedidos por situação',exact:true})).toBeVisible();
            if(name==='produtos')await expect(page.getByRole('button',{name:'Criar oferta para produto existente',exact:true})).toBeEnabled();
            if(name==='conta') {
                await expect(page.getByRole('main')).toContainText('supplier@example.invalid');
                await expect(page.getByRole('main')).toContainText('Operador do fornecedor');
                await expect(page.getByRole('main').getByRole('textbox')).toHaveCount(0);
            }
            if(name==='rotas')await expect(page.getByText('A atribuição de motoristas estará disponível em breve.',{exact:true})).toBeVisible();
            expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
            const audit=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
            expect(audit.violations.map(item=>({id:item.id,nodes:item.nodes.map(node=>node.target)}))).toEqual([]);
            await page.screenshot({path:testInfo.outputPath(`supplier-${name}-${width}.png`),fullPage:true});
            if(name==='produtos')for(const label of ['Catálogo','Meus depósitos','Minhas ofertas']) {
                await page.getByRole('tab',{name:label,exact:true}).click();
                expect((await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze()).violations.map(item=>item.id)).toEqual([]);
                await page.screenshot({path:testInfo.outputPath(`products-${label}-${width}.png`),fullPage:true});
            }
        }
        const profile=page.getByLabel('Abrir perfil do usuário',{exact:true});
        await profile.click();
        await expect(page.locator('.supplier-profile-panel').getByRole('link',{name:'Minha conta'})).toBeVisible();
        await page.keyboard.press('Escape');await expect(profile).toBeFocused();
        expect(state.posts).toHaveLength(0);
    });
}
test('cadastro atualiza depósitos e mantém pendentes fora das ofertas',async({page})=>{
    const state=await setup(page);await page.goto('/fornecedor/produtos');
    const dialog=await fillWarehouse(page);
    await expect(dialog).toContainText('confirmação do endereço');
    await dialog.getByRole('button',{name:'Confirmar cadastro',exact:true}).click();
    await expect(dialog.getByRole('button',{name:'Cadastrando depósito…'})).toBeDisabled();
    await expect(page.getByText('Depósito cadastrado. Ele poderá receber ofertas após a confirmação do endereço.',{exact:true})).toBeVisible();
    await expect(page.getByRole('heading',{name:'Depósito Norte'})).toBeVisible();
    expect(state.posts).toHaveLength(1);
    expect(state.posts[0]).toEqual({path:`/api/v1/suppliers/${org}/warehouses`,body:{name:'Depósito Norte',address:'CEP 69000-000, Rua Norte, nº 42, Centro, Manaus/AM',opening_hours:'08h às 18h',region:'Zona Norte'}});
    await page.getByRole('tab',{name:'Minhas ofertas',exact:true}).click();
    await page.getByRole('button',{name:'Criar oferta para produto existente',exact:true}).click();
    await expect(page.getByRole('dialog').getByLabel('Depósito elegível')).not.toContainText('Depósito Norte');
    await expect(page.getByRole('dialog').getByLabel('Depósito elegível').locator('option')).toHaveCount(2);
});
test('cadastro valida campos e permite corrigir erro de validação da API',async({page})=>{
    const state=await setup(page);state.conflict=true;await page.goto('/fornecedor/produtos');
    const dialog=await fillWarehouse(page);
    await dialog.getByLabel('Nome do depósito',{exact:true}).fill('   ');
    await dialog.getByRole('button',{name:'Confirmar cadastro',exact:true}).click();
    await expect(dialog.getByRole('alert')).toContainText('Nome do depósito deve conter');expect(state.posts).toHaveLength(0);
    await dialog.getByLabel('Nome do depósito',{exact:true}).fill('Depósito Norte');
    await dialog.getByRole('button',{name:'Confirmar cadastro',exact:true}).click();
    await expect(dialog.getByRole('alert')).toContainText('Dados inválidos');
    await expect(dialog.getByLabel('Município',{exact:true})).toHaveValue('Manaus');
    state.conflict=false;
    await dialog.getByRole('button',{name:'Confirmar cadastro',exact:true}).click();
    await expect(dialog).not.toBeVisible();expect(state.posts).toHaveLength(2);
});
test('cadastro incerto exige consulta e conferência sem repetir o POST',async({page})=>{
    const state=await setup(page);state.uncertain=true;await page.goto('/fornecedor/produtos');
    const dialog=await fillWarehouse(page);
    await dialog.getByRole('button',{name:'Confirmar cadastro',exact:true}).click();
    await expect(dialog.getByRole('alert')).toContainText('O cadastro pode ter sido concluído');
    await expect(dialog.getByRole('button',{name:'Confirmar cadastro',exact:true})).toBeDisabled();expect(state.posts).toHaveLength(1);
    await dialog.getByRole('button',{name:'Fechar',exact:true}).click();
    const review=page.getByRole('button',{name:'Conferi a lista atualizada e desejo cadastrar outro depósito',exact:true});
    await expect(review).toBeDisabled();
    await expect(page.getByRole('button',{name:'Cadastrar depósito',exact:true})).toBeDisabled();
    await page.getByRole('button',{name:/^Atualizar (ofertas|depósitos)$/}).click();
    await expect(page.getByRole('heading',{name:'Depósito Norte'})).toBeVisible();
    await expect(review).toBeEnabled();expect(state.posts).toHaveLength(1);
    await review.click();await expect(page.getByRole('button',{name:'Cadastrar depósito',exact:true})).toBeEnabled();
});
async function reviewCreate(page:Page) {
    await page.getByRole('tab',{name:'Minhas ofertas',exact:true}).click();
    await page.getByRole('tab',{name:'Minhas ofertas',exact:true}).click();
    await page.getByRole('button',{name:'Criar oferta para produto existente',exact:true}).click();
    const dialog=page.getByRole('dialog');
    await dialog.getByRole('combobox',{name:'Produto publicado',exact:true}).selectOption(product.id);
    await expect(dialog.getByRole('combobox',{name:'Produto publicado',exact:true})).toHaveValue(product.id);
    await expect(dialog.getByRole('combobox',{name:'Depósito elegível',exact:true})).toBeEnabled();
    await dialog.getByRole('combobox',{name:'Depósito elegível',exact:true}).selectOption(warehouse.id);
    await dialog.getByLabel('Preço unitário (R$)',{exact:true}).fill('12,30');
    await dialog.getByLabel('Quantidade mínima de pedido',{exact:true}).fill('3');
    await dialog.getByRole('button',{name:'Revisar oferta',exact:true}).click();
    await expect(dialog.getByRole('region',{name:'Revisão da oferta'})).toContainText('Depósito Central');
    return dialog;
}
test('depósitos elegíveis, criar, alterar e pausar com versão e confirmação',async({page},testInfo)=>{
    const state=await setup(page);await page.goto('/fornecedor/produtos');
    await page.getByRole('tab',{name:'Meus depósitos',exact:true}).click();
    const deposits=page.getByRole('region',{name:'Depósitos próprios',exact:true});
    await expect(deposits.getByText('Aguardando confirmação da localização · Ativo')).toBeVisible();
    const dialog=await reviewCreate(page);
    expect(state.posts).toHaveLength(0);
    await dialog.getByRole('button',{name:'Confirmar criação',exact:true}).click();
    await expect(page.getByText('Oferta criada com sucesso.',{exact:true})).toBeVisible();
    expect(state.posts[0].body).toEqual({product_id:'product',warehouse_id:'warehouse',unit_price:'12.30',currency:'BRL',minimum_order_quantity:3});
    const offers=page.getByRole('region',{name:'Minhas ofertas',exact:true});
    await expect(offers.getByRole('cell',{name:'R$ 12,30',exact:true})).toBeVisible();
    await page.screenshot({path:testInfo.outputPath('ofertas-desktop.png'),fullPage:true});
    await offers.getByRole('button',{name:'Alterar oferta',exact:true}).click();
    await page.getByRole('dialog').getByLabel('Preço unitário (R$)',{exact:true}).fill('15.25');
    await page.getByRole('dialog').getByLabel('Quantidade mínima de pedido',{exact:true}).fill('5');
    await page.getByRole('dialog').getByRole('button',{name:'Revisar oferta',exact:true}).click();
    await page.getByRole('dialog').getByRole('button',{name:'Confirmar alteração',exact:true}).click();
    await expect(offers.getByRole('cell',{name:'R$ 15,25',exact:true})).toBeVisible();
    expect(state.posts[1].body).toEqual({expected_version:1,unit_price:'15.25',currency:'BRL',minimum_order_quantity:5});
    await offers.getByRole('button',{name:'Pausar oferta',exact:true}).click();
    expect(state.posts).toHaveLength(2);
    await page.getByRole('dialog').getByRole('button',{name:'Confirmar pausa',exact:true}).click();
    await expect(offers.getByText('Nenhuma oferta ativa nesta página.')).toBeVisible();
    expect(state.posts[2].body).toEqual({expected_version:2});
});
test('depósitos pendentes e inativos não permitem criar ofertas',async({page})=>{
    const state=await setup(page);state.warehouses=state.warehouses.filter(item=>item.id!=='warehouse');
    await page.goto('/fornecedor/produtos');
    await expect(page.getByRole('button',{name:'Cadastre ou regularize um depósito para criar ofertas'})).toBeVisible();
    await expect(page.getByRole('button',{name:'Criar oferta para produto existente',exact:true})).toBeDisabled();
    expect(state.posts).toHaveLength(0);
});
test('conflito exige atualização e nova revisão',async({page})=>{
    const state=await setup(page);state.offers=[{...offer}];state.conflict=true;
    await page.goto('/fornecedor/produtos');
    await page.getByRole('button',{name:'Alterar oferta',exact:true}).click();
    await page.getByRole('dialog').getByRole('button',{name:'Revisar oferta',exact:true}).click();
    await page.getByRole('dialog').getByRole('button',{name:'Confirmar alteração',exact:true}).click();
    await expect(page.getByRole('dialog').getByRole('alert')).toContainText('Conflito de versão');
    await expect(page.getByRole('dialog').getByRole('button',{name:'Confirmar alteração',exact:true})).toBeDisabled();
    await page.getByRole('dialog').getByRole('button',{name:'Fechar',exact:true}).click();
    await page.getByRole('button',{name:/^Atualizar (ofertas|depósitos)$/}).click();
    await expect(page.getByRole('button',{name:'Alterar oferta',exact:true})).toBeEnabled();
    expect(state.posts).toHaveLength(1);
});
test('criação com resposta perdida não é repetida e permite conferir o resultado',async({page})=>{
    const state=await setup(page);state.uncertain=true;
    await page.goto('/fornecedor/produtos');const dialog=await reviewCreate(page);
    await dialog.getByRole('button',{name:'Confirmar criação',exact:true}).click();
    await expect(dialog.getByRole('alert')).toContainText('A criação pode ter sido concluída');
    await expect(dialog.getByRole('button',{name:'Confirmar criação',exact:true})).toBeDisabled();
    await dialog.getByRole('button',{name:'Fechar',exact:true}).click();
    await expect(page.getByRole('button',{name:'Criar oferta para produto existente',exact:true})).toBeDisabled();
    await page.getByRole('button',{name:/^Atualizar (ofertas|depósitos)$/}).click();
    await expect(page.getByRole('cell',{name:'R$ 12,30',exact:true})).toBeVisible();
    expect(state.posts).toHaveLength(1);expect(state.offers).toHaveLength(1);
});
test('rede e resposta de outra organização não disponibilizam ações de gestão',async({page})=>{
    const state=await setup(page);state.network=true;await page.goto('/fornecedor/produtos');
    await page.getByRole('tab',{name:'Meus depósitos',exact:true}).click();
    await expect(page.getByRole('region',{name:'Depósitos próprios',exact:true}).getByRole('alert')).toContainText('conectar');
    state.network=false;state.foreign=true;
    await page.getByRole('button',{name:/^Atualizar (ofertas|depósitos)$/}).click();
    await page.getByRole('tab',{name:'Minhas ofertas',exact:true}).click();
    await expect(page.getByRole('region',{name:'Minhas ofertas',exact:true}).getByRole('alert')).toContainText('outra organização');
    await expect(page.getByRole('button',{name:'Alterar oferta',exact:true})).toHaveCount(0);
    expect(state.posts).toHaveLength(0);
});
test('formulário de oferta utilizável em 360px com foco e Escape',async({page},testInfo)=>{
    await page.setViewportSize({width:360,height:800});await setup(page);
    await page.goto('/fornecedor/produtos');const dialog=await reviewCreate(page);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await page.screenshot({path:testInfo.outputPath('oferta-mobile.png'),fullPage:true});
    await page.keyboard.press('Escape');await expect(dialog).toHaveCount(0);
    await expect(page.getByRole('button',{name:'Criar oferta para produto existente',exact:true})).toBeFocused();
});

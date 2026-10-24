import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const org = "11111111-1111-4111-8111-111111111111";
const id = "22222222-2222-4222-8222-222222222222";
const detailsName = (orderId: string) => `Ver detalhes do Pedido #${orderId.replace(/-/g, "").toUpperCase().slice(0, 8)}`;
const user = { id: "test-user", name: "Fornecedor do teste", email: "supplier@example.invalid", role: "SUPPLIER_OPERATOR", organization_id: org, organizations: [{ id: org, name: "Organização sintética", role: "SUPPLIER_OPERATOR" }], capabilities: ["supplier_order:manage", "offer:write", "inventory:write"], demo_run_id: "demo", is_synthetic: true };
function makeOrder(orderId = id, state = "AWAITING_SUPPLIER_DECISION") {
    return {
        id: orderId, state, purchase_id: "purchase", buyer_organization_id: "buyer-id", supplier_organization_id: org,
        warehouse_id: "warehouse", version: 3, accepts_partial: false, acceptance_deadline: "2099-01-01T00:00:00Z",
        currency: "BRL", total: "0.30", cancellation_reason: null, allowed_actions: ["acceptance"], is_synthetic: true,
        items: [{ id: "line", offer_id: "offer", product: { id: "product", name: "Arroz do pedido", net_content: 1, net_content_unit: "un", packaging_type: "Pacote" }, unit_price: "0.10", currency: "BRL", requested_quantity: 3, reserved_quantity: 3, supplier_accepted_quantity: 0, supplier_refused_quantity: 0, separated_quantity: 0 }],
        fulfillments: [] as { id: string; supplier_order_id: string; state: string; version: number; lines: {id:string; order_item_id:string; allocated_quantity:number; separated_quantity:number}[] }[],
    };
}
async function setup(page: Page, items: ReturnType<typeof makeOrder>[]) {
    const state = { items, identity: { ...user }, posts: [] as { path: string; key: string | undefined; body: Record<string, unknown> }[], reads: 0, failList: 0, failPost: false, conflict: false };
    await page.addInitScript(() => {
        sessionStorage.setItem("rotalog:api-csrf", "test-csrf");
        localStorage.setItem("rotalog:supplier-orders:v1", JSON.stringify([{id:"LOCAL-ONLY",organizationId:"fornecedor-001",customer:"Mock",total:999,status:"Pendente"}]));
    });
    await page.route("http://localhost:8000/api/v1/**", async route => {
        const request = route.request(), url = new URL(request.url()), path = url.pathname;
        if (path.endsWith("/auth/refresh") || path.endsWith("/auth/login")) return route.fulfill({json:{access_token:"test-access",token_type:"bearer",expires_in:600,csrf_token:"test-csrf",refresh_token:null,user:state.identity}});
        if (path.endsWith("/me")) return route.fulfill({json:state.identity});
        if (path.endsWith("/auth/logout")) return route.fulfill({status:204});
        expect(request.headers()["authorization"]).toBe("Bearer test-access");
        expect(request.headers()["x-organization-id"]).toBe(state.identity.organization_id);
        if (request.method() === "POST") {
            state.posts.push({path,key:request.headers()["idempotency-key"],body:request.postDataJSON()});
            if (state.failPost) { state.failPost=false; return route.abort("failed"); }
            if (state.conflict) return route.fulfill({status:409,json:{error:{code:"VERSION_CONFLICT"}}});
            const target=state.items[0];
            if (path.endsWith("/acceptance")) {
                target.items[0].supplier_accepted_quantity=request.postDataJSON().lines[0].accepted_quantity;
                target.state=target.items[0].supplier_accepted_quantity ? "ACCEPTED" : "REFUSED";
                target.allowed_actions=target.state==="ACCEPTED" ? ["start-separation"] : []; target.version++;
            } else if (path.endsWith("/start-separation")) {
                target.state="SEPARATING"; target.allowed_actions=["fulfillments"]; target.version++;
            } else if (path.endsWith("/fulfillments")) {
                target.fulfillments.push({id:"batch",supplier_order_id:target.id,state:"SEPARATING",version:1,lines:[{id:"batch-line",order_item_id:"line",allocated_quantity:3,separated_quantity:0}]}); target.version++;
            } else if (path.endsWith("/separation-results")) {
                target.fulfillments[0].lines[0].separated_quantity=3; target.fulfillments[0].version++; target.version++; target.items[0].separated_quantity=3;
            } else if (path.endsWith("/mark-ready")) {
                target.fulfillments[0].state="READY_TO_DISPATCH"; target.fulfillments[0].version++; target.state="READY_TO_DISPATCH"; target.allowed_actions=[]; target.version++;
            }
            return route.fulfill({json:path.includes("/api/v1/fulfillments/") || path.endsWith("/fulfillments") ? target.fulfillments[0] : target});
        }
        if (path==="/api/v1/supplier-orders") {
            state.reads++;
            if (state.failList) return route.fulfill({status:state.failList,json:{error:{code:"TEST_ERROR"}}});
            const number=Number(url.searchParams.get("page"));
            return route.fulfill({json:{items:state.items.slice((number-1)*100,number*100),total:state.items.length,page:number,page_size:100,is_synthetic:true,label:"SIMULAÇÃO — dados sintéticos"}});
        }
        const target=state.items.find(item=>path.endsWith(`/${item.id}`));
        return target ? route.fulfill({json:target}) : route.fulfill({status:404,json:{error:{code:"NOT_FOUND"}}});
    });
    return state;
}
async function openDetails(page: Page) {
    await page.goto("/fornecedor/pedidos");
    await page.getByRole("button",{name:detailsName(id)}).click();
    return page.getByRole("dialog");
}
test('login preservado e acesso à nova conta pelo perfil',async({page},testInfo)=>{
    await setup(page,[]);
    await page.addInitScript(()=>sessionStorage.removeItem('rotalog:api-csrf'));
    await page.goto('/login');
    await page.getByLabel('E-mail',{exact:true}).fill('supplier@example.invalid');
    await page.getByLabel('Senha',{exact:true}).fill('synthetic-test-password');
    await page.screenshot({path:testInfo.outputPath('login-preservado.png'),fullPage:true});
    await page.getByRole('button',{name:'Entrar',exact:true}).click();
    await expect(page).toHaveURL(/\/fornecedor$/);
    await page.getByLabel('Abrir perfil do usuário',{exact:true}).click();
    await page.locator('.supplier-profile-panel').getByRole('link',{name:'Minha conta'}).click();
    await expect(page).toHaveURL(/\/fornecedor\/conta$/);
    await expect(page.getByRole('main')).toContainText(user.email);
});

test('filtro traduz rótulos sem alterar valores e preserva estados desconhecidos', async ({page}) => {
    await setup(page, [makeOrder(id, 'READY_TO_DISPATCH'), makeOrder('unknown', 'FUTURE_STATE')]);
    await page.goto('/fornecedor/pedidos');
    const filter = page.getByLabel('Filtrar estado', {exact:true});
    await expect(filter.locator('option[value="READY_TO_DISPATCH"]')).toHaveText('Pronto para coleta');
    await filter.selectOption({label:'Pronto para coleta'});
    await expect(filter).toHaveValue('READY_TO_DISPATCH');
    await expect(page.getByRole('button', {name:detailsName(id)})).toBeAttached();
    await expect(page.getByRole('button', {name:detailsName("unknown")})).toHaveCount(0);
    await filter.selectOption('FUTURE_STATE');
    await expect(page.getByRole('region', {name:'Outros estados', exact:true}).getByText('Situação não reconhecida', {exact:true})).toBeAttached();
});

test('identificação curta consistente e colisões antes dos filtros', async ({page}) => {
    const first = makeOrder('f1e10a37-78d7-4d53-828d-5122922dff46');
    const second = makeOrder('f1e10a37-1234-4d53-828d-5122922dff46');
    const numbered = Object.assign(makeOrder('commercial-order'), {order_number:'RL-2026-001'});
    const state = await setup(page, [first, second, numbered]);
    await page.goto('/fornecedor/pedidos');
    await expect(page.getByRole('heading', {name:'Pedido #F1E10A3778D7', exact:true})).toBeVisible();
    await expect(page.getByRole('heading', {name:'Pedido #F1E10A371234', exact:true})).toBeVisible();
    await expect(page.getByRole('heading', {name:'Pedido RL-2026-001', exact:true})).toBeVisible();
    await page.getByRole('searchbox').fill(first.id);
    await expect(page.getByRole('heading', {name:'Pedido #F1E10A3778D7', exact:true})).toBeVisible();
    await page.getByRole('button', {name:'Ver detalhes do Pedido #F1E10A3778D7'}).click();
    await expect(page.getByRole('region', {name:'Resumo do pedido'}).getByText('Pedido #F1E10A3778D7', {exact:true})).toBeVisible();
    await page.keyboard.press('Escape');
    await page.getByRole('navigation').getByRole('link', {name:'Dashboard', exact:true}).click();
    await expect(page.getByText('Pedido #F1E10A3778D7', {exact:true})).toBeVisible();
    await expect(page.getByText('Pedido RL-2026-001', {exact:true})).toBeVisible();
    expect(state.posts).toHaveLength(0);
});
for (const width of [1440,390]) test(`refinamento do pedido: áreas separadas e sem logística fictícia em ${width}px`,async({page},testInfo)=>{
    const order=makeOrder(id,'READY_TO_DISPATCH');order.allowed_actions=[];
    order.items[0].supplier_accepted_quantity=3;order.items[0].separated_quantity=3;
    order.fulfillments=[{id:'batch',supplier_order_id:id,state:'READY_TO_DISPATCH',version:4,lines:[{id:'batch-line',order_item_id:'line',allocated_quantity:3,separated_quantity:3}]}];
    const state=await setup(page,[order]);await page.setViewportSize({width,height:900});await page.goto('/fornecedor/pedidos');
    await expect(page.getByRole('heading',{name:'Quadro de pedidos'})).toBeVisible();
    await page.screenshot({path:testInfo.outputPath(`kanban-${width}.png`),fullPage:true});
    await page.getByRole('button',{name:detailsName(id)}).click();
    const dialog=page.getByRole('dialog');
    for(const label of ['Resumo do pedido','Produtos e quantidades','Lotes de atendimento','Situação logística','Ações do pedido'])await expect(dialog.getByRole('region',{name:label,exact:true})).toBeVisible();
    await expect(dialog.getByRole('region',{name:'Situação logística'})).toContainText('não confirma coleta ou entrega');
    await expect(dialog.getByRole('button',{name:/coletar|despachar|entregar|publicar rota/i})).toHaveCount(0);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
    expect(await dialog.evaluate(element=>element.scrollWidth<=element.clientWidth)).toBe(true);
    await dialog.evaluate(element=>element.scrollTop=0);
    await page.screenshot({path:testInfo.outputPath(`supplier-details-${width}.png`),fullPage:true});
    const accessibility=await new AxeBuilder({page}).include('dialog').analyze();expect(accessibility.violations).toEqual([]);
    await page.keyboard.press('Escape');await expect(dialog).toHaveCount(0);expect(state.posts).toHaveLength(0);
});

test('filtro vazio tem recuperação explícita sem alterar pedidos',async({page})=>{
    const state=await setup(page,[makeOrder()]);await page.goto('/fornecedor/pedidos');
    await page.getByRole('searchbox').fill('inexistente');await expect(page.getByText('Nenhum pedido corresponde aos filtros nesta aba.')).toBeVisible();
    await page.getByRole('button',{name:'Limpar filtros',exact:true}).click();await expect(page.getByRole('button',{name:detailsName(id)})).toBeVisible();expect(state.posts).toHaveLength(0);
});

test("vazio sem mocks ou datas fictícias; navegação somente consulta", async ({page}) => {
    const state=await setup(page,[]); await page.goto("/fornecedor");
    await expect(page.getByRole("link",{name:"Pedidos recebidos: 0. Ver pedidos"})).toBeVisible();
    await expect(page.getByLabel("Ano do Dashboard")).toHaveCount(0);
    await expect(page.getByText("LOCAL-ONLY")).toHaveCount(0);
    await page.getByRole("navigation").getByRole("link",{name:"Pedidos",exact:true}).click();
    await expect(page.getByText("Nenhum pedido encontrado para sua organização.")).toBeVisible();
    expect(state.posts).toHaveLength(0); expect(state.reads).toBe(1);
});
test("101 pedidos: paginação, contadores iguais e estado desconhecido acessível", async ({page}) => {
    const items=Array.from({length:100},(_,i)=>makeOrder(`order-${i}`)); items.push(makeOrder(id,"FUTURE_STATE"));
    const state=await setup(page,items); await page.goto("/fornecedor");
    await expect(page.getByRole("link",{name:"Pedidos recebidos: 101. Ver pedidos"})).toBeVisible();
    await expect(page.getByRole("link",{name:"Aguardando aceite: 100. Ver pedidos"})).toBeVisible();
    const menu=page.getByRole("navigation").getByRole("link",{name:"Pedidos 100 pedidos aguardando aceite"});
    await expect(menu).toBeVisible(); await menu.click();
    await expect(page.getByLabel("100 pedidos na etapa Novos")).toBeVisible();
    const unknown=page.getByRole("region",{name:"Outros estados",exact:true});
    await expect(unknown.getByText("Situação não reconhecida",{exact:true})).toBeVisible();
    await expect(unknown.getByText("FUTURE_STATE",{exact:true})).toHaveCount(0);
    await unknown.getByRole("button",{name:detailsName(id)}).click();
    await expect(page.getByRole("dialog").getByRole('region', {name:'Resumo do pedido'}).getByText('Situação não reconhecida', {exact:true})).toBeVisible();
    await expect(page.getByRole('dialog').getByText('FUTURE_STATE', {exact:true})).toHaveCount(0);
    await expect(page.getByRole("dialog").getByRole("button",{name:"Aceitar pedido",exact:true})).toHaveCount(0);
    expect(state.posts).toHaveLength(0); expect(state.reads).toBe(2);
});
test("aceite repete chave após falha e atualiza menu, Kanban e dashboard", async ({page}) => {
    const state=await setup(page,[makeOrder()]); state.failPost=true;
    const dialog=await openDetails(page);
    await expect(dialog.getByRole("timer")).toContainText("d");
    await dialog.getByRole("button",{name:"Aceitar pedido",exact:true}).click();
    await dialog.getByRole("button",{name:"Confirmar aceite",exact:true}).click();
    await expect(dialog.getByRole("alert")).toBeVisible();
    await dialog.getByRole("button",{name:"Confirmar aceite",exact:true}).click();
    await expect(dialog.getByRole('region', {name:'Resumo do pedido'}).getByText('Aceito', {exact:true})).toBeVisible();
    expect(state.posts).toHaveLength(2); expect(state.posts[0].key).toBeTruthy(); expect(state.posts[0].key).toBe(state.posts[1].key);
    expect(state.posts[0].body.expected_version).toBe(3);
    await dialog.getByRole("button",{name:"Fechar",exact:true}).click();
    await expect(page.getByLabel("1 pedidos na etapa Aceitos")).toBeVisible();
    await expect(page.getByRole("navigation").getByLabel("1 pedido aguardando aceite")).toHaveCount(0);
    await page.getByRole("navigation").getByRole("link",{name:"Dashboard",exact:true}).click();
    await expect(page.getByRole("link",{name:"Aguardando aceite: 0. Ver pedidos"})).toBeVisible();
    await expect(page.getByRole("link",{name:"Em preparação: 1. Ver pedidos"})).toBeVisible();
});
test("separação explícita com versões distintas até pronto para coleta", async ({page}) => {
    const item=makeOrder(id,"ACCEPTED"); item.allowed_actions=["start-separation"]; item.items[0].supplier_accepted_quantity=3;
    const state=await setup(page,[item]); const dialog=await openDetails(page);
    await dialog.getByRole("button",{name:"Iniciar separação",exact:true}).click();
    await dialog.getByRole("region",{name:"Confirmação da operação"}).getByRole("button",{name:"Iniciar separação",exact:true}).click();
    await expect(dialog.getByRole("region", {name:"Resumo do pedido"}).getByText("Em separação", {exact:true})).toBeVisible();
    await dialog.getByRole("button",{name:"Criar lote",exact:true}).click();
    await dialog.getByRole("button",{name:"Criar lote de atendimento",exact:true}).click();
    await expect(dialog.getByRole('region', {name:'Lotes de atendimento'}).getByText('Em separação',{exact:true})).toBeVisible();
    await expect(dialog.getByText('3 alocados / 0 separados')).toBeVisible();
    await expect(dialog.getByText(/Versão do lote/)).toHaveCount(0);
    await expect(dialog.getByRole("button",{name:"Marcar lote como pronto",exact:true})).toBeDisabled();
    await dialog.getByRole("button",{name:"Registrar separação do lote",exact:true}).click();
    await dialog.getByRole("spinbutton").fill("3");
    await dialog.getByRole("button",{name:"Registrar separação",exact:true}).click();
    await expect(dialog.getByRole('region', {name:'Lotes de atendimento'}).getByText('Em separação',{exact:true})).toBeVisible();
    await expect(dialog.getByText('3 alocados / 3 separados')).toBeVisible();
    await dialog.getByRole("button",{name:"Marcar lote como pronto",exact:true}).click();
    await dialog.getByRole("region",{name:"Confirmação da operação"}).getByRole("button",{name:"Marcar lote como pronto",exact:true}).click();
    await expect(dialog.getByRole("region", {name:"Resumo do pedido"}).getByText("Pronto para coleta", {exact:true})).toBeVisible();
    expect(state.posts.map(post=>post.body.expected_version)).toEqual([3,4,1,2]);
    expect(state.posts.every(post=>post.key===undefined)).toBe(true);
    await dialog.getByRole("button",{name:"Fechar",exact:true}).click();
    await page.getByRole("navigation").getByRole("link",{name:"Dashboard",exact:true}).click();
    await expect(page.getByRole("link",{name:"Prontos para coleta: 1. Ver pedidos"})).toBeVisible();
});
test("autorização e falha temporária não recorrem aos dados locais", async ({page}) => {
    const state=await setup(page,[makeOrder()]); state.failList=403; await page.goto("/fornecedor");
    await expect(page.getByRole("alert")).toContainText("Sem autorização");
    await expect(page.getByRole("link",{name:/Pedidos recebidos:/})).toHaveCount(0);
    state.failList=503; await page.getByRole("button",{name:"Tentar novamente"}).click();
    await expect(page.getByRole("alert")).toContainText("Não foi possível");
    state.failList=0; await page.getByRole("button",{name:"Tentar novamente"}).click();
    await expect(page.getByRole("link",{name:"Pedidos recebidos: 1. Ver pedidos"})).toBeVisible();
    await expect(page.getByText("LOCAL-ONLY")).toHaveCount(0);
});
test("conflito de versão não avança o pedido e permite revisão", async ({page}) => {
    const state=await setup(page,[makeOrder()]); state.conflict=true; const dialog=await openDetails(page);
    await dialog.getByRole("button",{name:"Aceitar pedido",exact:true}).click();
    await dialog.getByRole("button",{name:"Confirmar aceite",exact:true}).click();
    await expect(dialog.getByRole("alert")).toContainText("Conflito de versão");
    await expect(dialog.getByRole("region", {name:"Resumo do pedido"}).getByText("Aguardando aceite", {exact:true})).toBeVisible();
    expect(state.posts).toHaveLength(1);
    await dialog.getByRole("button",{name:"Atualizar pedido e revisar"}).click();
    await expect(dialog.getByRole("region",{name:"Confirmação da operação"})).toHaveCount(0);
});
test("portal API e detalhes permanecem utilizáveis no celular", async ({page}) => {
    await page.setViewportSize({width:390,height:844});
    await setup(page,[makeOrder()]);
    const dialog=await openDetails(page);
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText("R$ 0,30",{exact:true})).toBeVisible();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
    await dialog.getByRole("button",{name:"Fechar",exact:true}).click();
    await page.getByRole("button",{name:"Abrir menu"}).click();
    await expect(page.getByRole("dialog",{name:"Menu do fornecedor"}).getByLabel("1 pedido aguardando aceite")).toBeVisible();
});

for (const width of [1440, 1280, 1024, 768, 390, 360]) {
    test(`Kanban logístico e detalhes do pedido em ${width}px`, async ({page}) => {
        await page.setViewportSize({width, height:900});
        await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
        const transit = makeOrder(id, 'AWAITING_BUYER_RECEIPT');
        transit.allowed_actions = [];
        const delivered = makeOrder('33333333-3333-4333-8333-333333333333', 'DELIVERED');
        delivered.allowed_actions = [];
        const state = await setup(page, [transit, delivered, makeOrder('refused', 'REFUSED')]);
        await page.goto('/fornecedor/pedidos');
        const board = page.getByRole('region', {name:'Rolagem do quadro de pedidos'});
        await expect(board.getByRole('heading', {name:'Entregues', exact:true})).toBeAttached();
        await expect(board.getByText('Entrega informada — aguardando confirmação do comprador')).toBeAttached();
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        expect(await board.evaluate(el => getComputedStyle(el).overflowY)).toBe('auto');
        if (width === 360 || width === 1440) {
            await board.evaluate(el => { el.scrollLeft = el.scrollWidth; });
            await page.screenshot({path:`test-results/kanban-${width}.png`, fullPage:true});
        }
        await board.getByRole('button', {name:detailsName(id)}).click();
        const dialog = page.getByRole('dialog');
        await expect(dialog.getByRole('region', {name:'Resumo do pedido'})).toBeVisible();
        await expect(dialog.getByRole('region', {name:'Resumo do pedido'}).getByText('Pedido #22222222', {exact:true})).toBeVisible();
        await expect(dialog.getByRole('button', {name:'Aceitar pedido', exact:true})).toHaveCount(0);
        const technicalDetails=dialog.locator('details');
        await expect(technicalDetails).not.toHaveAttribute('open','');
        await expect(technicalDetails.getByText(id,{exact:true})).toBeHidden();
        await technicalDetails.locator('summary').click();
        await expect(technicalDetails.getByText(id,{exact:true})).toBeVisible();
        await technicalDetails.getByRole('button',{name:'Copiar UUID do pedido',exact:true}).click();
        await expect(technicalDetails.getByText('Identificador copiado.',{exact:true})).toBeVisible();
        expect(await page.evaluate(()=>navigator.clipboard.readText())).toBe(id);
        await page.keyboard.press('Escape');
        await page.getByRole('tab', {name:/Histórico/}).click();
        await expect(page.getByRole('tabpanel', {name:/Histórico/}).getByText('Pedido #REFUSED')).toBeVisible();
        expect(state.posts).toHaveLength(0);
    });
}
test("logout e nova organização limpam pedidos e contadores anteriores", async ({page}) => {
    const state=await setup(page,[makeOrder()]);
    await page.goto("/fornecedor");
    await expect(page.getByRole("link",{name:"Pedidos recebidos: 1. Ver pedidos"})).toBeVisible();
    await page.getByRole("button",{name:"Sair",exact:true}).click();
    await expect(page).toHaveURL(/\/login$/);
    const nextOrg="77777777-7777-4777-8777-777777777777";
    state.identity={...user,id:"another-user",organization_id:nextOrg,organizations:[{id:nextOrg,name:"Outra organização",role:"SUPPLIER_OPERATOR"}]};
    state.items=[];
    await page.getByLabel("E-mail",{exact:true}).fill("another@example.invalid");
    await page.getByLabel("Senha",{exact:true}).fill("test-input-only");
    await page.getByRole("button",{name:"Entrar",exact:true}).click();
    await expect(page.getByRole("link",{name:"Pedidos recebidos: 0. Ver pedidos"})).toBeVisible();
    await expect(page.getByText(id,{exact:true})).toHaveCount(0);
    await expect(page.getByRole("navigation").getByLabel("1 pedido aguardando aceite")).toHaveCount(0);
    expect(state.posts).toHaveLength(0);
});
test("prazo expirado bloqueia aceite sem inventar transição de estado", async ({page}) => {
    const item=makeOrder(); item.acceptance_deadline="2000-01-01T00:00:00Z";
    const state=await setup(page,[item]); const dialog=await openDetails(page);
    await expect(dialog.getByRole("timer")).toHaveText("Prazo encerrado");
    await expect(dialog.getByRole("button",{name:"Aceitar pedido",exact:true})).toHaveCount(0);
    await expect(dialog.getByRole("region", {name:"Resumo do pedido"}).getByText("Aguardando aceite", {exact:true})).toBeVisible();
    expect(state.posts).toHaveLength(0);
});

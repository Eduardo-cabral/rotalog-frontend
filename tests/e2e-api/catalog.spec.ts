import {test, expect, type Page} from '@playwright/test';

const organization = '11111111-1111-4111-8111-111111111111';
function product(index = 1) {
    return {id:`product-${index}`,name:`Arroz oficial ${index}`,brand:'Marca oficial',category:'ALIMENTO_SECO_INDUSTRIALIZADO',gtin:null,net_content:1000,net_content_unit:'g',packaging_type:'Pacote',packaging_quantity:1,gross_weight_grams:1050,volume_cm3:1500,variant_attributes:{tipo:'Branco'},publication_state:'PUBLISHED',version:1,demo_run_id:'demo',is_synthetic:true};
}
async function setup(page: Page) {
    const state = {products:Array.from({length:26},(_,index)=>product(index+1)),status:0,network:false,detailStatus:0,requests:[] as string[],organization};
    await page.addInitScript(()=>{
        sessionStorage.setItem('rotalog:api-csrf','csrf');
        localStorage.setItem('rotalog:supplier-products:v1:11111111-1111-4111-8111-111111111111',JSON.stringify([{id:'LOCAL',name:'Produto local proibido'}]));
    });
    await page.route('http://localhost:8000/api/v1/**',async route=>{
        const request=route.request(),url=new URL(request.url()),path=url.pathname;
        const user={id:'catalog-user',name:'Fornecedor',email:'supplier@example.invalid',role:'SUPPLIER_OPERATOR',organization_id:state.organization,organizations:[{id:state.organization,name:'Fornecedor',role:'SUPPLIER_OPERATOR'}],capabilities:['catalog:read','offer:write','inventory:write','supplier_order:manage'],demo_run_id:'demo',is_synthetic:true};
        if (path.endsWith('/auth/refresh')) return route.fulfill({json:{access_token:'test-access',token_type:'bearer',expires_in:600,csrf_token:'csrf',refresh_token:null,user}});
        if (path.endsWith('/me')) return route.fulfill({json:user});
        expect(request.headers()['authorization']).toBe('Bearer test-access');
        expect(request.headers()['x-organization-id']).toBe(state.organization);
        expect(request.method()).toBe('GET');
        if (path==='/api/v1/supplier-orders') return route.fulfill({json:{items:[],total:0,page:1,page_size:100}});
        if (path==='/api/v1/warehouses' || path==='/api/v1/offers') return route.fulfill({json:{items:[],total:0,page:Number(url.searchParams.get('page')),page_size:Number(url.searchParams.get('page_size'))}});
        state.requests.push(url.pathname+url.search);
        if (state.network) return route.abort('failed');
        if (path==='/api/v1/products') {
            if (state.status) return route.fulfill({status:state.status,json:{error:{code:'TEST_ERROR'}}});
            const search=url.searchParams.get('search')??'';
            const items=state.products.filter(item=>item.name.includes(search));
            const number=Number(url.searchParams.get('page'));
            return route.fulfill({json:{items:items.slice((number-1)*25,number*25),total:items.length,page:number,page_size:25,is_synthetic:true}});
        }
        if (state.detailStatus) return route.fulfill({status:state.detailStatus,json:{error:{code:'PRODUCT_NOT_FOUND'}}});
        const item=state.products.find(value=>path.endsWith(`/${value.id}`));
        return item ? route.fulfill({json:item}) : route.fulfill({status:404});
    });
    return state;
}

test('catálogo oficial: paginação, pesquisa, detalhes e ausência de ações locais',async({page})=>{
    const state=await setup(page);
    await page.goto('/fornecedor/produtos#catalogo');
    await expect(page.getByText('Arroz oficial 1',{exact:true})).toBeVisible();
    await expect(page.getByLabel('Categoria nesta página')).toHaveCount(0);
    await expect(page.getByRole('img',{name:'Imagem de Arroz oficial 1 não disponível'})).toBeVisible();
    await expect(page.getByText('Produto local proibido')).toHaveCount(0);
    await expect(page.getByRole('button',{name:'Novo produto',exact:true})).toHaveCount(0);
    await page.getByText('Produto não encontrado?',{exact:true}).click();
    await expect(page.getByRole('button',{name:'Solicitar cadastro de produto'})).toBeDisabled();
    await page.getByRole('button',{name:'Próxima',exact:true}).click();
    await expect(page.getByText('Arroz oficial 26',{exact:true})).toBeVisible();
    await expect(page.getByRole('button',{name:'Próxima',exact:true})).toBeDisabled();
    await page.getByRole('searchbox',{name:'Pesquisar por nome'}).fill('oficial 2');
    await page.getByRole('button',{name:'Pesquisar',exact:true}).click();
    await expect(page.getByText('Página 1 de 1 · 8 produtos')).toBeVisible();
    await page.getByRole('button',{name:'Ver detalhes de Arroz oficial 2',exact:true}).click();
    const dialog=page.getByRole('dialog');
    await expect(dialog.getByRole('heading',{name:'Arroz oficial 2',exact:true})).toBeVisible();
    await expect(dialog.getByText('1050 g',{exact:true})).toBeVisible();
    await expect(dialog.getByText('Não informado',{exact:true})).toBeVisible();
    await expect(dialog.getByText('product-2',{exact:true})).toHaveCount(0);
    await expect(dialog.getByText(/versão/i)).toHaveCount(0);
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    expect(state.requests.some(path=>path.includes('page=2'))).toBe(true);
    expect(state.requests.some(path=>path==='/api/v1/products/product-2')).toBe(true);
});

test('catálogo vazio e pesquisa sem resultados',async({page})=>{
    const state=await setup(page);state.products=[];
    await page.goto('/fornecedor/produtos#catalogo');
    await expect(page.getByText('Nenhum produto publicado no catálogo.')).toBeVisible();
    await page.getByRole('searchbox').fill('ausente');
    await page.getByRole('button',{name:'Pesquisar',exact:true}).click();
    await expect(page.getByText('Nenhum produto encontrado para esta pesquisa.')).toBeVisible();
});

test('sessão inválida segue o redirecionamento existente para login',async({page})=>{
    const state=await setup(page);state.status=401;
    await page.goto('/fornecedor/produtos#catalogo');
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByText('Produto local proibido')).toHaveCount(0);
});

test('falhas de permissão e rede não recorrem ao catálogo local',async({page})=>{
    const state=await setup(page);state.status=403;
    await page.goto('/fornecedor/produtos#catalogo');
    await expect(page.getByRole('alert')).toContainText('Sem autorização');
    state.status=0;state.network=true;
    await page.getByRole('button',{name:'Tentar novamente',exact:true}).click();
    await expect(page.getByRole('alert')).toContainText('Não foi possível conectar');
    await expect(page.getByText('Produto local proibido')).toHaveCount(0);
    state.network=false;
    await page.getByRole('button',{name:'Tentar novamente',exact:true}).click();
    await expect(page.getByText('Arroz oficial 1',{exact:true})).toBeVisible();
    state.detailStatus=404;
    await page.getByRole('button',{name:'Ver detalhes de Arroz oficial 1',exact:true}).click();
    await expect(page.getByRole('dialog').getByRole('alert')).toContainText('Produto não encontrado');
});

for (const width of [360, 768, 1440]) {
test(`catálogo e detalhes sem overflow em ${width}px`,async({page}, testInfo)=>{
    await page.setViewportSize({width,height:900});await setup(page);
    await page.goto('/fornecedor/produtos#catalogo');
    await expect(page.getByRole('button',{name:'Ver detalhes de Arroz oficial 1',exact:true})).toBeAttached();
    await page.screenshot({path:testInfo.outputPath('catalogo.png'), fullPage:true});
    await page.getByRole('button',{name:'Ver detalhes de Arroz oficial 1',exact:true}).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.screenshot({path:testInfo.outputPath('detalhes.png'), fullPage:true});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await page.keyboard.press('Escape');
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
}

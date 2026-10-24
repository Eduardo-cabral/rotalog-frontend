const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
function load(path, dependencies = {}) {
    const module = {exports:{}};
    const code = ts.transpileModule(fs.readFileSync(path, 'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
    vm.runInNewContext(code, {module,exports:module.exports,require:id=>dependencies[id],URLSearchParams,Error});
    return module.exports;
}
const http = load('src/shared/api/http.ts', {'./config':{apiUrl:''}});
const {CatalogRepository,catalogCategories,catalogError,productCategory,publicationLabel} = load('src/features/products/api/catalogRepository.ts', {'../../services/apiAuth.service':{},'../../../shared/api/http':http});
(async()=>{
    const calls = [];
    const product = {id:'product-id',name:'Arroz',publication_state:'PUBLISHED'};
    const repository = new CatalogRepository('supplier-org', async (path,options)=>{
        calls.push({path,options});
        return path.includes('?') ? {items:[product],page:2,page_size:25,total:26} : product;
    });
    const page = await repository.list(2,' Arroz & feijão ');
    assert.equal(page.total,26);
    const url = new URL(calls[0].path,'http://localhost');
    assert.equal(url.searchParams.get('page'),'2');
    assert.equal(url.searchParams.get('page_size'),'25');
    assert.equal(url.searchParams.get('search'),'Arroz & feijão');
    assert.equal(calls[0].options.headers['X-Organization-Id'],'supplier-org');
    assert.equal(await repository.detail('product-id'),product);
    await repository.list();
    assert.equal(new URL(calls[2].path,'http://localhost').searchParams.has('search'),false);
    assert.ok(calls.every(call=>!call.options.method));
    await assert.rejects(new CatalogRepository('').list(),/Organização/);
    await assert.rejects(repository.detail('wrong-id'),/diferente/);
    const mutations=[];
    const adminRepository=new CatalogRepository('admin-org',async(path,options,replayUnauthorized)=>{
        mutations.push({path,options,replayUnauthorized});
        return path.endsWith('/publish')?{...product,publication_state:'PUBLISHED',version:2}:{...product,publication_state:'DRAFT',version:1};
    });
    const productInput={name:'Arroz canônico',brand:'Marca',category:'ALIMENTO_SECO_INDUSTRIALIZADO',gtin:null,net_content:1000,net_content_unit:'g',packaging_type:'Fardo',packaging_quantity:6,gross_weight_grams:6200,volume_cm3:1000,variant_attributes:{apresentacao:'integral'}};
    const draft=await adminRepository.createProduct(productInput);
    assert.equal(draft.publication_state,'DRAFT');
    assert.equal(mutations[0].path,'/api/v1/admin/products');
    assert.equal(mutations[0].options.method,'POST');
    assert.equal(mutations[0].options.headers['X-Organization-Id'],'admin-org');
    assert.deepEqual(JSON.parse(mutations[0].options.body),productInput);
    assert.equal(mutations[0].replayUnauthorized,false);
    const published=await adminRepository.publishProduct('product-id',draft.version);
    assert.equal(published.publication_state,'PUBLISHED');
    assert.equal(mutations[1].path,'/api/v1/admin/products/product-id/publish');
    assert.deepEqual(JSON.parse(mutations[1].options.body),{expected_version:1});
    assert.equal(mutations[1].replayUnauthorized,false);
    const empty = new CatalogRepository('org',async()=>({items:[],total:0,page:1,page_size:25}));
    assert.equal((await empty.list()).total,0);
    for (const status of [401,403,404,422,500]) {
        const error = new http.ApiError(status);
        await assert.rejects(new CatalogRepository('org',async()=>{throw error;}).list(),failure=>failure===error);
        assert.ok(catalogError(error).length>10);
    }
    assert.match(catalogError(new Error('Falha de rede')),/Falha de rede/);
    assert.equal(productCategory('ALIMENTO_SECO_INDUSTRIALIZADO'),'Alimento seco industrializado');
    assert.equal(productCategory('FUTURE_CATEGORY'),'Future category');
    assert.equal(catalogCategories([{...product,category:'ALIMENTO_SECO_INDUSTRIALIZADO'},{...product,category:'ALIMENTO_SECO_INDUSTRIALIZADO'}]).join(','),'ALIMENTO_SECO_INDUSTRIALIZADO');
    assert.equal(publicationLabel('PUBLISHED'),'Publicado');
    assert.equal(publicationLabel('FUTURE_STATE'),'FUTURE_STATE');
    console.log('Catalog API: pagination, encoded search, organization, details, empty, auth/network errors and labels passed.');
})().catch(error=>{console.error(error);process.exitCode=1;});

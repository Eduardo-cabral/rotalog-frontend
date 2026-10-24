const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
function load(path,dependencies={}) {
    const module={exports:{}};
    vm.runInNewContext(ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module,exports:module.exports,require:id=>dependencies[id],URLSearchParams,Error});
    return module.exports;
}
const http=load('src/shared/api/http.ts',{'./config':{apiUrl:''}});
const {OffersRepository,eligibleWarehouse,offerPrice,minimumQuantity,offerError}=load('src/features/products/api/offersRepository.ts',{'../../services/apiAuth.service':{},'../../../shared/api/http':http});
const warehouse={id:'warehouse',supplier_organization_id:'org',is_active:true,geocoding_state:'CONFIRMED'};
const product={id:'product',publication_state:'PUBLISHED'};
const offer={id:'offer',supplier_organization_id:'org',is_active:true,version:7};
(async()=>{
    assert.equal(offerPrice('12,30'),'12.30');assert.equal(offerPrice('0'),'0.00');assert.equal(offerPrice('999999999999.99'),'999999999999.99');
    for(const value of ['-1','1.234','1e3','1.000,00','1000000000000','NaN'])assert.throws(()=>offerPrice(value));
    for(const value of ['0','1.5','-1','2147483648','Infinity'])assert.throws(()=>minimumQuantity(value));
    assert.equal(minimumQuantity('2147483647'),2147483647);
    assert.equal(eligibleWarehouse(warehouse,'org'),true);
    for(const change of [{supplier_organization_id:'other'},{is_active:false},{geocoding_state:'PENDING'}])assert.equal(eligibleWarehouse({...warehouse,...change},'org'),false);
    const calls=[];
    const repository=new OffersRepository('org',async(path,options,replayUnauthorized)=>{
        calls.push({path,options,replayUnauthorized});
        if(options.method==='POST')return offer;
        return path.includes('/warehouses')?{items:[warehouse],total:1,page:1,page_size:100}:{items:[offer],total:1,page:1,page_size:25};
    });
    assert.equal((await repository.warehouses()).length,1);
    await repository.offers();
    assert.equal(new URL(calls[1].path,'http://local').searchParams.get('supplier_id'),'org');
    await repository.create(product,warehouse,'12,30','3');
    const body=JSON.parse(calls.at(-1).options.body);
    assert.deepEqual(body,{product_id:'product',warehouse_id:'warehouse',unit_price:'12.30',currency:'BRL',minimum_order_quantity:3});
    assert.equal(calls.at(-1).path,'/api/v1/suppliers/org/offers');
    assert.ok(calls.filter(call=>call.options.method==='POST').every(call=>call.replayUnauthorized===false));
    await repository.update(offer,'15.20','4');
    assert.deepEqual(JSON.parse(calls.at(-1).options.body),{expected_version:7,unit_price:'15.20',currency:'BRL',minimum_order_quantity:4});
    await repository.pause(offer);assert.deepEqual(JSON.parse(calls.at(-1).options.body),{expected_version:7});
    assert.ok(calls.every(call=>call.options.headers['X-Organization-Id']==='org'));
    assert.throws(()=>repository.create({...product,publication_state:'DRAFT'},warehouse,'1','1'));
    assert.throws(()=>repository.create(product,{...warehouse,is_active:false},'1','1'));
    assert.throws(()=>repository.update({...offer,supplier_organization_id:'other'},'1','1'));
    const foreign=new OffersRepository('org',async()=>({items:[{...offer,...warehouse,supplier_organization_id:'other'}],total:1,page:1,page_size:100}));
    await assert.rejects(foreign.warehouses(),/outra organização/);await assert.rejects(foreign.offers(),/outra organização/);
    let attempts=0;
    const uncertain=new OffersRepository('org',async()=>{attempts++;throw new Error('Falha de rede');});
    await assert.rejects(uncertain.create(product,warehouse,'1','1'),/rede/);
    assert.equal(uncertain.creationNeedsReview(),true);
    await assert.rejects(uncertain.create(product,warehouse,'1','1'),/Confira/);assert.equal(attempts,1);
    const conflict=new OffersRepository('org',async()=>{throw new http.ApiError(409);});
    await assert.rejects(conflict.update(offer,'1','1'),error=>error.status===409);
    assert.match(offerError(new http.ApiError(409)),/versão/);
    let pageCalls=0;
    const paginated=new OffersRepository('org',async()=>{pageCalls++;return {items:pageCalls===1?Array.from({length:100},(_,i)=>({...warehouse,id:String(i)})):[{...warehouse,id:'last'}],total:101,page:pageCalls,page_size:100};});
    assert.equal((await paginated.warehouses()).length,101);assert.equal(pageCalls,2);
    const {warehouseValues,warehouseError}=load('src/features/products/api/offersRepository.ts',{'../../services/apiAuth.service':{},'../../../shared/api/http':http});
    const input={name:' Central ',address:' Rua A, 10 ',opening_hours:' 08h-18h ',region:' Manaus '};
    const clean=JSON.parse(JSON.stringify(warehouseValues(input)));
    assert.deepEqual(clean,{name:'Central',address:'Rua A, 10',opening_hours:'08h-18h',region:'Manaus'});
    for(const [key,min,max] of [['name',1,200],['address',5,500],['opening_hours',1,200],['region',1,100]]) {
        assert.throws(()=>warehouseValues({...clean,[key]:' '.repeat(min)}));
        assert.throws(()=>warehouseValues({...clean,[key]:'a'.repeat(max+1)}));
        assert.equal(warehouseValues({...clean,[key]:'a'.repeat(max)})[key].length,max);
    }
    let warehouseCalls=0,release;
    const warehouseRepo=new OffersRepository('authenticated-org',async(path,options,replayUnauthorized)=>{
        warehouseCalls++;
        assert.equal(path,'/api/v1/suppliers/authenticated-org/warehouses');
        assert.equal(replayUnauthorized,false);
        assert.equal(options.headers['X-Organization-Id'],'authenticated-org');
        assert.deepEqual(JSON.parse(options.body),clean);
        await new Promise(resolve=>{release=resolve;});
        return {...warehouse,id:'new',supplier_organization_id:'authenticated-org',geocoding_state:'PENDING'};
    });
    const creation=warehouseRepo.createWarehouse(input);
    await assert.rejects(warehouseRepo.createWarehouse(input),/andamento/);
    release();
    const created=await creation;
    assert.equal(created.geocoding_state,'PENDING');assert.equal(warehouseCalls,1);
    assert.equal(eligibleWarehouse(created,'authenticated-org'),false);
    let attemptsWarehouse=0;
    const uncertainWarehouse=new OffersRepository('org',async()=>{attemptsWarehouse++;throw new Error('Network failure');});
    await assert.rejects(uncertainWarehouse.createWarehouse(clean),/Network/);
    await assert.rejects(uncertainWarehouse.createWarehouse(clean),/Confira/);
    assert.equal(attemptsWarehouse,1);assert.equal(uncertainWarehouse.warehouseNeedsReview(),true);
    uncertainWarehouse.acknowledgeWarehouseReview();assert.equal(uncertainWarehouse.warehouseNeedsReview(),false);
    const foreignWarehouse=new OffersRepository('org',async()=>({...warehouse,supplier_organization_id:'other'}));
    await assert.rejects(foreignWarehouse.createWarehouse(clean),/outra organização/);
    assert.equal(foreignWarehouse.warehouseNeedsReview(),true);
    await assert.rejects(new OffersRepository('',async()=>{throw new Error('Unexpected transport');}).createWarehouse(clean),/Organização/);
    for(const status of [401,403,404,409,422,500]) {
        const failed=new OffersRepository('org',async()=>{throw new http.ApiError(status);});
        await assert.rejects(failed.createWarehouse(clean),error=>error.status===status);
        assert.equal(failed.warehouseNeedsReview(),status>=500);
        assert.ok(warehouseError(new http.ApiError(status)).length>0);
    }
    console.log('Offers and warehouses API: validation, isolation, eligibility, concurrency, errors and uncertain writes passed.');
})().catch(error=>{console.error(error);process.exitCode=1;});

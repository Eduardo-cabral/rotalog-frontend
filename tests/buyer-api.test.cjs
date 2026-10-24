const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const ts=require('typescript');
function load(path,dependencies={}){const module={exports:{}};const code=ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;vm.runInNewContext(code,{module,exports:module.exports,require:id=>dependencies[id],URLSearchParams,BigInt,Intl});return module.exports;}
class ApiError extends Error{constructor(status,code){super();this.status=status;this.code=code;}}
const adapter=load('src/features/orders/api/orderAdapter.ts');
const {BuyerRepository,validateCart,money,buyerError}=load('src/features/buyer/api/buyerRepository.ts',{'../../services/apiAuth.service':{},'../../../shared/api/http':{ApiError},'../../orders/api/orderAdapter':adapter});
const offer={id:'offer',product_name:'Arroz',supplier_organization_id:'supplier',warehouse_id:'warehouse',minimum_order_quantity:2,available_quantity:20,is_active:true};
assert.doesNotThrow(()=>validateCart([offer],[2]));
for(const quantity of [0,1,21,1.5,NaN,2147483648])assert.throws(()=>validateCart([offer],[quantity]));
assert.throws(()=>validateCart([],[]));assert.throws(()=>validateCart([offer,offer],[2,2]));
assert.throws(()=>validateCart([offer,{...offer,id:'other',warehouse_id:'other'}],[2,2]),/depósito/);
assert.throws(()=>validateCart([offer,{...offer,id:'other',supplier_organization_id:'other'}],[2,2]));
assert.throws(()=>validateCart([{...offer,is_active:false}],[2]));
assert.equal(money('9007199254740993.01'),'R$ 9.007.199.254.740.993,01');
assert.match(buyerError(new ApiError(409,'VERSION_CONFLICT')),/atualizados/);
(async()=>{
 const calls=[];
 const repository=new BuyerRepository('buyer',async(path,options,replay)=>{calls.push({path,options,replay});return path.includes('/offers?')?{items:[offer],total:1,page:1,page_size:25}:path.includes('/confirm-payment')?{purchase_id:'purchase'}:{id:'checkout'};});
 assert.equal((await repository.offers('product /1')).length,1);
 assert.match(calls[0].path,/product_id=product%20%2F1/);assert.match(calls[0].path,/page_size=25/);assert.equal(calls[0].options.headers['X-Organization-Id'],'buyer');
 const input={items:[{offer_id:'offer',quantity:2}],capacity_slot_id:'slot',accepts_partial:false};
 await repository.create(input,'same-key');await repository.create(input,'same-key');
 assert.equal(calls[1].options.body,calls[2].options.body);assert.equal(calls[1].options.headers['Idempotency-Key'],calls[2].options.headers['Idempotency-Key']);assert.equal(calls[1].replay,false);
 await repository.pay('checkout',3,'payment-key');assert.deepEqual(JSON.parse(calls.at(-1).options.body),{expected_version:3});assert.equal(calls.at(-1).replay,false);
 const invalidPaymentResponse=new BuyerRepository('buyer',async()=>({payment_id:'without-purchase-id'}));await assert.rejects(invalidPaymentResponse.pay('checkout',3,'payment-key'),/identificador da compra/);
 const failing=new BuyerRepository('buyer',async()=>{throw new Error('uncertain');});await assert.rejects(failing.create(input,'key'),/uncertain/);
 const invalidPage=new BuyerRepository('buyer',async()=>({items:[offer],total:1,page:1,page_size:100}));await assert.rejects(invalidPage.offers(),/consulta mudou/);
 const foreignPurchase=new BuyerRepository('buyer',async()=>({items:[{id:'foreign',supplier_orders:[{buyer_organization_id:'other'}]}],total:1,page:1,page_size:25}));await assert.rejects(foreignPurchase.purchases(1),error=>error.status===403);
 assert.throws(()=>new BuyerRepository('').get('/products'),/Organização/);
 console.log('Buyer API: official money, quantities, single origin, scope headers, pagination, idempotency and no automatic commercial replay passed.');
})().catch(error=>{console.error(error);process.exitCode=1;});

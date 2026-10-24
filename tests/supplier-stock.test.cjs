const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const { indexedDB } = require('fake-indexeddb');
const storage = new Map();
let failWrite = false;
const localStorage = { getItem: key => storage.get(key) ?? null, setItem: (key, value) => { if (failWrite) throw new Error('Storage full'); storage.set(key, value); } };
let queue = Promise.resolve();
const navigator = { locks: { request: (_name, callback) => { const result = queue.then(callback); queue = result.catch(() => {}); return result; } } };
function load(path, dependencies = {}) {
    const module = { exports: {} };
    const code = ts.transpileModule(fs.readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    vm.runInNewContext(code, { module, exports: module.exports, require: id => dependencies[id] ?? require(id), localStorage, navigator, indexedDB, window: { dispatchEvent() {} }, Event: class {} });
    return module.exports;
}
const productMocks = load('src/features/products/mocks/products.mock.ts');
const orderMocks = load('src/features/orders/mocks/orders.mock.ts');
const orderAdapter = load('src/features/orders/api/orderAdapter.ts');
const { getOrderDisplayIds } = load('src/features/orders/utils/orderDisplayId.ts', { '../api/orderAdapter': orderAdapter });
const stock = load('src/features/inventory/services/stockReservation.ts');
const history = load('src/features/inventory/services/stockMovements.ts');
const products = load('src/features/products/services/supplierProducts.service.ts', { '../mocks/products.mock': productMocks, '../../inventory/services/stockMovements': load('src/features/inventory/services/stockMovements.ts') });
const orders = load('src/features/orders/services/supplierOrders.service.ts', {
    '../../inventory/services/stockMovements': load('src/features/inventory/services/stockMovements.ts'),
    './orderWriteLock': load('src/features/orders/services/orderWriteLock.ts'),
    '../mocks/orders.mock': orderMocks,
    '../../inventory/services/stockReservation': stock,
    '../../products/services/supplierProducts.service': products,
});
const generator = load('src/features/orders/services/testOrderItems.ts', {
    '../../inventory/services/stockReservation': stock,
    '../../products/services/supplierProducts.service': products,
});
const org = 'fornecedor-001';
const makeOrder = (id, items, organizationId = org) => ({ id, organizationId, customer: 'Teste', date: '2026-10-19', total: 10, items: items?.length ?? 0, status: 'Pendente', commercialStatus: 'Aguardando aceite', custodyStatus: 'Aguardando separação', orderItems: items });
const item = (productId, quantity) => ({ productId, productName: 'Teste', quantity, unitPrice: 10 });
const key = 'rotalog:supplier-orders:v1';
function seed(...extra) { storage.clear(); orders.saveSupplierOrders([...orderMocks.ordersMock, ...extra]); }
async function run() {
    const displayOrders = [
        makeOrder('TESTE-001', []),
        makeOrder('TESTE-01234567-89ab-cdef-0123-456789abcdef', []),
        makeOrder('TESTE-0123456789abcdef0123456789abcdef', []),
    ];
    const displaySnapshot = JSON.stringify(displayOrders);
    const displayIds = getOrderDisplayIds(displayOrders);
    assert.equal(displayIds.get(displayOrders[0].id), 'TESTE-001');
    assert.equal(displayIds.get(displayOrders[1].id), 'TESTE-002');
    assert.equal(displayIds.get(displayOrders[2].id), 'TESTE-003');
    assert.equal(getOrderDisplayIds([...displayOrders, makeOrder('TESTE-fedcba9876543210fedcba9876543210', [])]).get(displayOrders[2].id), 'TESTE-003');
    assert.equal(JSON.stringify(displayOrders), displaySnapshot, 'display formatting must not mutate persisted IDs');
    const legacyUuid = makeOrder('01234567-89ab-cdef-0123-456789abcdef', []);
    assert.equal(getOrderDisplayIds([legacyUuid]).get(legacyUuid.id), '01234567…89abcdef', 'full UUIDs are shortened for presentation');
    const reversedIds = getOrderDisplayIds([...displayOrders].reverse());
    for (const order of displayOrders) assert.equal(reversedIds.get(order.id), displayIds.get(order.id), 'sorting must not change visual IDs');
    const unusual = makeOrder('TESTE-3e6968b543f1c00328015ea2578537', []);
    const withOldOrder = getOrderDisplayIds([unusual, ...displayOrders]);
    assert.match(withOldOrder.get(unusual.id), /^TESTE-\d{3,}$/);
    for (const order of displayOrders) assert.equal(withOldOrder.get(order.id), displayIds.get(order.id));
    assert.equal(getOrderDisplayIds([unusual]).get(unusual.id), withOldOrder.get(unusual.id), 'filtered subsets retain assigned labels');
    assert.equal(new Set(withOldOrder.values()).size, withOldOrder.size, 'legacy and generated IDs cannot collide');
    // Reproduz o ambiente HTTP local: Web Locks não está disponível.
    navigator.locks = undefined;
    seed();
    assert.equal(history.collectStockMovements(org, orders.readSupplierOrders(), products.getSupplierProducts(org)).length, 0, 'legacy reserves and defaults do not create retroactive history');
    const productsBeforeTest = JSON.stringify(products.getSupplierProducts(org));
    const savedBeforeTest = storage.get(key);
    const generatedItems = generator.getTestOrderItems(org, orders.getSupplierOrders());
    assert.equal(storage.get(key), savedBeforeTest, 'generation must not reserve');
    for (const line of generatedItems) {
        const catalogProduct = products.getSupplierProducts(org).find(p => p.id === line.productId);
        assert.ok(catalogProduct);
        assert.equal(line.productName, catalogProduct.name);
        assert.equal(line.unitPrice, catalogProduct.price);
        assert.ok(line.quantity > 0 && line.quantity <= catalogProduct.stock);
    }
    const testOrder = makeOrder('GENERATED', generatedItems);
    testOrder.total = generatedItems.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0);
    orders.saveSupplierOrders([...orders.getSupplierOrders(), testOrder]);
    assert.equal(orders.getSupplierOrders().find(o => o.id === 'GENERATED').total, testOrder.total);
    const afterGenerated = await orders.localSupplierOrderAcceptanceService.accept(org, testOrder.id);
    const movements = history.collectStockMovements(org, orders.readSupplierOrders(), products.getSupplierProducts(org));
    assert.equal(movements.length, generatedItems.length);
    assert.ok(movements.every(movement => movement.type === 'reservation' && movement.orderId === testOrder.id && movement.source === 'order-acceptance'));
    for (const line of generatedItems) {
        const catalogProduct = products.getSupplierProducts(org).find(p => p.id === line.productId);
        const balance = stock.getStockBalance(catalogProduct, afterGenerated);
        assert.equal(balance.reserved, line.quantity);
        assert.equal(balance.available, catalogProduct.stock - line.quantity);
        assert.equal(balance.physical, catalogProduct.stock);
        assert.equal(movements.find(movement => movement.productId === line.productId).quantity, balance.reserved);
    }
    await assert.rejects(() => orders.localSupplierOrderAcceptanceService.accept(org, testOrder.id));
    assert.equal(history.collectStockMovements(org, orders.readSupplierOrders(), products.getSupplierProducts(org)).length, movements.length, 'retry cannot duplicate events');
    assert.equal(JSON.stringify(products.getSupplierProducts(org)), productsBeforeTest);
    const allProducts = products.getSupplierProducts(org);
    const allReserved = { ...makeOrder('ALL-RESERVED', []), commercialStatus: 'Aceito', stockReservation: { reservedAt: new Date().toISOString(), items: allProducts.filter(p => p.stock > 0).map(p => ({ productId: p.id, quantity: p.stock })) } };
    assert.throws(() => generator.getTestOrderItems(org, [allReserved]));
    assert.throws(() => generator.getTestOrderItems('unknown-organization', []));
    const fractional = { ...allReserved, stockReservation: { ...allReserved.stockReservation, items: allReserved.stockReservation.items.map(line => ({ ...line, quantity: line.productId === 'PROD-001' ? line.quantity - 0.25 : line.quantity })) } };
    const fractionalItems = generator.getTestOrderItems(org, [fractional]);
    assert.equal(fractionalItems.length, 1);
    assert.equal(fractionalItems[0].productId, 'PROD-001');
    assert.equal(fractionalItems[0].quantity, 0.25);
    const otherItems = generator.getTestOrderItems('fornecedor-002', []);
    assert.ok(otherItems.every(line => products.getSupplierProducts('fornecedor-002').some(p => p.id === line.productId)));
    const originalProducts = JSON.stringify(products.getSupplierProducts(org));
    seed({ ...makeOrder('OK', [item('PROD-001', 2), item('PROD-002', 3)]), financialStatus: 'Pendente' });
    const accepted = await orders.localSupplierOrderAcceptanceService.accept(org, 'OK');
    assert.equal(accepted.find(o => o.id === 'OK').commercialStatus, 'Aceito');
    assert.equal(accepted.find(o => o.id === 'OK').financialStatus, 'Pendente');
    assert.equal(accepted.find(o => o.id === 'OK').custodyStatus, 'Aguardando separação');
    const product = products.getSupplierProducts(org).find(p => p.id === 'PROD-001');
    const balance = stock.getStockBalance(product, accepted);
    assert.equal(balance.physical, 120); assert.equal(balance.reserved, 2); assert.equal(balance.available, 118);
    assert.equal(JSON.stringify(products.getSupplierProducts(org)), originalProducts);
    assert.ok(!accepted.find(o => o.id === 'PED-002').stockReservation, 'no retroactive reservation');
    const separating = orders.changeSupplierOrderOperationalStatus(accepted, org, 'OK', 'start-separation');
    const ready = orders.changeSupplierOrderOperationalStatus(separating, org, 'OK', 'mark-ready');
    for (const state of [separating, ready]) {
        assert.equal(state.find(o => o.id === 'OK').commercialStatus, 'Aceito');
        assert.equal(state.find(o => o.id === 'OK').financialStatus, 'Pendente');
    }
    assert.equal(separating.find(o => o.id === 'OK').custodyStatus, 'Em separação');
    assert.equal(ready.find(o => o.id === 'OK').custodyStatus, 'Pronto para coleta');
    const toReject = { ...makeOrder('REJECT-STATES', []), financialStatus: 'Aprovado' };
    const rejectedStates = orders.changeSupplierOrderStatus([toReject], org, toReject.id, 'reject', { reason: 'Outro motivo', justification: 'Sem alteração financeira ou de custódia' })[0];
    assert.equal(rejectedStates.commercialStatus, 'Recusado');
    assert.equal(rejectedStates.financialStatus, 'Aprovado');
    assert.equal(rejectedStates.custodyStatus, 'Aguardando separação');
    assert.equal(rejectedStates.status, 'Pendente');
    orders.saveSupplierOrders(ready);
    assert.equal(stock.getStockBalance(product, orders.getSupplierOrders()).reserved, 2);
    await assert.rejects(() => orders.localSupplierOrderAcceptanceService.accept(org, 'OK'));
    assert.equal(stock.getStockBalance(product, orders.getSupplierOrders()).reserved, 2);
    for (const [name, items] of [
        ['insufficient', [item('PROD-001', 1), item('PROD-002', 999)]],
        ['missing', [item('MISSING', 1)]],
        ['foreign product', [item('PROD-101', 1)]],
        ['empty', []], ['legacy without items', undefined],
        ['negative', [item('PROD-001', -1)]],
        ['invalid', [item('PROD-001', NaN)]],
        ['duplicate lines exceed stock', [item('PROD-002', 5), item('PROD-002', 5)]],
    ]) {
        seed(makeOrder('BAD', items));
        const before = storage.get(key);
        await assert.rejects(() => orders.localSupplierOrderAcceptanceService.accept(org, 'BAD'), name);
        assert.equal(storage.get(key), before, name + ' must not write partially');
        assert.equal(history.collectStockMovements(org, orders.readSupplierOrders(), products.getSupplierProducts(org)).length, 0, name + ' must not record movements');
    }
    seed(makeOrder('FOREIGN', [item('PROD-101', 1)], 'fornecedor-002'));
    const beforeForeign = storage.get(key);
    await assert.rejects(() => orders.localSupplierOrderAcceptanceService.accept(org, 'FOREIGN'));
    assert.equal(storage.get(key), beforeForeign);
    seed(makeOrder('ORG1', [item('PROD-001', 2)]), makeOrder('ORG2', [item('PROD-001', 1)], 'fornecedor-002'));
    products.createSupplierProducts('fornecedor-002', [{ id: 'PROD-001', name: 'Outro fornecedor', category: 'Teste', unit: 'kg', stock: 10, price: 1 }]);
    await orders.localSupplierOrderAcceptanceService.accept(org, 'ORG1');
    await orders.localSupplierOrderAcceptanceService.accept('fornecedor-002', 'ORG2');
    const other = products.getSupplierProducts('fornecedor-002').find(p => p.id === 'PROD-001');
    assert.equal(stock.getStockBalance(other, orders.getSupplierOrders()).reserved, 1);
    assert.equal(stock.getStockBalance(product, orders.getSupplierOrders()).reserved, 2);
    assert.ok(history.collectStockMovements(org, orders.readSupplierOrders(), products.getSupplierProducts(org)).every(item => item.organizationId === org));
    assert.ok(history.collectStockMovements('fornecedor-002', orders.readSupplierOrders(), products.getSupplierProducts('fornecedor-002')).every(item => item.organizationId === 'fornecedor-002'));
    seed(makeOrder('A', [item('PROD-002', 6)]), makeOrder('B', [item('PROD-002', 6)]));
    const results = await Promise.allSettled([
        orders.localSupplierOrderAcceptanceService.accept(org, 'A'),
        orders.localSupplierOrderAcceptanceService.accept(org, 'B'),
    ]);
    assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
    const sand = products.getSupplierProducts(org).find(p => p.id === 'PROD-002');
    assert.equal(stock.getStockBalance(sand, orders.getSupplierOrders()).available, 2);
    assert.equal(history.collectStockMovements(org, orders.readSupplierOrders(), products.getSupplierProducts(org)).length, 1, 'concurrent insufficient stock produces a single event');
    seed(makeOrder('SAME', [item('PROD-001', 2)]));
    const stale = orders.getSupplierOrders();
    const same = await Promise.allSettled([orders.localSupplierOrderAcceptanceService.accept(org, 'SAME'), orders.localSupplierOrderAcceptanceService.accept(org, 'SAME')]);
    assert.equal(same.filter(result => result.status === 'fulfilled').length, 1);
    assert.throws(() => orders.saveSupplierOrders(stale), 'stale snapshot cannot erase reservation');
    assert.equal(history.collectStockMovements(org, orders.readSupplierOrders(), products.getSupplierProducts(org)).length, 1);
    // Abortar o mutex após o commit não pode reportar falha nem desfazer só o evento.
    seed(makeOrder('COMMITTED', [item('PROD-001', 2)]));
    const { IDBObjectStore } = require('fake-indexeddb');
    const originalGet = IDBObjectStore.prototype.get;
    IDBObjectStore.prototype.get = function (...args) {
        const request = originalGet.apply(this, args);
        if (this.name === 'writes') request.addEventListener('success', () => queueMicrotask(() => this.transaction.abort()));
        return request;
    };
    try {
        await orders.localSupplierOrderAcceptanceService.accept(org, 'COMMITTED');
        assert.equal(history.collectStockMovements(org, orders.readSupplierOrders(), products.getSupplierProducts(org)).length, 1);
    } finally { IDBObjectStore.prototype.get = originalGet; }
    seed(makeOrder('FAIL', [item('PROD-001', 2)]));
    const before = storage.get(key); failWrite = true;
    await assert.rejects(() => orders.localSupplierOrderAcceptanceService.accept(org, 'FAIL'));
    failWrite = false; assert.equal(storage.get(key), before);
    assert.equal(history.collectStockMovements(org, orders.readSupplierOrders(), products.getSupplierProducts(org)).length, 0, 'failed storage write saves neither reservation nor event');
    const savedMovements = JSON.parse(JSON.stringify(movements));
    const dates = ['2026-10-20T10:00:00.000Z', '2026-10-20T12:00:00.000Z'];
    const sampleOrders = savedMovements.map((movement, index) => ({ ...makeOrder(`HISTORY-${index}`, [item(movement.productId, movement.quantity)]), commercialStatus: 'Aceito', stockReservation: { reservedAt: dates[index], items: [{ productId: movement.productId, quantity: movement.quantity }], movements: [{ ...movement, id: `EVENT-${index}`, orderId: `HISTORY-${index}`, occurredAt: dates[index] }] } }));
    const sorted = history.collectStockMovements(org, sampleOrders, []);
    assert.equal(sorted[0].orderId, 'HISTORY-1');
    assert.equal(history.filterStockMovements(sorted, 'TESTE-001', 'reservation', new Map([['HISTORY-1', 'TESTE-001']])).length, 1);
    assert.equal(history.filterStockMovements(sorted, sorted[0].productId, 'reservation', new Map()).length, 1);
    assert.equal(history.filterStockMovements(sorted, '', 'initial-stock', new Map()).length, 0);
    const corrupt = JSON.parse(JSON.stringify(sampleOrders));
    corrupt[0].stockReservation.movements[0].quantity += 1;
    assert.throws(() => history.collectStockMovements(org, corrupt, []), /inconsistente/);
    storage.set(key, '{invalid');
    await assert.rejects(() => orders.localSupplierOrderAcceptanceService.accept(org, 'FAIL'));
    assert.equal(storage.get(key), '{invalid');
    console.log('Stock reservation: sufficient/insufficient stock, invalid/missing items, duplicate reservation, organization isolation, atomic writes, serialized acceptance, physical stock and legacy compatibility OK');
}
run().catch(error => { console.error(error); process.exitCode = 1; });

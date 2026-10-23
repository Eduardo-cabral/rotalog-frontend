const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function load(path, dependencies = {}) {
    const module = { exports: {} };
    const code = ts.transpileModule(fs.readFileSync(path, 'utf8'), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    vm.runInNewContext(code, {
        module,
        exports: module.exports,
        require: id => dependencies[id],
        URLSearchParams,
        Error,
        Number,
        Set,
    });
    return module.exports;
}

const http = load('src/shared/api/http.ts', { './config': { apiUrl: '' } });
const productPages = [
    { items: [{ id: 'product-1' }], total: 2, page: 1, page_size: 25 },
    { items: [{ id: 'product-2' }], total: 2, page: 2, page_size: 25 },
];
const { BuyerReadRepository } = load('src/features/buyer/api/BuyerReadRepository.ts', {
    '../../../shared/api/http': http,
    '../../services/apiAuth.service': { authenticatedRequest: async () => {} },
    '../../orders/api/contracts': {},
    '../../products/api/catalogRepository': {
        CatalogRepository: class {
            async list(page) { return productPages[page - 1]; }
            async detail(id) { return { id }; }
        },
    },
});

(async () => {
    const calls = [];
    const purchase = {
        id: 'purchase/id',
        checkout_id: 'checkout',
        state: 'CONFIRMED',
        is_synthetic: true,
        supplier_orders: [{ id: 'order', buyer_organization_id: 'buyer-org' }],
    };
    const repository = new BuyerReadRepository('buyer-org', async (path, options = {}) => {
        calls.push({ path, options });
        if (path.startsWith('/api/v1/offers')) {
            const query = new URL(path, 'http://localhost').searchParams;
            assert.equal(query.get('page'), '1');
            assert.equal(query.get('page_size'), '25');
            assert.equal(query.get('product_id'), 'product-1');
            return { items: [{ id: 'offer', unit_price: '149.90' }], total: 1, page: 1, page_size: 25 };
        }
        if (path.includes('/purchases/')) return purchase;
        return { items: [purchase], total: 1, page: 1, page_size: 25 };
    });

    const products = await repository.products();
    assert.equal(products.length, 2);
    assert.equal(products[0].id, 'product-1');
    assert.equal(products[1].id, 'product-2');
    const offers = await repository.offers('product-1');
    assert.equal(offers[0].unit_price, '149.90');
    const loaded = await repository.purchase('purchase/id');
    assert.equal(loaded.id, purchase.id);
    assert.equal(calls[0].options.headers['X-Organization-Id'], 'buyer-org');
    assert.equal(calls[0].options.method, undefined);
    assert.ok(calls.every(call => !call.options.method || call.options.method === 'GET'));
    assert.ok(calls.some(call => call.path === '/api/v1/purchases/purchase%2Fid'));

    const foreignPurchase = { ...purchase, supplier_orders: [{ buyer_organization_id: 'another-org' }] };
    const foreignRepository = new BuyerReadRepository('buyer-org', async () => foreignPurchase);
    await assert.rejects(foreignRepository.purchase('purchase/id'), error => error.status === 403);
    await assert.rejects(new BuyerReadRepository('', async () => ({})).offers(), /Organização/);
    console.log('Buyer API: catalog pagination, offer prices, organization scope, purchase detail, and read-only requests passed.');
})().catch(error => {
    console.error(error);
    process.exitCode = 1;
});

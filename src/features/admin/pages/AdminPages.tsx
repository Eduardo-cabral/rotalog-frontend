import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Link, useOutletContext } from "react-router-dom";
import { useAuth } from "../../auth/hooks/useAuth";
import { PasswordChangeDialog } from "../../account/components/PasswordChangeDialog";
import { authMode } from "../../../shared/api/config";
import { PageHeader } from "../../../shared/components/PageHeader";
import {
    CatalogRepository,
    catalogCategories,
    catalogError,
    catalogMutationError,
    productCategory,
    publicationLabel,
    type CatalogPage,
    type ProductCreate,
} from "../../products/api/catalogRepository";
import { ApiCatalogDetails } from "../../products/api/ApiCatalogDetails";
import { ProductCategoryFilter } from "../../../shared/components/ProductCategoryFilter";
import { ProductImage } from "../../../shared/components/ProductImage";
import type { AdminWorkflow } from "../layout/AdminLayout";

const primaryButton = "inline-flex min-h-10 items-center justify-center rounded-lg bg-blue-800 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-900 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700";
const secondaryButton = "inline-flex min-h-10 items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700";
const fieldClass = "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 focus:border-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100";
const cardClass = "rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6";

export function AdminOverview() {
    const { user } = useAuth();
    return <div className="space-y-6">
        <PageHeader title={`Olá, ${user?.name ?? "administrador"}`} subtitle="Gerencie a identificação dos produtos do catálogo RotaLog."/>
        <section className="overflow-hidden rounded-3xl bg-gradient-to-br from-[#102957] via-blue-900 to-blue-700 p-6 text-white shadow-sm sm:p-8">
            <div className="max-w-3xl">
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-blue-200">Área administrativa</p>
                <h2 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">Catálogo canônico</h2>
                <p className="mt-3 text-sm leading-6 text-blue-100 sm:text-base">Cadastre informações de identificação e embalagem. Preços, ofertas e estoque são gerenciados pelos fornecedores.</p>
                <div className="mt-6 flex flex-wrap gap-3">
                    <Link className="inline-flex min-h-11 items-center justify-center rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-blue-900 transition hover:bg-blue-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white" to="/admin/products">Ver produtos publicados</Link>
                    <Link className="inline-flex min-h-11 items-center justify-center rounded-lg border border-white/40 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white" to="/admin/products/new">Cadastrar produto</Link>
                </div>
            </div>
        </section>
        <div className="grid gap-4 md:grid-cols-2">
            <article className={`${cardClass} transition hover:border-blue-200 hover:shadow-md`}><span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-lg font-bold text-blue-800" aria-hidden="true">01</span><h3 className="mt-4 font-semibold text-slate-900">Consultar produtos</h3><p className="mt-2 text-sm leading-6 text-slate-600">Pesquise o catálogo publicado e consulte os dados de cada produto.</p><Link className="mt-4 inline-flex text-sm font-semibold text-blue-800 hover:underline" to="/admin/products">Abrir catálogo<span aria-hidden="true" className="ml-1">→</span></Link></article>
            <article className={`${cardClass} transition hover:border-blue-200 hover:shadow-md`}><span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-lg font-bold text-emerald-800" aria-hidden="true">02</span><h3 className="mt-4 font-semibold text-slate-900">Cadastrar produto</h3><p className="mt-2 text-sm leading-6 text-slate-600">Crie um rascunho e publique-o em uma etapa separada, após a revisão.</p><Link className="mt-4 inline-flex text-sm font-semibold text-blue-800 hover:underline" to="/admin/products/new">Iniciar cadastro<span aria-hidden="true" className="ml-1">→</span></Link></article>
        </div>
    </div>;
}

export function AdminCatalog() {
    const { user } = useAuth();
    const repository = useMemo(() => new CatalogRepository(user?.organization_id ?? ""), [user?.organization_id]);
    const [search, setSearch] = useState("");
    const [query, setQuery] = useState({ page: 1, search: "" });
    const [resultState, setResultState] = useState<{ key: string; data: CatalogPage } | null>(null);
    const [errorState, setErrorState] = useState<{ key: string; message: string } | null>(null);
    const [attempt, setAttempt] = useState(0);
    const [selected, setSelected] = useState<string | null>(null);
    const [category, setCategory] = useState("");
    const requestKey = `${user?.organization_id ?? ""}:${query.page}:${query.search}`;
    const result = resultState?.key === requestKey ? resultState.data : null;
    const error = errorState?.key === requestKey ? errorState.message : "";

    useEffect(() => {
        let active = true;
        void repository.list(query.page, query.search)
            .then(data => { if (active) setResultState({ key: requestKey, data }); })
            .catch(failure => { if (active) setErrorState({ key: requestKey, message: catalogError(failure) }); });
        return () => { active = false; };
    }, [repository, query, requestKey, attempt]);

    function retry() {
        setResultState(null);
        setErrorState(null);
        setAttempt(value => value + 1);
    }
    function changeQuery(page: number, name: string) {
        setResultState(null);
        setErrorState(null);
        setCategory("");
        setQuery({ page, search: name });
    }
    const categories = result ? catalogCategories(result.items) : [];
    const visibleProducts = result?.items.filter(product => !category || product.category === category) ?? [];

    return <div className="space-y-5">
        <PageHeader title="Produtos publicados" subtitle="Consulte e organize os produtos disponíveis no catálogo canônico." actions={<Link className={primaryButton} to="/admin/products/new">Cadastrar produto</Link>}/>
        <section className={`${cardClass} space-y-5`} aria-label="Catálogo de produtos publicados">
            <div className="flex flex-wrap items-end justify-between gap-4">
                <div><h2 className="text-lg font-bold text-slate-900">Catálogo publicado</h2><p className="mt-1 text-sm text-slate-500">Pesquise produtos e consulte seus dados comerciais e de embalagem.</p></div>
                {result && <span className="rounded-full bg-blue-50 px-3 py-1.5 text-sm font-semibold text-blue-800">{result.total} produto(s)</span>}
            </div>
            <form className="flex flex-wrap items-end gap-3" onSubmit={event => { event.preventDefault(); changeQuery(1, search.trim()); }}>
                <label htmlFor="admin-product-search" className="min-w-52 flex-1 text-sm font-medium text-slate-700">Buscar produto<input id="admin-product-search" type="search" maxLength={200} value={search} onChange={event => setSearch(event.target.value)} placeholder="Nome do produto" className={fieldClass}/></label>
                <ProductCategoryFilter categories={categories} value={category} onChange={setCategory} label="Categoria nesta página"/>
                <button type="submit" className={secondaryButton}>Pesquisar</button>
                <button type="button" className={secondaryButton} onClick={() => { setSearch(""); changeQuery(1, ""); }}>Limpar</button>
            </form>
            {!result && !error && <p role="status" aria-live="polite" className="mt-5 text-sm text-slate-600">Carregando produtos publicados…</p>}
            {error && <div role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"><p>{error}</p><button type="button" className="mt-2 font-semibold underline" onClick={retry}>Tentar novamente</button></div>}
            {result && !result.items.length && <p role="status" className="py-10 text-center text-sm text-slate-600">{query.search ? "Nenhum produto publicado corresponde à busca." : "Ainda não há produtos publicados no catálogo."}</p>}
            {result && !!result.items.length && !visibleProducts.length && <p role="status" className="py-8 text-center text-sm text-slate-600">Nenhum produto desta página pertence à categoria selecionada.</p>}
            {result && !!visibleProducts.length && <div role="region" aria-label="Lista de produtos publicados" className="grid gap-4 md:grid-cols-2">
                {visibleProducts.map(product => <article key={product.id} aria-label={product.name} className="overflow-hidden rounded-2xl border border-slate-200 bg-white transition hover:border-blue-200 hover:shadow-sm">
                    <div className="flex gap-4 p-4 sm:p-5">
                        <ProductImage name={product.name} className="h-24 w-24"/>
                        <div className="min-w-0 flex-1">
                            <span className="inline-flex rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-800">{productCategory(product.category)}</span>
                            <h3 className="mt-2 break-words font-bold text-slate-900">{product.name}</h3>
                            <p className="mt-1 truncate text-sm text-slate-600">{product.brand}</p>
                            <p className="mt-2 text-sm text-slate-700">{product.packaging_quantity} × {product.net_content} {product.net_content_unit}</p>
                            <p className="mt-1 text-xs text-slate-500">{product.packaging_type} · GTIN {product.gtin ?? "não informado"}</p>
                        </div>
                    </div>
                    <div className="flex items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/70 px-4 py-3 sm:px-5">
                        <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800 ring-1 ring-inset ring-emerald-200">{publicationLabel(product.publication_state)}</span>
                        <button type="button" className="font-semibold text-blue-800 hover:underline" onClick={() => setSelected(product.id)}>Ver detalhes</button>
                    </div>
                </article>)}
            </div>}
            {result && <nav aria-label="Paginação de produtos" className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4 text-sm"><p aria-live="polite">Página {result.page} de {Math.max(1, Math.ceil(result.total / result.page_size))} · {result.total} produto(s)</p><div className="flex gap-2"><button type="button" className={secondaryButton} disabled={result.page <= 1} onClick={() => changeQuery(result.page - 1, query.search)}>Anterior</button><button type="button" className={secondaryButton} disabled={result.page * result.page_size >= result.total} onClick={() => changeQuery(result.page + 1, query.search)}>Próxima</button></div></nav>}
        </section>
        {selected && <ApiCatalogDetails key={selected} id={selected} repository={repository} onClose={() => setSelected(null)}/>}
    </div>;
}

function positiveInteger(formData: FormData, name: string, label: string) {
    const value = String(formData.get(name) ?? "").trim();
    if (!/^\d+$/.test(value)) throw new Error(`${label}: informe um número inteiro positivo.`);
    const number = Number(value);
    if (!Number.isSafeInteger(number) || number < 1 || number > 2_147_483_647) throw new Error(`${label}: o valor deve estar entre 1 e 2.147.483.647.`);
    return number;
}
type VariantAttributeField = { id: number; name: string; description: string };

function normalizedAttributeName(name: string): string {
    return name.trim()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-zA-Z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "")
        .toLocaleLowerCase("en-US");
}

function productInput(formData: FormData, attributeFields: VariantAttributeField[]): ProductCreate {
    const text = (name: string, label: string) => {
        const value = String(formData.get(name) ?? "").trim();
        if (!value) throw new Error(`${label} é obrigatório.`);
        if (value.length > 200) throw new Error(`${label} deve ter no máximo 200 caracteres.`);
        return value;
    };
    if (attributeFields.length > 20) throw new Error("Adicione no máximo 20 características.");
    const attributeNames = new Set<string>();
    const attributeEntries: [string, string][] = [];
    for (const [index, field] of attributeFields.entries()) {
        const name = normalizedAttributeName(field.name);
        const description = field.description.trim();
        if (!name || !description) throw new Error(`Preencha a característica e a descrição do item ${index + 1}, ou remova-o.`);
        if (attributeNames.has(name)) throw new Error(`A característica "${field.name.trim()}" está repetida. Use nomes diferentes.`);
        attributeNames.add(name);
        attributeEntries.push([name, description]);
    }
    const attributes = Object.fromEntries(attributeEntries);
    const gtin = String(formData.get("gtin") ?? "").trim();
    if (gtin && !/^(?:\d{8}|\d{12,14})$/.test(gtin)) throw new Error("GTIN deve conter 8 ou de 12 a 14 algarismos.");
    return {
        name: text("name", "Nome"),
        brand: text("brand", "Marca"),
        category: "ALIMENTO_SECO_INDUSTRIALIZADO",
        gtin: gtin || null,
        net_content: positiveInteger(formData, "net_content", "Conteúdo líquido"),
        net_content_unit: String(formData.get("net_content_unit")) as ProductCreate["net_content_unit"],
        packaging_type: text("packaging_type", "Tipo de embalagem"),
        packaging_quantity: positiveInteger(formData, "packaging_quantity", "Quantidade por embalagem"),
        gross_weight_grams: positiveInteger(formData, "gross_weight_grams", "Peso bruto"),
        volume_cm3: positiveInteger(formData, "volume_cm3", "Volume"),
        variant_attributes: attributes,
    };
}

export function AdminProductCreate() {
    const { user } = useAuth();
    const workflow = useOutletContext<AdminWorkflow>();
    const repository = useMemo(() => new CatalogRepository(user?.organization_id ?? ""), [user?.organization_id]);
    const [attributeFields, setAttributeFields] = useState<VariantAttributeField[]>([]);
    const nextAttributeId = useRef(0);
    const [error, setError] = useState("");
    const [verificationError, setVerificationError] = useState("");
    const [submitting, setSubmitting] = useState(false);

    async function create(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setError("");
        let payload: ProductCreate;
        try { payload = productInput(new FormData(event.currentTarget), attributeFields); }
        catch (failure) { setError(failure instanceof Error ? failure.message : "Revise os campos do produto."); return; }
        setSubmitting(true);
        try {
            const product = await repository.createProduct(payload);
            workflow.setCreatedProduct(product);
            workflow.setCreationUncertain(false);
            workflow.setPublicationStatus("not-started");
            workflow.setPublishedProduct(null);
        } catch (failure) {
            const uncertain = !(failure instanceof Error && "status" in failure && typeof failure.status === "number" && failure.status < 500);
            workflow.setCreationUncertain(uncertain);
            setError(catalogMutationError(failure, "create"));
        } finally { setSubmitting(false); }
    }

    async function publish() {
        const product = workflow.createdProduct;
        if (!product || workflow.publicationStatus !== "not-started") return;
        workflow.setPublicationStatus("attempting");
        setError("");
        setVerificationError("");
        try {
            const published = await repository.publishProduct(product.id, product.version);
            workflow.setCreatedProduct(published);
            workflow.setPublishedProduct(published);
            workflow.setPublicationStatus("published");
        } catch (failure) {
            workflow.setPublicationStatus(failure instanceof Error && "status" in failure && typeof failure.status === "number" && failure.status < 500 ? "rejected" : "uncertain");
            setError(catalogMutationError(failure, "publish"));
        }
    }

    async function verifyPublication() {
        const product = workflow.createdProduct;
        if (!product) return;
        setVerificationError("");
        try {
            const published = await repository.detail(product.id);
            workflow.setCreatedProduct(published);
            workflow.setPublishedProduct(published);
            workflow.setPublicationStatus("published");
        } catch (failure) {
            setVerificationError(failure instanceof Error && "status" in failure && failure.status === 404
                ? "A consulta segura não encontrou este produto publicado. O Backend não permite consultar rascunhos; não repita a publicação."
                : catalogError(failure));
        }
    }

    const product = workflow.createdProduct;
    const canStartAnother = workflow.publicationStatus === "published";
    return <div className="space-y-5">
        <PageHeader title="Cadastrar produto canônico" subtitle="Informe os dados do produto e da embalagem. Preço e estoque são cadastrados pelo fornecedor."/>
        {workflow.creationUncertain && !product && <section role="alert" className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950"><h2 className="font-bold">Resultado do cadastro não confirmado</h2><p className="mt-1 leading-6">Não repita este cadastro. O Backend não oferece consulta de rascunhos nem recuperação após recarregar a página. Esta informação fica somente na sessão atual.</p></section>}
        {product && <section className={`${cardClass} border-blue-200`} aria-label="Produto criado nesta sessão">
            <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wide text-blue-700">{workflow.publicationStatus === "published" ? "Produto publicado" : "Rascunho criado"}</p><h2 className="mt-1 text-xl font-bold text-slate-900">{product.name}</h2><p className="mt-1 text-sm text-slate-600">{product.brand} · {product.packaging_type}</p></div><span className={`rounded-full px-3 py-1.5 text-xs font-semibold ${workflow.publicationStatus === "published" ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-900"}`}>{workflow.publicationStatus === "published" ? "Publicado" : publicationLabel(product.publication_state)}</span></div>
            {workflow.publicationStatus !== "published" && <p className="mt-4 text-sm leading-6 text-slate-600">O produto foi criado como rascunho. Ele não aparece no catálogo publicado até a confirmação explícita da publicação.</p>}
            {error && <p role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
            {verificationError && <p role="alert" className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">{verificationError}</p>}
            <div className="mt-5 flex flex-wrap gap-3">
                {workflow.publicationStatus === "not-started" && <button type="button" className={primaryButton} onClick={() => void publish()}>Publicar produto</button>}
                {(workflow.publicationStatus === "uncertain" || workflow.publicationStatus === "rejected") && <button type="button" className={secondaryButton} onClick={() => void verifyPublication()}>Consultar se foi publicado</button>}
                {workflow.publicationStatus === "published" && <Link className={primaryButton} to="/admin/products">Consultar catálogo publicado</Link>}
                {canStartAnother && <button type="button" className={secondaryButton} onClick={() => { workflow.setCreatedProduct(null); workflow.setCreationUncertain(false); workflow.setPublicationStatus("not-started"); workflow.setPublishedProduct(null); }}>Cadastrar outro produto</button>}
            </div>
            {(workflow.publicationStatus === "uncertain" || workflow.publicationStatus === "rejected") && <p className="mt-3 text-xs leading-5 text-slate-500">A consulta acima é somente leitura. Não haverá repetição automática da publicação; rascunhos não podem ser recuperados pela API atual.</p>}
        </section>}
        {!product && !workflow.creationUncertain && <form className={`${cardClass} space-y-6`} onSubmit={event => void create(event)}>
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_17rem]">
                <div className="space-y-5">
                    <section className="rounded-2xl border border-slate-200 p-4 sm:p-5">
                        <h2 className="font-bold text-slate-900">Identificação do produto</h2>
                        <p className="mt-1 text-sm text-slate-500">Dados principais para reconhecer o produto no catálogo.</p>
                        <div className="mt-4 grid gap-4 sm:grid-cols-2">
                            <label className="text-sm font-semibold text-slate-700 sm:col-span-2">Nome do produto<input name="name" required maxLength={200} className={fieldClass}/></label>
                            <label className="text-sm font-semibold text-slate-700">Marca<input name="brand" required maxLength={200} className={fieldClass}/></label>
                            <label className="text-sm font-semibold text-slate-700">GTIN (opcional)<input name="gtin" inputMode="numeric" pattern="(?:[0-9]{8}|[0-9]{12,14})" maxLength={14} className={fieldClass} aria-describedby="gtin-help"/><span id="gtin-help" className="mt-1 block text-xs font-normal text-slate-500">8 ou de 12 a 14 algarismos.</span></label>
                            <label className="text-sm font-semibold text-slate-700 sm:col-span-2">Categoria<select name="category" value="ALIMENTO_SECO_INDUSTRIALIZADO" disabled className={fieldClass}><option value="ALIMENTO_SECO_INDUSTRIALIZADO">Alimento seco industrializado</option></select><span className="mt-1 block text-xs font-normal text-slate-500">Categoria disponível no catálogo atualmente.</span></label>
                        </div>
                    </section>
                    <section className="rounded-2xl border border-slate-200 p-4 sm:p-5">
                        <h2 className="font-bold text-slate-900">Conteúdo e embalagem</h2>
                        <p className="mt-1 text-sm text-slate-500">Informe a quantidade comercializada na embalagem.</p>
                        <div className="mt-4 grid gap-4 sm:grid-cols-2">
                            <label className="text-sm font-semibold text-slate-700">Conteúdo líquido<input name="net_content" type="number" required min={1} max={2147483647} step={1} className={fieldClass}/></label>
                            <label className="text-sm font-semibold text-slate-700">Unidade do conteúdo<select name="net_content_unit" defaultValue="g" className={fieldClass}><option value="g">g</option><option value="ml">ml</option><option value="un">un</option></select></label>
                            <label className="text-sm font-semibold text-slate-700">Tipo de embalagem<input name="packaging_type" required maxLength={200} className={fieldClass}/></label>
                            <label className="text-sm font-semibold text-slate-700">Quantidade por embalagem<input name="packaging_quantity" type="number" required min={1} max={2147483647} step={1} className={fieldClass}/></label>
                        </div>
                    </section>
                    <section className="rounded-2xl border border-slate-200 p-4 sm:p-5">
                        <h2 className="font-bold text-slate-900">Peso e dimensões</h2>
                        <div className="mt-4 grid gap-4 sm:grid-cols-2">
                            <label className="text-sm font-semibold text-slate-700">Peso bruto (gramas)<input name="gross_weight_grams" type="number" required min={1} max={2147483647} step={1} className={fieldClass}/></label>
                            <label className="text-sm font-semibold text-slate-700">Volume (cm³)<input name="volume_cm3" type="number" required min={1} max={2147483647} step={1} className={fieldClass}/></label>
                        </div>
                    </section>
                    <section className="rounded-2xl border border-slate-200 p-4 sm:p-5" aria-labelledby="product-characteristics-title">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                                <h2 id="product-characteristics-title" className="font-semibold text-slate-900">Características adicionais do produto</h2>
                                <p id="product-characteristics-help" className="mt-1 text-sm text-slate-500">Inclua detalhes que ajudam a diferenciar este produto. Esta seção é opcional.</p>
                            </div>
                            <span className="text-xs font-medium text-slate-500">{attributeFields.length} de 20</span>
                        </div>
                        {attributeFields.length > 0 && <div className="mt-4 space-y-3">
                            {attributeFields.map((field, index) => (
                                <fieldset key={field.id} className="grid gap-3 rounded-xl bg-slate-50 p-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end">
                                    <legend className="sr-only">Característica {index + 1}</legend>
                                    <label htmlFor={`product-characteristic-name-${field.id}`} className="text-sm font-semibold text-slate-700">
                                        Característica
                                        <input
                                            id={`product-characteristic-name-${field.id}`}
                                            type="text"
                                            value={field.name}
                                            onChange={event => setAttributeFields(fields => fields.map(item => item.id === field.id ? { ...item, name: event.target.value } : item))}
                                            placeholder="Ex.: Tipo"
                                            aria-describedby="product-characteristics-help"
                                            className={fieldClass}
                                        />
                                    </label>
                                    <label htmlFor={`product-characteristic-description-${field.id}`} className="text-sm font-semibold text-slate-700">
                                        Descrição
                                        <input
                                            id={`product-characteristic-description-${field.id}`}
                                            type="text"
                                            value={field.description}
                                            onChange={event => setAttributeFields(fields => fields.map(item => item.id === field.id ? { ...item, description: event.target.value } : item))}
                                            placeholder="Ex.: Espaguete"
                                            aria-describedby="product-characteristics-help"
                                            className={fieldClass}
                                        />
                                    </label>
                                    <button
                                        type="button"
                                        className={`${secondaryButton} w-full sm:w-auto`}
                                        aria-label={`Remover característica ${index + 1}`}
                                        onClick={() => setAttributeFields(fields => fields.filter(item => item.id !== field.id))}
                                    >
                                        Remover
                                    </button>
                                </fieldset>
                            ))}
                        </div>}
                        <button
                            type="button"
                            className={`${secondaryButton} mt-4`}
                            disabled={attributeFields.length >= 20}
                            onClick={() => setAttributeFields(fields => [...fields, { id: nextAttributeId.current++, name: "", description: "" }])}
                        >
                            Adicionar característica
                        </button>
                    </section>
                </div>
                <aside className="space-y-3">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                        <h2 className="font-bold text-slate-900">Imagem do produto</h2>
                        <ProductImage name="novo produto" className="mt-3 h-44 w-full"/>
                        <p className="mt-3 text-sm leading-5 text-slate-600">A inclusão de imagens estará disponível em uma próxima etapa.</p>
                    </div>
                    <div className="rounded-2xl bg-blue-50 p-4 text-sm leading-6 text-blue-950">
                        <h2 className="font-bold">Cadastro canônico</h2>
                        <p className="mt-1">O cadastro cria um rascunho. Preços, estoque, depósitos e ofertas são gerenciados pelo fornecedor.</p>
                        <p className="mt-2 text-blue-800">Rascunhos não podem ser recuperados após sair desta sessão.</p>
                    </div>
                </aside>
            </div>
            {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-5">
                <p className="max-w-xl text-sm leading-5 text-slate-500">Revise os dados antes de salvar. A publicação será solicitada separadamente.</p>
                <button type="submit" className={primaryButton} disabled={submitting}>{submitting ? "Cadastrando…" : "Cadastrar como rascunho"}</button>
            </div>
        </form>}
    </div>;
}

export function AdminAccount() {
    const { user } = useAuth();
    const [passwordDialog, setPasswordDialog] = useState(false);
    const organization = user?.organizations?.find(item => item.id === user.organization_id);
    return <div className="space-y-5">
        <PageHeader title="Minha conta" subtitle="Informações da conta administrativa e da sessão."/>
        <section className={`${cardClass} max-w-3xl`} aria-label="Dados da conta administrativa">
            <div><h2 className="text-lg font-bold">{user?.name ?? "Administrador"}</h2><span className="mt-2 inline-flex rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-800">Administrador RotaLog</span></div>
            <dl className="mt-6 grid gap-4 sm:grid-cols-2">{[["Nome", user?.name], ["E-mail", user?.email], ["Organização", organization?.name], ["Perfil", user?.role]].map(([label, value]) => <div key={label} className="border-t border-slate-100 pt-3"><dt className="text-sm text-slate-500">{label}</dt><dd className="mt-1 break-words font-medium">{value || "Não informado"}</dd></div>)}</dl>
            <p className="mt-6 text-sm text-slate-500">Nome, e-mail e organização são somente leitura.</p>
            {authMode === "api" && <button type="button" onClick={() => setPasswordDialog(true)} className={`${secondaryButton} mt-4`}>Alterar senha</button>}
        </section>
        {passwordDialog && <PasswordChangeDialog onClose={() => setPasswordDialog(false)}/>}
    </div>;
}

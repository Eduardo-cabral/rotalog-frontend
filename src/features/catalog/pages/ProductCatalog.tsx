
import { useMemo, useState } from "react";
import { Link, useOutletContext } from "react-router-dom";
import { catalogProducts, formatPrice } from "../mocks/products.mock";
import { BuyerEmptyState, BuyerIcon, BuyerProductPlaceholder, BuyerStatus } from "../../buyer/components/BuyerVisuals";
import { authMode } from "../../../shared/api/config";
import { DemoDataBadge } from "../../buyer/components/DemoDataBadge";

type MarketplaceContext = {
    search: string;
};

const categories = [
    "Todos",
    "Construção",
    "Pintura",
    "Ferramentas",
];

export function ProductCatalog() {
    const { search } = useOutletContext<MarketplaceContext>();
    const [category, setCategory] = useState("Todos");

    const filteredProducts = useMemo(() => {
        const term = search.trim().toLocaleLowerCase("pt-BR");

        return catalogProducts.filter((product) => {
            const matchesCategory =
                category === "Todos" || product.category === category;

            const matchesSearch =
                product.name.toLocaleLowerCase("pt-BR").includes(term) ||
                product.supplier.toLocaleLowerCase("pt-BR").includes(term);

            return matchesCategory && matchesSearch;
        });
    }, [category, search]);

    return (
        <div className="mx-auto w-full max-w-[1120px] text-slate-900">
            <section className="relative overflow-hidden rounded-xl bg-gradient-to-r from-[#122a55] to-[#1d4d94] px-6 py-7 text-white sm:px-8 sm:py-8">
                <div className="relative z-10 max-w-xl">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-blue-200">
                        Marketplace RotaLog
                    </p>

                    <h1 className="mt-2 text-[23px] font-bold leading-tight tracking-tight sm:text-[28px]">
                        Tudo para o seu negócio em um só lugar
                    </h1>

                    <p className="mt-3 max-w-lg text-[13px] leading-5 text-blue-100">
                        Encontre produtos, conheça fornecedores e organize
                        suas compras de forma simples.
                    </p>
                    <div className="mt-4"><DemoDataBadge visible={authMode === "mock" && filteredProducts.length > 0}/></div>

                    <a
                        href="#produtos"
                        className="mt-5 inline-flex h-9 items-center rounded-lg bg-white px-4 text-xs font-semibold text-blue-800 transition hover:bg-blue-50"
                    >
                        Explorar produtos
                        <span className="ml-2" aria-hidden="true">→</span>
                    </a>
                </div>

                <div
                    aria-hidden="true"
                    className="pointer-events-none absolute -right-16 -top-20 h-60 w-60 rounded-full border-[35px] border-white/5"
                />
            </section>

            <section className="mt-7" aria-labelledby="categories-title">
                <h2
                    id="categories-title"
                    className="text-base font-bold tracking-tight"
                >
                    Categorias
                </h2>

                <div className="mt-3 flex flex-wrap gap-2">
                    {categories.map((item) => {
                        const active = category === item;

                        return (
                            <button
                                key={item}
                                type="button"
                                onClick={() => setCategory(item)}
                                aria-pressed={active}
                                className={`rounded-lg border px-3.5 py-2 text-xs font-semibold transition ${active
                                        ? "border-blue-700 bg-blue-700 text-white"
                                        : "border-slate-200 bg-white text-slate-600 hover:border-blue-300 hover:text-blue-700"
                                    }`}
                            >
                                {item}
                            </button>
                        );
                    })}
                </div>
            </section>

            <section
                id="produtos"
                aria-labelledby="products-title"
                className="mt-7 scroll-mt-24"
            >
                <div className="flex flex-wrap items-end justify-between gap-3">
                    <div>
                        <h2
                            id="products-title"
                            className="text-lg font-bold tracking-tight"
                        >
                            Produtos disponíveis
                        </h2>

                        <p className="mt-1 text-xs text-slate-500">
                            Explore as opções dos fornecedores parceiros.
                        </p>
                    </div>

                    <span className="rounded-full bg-slate-100 px-3 py-1.5 text-sm font-semibold text-slate-600">
                        {filteredProducts.length} produto(s)
                    </span>
                </div>

                {filteredProducts.length === 0 ? (
                    <div className="mt-4">
                        <BuyerEmptyState icon="search" title="Nenhum produto encontrado">
                            <p>Tente outro termo ou selecione uma categoria diferente.</p>
                        </BuyerEmptyState>
                    </div>
                ) : (
                    <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                        {filteredProducts.map((product) => (
                            <article
                                key={product.id}
                                className="group flex min-w-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md sm:p-5"
                            >
                                <Link
                                    to={`/produto/${product.id}`}
                                    className="flex h-36 items-center justify-center overflow-hidden rounded-xl bg-slate-50 p-3 sm:h-40"
                                    aria-label={`Ver detalhes de ${product.name}`}
                                >
                                    <ProductImage src={product.image} alt={product.name} />
                                </Link>

                                <div className="flex flex-1 flex-col p-4">
                                    <div className="flex items-center justify-between gap-2">
                                        <span className="w-fit rounded-md bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">{product.category}</span>
                                        <BuyerStatus tone={product.available ? "success" : "neutral"} icon={product.available ? "check" : "clock"}>{product.available ? "Disponível" : "Indisponível"}</BuyerStatus>
                                    </div>

                                    <h3 className="mt-4 min-h-12 text-base font-bold leading-6">
                                        <Link to={`/produto/${product.id}`} className="transition hover:text-blue-700">{product.name}</Link>
                                    </h3>

                                    <p className="mt-1 truncate text-sm text-slate-500">
                                        Vendido por {product.supplier}
                                    </p>

                                    <div className="mt-auto pt-4">
                                        <p className="text-2xl font-bold tracking-tight text-blue-950">
                                            {formatPrice(product.price)}
                                        </p>

                                        <p className="mt-1 text-sm text-slate-500">
                                            por {product.unit}
                                        </p>

                                        <Link
                                            to={`/produto/${product.id}`}
                                            className="mt-5 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                                        >
                                            Ver produto
                                            <BuyerIcon name="arrow-right" className="h-4 w-4" />
                                        </Link>
                                    </div>
                                </div>
                            </article>
                        ))}
                    </div>
                )}
            </section>
        </div>
    );
}

function ProductImage({src,alt}:{src:string;alt:string}) {
    const [failed,setFailed]=useState(false);
    if(failed)return <BuyerProductPlaceholder/>;
    return <img src={src} alt={alt} loading="lazy" onError={()=>setFailed(true)} className="h-full w-full object-contain transition duration-200 group-hover:scale-[1.03]"/>;
}

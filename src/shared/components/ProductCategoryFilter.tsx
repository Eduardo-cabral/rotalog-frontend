import { productCategory } from "../../features/products/api/catalogRepository";

export function ProductCategoryFilter({
    categories,
    value,
    onChange,
    label = "Filtrar por categoria",
}: {
    categories: string[];
    value: string;
    onChange: (category: string) => void;
    label?: string;
}) {
    if (categories.length < 2) return null;

    return (
        <label className="min-w-48 text-sm font-medium text-slate-700">
            {label}
            <select
                value={value}
                onChange={event => onChange(event.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 focus:border-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-100"
            >
                <option value="">Todas as categorias</option>
                {categories.map(category => <option key={category} value={category}>{productCategory(category)}</option>)}
            </select>
        </label>
    );
}

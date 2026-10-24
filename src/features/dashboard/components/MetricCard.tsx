
type MetricCardProps = {
    title: string;
    value: number;
};

export function MetricCard({
    title,
    value,
}: MetricCardProps) {
    return (
        <article style={{"--metric-color": title === "Aguardando aceite" ? "#b45309" : title === "Em preparação" ? "#0e7490" : title === "Prontos para coleta" ? "#15803d" : "#316bff"} as React.CSSProperties} className="supplier-metric flex h-full min-w-0 flex-1 flex-col rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-3"><h3 className="min-h-10 text-sm font-medium text-slate-600">
                {title}
            </h3><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className="h-8 w-8 shrink-0 rounded-lg bg-blue-50 p-1.5 text-blue-700"><path strokeLinecap="round" strokeLinejoin="round" d={title === "Pedidos recebidos" ? "M8 3h8v4H8z M6 5H4v16h16V5h-2 M8 12h8 M8 16h5" : title === "Aguardando aceite" ? "M12 8v4l3 2 M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0" : title === "Em preparação" ? "M4 7h16v14H4z M8 3h8v4H8z M8 12h8 M8 16h5" : "M3 7l9-4 9 4v13H3z M8 13l3 3 5-6"} /></svg></div>

            <p className="mt-3 text-3xl font-bold text-slate-900">
                {value.toLocaleString("pt-BR")}
            </p>

        </article>
    );
}

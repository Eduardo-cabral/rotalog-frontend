import type { ApiOrder, OrderItem } from "../api/contracts";
import { formatMoney } from "../api/orderAdapter";
import { preparationMessage, readableOrderState } from "../api/orderPresentation";
import { StatusBadge } from "../../../shared/components/SupplierVisuals";
import { orderTone } from "../../../shared/components/supplierStatus";

export function OrderQuantities({items}: {items: OrderItem[]}) {
    return <section className="mt-5 rounded-xl border border-slate-200 bg-white p-4">
        <div role="region" aria-label="Produtos e quantidades" tabIndex={0} className="max-w-full overflow-x-auto rounded-lg focus-visible:outline-2 focus-visible:outline-blue-600">
            <table className="w-full text-left text-sm">
                <caption className="mb-3 text-left font-bold text-blue-950">Produtos e quantidades</caption>
                <thead><tr className="border-b bg-slate-50 text-slate-600">{["Produto","Solicitado","Reservado","Aceito / recusado","Separado","Preço unitário"].map(label=><th key={label} scope="col" className="whitespace-nowrap px-3 py-3">{label}</th>)}</tr></thead>
                <tbody>{items.map(item=><tr key={item.id} className="border-b border-slate-100 last:border-0">
                    <th scope="row" className="min-w-40 max-w-xs px-3 py-4 font-medium"><span className="block break-words">{item.product.name}</span><span className="mt-1 block text-xs font-normal text-slate-500">{item.product.net_content} {item.product.net_content_unit} · {item.product.packaging_type}</span></th>
                    <td className="px-3 py-4 tabular-nums">{item.requested_quantity}</td><td className="px-3 py-4 tabular-nums">{item.reserved_quantity ?? "Não informado"}</td>
                    <td className="px-3 py-4 tabular-nums">{item.supplier_accepted_quantity} / {item.supplier_refused_quantity ?? "Não informado"}</td><td className="px-3 py-4 tabular-nums">{item.separated_quantity}</td><td className="whitespace-nowrap px-3 py-4">{formatMoney(item.unit_price)}</td>
                </tr>)}</tbody>
            </table>
        </div>
        {!items.length && <p className="text-sm text-slate-500">Nenhum produto informado para este pedido.</p>}
        <p className="mt-3 text-xs text-slate-500">Quantidades informadas pelo pedido. Consulte os lotes para acompanhar a preparação.</p>
    </section>;
}

export function LogisticsSummary({state}: {state: string}) {
    return <section aria-label="Situação logística" className="mt-5 rounded-xl border border-blue-100 bg-blue-50/60 p-4">
        <h3 className="font-bold text-blue-950">Situação logística</h3>
        <p className="mt-2 text-sm text-slate-700">{preparationMessage(state)}</p>
        <p className="mt-2 text-sm text-slate-600">Ainda não há confirmação de coleta ou entrega para este pedido.</p>
    </section>;
}

export function ReadOnlyBatches({order}: {order: ApiOrder}) {
    return <section aria-label="Lotes de atendimento" className="mt-5 rounded-xl border border-slate-200 p-4">
        <h3 className="font-bold text-blue-950">Atendimento e separação</h3>
        {!order.fulfillments.length && <p className="mt-2 text-sm text-slate-500">Nenhum lote registrado.</p>}
        <div className="mt-3 space-y-3">{order.fulfillments.map((batch,index)=><article key={batch.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2"><h4 className="font-semibold">Lote {index+1}</h4><StatusBadge tone={orderTone(batch.state)}>{readableOrderState(batch.state)}</StatusBadge></div>
            <p className="mt-2 text-sm">{batch.lines.reduce((sum,line)=>sum+line.allocated_quantity,0)} alocados / {batch.lines.reduce((sum,line)=>sum+line.separated_quantity,0)} separados</p>
            <ul className="mt-2 space-y-1 text-sm">{batch.lines.map(line=><li key={line.id}>{order.items.find(item=>item.id===line.order_item_id)?.product.name ?? "Produto não identificado"}: {line.separated_quantity} separados / {line.allocated_quantity} alocados</li>)}</ul>
        </article>)}</div>
    </section>;
}

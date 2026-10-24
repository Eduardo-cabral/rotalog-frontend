import {useAuth} from "../../auth/hooks/useAuth";
import {PageHeader} from "../../../shared/components/PageHeader";
import {StatusBadge, SupplierIcon} from "../../../shared/components/SupplierVisuals";
import {useState} from "react";
import {authMode} from "../../../shared/api/config";
import {PasswordChangeDialog} from "../components/PasswordChangeDialog";

export function SupplierAccount() {
    const {user} = useAuth();
    const [passwordDialog, setPasswordDialog] = useState(false);
    const organization = user?.organizations?.find(item => item.id === user.organization_id);
    const role = user?.role === "SUPPLIER_OPERATOR" ? "Operador do fornecedor" : user?.role;
    return <div className="space-y-6">
        <PageHeader title="Minha conta" subtitle="Informações da sua sessão e da organização vinculada."/>
        <section className="supplier-account-card rounded-xl border border-slate-200 bg-white p-6 shadow-sm" aria-label="Dados da conta">
            <div className="mb-6 flex items-center gap-4"><span className="supplier-account-icon"><SupplierIcon name="account" className="h-8 w-8"/></span><div><h2 className="text-lg font-semibold">{user?.name ?? "Nome não informado"}</h2><StatusBadge tone="blue">{role ?? "Perfil não informado"}</StatusBadge></div></div>
            <dl className="grid gap-6 sm:grid-cols-2">{[["Nome", user?.name], ["E-mail", user?.email], ["Organização", organization?.name], ["Perfil de acesso", role]].map(([label, value]) => <div key={label} className="min-w-0 border-t border-slate-100 pt-4"><dt className="text-sm text-slate-500">{label}</dt><dd className="mt-2 break-words font-medium">{value || "Não informado pela autenticação"}</dd></div>)}</dl>
            <p className="mt-8 text-sm text-slate-500">Nome, e-mail e organização são somente leitura.</p>
            {authMode === "api" && <button type="button" onClick={()=>setPasswordDialog(true)} className="supplier-button mt-5">Alterar senha</button>}
        </section>
        {passwordDialog && <PasswordChangeDialog onClose={()=>setPasswordDialog(false)}/>}
    </div>;
}

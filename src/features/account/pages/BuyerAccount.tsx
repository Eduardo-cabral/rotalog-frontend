import { useState } from "react";
import { useAuth } from "../../auth/hooks/useAuth";
import { PasswordChangeDialog } from "../components/PasswordChangeDialog";

export function BuyerAccount() {
  const { user } = useAuth();
  const [passwordDialog, setPasswordDialog] = useState(false);

  if (!user) {
    return null;
  }

  const initials = user.name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");

  const roleLabel =
    user.role === "BUYER_ADMIN"
      ? "Comprador"
      : "Fornecedor";

  return (
    <div className="mx-auto w-full max-w-[960px] text-slate-900">
      <header className="mb-6">
        <p className="text-xs font-semibold text-blue-700">
          RotaLog • Portal do Comprador
        </p>

        <h1 className="mt-2 text-2xl font-bold tracking-tight">
          Minha conta
        </h1>

        <p className="mt-2 text-[13px] leading-5 text-slate-600">
          Consulte as informações da sua conta e do seu perfil
          de acesso ao RotaLog.
        </p>
      </header>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="flex flex-wrap items-center gap-4 border-b border-slate-100 px-5 py-6 sm:px-6">
          <div
            aria-hidden="true"
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-lg font-bold text-blue-700"
          >
            {initials}
          </div>

          <div className="min-w-0">
            <h2 className="break-words text-lg font-bold">
              {user.name}
            </h2>

            <p className="mt-1 break-all text-sm text-slate-500">
              {user.email}
            </p>

            <span className="mt-2 inline-flex rounded-md bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-blue-700">
              {roleLabel}
            </span>
          </div>
        </div>

        <div className="px-5 py-6 sm:px-6">
          <h3 className="text-base font-bold">
            Informações pessoais
          </h3>

          <p className="mt-1 text-xs text-slate-500">
            Dados associados ao seu acesso à plataforma.
          </p>

          <dl className="mt-5 grid gap-5 sm:grid-cols-2">
            <div className="min-w-0">
              <dt className="text-xs font-medium text-slate-500">
                Nome
              </dt>
              <dd className="mt-1 break-words text-sm font-semibold">
                {user.name}
              </dd>
            </div>

            <div className="min-w-0">
              <dt className="text-xs font-medium text-slate-500">
                E-mail
              </dt>
              <dd className="mt-1 break-all text-sm font-semibold">
                {user.email}
              </dd>
            </div>

            <div>
              <dt className="text-xs font-medium text-slate-500">
                Tipo de perfil
              </dt>
              <dd className="mt-1 text-sm font-semibold">
                {roleLabel}
              </dd>
            </div>

          </dl>
        </div>
      </section>

      <section className="mt-5 rounded-xl border border-slate-200 bg-white px-5 py-5 sm:px-6" aria-labelledby="account-security-title">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 id="account-security-title" className="text-base font-bold">
              Segurança da conta
            </h2>
            <p className="mt-2 max-w-xl text-[13px] leading-5 text-slate-600">
              Atualize sua senha usando a senha atual. Após a alteração, será necessário entrar novamente.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setPasswordDialog(true)}
            className="inline-flex min-h-10 items-center justify-center rounded-lg bg-blue-800 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
          >
            Alterar senha
          </button>
        </div>
      </section>
      {passwordDialog && <PasswordChangeDialog onClose={() => setPasswordDialog(false)} />}
    </div>
  );
}


import { useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

export function Login() {
    const { login, sessionError, sessionNotice, isLoading } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const locationState = location.state as {
        from?: unknown;
        registrationEmail?: unknown;
        registrationNotice?: unknown;
    } | null;
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [email, setEmail] = useState(
        typeof locationState?.registrationEmail === "string"
            ? locationState.registrationEmail
            : ""
    );
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [rememberMe, setRememberMe] = useState(false);
    const [message, setMessage] = useState("");

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();

        if (isSubmitting) return;

        if (!email.trim() || !password) {
            setMessage("Preencha seu e-mail e sua senha.");
            return;
        }

        setIsSubmitting(true);
        setMessage("");

        try {
            const user = await login({ email, password });

            const requestedPath = locationState?.from;

            const defaultPath = user.role === "ROTALOG_ADMIN"
                ? "/admin"
                : user.role === "BUYER_ADMIN"
                    ? user.capabilities?.includes("catalog:read") ? "/" : "/comprador/compras"
                    : "/fornecedor";

            const destination =
                typeof requestedPath === "string" &&
                requestedPath.startsWith("/") &&
                !requestedPath.startsWith("//") &&
                !requestedPath.startsWith("/\\") &&
                !requestedPath.includes("\\") &&
                !requestedPath.includes("://") &&
                !["/login", "/cadastro"].includes(requestedPath) &&
                (user.role === "ROTALOG_ADMIN"
                    ? requestedPath === "/admin" || requestedPath.startsWith("/admin/")
                    : user.role === "BUYER_ADMIN"
                    ? requestedPath.startsWith("/produto/")
                        ? user.capabilities?.includes("catalog:read")
                        : requestedPath.startsWith("/comprador/compras")
                            ? user.capabilities?.includes("purchase:read")
                            : requestedPath.startsWith("/comprador/carrinho")
                                ? user.capabilities?.includes("checkout:create")
                                : requestedPath.startsWith("/comprador")
                                    ? user.capabilities?.includes("catalog:read") || user.capabilities?.includes("purchase:read")
                                    : requestedPath === "/"
                                        ? user.capabilities?.includes("catalog:read") || user.capabilities?.includes("purchase:read")
                                        : false
                    : requestedPath.startsWith("/fornecedor"))
                    ? requestedPath
                    : defaultPath;

            navigate(destination, { replace: true });
        } catch (error) {
            setMessage(
                error instanceof Error
                    ? error.message
                    : "Não foi possível realizar o login."
            );
        } finally {
            setIsSubmitting(false);
        }
    }

    return (
        <div className="min-h-screen bg-white text-slate-900">
            <div className="grid min-h-screen lg:grid-cols-2">
                {/* Coluna esquerda */}
                <section className="flex flex-col bg-white px-6 py-8 sm:px-10 lg:px-12 lg:py-10">
                    {/* Logo */}
                    <Link to="/" className="flex w-fit items-center gap-3">
                        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white shadow-md">
                            <svg
                                viewBox="0 0 24 24"
                                fill="none"
                                className="h-6 w-6"
                                stroke="currentColor"
                                strokeWidth="1.8"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                aria-hidden="true"
                            >
                                <path d="m12 3 9 5-9 5-9-5 9-5Z" />
                                <path d="m3 12 9 5 9-5" />
                                <path d="m3 16 9 5 9-5" />
                            </svg>
                        </span>

                        <span>
                            <span className="block text-xl font-extrabold tracking-tight text-slate-900">
                                RotaLog
                            </span>
                            <span className="block text-[10px] text-slate-500">
                                Conectando negócios. Entregando mais.
                            </span>
                        </span>
                    </Link>

                    {/* Formulário */}
                    <div className="mx-auto flex w-full max-w-[390px] flex-1 flex-col justify-center py-10 lg:py-12">
                        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                            Bem-vindo de volta
                        </h1>

                        <p className="mt-2 text-sm text-slate-500">
                            Faça login para continuar
                        </p>
                        {sessionNotice && <p role="status" className="mt-4 rounded-lg bg-green-50 p-3 text-sm text-green-800">{sessionNotice}</p>}
                        {typeof locationState?.registrationNotice === "string" && (
                            <p role="status" className="mt-4 rounded-lg bg-green-50 p-3 text-sm text-green-800">
                                {locationState.registrationNotice}
                            </p>
                        )}

                        <form
                            onSubmit={handleSubmit}
                            className="mt-5 space-y-3"
                        >
                            <div>
                                <label
                                    htmlFor="email"
                                    className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-600"
                                >
                                    E-mail
                                </label>

                                <input
                                    id="email"
                                    type="email"
                                    required
                                    autoComplete="email"
                                    value={email}
                                    onChange={(event) => setEmail(event.target.value)}
                                    placeholder="seu-email@empresa.com"
                                    className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
                                />
                            </div>

                            <div>
                                <div className="mb-2 flex items-center justify-between gap-3">
                                    <label
                                        htmlFor="password"
                                        className="text-xs font-bold uppercase tracking-wide text-slate-600"
                                    >
                                        Senha
                                    </label>

                                    <button
                                        type="button"
                                        onClick={() =>
                                            setMessage(
                                                "A recuperação de senha será disponibilizada com a integração da autenticação."
                                            )
                                        }
                                        className="text-xs font-semibold text-blue-600 hover:underline"
                                    >
                                        Esqueceu sua senha?
                                    </button>
                                </div>

                                <div className="relative">
                                    <input
                                        id="password"
                                        type={showPassword ? "text" : "password"}
                                        required
                                        autoComplete="current-password"
                                        value={password}
                                        onChange={(event) =>
                                            setPassword(event.target.value)
                                        }
                                        placeholder="Digite sua senha"
                                        className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 pr-20 text-sm outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
                                    />

                                    <button
                                        type="button"
                                        onClick={() =>
                                            setShowPassword((current) => !current)
                                        }
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-blue-600"
                                        aria-label={
                                            showPassword ? "Ocultar senha" : "Mostrar senha"
                                        }
                                    >
                                        {showPassword ? "Ocultar" : "Mostrar"}
                                    </button>
                                </div>
                            </div>

                            <label className="flex w-fit cursor-pointer items-center gap-2 text-sm text-slate-500">
                                <input
                                    type="checkbox"
                                    checked={rememberMe}
                                    onChange={(event) =>
                                        setRememberMe(event.target.checked)
                                    }
                                    className="h-4 w-4 accent-blue-600"
                                />
                                Lembrar de mim
                            </label>

                            {(message || sessionError) && (
                                <p
                                    role="status"
                                    className="rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-700"
                                >
                                    {message || sessionError}
                                </p>
                            )}

                            <button
                                type="submit"
                                disabled={isSubmitting || isLoading}
                                className="w-full rounded-lg bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                {isSubmitting ? "Entrando..." : "Entrar"}
                            </button>
                        </form>

                        {/* Login social */}
                        <div className="my-4 flex items-center gap-3">
                            <div className="h-px flex-1 bg-slate-200" />
                            <span className="text-xs text-slate-500">
                                Ou continue com
                            </span>
                            <div className="h-px flex-1 bg-slate-200" />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <button
                                type="button"
                                onClick={() =>
                                    setMessage(
                                        "O login com Google ainda não está disponível."
                                    )
                                }
                                className="flex items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 py-3 text-xs font-medium transition hover:bg-slate-50"
                            >
                                <span className="text-base font-bold text-[#4285F4]">
                                    G
                                </span>
                                Google
                            </button>

                            <button
                                type="button"
                                onClick={() =>
                                    setMessage(
                                        "O login com Microsoft ainda não está disponível."
                                    )
                                }
                                className="flex items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 py-3 text-xs font-medium transition hover:bg-slate-50"
                            >
                                <span className="grid h-4 w-4 grid-cols-2 gap-[2px]">
                                    <span className="bg-[#F25022]" />
                                    <span className="bg-[#7FBA00]" />
                                    <span className="bg-[#00A4EF]" />
                                    <span className="bg-[#FFB900]" />
                                </span>
                                Microsoft
                            </button>
                        </div>

                        <p className="mt-4 text-center text-sm text-slate-500">
                            Não tem uma conta?{" "}
                            <Link
                                to="/cadastro"
                                className="font-semibold text-blue-600 hover:underline"
                            >
                                Criar uma conta
                            </Link>
                        </p>
                    </div>

                    <footer className="text-center text-xs text-slate-400 sm:text-left">
                        © 2026 RotaLog Sistemas de Logística S.A.
                    </footer>
                </section>

                {/* Coluna direita */}
                <aside className="relative hidden min-h-full overflow-hidden bg-[#101b38] text-white lg:block">
                    <div
                        className="absolute inset-0 bg-cover bg-center"
                        style={{
                            backgroundImage: "url('/images/login-truck.png')",
                        }}
                    />

                    <div className="absolute inset-0 bg-gradient-to-b from-[#1b3260]/85 via-[#101b38]/80 to-[#050a1b]/95" />

                    <div className="relative flex h-full flex-col px-10 py-6 xl:px-12">
                        <div>
                            <span className="rounded-full border border-white/10 bg-white/10 px-4 py-2 text-xs font-semibold text-blue-100">
                                ● Plataforma Integrada
                            </span>
                        </div>

                        <div className="flex flex-1 flex-col justify-center">
                            <h2 className="max-w-lg text-3xl font-extrabold leading-tight tracking-tight xl:text-4xl">
                                Logística inteligente para um mundo que não pode parar.
                            </h2>

                            <div className="mt-10 space-y-4">
                                {[
                                    "Mais eficiência",
                                    "Mais oportunidades",
                                    "Mais resultados",
                                ].map((benefit) => (
                                    <div
                                        key={benefit}
                                        className="flex items-center gap-3 text-sm font-medium"
                                    >
                                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-xs">
                                            ✓
                                        </span>
                                        {benefit}
                                    </div>
                                ))}
                            </div>
                        </div>

                        <footer className="flex items-center justify-between border-t border-white/10 pt-6 text-xs text-slate-300">
                            <span>RotaLog Cloud v2.4</span>
                            <span>Suporte 24/7</span>
                        </footer>
                    </div>
                </aside>
            </div>
        </div>
    );
}

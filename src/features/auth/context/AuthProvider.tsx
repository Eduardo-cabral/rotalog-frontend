import { authMode } from "../../../shared/api/config";
import { apiAuthService, authenticatedRequest, subscribeSessionExpired, type ApiUser } from "../../services/apiAuth.service";

import { useEffect, useState, type ReactNode } from "react";

import { AuthContext } from "./AuthContext";

import {
    mockAuthService,
    type AuthUser,
    type LoginCredentials,
} from "../../services/auth.service";

type AuthProviderProps = {
    children: ReactNode;
};

const SESSION_KEY = "rotalog:mock-auth-user";

function getStoredUser(): AuthUser | null {
    try {
        const storedUser = sessionStorage.getItem(SESSION_KEY);

        if (!storedUser) {
            return null;
        }

        const parsedUser: unknown = JSON.parse(storedUser);

        if (
            typeof parsedUser !== "object" ||
            parsedUser === null ||
            !("id" in parsedUser) ||
            !("name" in parsedUser) ||
            !("email" in parsedUser) ||
            !("role" in parsedUser) ||
            typeof parsedUser.id !== "string" ||
            typeof parsedUser.name !== "string" ||
            typeof parsedUser.email !== "string" ||
            (parsedUser.role !== "BUYER_ADMIN" &&
                parsedUser.role !== "SUPPLIER_OPERATOR")
        ) {
            sessionStorage.removeItem(SESSION_KEY);
            return null;
        }

        return {
            id: parsedUser.id,
            name: parsedUser.name,
            email: parsedUser.email,
            role: parsedUser.role,
        };
    } catch {
        sessionStorage.removeItem(SESSION_KEY);
        return null;
    }
}

export function AuthProvider({ children }: AuthProviderProps) {
    const [user, setUser] = useState<AuthUser | null>(() => authMode === "mock" ? getStoredUser() : null);

    const [isLoading, setIsLoading] = useState(authMode === "api");
    const [sessionError, setSessionError] = useState("");
    const [sessionNotice, setSessionNotice] = useState("");
    useEffect(() => {
        if (authMode !== "api") return;
        let active = true;
        const unsubscribe = subscribeSessionExpired(reason => {
            setUser(null);
            setSessionError(reason === "password-changed" ? "" : "Sessão encerrada. Entre novamente.");
            setSessionNotice(reason === "password-changed" ? "Senha alterada com sucesso. Entre com a nova senha." : "");
        });
        void apiAuthService.restore().then(restored => {
            if (active) { setUser(restored); setIsLoading(false); }
        });
        return () => { active = false; unsubscribe(); };
    }, []);
    const userId = user?.id;
    useEffect(() => {
        if (authMode !== "api" || !userId) return;
        let active = true;
        const validate = () => {
            void authenticatedRequest<ApiUser>("/api/v1/me")
                .then(profile => { if (active) setUser(profile); })
                .catch(() => { if (active) setSessionError("Não foi possível validar a sessão. Tente novamente."); });
        };
        const interval = window.setInterval(validate, 60_000);
        window.addEventListener("focus", validate);
        return () => { active = false; window.clearInterval(interval); window.removeEventListener("focus", validate); };
    }, [userId]);
    const service = authMode === "api" ? apiAuthService : mockAuthService;

    async function login(credentials: LoginCredentials) {
        const authenticatedUser = await service.login(credentials);

        if (authMode === "mock") sessionStorage.setItem(
            SESSION_KEY,
            JSON.stringify(authenticatedUser)
        );

        setSessionError("");
        setUser(authenticatedUser);

        return authenticatedUser;
    }

    async function logout() {
        try {
            await service.logout();
            setSessionError("");
        } catch {
            setSessionError("Sessão local encerrada. Não foi possível confirmar a revogação no servidor.");
        } finally {
            sessionStorage.removeItem(SESSION_KEY);
            setUser(null);
        }
    }

    return (
        <AuthContext.Provider
            value={{
                user,
                isLoading,
                sessionError,
                sessionNotice,
                isAuthenticated: user !== null,
                login,
                logout,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
}

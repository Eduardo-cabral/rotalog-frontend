import { ApiError, request } from "../../shared/api/http";
import type { AuthUser, LoginCredentials } from "./auth.service";
import type { Permission } from "../auth/mocks/users.mock";

export type ApiUser = AuthUser & {
    organization_id: string;
    organizations: { id: string; name: string; role: AuthUser["role"] }[];
    capabilities: string[];
    demo_run_id: string;
    is_synthetic: true;
};
type TokenResponse = { access_token: string; token_type: "bearer"; expires_in: number; csrf_token: string | null; refresh_token: string | null; user: ApiUser };
const CSRF_KEY = "rotalog:api-csrf";
let accessToken: string | null = null;
let expiresAt = 0;
let refreshPromise: Promise<void> | null = null;
let restorePromise: Promise<ApiUser | null> | null = null;
let generation = 0;
const listeners = new Set<() => void>();

export function subscribeSessionExpired(listener: () => void) {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
}
function clearSession() {
    accessToken = null;
    expiresAt = 0;
    sessionStorage.removeItem(CSRF_KEY);
    listeners.forEach(listener => listener());
}
function applyTokens(data: TokenResponse) {
    accessToken = data.access_token;
    expiresAt = Date.now() + data.expires_in * 1000;
    if (data.csrf_token) sessionStorage.setItem(CSRF_KEY, data.csrf_token);
}
export function refreshSession(): Promise<void> {
    if (refreshPromise) return refreshPromise;
    const csrf = sessionStorage.getItem(CSRF_KEY);
    if (!csrf) return Promise.reject(new ApiError(401));
    const current = generation;
    const renew = () => request<TokenResponse>("/api/v1/auth/refresh", {
        method: "POST", headers: { "X-CSRF-Token": csrf },
    });
    refreshPromise = (navigator.locks ? navigator.locks.request("rotalog:refresh", renew) : renew())
        .then(data => { if (current === generation) applyTokens(data); })
        .catch(error => { if (current === generation) clearSession(); throw error; })
        .finally(() => { refreshPromise = null; });
    return refreshPromise;
}
export async function authenticatedRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
    if (!accessToken || Date.now() >= expiresAt - 30_000) await refreshSession();
    const send = () => {
        const headers = new Headers(options.headers);
        headers.set("Authorization", `Bearer ${accessToken}`);
        return request<T>(path, { ...options, headers });
    };
    const sentToken = accessToken;
    try { return await send(); }
    catch (error) {
        if (!(error instanceof ApiError) || error.status !== 401) throw error;
        if (sentToken === accessToken) await refreshSession();
        try { return await send(); }
        catch (retryError) {
            if (retryError instanceof ApiError && retryError.status === 401) clearSession();
            throw retryError;
        }
    }
}
export function supplierPermissions(user: AuthUser): Permission[] {
    if (user.role !== "SUPPLIER_OPERATOR" || !user.organizations?.some(org => org.id === user.organization_id && org.role === "SUPPLIER_OPERATOR")) return [];
    const capabilities = user.capabilities ?? [];
    const permissions: Permission[] = [];
    if (capabilities.includes("supplier_order:manage")) permissions.push("dashboard:view", "orders:view");
    if (capabilities.includes("offer:write")) permissions.push("products:view");
    if (capabilities.includes("inventory:write")) permissions.push("inventory:view");
    return permissions;
}
export function buyerAuthorized(user: AuthUser, capability = "catalog:read"): boolean {
    return user.role === "BUYER_ADMIN" &&
        !!user.organization_id &&
        !!user.organizations?.some(org => org.id === user.organization_id && org.role === "BUYER_ADMIN") &&
        !!user.capabilities?.includes(capability);
}
function authorize(user: ApiUser): ApiUser {
    if (
        !supplierPermissions(user).length &&
        !buyerAuthorized(user) &&
        !buyerAuthorized(user, "purchase:read")
    ) {
        throw new ApiError(403);
    }
    return user;
}
export const apiAuthService = {
    async login({ email, password }: LoginCredentials): Promise<ApiUser> {
        generation++;
        await refreshPromise?.catch(() => {});
        clearSession();
        const data = await request<TokenResponse>("/api/v1/auth/login?client_type=browser", {
            method: "POST", body: new URLSearchParams({ username: email.trim().toLowerCase(), password }),
        });
        applyTokens(data);
        try { return authorize(await authenticatedRequest<ApiUser>("/api/v1/me")); }
        catch (error) { await this.logout().catch(() => {}); throw error; }
    },
    restore(): Promise<ApiUser | null> {
        if (!sessionStorage.getItem(CSRF_KEY)) return Promise.resolve(null);
        if (!restorePromise) restorePromise = refreshSession()
            .then(() => authenticatedRequest<ApiUser>("/api/v1/me"))
            .then(authorize)
            .catch(() => { clearSession(); return null; })
            .finally(() => { restorePromise = null; });
        return restorePromise;
    },
    async logout(): Promise<void> {
        await refreshPromise?.catch(() => {});
        try {
            // Bearer logout revokes the session without requiring a refresh rotation.
            if (accessToken && Date.now() >= expiresAt) await refreshSession();
            const headers: Record<string, string> = accessToken
                ? { Authorization: `Bearer ${accessToken}` }
                : { "X-CSRF-Token": sessionStorage.getItem(CSRF_KEY) ?? "" };
            await request<void>("/api/v1/auth/logout", { method: "POST", headers });
        } finally { generation++; clearSession(); }
    },
};

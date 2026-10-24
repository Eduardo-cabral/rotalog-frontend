import { authMode } from "../../../shared/api/config";
import { adminAuthorized, buyerAuthorized, supplierPermissions } from "../../services/apiAuth.service";

import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";

import { useAuth } from "../hooks/useAuth";
import type { UserRole } from "../../services/auth.service";

type ProtectedRouteProps = {
    allowedRoles: UserRole[];
    children: ReactNode;
    capability?: string;
};

export function ProtectedRoute({
    allowedRoles,
    children,
    capability,
}: ProtectedRouteProps) {
    const { user, isAuthenticated, isLoading } = useAuth();
    const location = useLocation();

    if (isLoading) return <p role="status">Verificando sessão...</p>;

    if (!isAuthenticated || !user) {
        return (
            <Navigate
                to="/login"
                replace
                state={{ from: location.pathname }}
            />
        );
    }

    if (!allowedRoles.includes(user.role)) {
        return (
            <Navigate
                to={user.role === "ROTALOG_ADMIN" ? "/admin" : user.role === "BUYER_ADMIN" ? "/" : "/fornecedor"}
                replace
            />
        );
    }

    if (authMode === "api" && allowedRoles.includes("SUPPLIER_OPERATOR") && !supplierPermissions(user).length) {
        return <p role="alert">Acesso não autorizado para este fornecedor.</p>;
    }
    if (authMode === "api" && user.role === "BUYER_ADMIN") {
        const authorized = capability
            ? buyerAuthorized(user, capability)
            : buyerAuthorized(user, "catalog:read") || buyerAuthorized(user, "purchase:read");
        if (!authorized) return <p role="alert">Acesso não autorizado para esta organização ou operação.</p>;
    }
    if (authMode === "api" && user.role === "ROTALOG_ADMIN" && !adminAuthorized(user, capability)) {
        return <p role="alert">Acesso não autorizado para esta organização ou operação administrativa.</p>;
    }
    return <>{children}</>;
}

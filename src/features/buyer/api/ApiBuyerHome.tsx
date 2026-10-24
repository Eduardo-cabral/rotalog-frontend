import { Navigate } from "react-router-dom";
import { useAuth } from "../../auth/hooks/useAuth";
import { buyerAuthorized } from "../../services/apiAuth.service";
import { ApiBuyerCatalog } from "./BuyerPages";

export function ApiBuyerHome() {
    const { user, isLoading } = useAuth();
    if (isLoading) return <p role="status">Verificando sessão...</p>;
    if (!user) return <Navigate to="/login" replace state={{ from: "/" }} />;
    if (user.role === "ROTALOG_ADMIN") return <Navigate to="/admin" replace />;
    if (user.role === "SUPPLIER_OPERATOR") return <Navigate to="/fornecedor" replace />;
    if (buyerAuthorized(user, "catalog:read")) return <ApiBuyerCatalog />;
    if (buyerAuthorized(user, "purchase:read")) return <Navigate to="/comprador/compras" replace />;
    return <p role="alert">Sua organização não tem permissão para consultar catálogo ou compras.</p>;
}

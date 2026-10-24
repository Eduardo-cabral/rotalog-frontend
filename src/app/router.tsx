import { createBrowserRouter, Outlet } from "react-router-dom";

import { Login } from "../features/auth/pages/Login";
import { Register } from "../features/auth/pages/Register";
import { ProtectedRoute } from "../features/auth/components/ProtectedRoute";
import { authMode } from "../shared/api/config";

import { NotFoundPage } from "../shared/pages/NotFoundPage";
import { SupplierRoutes } from "../features/orders/pages/SupplierRoutes";
import { SupplierAccount } from "../features/account/pages/SupplierAccount";
import { ProductCatalog } from "../features/catalog/pages/ProductCatalog";
import { ProductDetails } from "../features/catalog/pages/ProductDetails";
import { AppLayout } from "../shared/components/AppLayout";
import { MarketplaceLayout } from "../shared/components/MarketplaceLayout";

import { SupplierDashboard } from "../features/dashboard/pages/SupplierDashboard";
import { SupplierOrders } from "../features/orders/pages/SupplierOrders";
import { SupplierProducts } from "../features/products/pages/SupplierProducts";
import { ApiSupplierProducts } from "../features/products/api/ApiSupplierProducts";
import { SupplierInventory } from "../features/inventory/pages/SupplierInventory";
import { ApiSupplierInventory } from "../features/inventory/api/ApiSupplierInventory";
import { ApiOrdersProvider } from "../features/orders/api/OrdersProvider";
import { ApiSupplierOrders } from "../features/orders/api/ApiSupplierOrders";
import { ApiSupplierDashboard } from "../features/dashboard/pages/ApiSupplierDashboard";

import { BuyerAccount } from "../features/account/pages/BuyerAccount";
import { BuyerCart } from "../features/cart/pages/BuyerCart";
import { BuyerPurchases } from "../features/purchases/pages/BuyerPurchases";
import { BuyerPurchaseDetails } from "../features/purchases/pages/BuyerPurchaseDetails";
import {
    ApiBuyerProductDetails,
    ApiBuyerCart,
    ApiBuyerPurchases,
    ApiBuyerPurchaseDetails,
} from "../features/buyer/api/BuyerPages";
import { ApiBuyerHome } from "../features/buyer/api/ApiBuyerHome";
import { AdminLayout } from "../features/admin/layout/AdminLayout";
import { AdminAccount, AdminCatalog, AdminOverview, AdminProductCreate } from "../features/admin/pages/AdminPages";

export const router = createBrowserRouter([
    {
        path: "/",
        element: <MarketplaceLayout />,
        errorElement: <NotFoundPage />,
        children: [
            { index: true, element: authMode === "api" ? <ApiBuyerHome /> : <ProductCatalog /> },
            {
                path: "produto/:productId",
                element: (
                    <ProtectedRoute allowedRoles={["BUYER_ADMIN"]} capability={authMode === "api" ? "catalog:read" : undefined}>
                        {authMode === "api" ? <ApiBuyerProductDetails /> : <ProductDetails />}
                    </ProtectedRoute>
                ),
            },
            {
                path: "comprador",
                element: (
                    <ProtectedRoute allowedRoles={["BUYER_ADMIN"]}>
                        <Outlet />
                    </ProtectedRoute>
                ),
                children: [
                    {
                        path: "carrinho",
                        element: authMode === "api"
                            ? <ProtectedRoute allowedRoles={["BUYER_ADMIN"]} capability="checkout:create"><ApiBuyerCart /></ProtectedRoute>
                            : <BuyerCart />,
                    },
                    {
                        path: "compras",
                        element: authMode === "api"
                            ? <ProtectedRoute allowedRoles={["BUYER_ADMIN"]} capability="purchase:read"><ApiBuyerPurchases /></ProtectedRoute>
                            : <BuyerPurchases />,
                    },
                    {
                        path: "compras/:purchaseId",
                        element: authMode === "api"
                            ? <ProtectedRoute allowedRoles={["BUYER_ADMIN"]} capability="purchase:read"><ApiBuyerPurchaseDetails /></ProtectedRoute>
                            : <BuyerPurchaseDetails />,
                    },
                    { path: "conta", element: <BuyerAccount /> },
                ],
            },
        ],
    },
    { path: "/login", element: <Login /> },
    { path: "/cadastro", element: <Register /> },
    {
        path: "/admin",
        element: (
            <ProtectedRoute allowedRoles={["ROTALOG_ADMIN"]} capability="catalog:read">
                <AdminLayout />
            </ProtectedRoute>
        ),
        errorElement: <NotFoundPage />,
        children: [
            { index: true, element: <AdminOverview /> },
            { path: "products", element: <AdminCatalog /> },
            {
                path: "products/new",
                element: <ProtectedRoute allowedRoles={["ROTALOG_ADMIN"]} capability="product:write"><AdminProductCreate /></ProtectedRoute>,
            },
            { path: "account", element: <AdminAccount /> },
        ],
    },
    {
        path: "/fornecedor",
        element: (
            <ProtectedRoute allowedRoles={["SUPPLIER_OPERATOR"]}>
                {authMode === "api" ? <ApiOrdersProvider><AppLayout /></ApiOrdersProvider> : <AppLayout />}
            </ProtectedRoute>
        ),
        errorElement: <NotFoundPage />,
        children: [
            { index: true, element: authMode === "api" ? <ApiSupplierDashboard /> : <SupplierDashboard /> },
            { path: "pedidos", element: authMode === "api" ? <ApiSupplierOrders /> : <SupplierOrders /> },
            { path: "produtos", element: authMode === "api" ? <ApiSupplierProducts /> : <SupplierProducts /> },
            { path: "estoque", element: authMode === "api" ? <ApiSupplierInventory /> : <SupplierInventory /> },
            { path: "conta", element: <SupplierAccount /> },
            { path: "rotas", element: <SupplierRoutes /> },
        ],
    },
    { path: "*", element: <NotFoundPage /> },
]);

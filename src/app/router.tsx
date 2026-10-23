
import { createBrowserRouter, Navigate, Outlet } from "react-router-dom";

import { Login } from "../features/auth/pages/Login";
import { Register } from "../features/auth/pages/Register";
import { ProtectedRoute } from "../features/auth/components/ProtectedRoute";

import { NotFoundPage } from "../shared/pages/NotFoundPage";
import { FeaturePlaceholder } from "../shared/pages/FeaturePlaceholder";

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
import { authMode } from "../shared/api/config";
import { ApiOrdersProvider } from "../features/orders/api/OrdersProvider";
import { ApiSupplierOrders } from "../features/orders/api/ApiSupplierOrders";
import { ApiSupplierDashboard } from "../features/dashboard/pages/ApiSupplierDashboard";

import { BuyerAccount } from "../features/account/pages/BuyerAccount";
import { BuyerCart } from "../features/cart/pages/BuyerCart";
import { BuyerPurchases } from "../features/purchases/pages/BuyerPurchases";
import { BuyerPurchaseDetails } from "../features/purchases/pages/BuyerPurchaseDetails";
import { BuyerApiCatalog } from "../features/buyer/api/BuyerApiCatalog";
import { BuyerApiProductDetails } from "../features/buyer/api/BuyerApiProductDetails";
import { BuyerApiPurchaseDetails, BuyerApiPurchaseList } from "../features/buyer/api/BuyerApiPurchases";

export const router = createBrowserRouter([
  // Marketplace público e portal do comprador
  {
    path: "/",
    element: <MarketplaceLayout />,
    errorElement: <NotFoundPage />,
    children: [
      {
        index: true,
        element: authMode === "api" ? (
          <ProtectedRoute allowedRoles={["BUYER_ADMIN"]} capability="catalog:read">
            <BuyerApiCatalog />
          </ProtectedRoute>
        ) : <ProductCatalog />,
      },
      {
        path: "produto/:productId",
        element: authMode === "api" ? (
          <ProtectedRoute allowedRoles={["BUYER_ADMIN"]} capability="catalog:read">
            <BuyerApiProductDetails />
          </ProtectedRoute>
        ) : (
          <ProtectedRoute allowedRoles={["BUYER_ADMIN"]}>
            <ProductDetails />
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
            element: authMode === "api" ? <Navigate to="/" replace /> : <BuyerCart />,
          },
          {
            path: "compras",
            element: authMode === "api" ? (
              <ProtectedRoute allowedRoles={["BUYER_ADMIN"]} capability="purchase:read">
                <BuyerApiPurchaseList />
              </ProtectedRoute>
            ) : <BuyerPurchases />,
          },
          {
            path: "compras/:purchaseId",
            element: authMode === "api" ? (
              <ProtectedRoute allowedRoles={["BUYER_ADMIN"]} capability="purchase:read">
                <BuyerApiPurchaseDetails />
              </ProtectedRoute>
            ) : <BuyerPurchaseDetails />,
          },
          {
            path: "conta",
            element: authMode === "api" ? <Navigate to="/" replace /> : <BuyerAccount />,
          },
        ],
      },
    ],
  },

  // Autenticação
  {
    path: "/login",
    element: <Login />,
  },
  {
    path: "/cadastro",
    element: <Register />,
  },

  // Portal do fornecedor
  {
    path: "/fornecedor",
    element: (
      <ProtectedRoute allowedRoles={["SUPPLIER_OPERATOR"]}>
        {authMode === "api" ? <ApiOrdersProvider><AppLayout /></ApiOrdersProvider> : <AppLayout />}
      </ProtectedRoute>
    ),
    errorElement: <NotFoundPage />,
    children: [
      {
        index: true,
        element: authMode === "api" ? <ApiSupplierDashboard /> : <SupplierDashboard />,
      },
      {
        path: "pedidos",
        element: authMode === "api" ? <ApiSupplierOrders /> : <SupplierOrders />,
      },
      {
        path: "produtos",
        element: authMode === "api" ? <ApiSupplierProducts /> : <SupplierProducts />,
      },
      {
        path: "estoque",
        element: authMode === "api" ? <ApiSupplierInventory /> : <SupplierInventory />,
      },
      {
        path: "rotas",
        element: (
          <FeaturePlaceholder
            title="Rotas"
            description="Visualização das rotas e operações logísticas autorizadas."
          />
        ),
      },
    ],
  },

  // Rotas não encontradas
  {
    path: "*",
    element: <NotFoundPage />,
  },
]);

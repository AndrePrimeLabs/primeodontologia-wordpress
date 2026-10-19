// @ts-nocheck
import React, { Suspense } from "react";
import { Toaster } from "@/components/ui/toaster"
import { RealtimeMeshListener } from "@/hooks/useRealtimeMesh";
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import NavigationTracker from '@/lib/NavigationTracker'
import { pagesConfig } from './pages.config'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/auth-context';
import AccessDeniedError from '@/components/AccessDeniedError';

const { Pages, Layout, mainPage } = pagesConfig;
const mainPageKey = mainPage ?? Object.keys(Pages)[0];
const MainPage = mainPageKey ? Pages[mainPageKey] : <></>;

// Role-Based Access Control (RBAC) permission map for sensitive pages
const ROUTE_PERMISSIONS = {
  AdminPanel: ['admin'],
  Backup: ['admin'],
  APIConfig: ['admin'],
  DatabaseMap: ['admin'],
  Financeiro: ['admin', 'gestor', 'financeiro'],
  DashboardFinanceiro: ['admin', 'gestor', 'financeiro'],
  RelatoriosFinanceiros: ['admin', 'gestor', 'financeiro'],
  CostStructure: ['admin', 'gestor', 'financeiro'],
  RevenueStreams: ['admin', 'gestor', 'financeiro', 'dentista'],
  Revenue: ['admin', 'gestor', 'financeiro', 'dentista'],
};

const LayoutWrapper = ({ children, currentPageName }) => Layout ?
  <Layout currentPageName={currentPageName}>{children}</Layout>
  : <>{children}</>;

const ProtectedRoute = ({ pageName, children }) => {
  const { hasRole } = useAuth();
  const requiredRoles = ROUTE_PERMISSIONS[pageName];

  if (requiredRoles && !hasRole(requiredRoles)) {
    const roleLabels = requiredRoles.map(r => r.toUpperCase()).join(' ou ');
    return <AccessDeniedError requiredRole={roleLabels} pageTitle={pageName} />;
  }

  return children;
};

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, isAuthenticated, navigateToLogin } = useAuth();

  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (authError) {
    if (authError.type === 'access_denied') {
      return <AccessDeniedError />;
    } else if (authError.type === 'auth_required') {
      navigateToLogin();
      return null;
    }
  }

  if (!isAuthenticated) {
    navigateToLogin();
    return null;
  }

  return (
    <Suspense
      fallback={
        <div className="fixed inset-0 flex items-center justify-center bg-white/70 backdrop-blur-sm z-50">
          <div className="w-9 h-9 border-4 border-slate-200 border-t-teal-700 rounded-full animate-spin"></div>
        </div>
      }
    >
      <Routes>
        <Route path="/" element={
          <LayoutWrapper currentPageName={mainPageKey}>
            <ProtectedRoute pageName={mainPageKey}>
              <MainPage />
            </ProtectedRoute>
          </LayoutWrapper>
        } />
        {Object.entries(Pages).map(([path, Page]) => (
          <Route
            key={path}
            path={`/${path}`}
            element={
              <LayoutWrapper currentPageName={path}>
                <ProtectedRoute pageName={path}>
                  <Page />
                </ProtectedRoute>
              </LayoutWrapper>
            }
          />
        ))}
        <Route path="*" element={<PageNotFound />} />
      </Routes>
    </Suspense>
  );
};

function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router
          basename={import.meta.env.BASE_URL}
          future={{
            v7_startTransition: true,
            v7_relativeSplatPath: true
          }}
        >
          <NavigationTracker />
          <AuthenticatedApp />
        </Router>
        <RealtimeMeshListener />
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App

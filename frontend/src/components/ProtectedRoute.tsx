/**
 * ProtectedRoute.tsx
 * Route guard component for protecting private pages.
 *
 * Responsibilities:
 *  - Allow access only to authenticated users (via AuthContext)
 *  - Redirect unauthenticated users to the login page
 *  - Prevents flashing of protected content before redirect
 *
 * Works seamlessly with AuthProvider + React Router v6.
 */

import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    // Redirect to login while preserving intended destination
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;

// src/App.tsx
import React, { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import PaymentHistory from "./pages/PaymentHistory";

// Protected Route
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const token = localStorage.getItem("token");
    if (!token) {
        console.log("🔒 No token found - redirecting to login");
        return <Navigate to="/login" replace />;
    }
    return <>{children}</>;
};

const App: React.FC = () => {
    

    useEffect(() => {
        const token = localStorage.getItem("token");
        setIsAuthenticated(!!token);
    }, []);

    return (
        <BrowserRouter>
            <Routes>
                <Route path="/login" element={<Login />} />
                <Route
                    path="/"
                    element={
                        <ProtectedRoute>
                            <Dashboard />
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/payment-history"
                    element={
                        <ProtectedRoute>
                            <PaymentHistory />
                        </ProtectedRoute>
                    }
                />
                <Route path="*" element={<Navigate to="/login" replace />} />
            </Routes>
        </BrowserRouter>
    );
};

// ✅ Default export is required for main.tsx to import it
export default App;

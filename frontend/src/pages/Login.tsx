import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

const Login: React.FC = () => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const navigate = useNavigate();

    useEffect(() => {
        const token = localStorage.getItem('token');
        if (token) {
            console.log('✅ Already logged in - redirecting to dashboard');
            navigate('/');
        }
    }, [navigate]);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        console.log('🔐 Attempting login for:', username);

        try {
            const response = await fetch(`${API_URL}/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ username, password }),
            });

            console.log('📡 Response status:', response.status);

            if (!response.ok) {
                const errorData = await response.json();
                console.error('❌ Login failed:', errorData);
                throw new Error(errorData.detail || 'Login failed');
            }

            const data = await response.json();
            console.log('✅ Login response:', data);

            if (data.success && data.token) {
                // Store token and user info
                localStorage.setItem('token', data.token);
                localStorage.setItem('user', JSON.stringify(data.user));

                console.log('✅ Token stored:', data.token.substring(0, 20) + '...');
                console.log('✅ User info stored:', data.user);

                // Redirect to dashboard
                navigate('/');
            } else {
                throw new Error('Invalid response from server');
            }
        } catch (err: any) {
            console.error('❌ Login error:', err);
            setError(err.message || 'Login failed. Please check your credentials.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
            <div className="max-w-md w-full">
                <div className="text-center mb-8">
                    <div className="w-20 h-20 bg-gradient-to-br from-blue-600 to-purple-700 rounded-2xl flex items-center justify-center shadow-lg mx-auto mb-4">
                        <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                    </div>
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent">
                        Vicidial Dashboard
                    </h1>
                    <p className="text-gray-600 mt-2">Sign in to access your analytics</p>
                </div>

                <div className="bg-white/80 backdrop-blur-lg rounded-2xl shadow-xl border border-gray-200/60 p-8">
                    <form onSubmit={handleLogin} className="space-y-6">
                        {error && (
                            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                                <p className="text-red-700 text-sm font-medium">{error}</p>
                            </div>
                        )}

                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                                Username
                            </label>
                            <input
                                type="text"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                className="w-full px-4 py-3 border border-gray-300/80 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-300 bg-white/50 backdrop-blur-sm"
                                placeholder="Enter your username"
                                required
                                disabled={loading}
                                autoComplete="username"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                                Password
                            </label>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full px-4 py-3 border border-gray-300/80 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-300 bg-white/50 backdrop-blur-sm"
                                placeholder="Enter your password"
                                required
                                disabled={loading}
                                autoComplete="current-password"
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white py-3 px-4 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 font-semibold flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? (
                                <>
                                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                                    Signing in...
                                </>
                            ) : (
                                <>
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                                    </svg>
                                    Sign In
                                </>
                            )}
                        </button>
                    </form>

                    <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
                        <p className="text-sm text-blue-700 text-center">
                            💡 Default: admin / admin123
                        </p>
                    </div>
                </div>

                <div className="text-center mt-6">
                    <p className="text-sm text-gray-500">
                        Secure access to your call analytics
                    </p>
                </div>
            </div>
        </div>
    );
};

export default Login;
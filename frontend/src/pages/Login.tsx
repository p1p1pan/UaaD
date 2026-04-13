import React, { useState } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { LogIn, User, Lock, ArrowRight, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { login as loginRequest } from '../api/endpoints';
import LanguageToggle from '../components/LanguageToggle';
import { useAuth } from '../context/AuthContext';

const LoginPage = () => {
  const { t } = useTranslation();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const authPayload = await loginRequest({ phone, password });
      const { token, role, username } = authPayload;
      login(token);
      localStorage.setItem('user_role', role);
      localStorage.setItem('username', username);
      const fallbackPath = '/';
      const from = (location.state as { from?: { pathname?: string; search?: string } } | null)?.from;
      const nextPath = from?.pathname
        ? `${from.pathname}${from.search ?? ''}`
        : fallbackPath;
      navigate(nextPath, { replace: true });
    } catch (err) {
      const error = err as { response?: { data?: { message?: string } } };
      setError(error.response?.data?.message || t('auth.errorMsg'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-white px-4 py-10">
      <div className="pointer-events-none absolute -left-24 -top-20 h-64 w-64 rounded-full bg-rose-200/50 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -right-20 h-72 w-72 rounded-full bg-pink-100 blur-3xl" />
      {/* Language Toggle in Top Right */}
      <div className="absolute top-6 right-6 z-50">
        <LanguageToggle />
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative z-10 w-full max-w-md rounded-3xl border border-rose-100 bg-white/95 p-8 shadow-[0_20px_60px_-25px_rgba(225,29,72,0.35)] backdrop-blur"
      >
        <div className="flex flex-col items-center mb-8">
          <div className="mb-4 rounded-2xl bg-rose-50 p-3">
            <LogIn className="h-8 w-8 text-rose-500" />
          </div>
          <h1 className="bg-gradient-to-r from-rose-600 to-pink-500 bg-clip-text text-3xl font-bold text-transparent">
            {t('auth.welcome')}
          </h1>
          <p className="mt-2 text-slate-500">{t('auth.enterCredentials')}</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          <div className="space-y-2">
            <label htmlFor="phone" className="ml-1 text-sm font-medium text-slate-700">{t('auth.phone')}</label>
            <div className="relative group">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-rose-300 transition-colors group-focus-within:text-rose-500">
                <User className="h-5 w-5" />
              </div>
              <input
                id="phone"
                type="text"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="block w-full rounded-xl border border-rose-100 bg-rose-50/40 py-3 pl-10 pr-3 text-slate-800 placeholder-slate-400 transition-all focus:border-rose-300 focus:outline-none focus:ring-2 focus:ring-rose-200"
                placeholder="13800000000"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label htmlFor="password" className="ml-1 text-sm font-medium text-slate-700">{t('auth.password')}</label>
            <div className="relative group">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-rose-300 transition-colors group-focus-within:text-rose-500">
                <Lock className="h-5 w-5" />
              </div>
              <input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="block w-full rounded-xl border border-rose-100 bg-rose-50/40 py-3 pl-10 pr-3 text-slate-800 placeholder-slate-400 transition-all focus:border-rose-300 focus:outline-none focus:ring-2 focus:ring-rose-200"
                placeholder="••••••••"
              />
            </div>
          </div>

          {error && (
            <motion.div 
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-500"
            >
              {error}
            </motion.div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="group flex w-full items-center justify-center rounded-xl bg-rose-500 py-3 font-semibold text-white shadow-lg shadow-rose-500/25 transition-all duration-200 hover:bg-rose-400 focus:outline-none focus:ring-2 focus:ring-rose-300 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                {t('auth.signIn')}
                <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </>
            )}
          </button>
        </form>

        <div className="mt-8 text-center text-slate-500">
          {t('auth.noAccount')}{' '}
          <Link
            to="/register"
            state={location.state ?? undefined}
            className="font-medium text-rose-500 transition-colors hover:text-rose-600"
          >
            {t('auth.register')}
          </Link>
        </div>
      </motion.div>
    </div>
  );
};

export default LoginPage;

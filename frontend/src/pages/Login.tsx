import React, { useState } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { isAxiosError } from 'axios';
import { LogIn, Phone, Lock, ArrowLeft, ArrowRight, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { login as loginRequest } from '../api/endpoints';
import LanguageToggle from '../components/LanguageToggle';
import { useAuth } from '../context/AuthContext';
import { getPostLoginPath, normalizeRedirectPath } from '../utils/auth';

const PHONE_PATTERN = /^1[3-9]\d{9}$/;

interface FieldErrors {
  phone: string;
  password: string;
}

interface BackendErrorPayload {
  code?: number;
  message?: string;
}

const LoginPage = () => {
  const { t } = useTranslation();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({ phone: '', password: '' });
  const navigate = useNavigate();
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const { login } = useAuth();

  const sessionExpiredMessage =
    searchParams.get('reason') === 'session_expired'
      ? t('auth.sessionExpired')
      : '';

  const resolveRequestedPath = () => {
    const from = (
      location.state as {
        from?: { pathname?: string; search?: string; hash?: string };
      } | null
    )?.from;

    if (from?.pathname) {
      return normalizeRedirectPath(
        `${from.pathname}${from.search ?? ''}${from.hash ?? ''}`
      );
    }

    return normalizeRedirectPath(searchParams.get('redirect'));
  };

  const validateForm = () => {
    const nextFieldErrors: FieldErrors = { phone: '', password: '' };
    const normalizedPhone = phone.trim();

    if (!normalizedPhone) {
      nextFieldErrors.phone = t('auth.phoneRequired');
    } else if (!PHONE_PATTERN.test(normalizedPhone)) {
      nextFieldErrors.phone = t('auth.phoneInvalid');
    }

    if (!password.trim()) {
      nextFieldErrors.password = t('auth.passwordRequired');
    }

    setFieldErrors(nextFieldErrors);

    return {
      normalizedPhone,
      isValid: !nextFieldErrors.phone && !nextFieldErrors.password,
    };
  };

  const handlePhoneChange = (value: string) => {
    setPhone(value);
    if (fieldErrors.phone) {
      setFieldErrors((current) => ({ ...current, phone: '' }));
    }
    if (error) {
      setError('');
    }
  };

  const handlePasswordChange = (value: string) => {
    setPassword(value);
    if (fieldErrors.password) {
      setFieldErrors((current) => ({ ...current, password: '' }));
    }
    if (error) {
      setError('');
    }
  };

  const getLoginErrorMessage = (caughtError: unknown) => {
    if (!isAxiosError<BackendErrorPayload>(caughtError)) {
      return t('auth.errorMsg');
    }

    if (!caughtError.response) {
      return t('auth.networkError');
    }

    const { status, data } = caughtError.response;
    const backendMessage = data?.message ?? '';
    const backendCode = data?.code;

    if (status === 429 || backendCode === 1006) {
      return t('auth.rateLimited');
    }

    if (status === 401 || backendCode === 1002) {
      return t('auth.sessionExpired');
    }

    if (status === 400 && backendMessage.includes('手机号或密码错误')) {
      return t('auth.invalidCredentials');
    }

    if (status === 400 && backendMessage.includes('请求参数错误')) {
      return t('auth.invalidRequest');
    }

    return t('auth.errorMsg');
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) {
      return;
    }
    setError('');

    const { normalizedPhone, isValid } = validateForm();
    if (!isValid) {
      return;
    }

    setLoading(true);

    try {
      const authPayload = await loginRequest({ phone: normalizedPhone, password });
      login(authPayload);
      const nextPath = getPostLoginPath(authPayload.role, resolveRequestedPath());
      navigate(nextPath, { replace: true });
    } catch (caughtError) {
      setError(getLoginErrorMessage(caughtError));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-white px-4 py-10">
      <div className="pointer-events-none absolute -left-24 -top-20 h-64 w-64 rounded-full bg-rose-200/50 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -right-20 h-72 w-72 rounded-full bg-pink-100 blur-3xl" />
      <button
        type="button"
        onClick={() => navigate('/')}
        className="absolute left-6 top-6 z-50 inline-flex items-center gap-2 rounded-full border border-rose-100 bg-white/95 px-4 py-2 text-sm font-semibold text-slate-600 shadow-sm transition hover:border-rose-200 hover:text-rose-600"
      >
        <ArrowLeft size={16} />
        {t('auth.backHome')}
      </button>
      {/* Language Toggle in Top Right */}
      <div className="absolute top-6 right-6 z-50">
        <LanguageToggle variant="light" />
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
          {!error && sessionExpiredMessage && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700"
            >
              {sessionExpiredMessage}
            </motion.div>
          )}

          <div className="space-y-2">
            <label htmlFor="phone" className="ml-1 text-sm font-medium text-slate-700">{t('auth.phone')}</label>
            <div className="relative group">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-rose-300 transition-colors group-focus-within:text-rose-500">
                <Phone className="h-5 w-5" />
              </div>
              <input
                id="phone"
                type="text"
                required
                disabled={loading}
                inputMode="numeric"
                autoComplete="tel"
                maxLength={11}
                value={phone}
                onChange={(e) => handlePhoneChange(e.target.value)}
                aria-invalid={!!fieldErrors.phone}
                aria-describedby={fieldErrors.phone ? 'phone-error' : undefined}
                className={`block w-full rounded-xl bg-rose-50/40 py-3 pl-10 pr-3 text-slate-800 placeholder-slate-400 transition-all focus:outline-none focus:ring-2 ${
                  fieldErrors.phone
                    ? 'border border-red-300 focus:border-red-300 focus:ring-red-100'
                    : 'border border-rose-100 focus:border-rose-300 focus:ring-rose-200'
                }`}
                placeholder="13800000000"
              />
            </div>
            {fieldErrors.phone && (
              <p id="phone-error" className="ml-1 text-sm text-red-500">
                {fieldErrors.phone}
              </p>
            )}
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
                disabled={loading}
                autoComplete="current-password"
                value={password}
                onChange={(e) => handlePasswordChange(e.target.value)}
                aria-invalid={!!fieldErrors.password}
                aria-describedby={fieldErrors.password ? 'password-error' : undefined}
                className={`block w-full rounded-xl bg-rose-50/40 py-3 pl-10 pr-3 text-slate-800 placeholder-slate-400 transition-all focus:outline-none focus:ring-2 ${
                  fieldErrors.password
                    ? 'border border-red-300 focus:border-red-300 focus:ring-red-100'
                    : 'border border-rose-100 focus:border-rose-300 focus:ring-rose-200'
                }`}
                placeholder="••••••••"
              />
            </div>
            {fieldErrors.password && (
              <p id="password-error" className="ml-1 text-sm text-red-500">
                {fieldErrors.password}
              </p>
            )}
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
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                {t('auth.signingIn')}
              </>
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

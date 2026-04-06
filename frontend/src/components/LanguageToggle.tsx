import React from 'react';
import { useTranslation } from 'react-i18next';
import { Languages } from 'lucide-react';
import { motion } from 'framer-motion';

interface LanguageToggleProps {
  variant?: 'dark' | 'light';
}

const LanguageToggle: React.FC<LanguageToggleProps> = ({ variant = 'dark' }) => {
  const { i18n, t } = useTranslation();
  const currentLanguage = i18n.resolvedLanguage?.startsWith('en') ? 'en' : 'zh';

  const toggleLanguage = () => {
    const newLang = currentLanguage === 'zh' ? 'en' : 'zh';
    i18n.changeLanguage(newLang);
  };

  const isDark = variant === 'dark';
  const nextLanguageLabel =
    currentLanguage === 'zh' ? t('common.switchToEnglish') : t('common.switchToChinese');

  return (
    <motion.button
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      onClick={toggleLanguage}
      aria-label={nextLanguageLabel}
      title={nextLanguageLabel}
      className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-semibold transition-colors ${
        isDark
          ? 'border-slate-700 bg-slate-800/50 text-slate-200 hover:border-blue-500/50'
          : 'border-rose-100 bg-white text-slate-600 shadow-sm hover:border-rose-200 hover:text-rose-600'
      }`}
    >
      <Languages size={16} className={isDark ? 'text-blue-500' : 'text-rose-500'} />
      <span
        className={`rounded-full px-2 py-0.5 text-xs tracking-[0.18em] ${
          currentLanguage === 'zh'
            ? isDark
              ? 'bg-blue-500/15 text-blue-300'
              : 'bg-rose-100 text-rose-600'
            : 'text-slate-400'
        }`}
      >
        中
      </span>
      <span
        className={`rounded-full px-2 py-0.5 text-xs tracking-[0.18em] ${
          currentLanguage === 'en'
            ? isDark
              ? 'bg-blue-500/15 text-blue-300'
              : 'bg-rose-100 text-rose-600'
            : 'text-slate-400'
        }`}
      >
        EN
      </span>
    </motion.button>
  );
};

export default LanguageToggle;

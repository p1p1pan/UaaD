import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { LayoutDashboard, LogOut, User, Settings, Bell, Calendar } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import LanguageToggle from '../components/LanguageToggle';
import { useAuth } from '../context/AuthContext';

export default function DashboardLayout() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { logout } = useAuth();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const menuItems = [
    { icon: LayoutDashboard, label: t('dashboard.overview'), path: '/app/overview' },
    { icon: Calendar, label: t('dashboard.activities'), path: '/app/activities' },
    { icon: Bell, label: t('dashboard.notifications'), path: '/app/notifications' },
    { icon: User, label: t('dashboard.profile'), path: '/app/profile' },
    { icon: Settings, label: t('dashboard.settings'), path: '/app/settings' },
  ];

  return (
    <div className="flex h-screen bg-slate-950 overflow-hidden text-slate-50">
      {/* Sidebar */}
      <motion.aside 
        initial={{ x: -20, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        className="w-64 border-r border-slate-800 bg-slate-900/20 backdrop-blur-md flex flex-col p-4"
      >
        <div className="flex items-center gap-2 px-2 mb-8 cursor-pointer" onClick={() => navigate('/app/overview')}>
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <span className="font-bold text-white text-lg">U</span>
          </div>
          <span className="text-xl font-bold bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
            {t('dashboard.brandTitle')}
          </span>
        </div>

        <nav className="flex-1 space-y-1">
          {menuItems.map((item) => {
            const isActive = location.pathname.startsWith(item.path);
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                  isActive 
                    ? 'bg-blue-600/10 text-blue-500 border border-blue-500/20 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)]' 
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/50 hover:border-transparent border border-transparent'
                }`}
              >
                <item.icon size={20} className={isActive ? "text-blue-500" : "text-slate-500"} />
                <span className="font-medium">{item.label}</span>
              </button>
            );
          })}
        </nav>

        <button 
          onClick={handleLogout}
          className="flex items-center gap-3 px-4 py-3 text-red-400 hover:text-red-300 hover:bg-red-400/10 hover:border-red-400/20 border border-transparent rounded-xl transition-all font-medium mt-auto"
        >
          <LogOut size={20} />
          {t('dashboard.logout')}
        </button>
      </motion.aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-indigo-900/10 via-slate-950 to-slate-950 flex flex-col relative">
        <header className="flex items-center justify-between p-6 lg:px-8 border-b border-white/5 sticky top-0 z-10 backdrop-blur-md bg-slate-950/50">
          <div className="flex items-center gap-4">
            {/* Header left side can be contextual breadcrumbs or empty */}
          </div>
          <div className="flex items-center gap-4">
            <LanguageToggle />
            <button
              type="button"
              onClick={() => navigate('/app/notifications')}
              className="relative rounded-lg border border-slate-800 bg-slate-900/50 p-2 transition-colors hover:bg-slate-800"
            >
              <Bell size={20} className="text-slate-400 hover:text-white transition-colors" />
              <span className="absolute top-2 right-2 w-2 h-2 bg-blue-500 rounded-full border-2 border-slate-950"></span>
            </button>
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full cursor-pointer ring-2 ring-slate-800 ring-offset-2 ring-offset-slate-950 hover:ring-blue-500/50 transition-all"></div>
          </div>
        </header>
        
        {/* Dynamic Page Content Rendered Here */}
        <div className="flex-1 p-6 lg:p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

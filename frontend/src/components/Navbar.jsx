import { Activity, LogOut } from 'lucide-react';

export default function Navbar({ user, onLogout, title }) {
  return (
    <nav className="bg-white border-b border-slate-100 sticky top-0 z-50 shadow-sm">
      <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
        {/* Left: Logo */}
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-indigo-600 to-cyan-500 flex items-center justify-center shadow-lg">
            <Activity className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-slate-800">{title}</h1>
            <p className="text-xs text-slate-400 -mt-1">Healthcare Queue Management</p>
          </div>
        </div>

        {/* Right: User Info & Logout */}
        <div className="flex items-center space-x-6">
          <div className="text-right hidden sm:block">
            <p className="text-slate-800 font-bold">{user?.name}</p>
            <p className="text-xs text-indigo-600 font-medium capitalize">{user?.role?.replace('_', ' ')}</p>
          </div>
          <button 
            onClick={onLogout}
            className="p-2.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
            title="Logout"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </div>
    </nav>
  );
}

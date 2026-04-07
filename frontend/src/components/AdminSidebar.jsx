import { LayoutDashboard, Users, BarChart3, FileText, User, ChevronRight } from 'lucide-react';

export default function AdminSidebar({ activeTab, setActiveTab }) {
  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="w-5 h-5" /> },
    { id: 'queues', label: 'Live Queues', icon: <Users className="w-5 h-5" /> },
    { id: 'analytics', label: 'Analytics', icon: <BarChart3 className="w-5 h-5" /> },
    { id: 'records', label: 'Medical Records', icon: <FileText className="w-5 h-5" /> },
    { id: 'profile', label: 'Profile', icon: <User className="w-5 h-5" /> },
  ];

  return (
    <aside className="bg-white border-r border-slate-100 w-64 h-[calc(100vh-80px)] sticky top-20 overflow-y-auto">
      <nav className="p-6 space-y-2">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`w-full flex items-center justify-between px-4 py-3 rounded-xl font-medium transition-all ${
              activeTab === tab.id
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <span className="flex items-center space-x-3">
              {tab.icon}
              <span>{tab.label}</span>
            </span>
            {activeTab === tab.id && <ChevronRight className="w-4 h-4" />}
          </button>
        ))}
      </nav>
    </aside>
  );
}

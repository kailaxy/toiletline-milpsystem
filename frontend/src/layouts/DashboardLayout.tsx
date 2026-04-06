import { NavLink, Outlet } from 'react-router-dom';
import { LayoutDashboard, Zap, CalendarDays } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cx(...inputs: (string | undefined | null | false)[]) {
  return twMerge(clsx(inputs));
}

export default function DashboardLayout() {
  const links = [
    { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { name: 'Optimization', path: '/optimization', icon: Zap },
    { name: 'Schedule', path: '/schedule', icon: CalendarDays },
  ];

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden text-slate-900">
      <nav className="w-64 bg-slate-900 text-slate-300 p-6 flex-col hidden md:flex shrink-0">
        <div className="flex items-center gap-3 text-white mb-10 px-2">
          <Zap className="h-6 w-6 text-blue-500" />
          <h1 className="text-xl font-bold tracking-wider">PM-OPT</h1>
        </div>
        <div className="flex flex-col gap-2">
          {links.map((link) => (
            <NavLink
              key={link.name}
              to={link.path}
              className={({ isActive }) => cx(
                "flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-colors",
                isActive ? "bg-slate-800 text-white" : "hover:bg-slate-800 hover:text-white"
              )}
            >
              <link.icon className="h-5 w-5" />
              {link.name}
            </NavLink>
          ))}
        </div>
      </nav>
      <main className="flex-1 p-8 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}
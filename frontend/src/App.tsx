import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { SpeedInsights } from '@vercel/speed-insights/react';
import DashboardLayout from './layouts/DashboardLayout';
import Dashboard from './pages/Dashboard';
import Optimization from './pages/Optimization';
import Schedule from './pages/Schedule';
import MachineManagement from './pages/MachineManagement';
import MaintenanceLogs from './pages/MaintenanceLogs';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<DashboardLayout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="optimization" element={<Optimization />} />
          <Route path="schedule" element={<Schedule />} />
          <Route path="machines" element={<MachineManagement />} />
          <Route path="maintenance" element={<MaintenanceLogs />} />
        </Route>
      </Routes>
      <SpeedInsights />
    </BrowserRouter>
  );
}

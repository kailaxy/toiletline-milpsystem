import { useState } from 'react';
import { createMachine, createMaintenanceData, Machine } from '../services/api';
import { PlusCircle, Activity, Wrench, CheckCircle, AlertCircle } from 'lucide-react';

export default function DataEntryForms({ machines, onRefresh }: { machines: Machine[], onRefresh: () => void }) {
  const [activeTab, setActiveTab] = useState<'machine' | 'maintenance'>('machine');

  // Machine state
  const [machineName, setMachineName] = useState('');
  const [mttfMinutes, setMttfMinutes] = useState(30000);
  const [mttrMinutes, setMttrMinutes] = useState(480);
  const [costPerHour, setCostPerHour] = useState(2500);
  const [lastMaint, setLastMaint] = useState(15);

  // Maintenance state
  const [machineId, setMachineId] = useState<number | ''>('');
  const [performedAt, setPerformedAt] = useState(new Date().toISOString().split('T')[0]);
  const [duration, setDuration] = useState(4);
  const [notes, setNotes] = useState('');

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  const handleCreateMachine = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!machineName.trim()) {
      setMessage({ type: 'error', text: 'Machine name is required.' });
      return;
    }
    setLoading(true);
    setMessage(null);
    try {
      await createMachine({
        name: machineName,
        mttf_minutes: mttfMinutes,
        mttr_minutes: mttrMinutes,
        downtime_cost_per_hour: costPerHour,
        last_maintenance_days_ago: lastMaint
      });
      setMessage({ type: 'success', text: `Machine "${machineName}" added successfully.` });
      setMachineName('');
      onRefresh();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to create machine.' });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateMaintenance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!machineId) {
      setMessage({ type: 'error', text: 'Please select a machine.' });
      return;
    }
    setLoading(true);
    setMessage(null);
    try {
      await createMaintenanceData({
        machine_id: Number(machineId),
        performed_at: performedAt,
        duration_hours: duration,
        notes: notes
      });
      setMessage({ type: 'success', text: 'Maintenance record saved.' });
      setNotes('');
      onRefresh();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to log maintenance.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
            <PlusCircle className="w-5 h-5 text-blue-600" /> Data Entry
          </h2>
          <p className="text-sm text-slate-500">Add new tissue line machines or log recent maintenance.</p>
        </div>
        <div className="flex bg-slate-100 p-1 rounded-lg">
          <button 
            type="button"
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition ${activeTab === 'machine' ? 'bg-white shadow text-slate-800' : 'text-slate-600 hover:text-slate-900'}`}
            onClick={() => { setActiveTab('machine'); setMessage(null); }}
          >
            Machine
          </button>
          <button 
             type="button"
             className={`px-4 py-1.5 text-sm font-medium rounded-md transition ${activeTab === 'maintenance' ? 'bg-white shadow text-slate-800' : 'text-slate-600 hover:text-slate-900'}`}
             onClick={() => { setActiveTab('maintenance'); setMessage(null); }}
          >
            Maintenance
          </button>
        </div>
      </div>

      {message && (
        <div className={`p-4 mb-6 rounded-lg flex items-center gap-3 text-sm font-medium ${message.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
          {message.type === 'success' ? <CheckCircle className="w-5 h-5 text-green-600" /> : <AlertCircle className="w-5 h-5 text-red-600" />}
          {message.text}
        </div>
      )}

      {activeTab === 'machine' ? (
        <form onSubmit={handleCreateMachine} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          <div className="space-y-1">
             <label className="block text-sm font-medium text-slate-700">Name</label>
             <input type="text" value={machineName} onChange={e => setMachineName(e.target.value)} className="w-full rounded-md border-slate-300 shadow-sm border px-3 py-2 text-slate-900 focus:ring-blue-500 focus:border-blue-500 outline-none" placeholder="e.g., Rewinder 2" required />
          </div>
          <div className="space-y-1">
             <label className="block text-sm font-medium text-slate-700">MTTF (minutes)</label>
             <input type="number" min={1} value={mttfMinutes} onChange={e => setMttfMinutes(Number(e.target.value))} className="w-full rounded-md border-slate-300 shadow-sm border px-3 py-2 text-slate-900 focus:ring-blue-500 focus:border-blue-500 outline-none" required />
             <p className="text-xs text-slate-500">Mean time to failure in minutes (e.g., 30000 for 500 hours).</p>
          </div>
          <div className="space-y-1">
             <label className="block text-sm font-medium text-slate-700">MTTR (minutes)</label>
             <input type="number" min={1} value={mttrMinutes} onChange={e => setMttrMinutes(Number(e.target.value))} className="w-full rounded-md border-slate-300 shadow-sm border px-3 py-2 text-slate-900 focus:ring-blue-500 focus:border-blue-500 outline-none" required />
             <p className="text-xs text-slate-500">Mean time to repair in minutes (e.g., 480 for 8 hours).</p>
          </div>
          <div className="space-y-1">
             <label className="block text-sm font-medium text-slate-700">Downtime Cost (PHP/hr)</label>
             <input type="number" value={costPerHour} onChange={e => setCostPerHour(Number(e.target.value))} className="w-full rounded-md border-slate-300 shadow-sm border px-3 py-2 text-slate-900 focus:ring-blue-500 focus:border-blue-500 outline-none" required />
          </div>
          <div className="space-y-1">
             <label className="block text-sm font-medium text-slate-700">Days Since Last Maint.</label>
             <input type="number" value={lastMaint} onChange={e => setLastMaint(Number(e.target.value))} className="w-full rounded-md border-slate-300 shadow-sm border px-3 py-2 text-slate-900 focus:ring-blue-500 focus:border-blue-500 outline-none" required />
          </div>
          <div className="flex items-end lg:col-span-1 md:col-span-2">
            <button type="submit" disabled={loading} className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg shadow-sm font-medium hover:bg-blue-700 disabled:opacity-75 transition-colors flex justify-center items-center gap-2">
              <Activity className="w-4 h-4" />
              {loading ? 'Saving...' : 'Add Machine'}
            </button>
          </div>
        </form>
      ) : (
        <form onSubmit={handleCreateMaintenance} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
           <div className="space-y-1 lg:col-span-1">
             <label className="block text-sm font-medium text-slate-700">Machine</label>
             <select value={machineId} onChange={e => setMachineId(e.target.value ? Number(e.target.value) : '')} className="w-full rounded-md border-slate-300 shadow-sm border px-3 py-2 text-slate-900 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white" required>
               <option value="" disabled>Select a machine...</option>
               {machines.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
             </select>
           </div>
           <div className="space-y-1 lg:col-span-1">
             <label className="block text-sm font-medium text-slate-700">Performed At</label>
             <input type="date" value={performedAt} onChange={e => setPerformedAt(e.target.value)} className="w-full rounded-md border-slate-300 shadow-sm border px-3 py-2 text-slate-900 focus:ring-blue-500 focus:border-blue-500 outline-none" required />
           </div>
           <div className="space-y-1 lg:col-span-1">
             <label className="block text-sm font-medium text-slate-700">Duration (hrs)</label>
             <input type="number" step="0.5" value={duration} onChange={e => setDuration(Number(e.target.value))} className="w-full rounded-md border-slate-300 shadow-sm border px-3 py-2 text-slate-900 focus:ring-blue-500 focus:border-blue-500 outline-none" required />
           </div>
           <div className="space-y-1 lg:col-span-1 md:col-span-2 lg:col-span-1 flex items-end">
             <button type="submit" disabled={loading} className="w-full px-4 py-2 bg-green-600 text-white rounded-lg shadow-sm font-medium hover:bg-green-700 disabled:opacity-75 transition-colors flex justify-center items-center gap-2">
               <Wrench className="w-4 h-4" />
               {loading ? 'Saving...' : 'Log Record'}
             </button>
           </div>
           <div className="space-y-1 md:col-span-2 lg:col-span-4">
             <label className="block text-sm font-medium text-slate-700">Notes / Anomaly Cause</label>
             <input type="text" value={notes} onChange={e => setNotes(e.target.value)} className="w-full rounded-md border-slate-300 shadow-sm border px-3 py-2 text-slate-900 focus:ring-blue-500 focus:border-blue-500 outline-none" placeholder="e.g., Replaced drive belt, routine lubrication..." />
           </div>
        </form>
      )}
    </div>
  );
}
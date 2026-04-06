import { useEffect, useState } from 'react';
import { fetchMaintenanceRecords, createMaintenanceData, updateMaintenanceData, deleteMaintenanceData, fetchMachines, MaintenanceData, Machine } from '../services/api';
import { Pencil, Trash2, Check, X, PlusCircle, AlertCircle } from 'lucide-react';

const toLocalDateTimeInputValue = (value: Date | string): string => {
  const date = value instanceof Date ? value : new Date(value);
  const offsetMs = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
};

export default function MaintenanceLogs() {
  const [logs, setLogs] = useState<MaintenanceData[]>([]);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Edit Mode state
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editFormData, setEditFormData] = useState<Partial<MaintenanceData>>({});

  // Create Mode state
  const [isCreating, setIsCreating] = useState(false);
  const [createFormData, setCreateFormData] = useState({
    machine_id: 0,
    performed_at: toLocalDateTimeInputValue(new Date()),
    duration_hours: 1,
    notes: ''
  });

  const loadData = async () => {
    try {
      setLoading(true);
      const [logsData, machinesData] = await Promise.all([
        fetchMaintenanceRecords(),
        fetchMachines()
      ]);
      setLogs(logsData);
      setMachines(machinesData);
      if (machinesData.length > 0 && createFormData.machine_id === 0) {
        setCreateFormData(prev => ({ ...prev, machine_id: machinesData[0].id }));
      }
    } catch (err: any) {
      setError(err.message || 'Error fetching maintenance logs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleEdit = (log: MaintenanceData) => {
    setEditingId(log.id);
    setEditFormData(log);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditFormData({});
  };

  const handleSaveEdit = async () => {
    if (!editingId) return;
    try {
      const { id, machine_name, ...payload } = editFormData as any;
      await updateMaintenanceData(editingId, payload);
      setSuccess('Log updated successfully');
      setEditingId(null);
      loadData();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to update log');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this log?')) return;
    try {
      await deleteMaintenanceData(id);
      setSuccess('Log deleted successfully');
      loadData();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to delete log');
    }
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createFormData.machine_id) {
      setError('Please select a machine');
      return;
    }
    
    try {
      await createMaintenanceData(createFormData);
      setSuccess('Log created successfully');
      setIsCreating(false);
      setCreateFormData({
        machine_id: machines[0]?.id || 0,
        performed_at: toLocalDateTimeInputValue(new Date()),
        duration_hours: 1,
        notes: ''
      });
      loadData();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to create log');
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12 w-full">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-slate-800">Maintenance Logs</h1>
        <button
          onClick={() => setIsCreating(!isCreating)}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors font-medium shadow-sm"
        >
          <PlusCircle className="w-5 h-5" />
          <span>Add Record</span>
        </button>
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 border border-red-200 p-4 rounded-lg flex items-center gap-3">
          <AlertCircle className="w-5 h-5" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="bg-green-50 text-green-700 border border-green-200 p-4 rounded-lg flex items-center gap-3">
          <Check className="w-5 h-5" />
          <span>{success}</span>
        </div>
      )}

      {isCreating && (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <h2 className="text-xl font-semibold mb-4 text-slate-800">New Maintenance Record</h2>
          <form onSubmit={handleCreateSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Machine</label>
              <select 
                required 
                value={createFormData.machine_id} 
                onChange={e => setCreateFormData({ ...createFormData, machine_id: Number(e.target.value) })} 
                className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
              >
                {machines.map(m => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Performed At</label>
              <input type="datetime-local" required value={createFormData.performed_at} onChange={e => setCreateFormData({ ...createFormData, performed_at: e.target.value })} className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Duration (Hours)</label>
              <input type="number" required min={0} step={0.5} value={createFormData.duration_hours} onChange={e => setCreateFormData({ ...createFormData, duration_hours: Number(e.target.value) })} className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
              <input type="text" value={createFormData.notes} onChange={e => setCreateFormData({ ...createFormData, notes: e.target.value })} className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
            </div>
            <div className="md:col-span-2 flex justify-end gap-2 mt-2">
              <button type="button" onClick={() => setIsCreating(false)} className="px-4 py-2 text-slate-600 hover:text-slate-800">Cancel</button>
              <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded shadow-sm">Save</button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[700px]">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-slate-600">
              <th className="p-4 font-medium">Machine</th>
              <th className="p-4 font-medium">Performed At</th>
              <th className="p-4 font-medium">Duration (hr)</th>
              <th className="p-4 font-medium">Notes</th>
              <th className="p-4 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="p-8 text-center text-slate-500">Loading...</td></tr>
            ) : logs.length === 0 ? (
              <tr><td colSpan={5} className="p-8 text-center text-slate-500">No maintenance logs found</td></tr>
            ) : (
              logs.map((log) => (
                <tr key={log.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                  {editingId === log.id ? (
                    <>
                      <td className="p-3">
                        <select 
                          className="w-full p-1 border rounded bg-white" 
                          value={editFormData.machine_id || ''} 
                          onChange={e => setEditFormData({ ...editFormData, machine_id: Number(e.target.value) })}
                        >
                          {machines.map(m => (
                            <option key={m.id} value={m.id}>{m.name}</option>
                          ))}
                        </select>
                      </td>
                      <td className="p-3"><input type="datetime-local" className="w-full p-1 border rounded" value={editFormData.performed_at ? toLocalDateTimeInputValue(editFormData.performed_at) : ''} onChange={e => setEditFormData({ ...editFormData, performed_at: e.target.value })} /></td>
                      <td className="p-3"><input type="number" step="0.5" className="w-full p-1 border rounded" value={editFormData.duration_hours || 0} onChange={e => setEditFormData({ ...editFormData, duration_hours: parseFloat(e.target.value) || 0 })} /></td>
                      <td className="p-3"><input type="text" className="w-full p-1 border rounded" value={editFormData.notes || ''} onChange={e => setEditFormData({ ...editFormData, notes: e.target.value })} /></td>
                      <td className="p-4">
                        <div className="flex justify-end gap-2">
                          <button onClick={handleSaveEdit} className="p-2 text-green-600 hover:bg-green-50 rounded" title="Save"><Check className="w-5 h-5" /></button>
                          <button onClick={handleCancelEdit} className="p-2 text-slate-500 hover:bg-slate-100 rounded" title="Cancel"><X className="w-5 h-5" /></button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="p-4 font-medium text-slate-800">{log.machine_name || machines.find(m => m.id === log.machine_id)?.name || 'Unknown'}</td>
                      <td className="p-4 text-slate-600">{new Date(log.performed_at).toLocaleString()}</td>
                      <td className="p-4 text-slate-600">{log.duration_hours}</td>
                      <td className="p-4 text-slate-600">{log.notes || '-'}</td>
                      <td className="p-4">
                        <div className="flex justify-end gap-2">
                          <button onClick={() => handleEdit(log)} className="p-2 text-blue-600 hover:bg-blue-50 rounded transition-colors" title="Edit"><Pencil className="w-5 h-5" /></button>
                          <button onClick={() => handleDelete(log.id)} className="p-2 text-red-600 hover:bg-red-50 rounded transition-colors" title="Delete"><Trash2 className="w-5 h-5" /></button>
                        </div>
                      </td>
                    </>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

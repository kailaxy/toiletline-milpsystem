import { useEffect, useState } from 'react';
import { fetchMachines, createMachine, updateMachine, deleteMachine, Machine } from '../services/api';
import { Pencil, Trash2, Check, X, PlusCircle, AlertCircle } from 'lucide-react';

export default function MachineManagement() {
  const [machines, setMachines] = useState<Machine[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Edit Mode state
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editFormData, setEditFormData] = useState<Partial<Machine>>({});

  // Create Mode state
  const [isCreating, setIsCreating] = useState(false);
  const [createFormData, setCreateFormData] = useState({
    name: '',
    mttf_minutes: 30000,
    mttr_minutes: 480,
    downtime_cost_per_hour: 1000,
    last_maintenance_days_ago: 0
  });

  const loadData = async () => {
    try {
      setLoading(true);
      const data = await fetchMachines();
      setMachines(data);
    } catch (err: any) {
      setError(err.message || 'Error fetching machines');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleEdit = (machine: Machine) => {
    setEditingId(machine.id);
    setEditFormData(machine);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditFormData({});
  };

  const handleSaveEdit = async () => {
    if (!editingId) return;
    try {
      const { id, created_at, status, reliabilityScore, mttf_hours, mttr_hours, ...payload } = editFormData as any;
      await updateMachine(editingId, payload);
      setSuccess('Machine updated successfully');
      setEditingId(null);
      loadData();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to update machine');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this machine?')) return;
    try {
      await deleteMachine(id);
      setSuccess('Machine deleted successfully');
      loadData();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to delete machine');
    }
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createMachine(createFormData);
      setSuccess('Machine created successfully');
      setIsCreating(false);
      setCreateFormData({
        name: '',
        mttf_minutes: 30000,
        mttr_minutes: 480,
        downtime_cost_per_hour: 1000,
        last_maintenance_days_ago: 0
      });
      loadData();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to create machine');
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12 w-full">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-slate-800">Machine Management</h1>
        <button
          onClick={() => setIsCreating(!isCreating)}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors font-medium shadow-sm"
        >
          <PlusCircle className="w-5 h-5" />
          <span>Add Machine</span>
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
          <h2 className="text-xl font-semibold mb-4 text-slate-800">New Machine</h2>
          <form onSubmit={handleCreateSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Name</label>
              <input type="text" required value={createFormData.name} onChange={e => setCreateFormData({ ...createFormData, name: e.target.value })} className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">MTTF (Minutes)</label>
              <input type="number" required min={1} value={createFormData.mttf_minutes} onChange={e => setCreateFormData({ ...createFormData, mttf_minutes: Number(e.target.value) })} className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">MTTR (Minutes)</label>
              <input type="number" required min={0} value={createFormData.mttr_minutes} onChange={e => setCreateFormData({ ...createFormData, mttr_minutes: Number(e.target.value) })} className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Downtime Cost ($/Hour)</label>
              <input type="number" required min={0} value={createFormData.downtime_cost_per_hour} onChange={e => setCreateFormData({ ...createFormData, downtime_cost_per_hour: Number(e.target.value) })} className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Last Maintenance (Days Ago)</label>
              <input type="number" required min={0} value={createFormData.last_maintenance_days_ago} onChange={e => setCreateFormData({ ...createFormData, last_maintenance_days_ago: Number(e.target.value) })} className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
            </div>
            <div className="md:col-span-2 flex justify-end gap-2 mt-2">
              <button type="button" onClick={() => setIsCreating(false)} className="px-4 py-2 text-slate-600 hover:text-slate-800">Cancel</button>
              <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded shadow-sm">Save</button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[800px]">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-slate-600">
              <th className="p-4 font-medium">Name</th>
              <th className="p-4 font-medium">MTTF (min)</th>
              <th className="p-4 font-medium">MTTR (min)</th>
              <th className="p-4 font-medium">Downtime Cost/hr ($)</th>
              <th className="p-4 font-medium">Last Maint. (days)</th>
              <th className="p-4 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="p-8 text-center text-slate-500">Loading...</td></tr>
            ) : machines.length === 0 ? (
              <tr><td colSpan={6} className="p-8 text-center text-slate-500">No machines found</td></tr>
            ) : (
              machines.map((mac) => (
                <tr key={mac.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                  {editingId === mac.id ? (
                    <>
                      <td className="p-3"><input type="text" className="w-full p-1 border rounded" value={editFormData.name || ''} onChange={e => setEditFormData({ ...editFormData, name: e.target.value })} /></td>
                      <td className="p-3"><input type="number" min={1} className="w-full p-1 border rounded" value={editFormData.mttf_minutes ?? 0} onChange={e => setEditFormData({ ...editFormData, mttf_minutes: parseInt(e.target.value) || 0 })} /></td>
                      <td className="p-3"><input type="number" min={0} className="w-full p-1 border rounded" value={editFormData.mttr_minutes ?? 0} onChange={e => setEditFormData({ ...editFormData, mttr_minutes: parseInt(e.target.value) || 0 })} /></td>
                      <td className="p-3"><input type="number" className="w-full p-1 border rounded" value={editFormData.downtime_cost_per_hour || 0} onChange={e => setEditFormData({ ...editFormData, downtime_cost_per_hour: parseInt(e.target.value) || 0 })} /></td>
                      <td className="p-3"><input type="number" className="w-full p-1 border rounded" value={editFormData.last_maintenance_days_ago || 0} onChange={e => setEditFormData({ ...editFormData, last_maintenance_days_ago: parseInt(e.target.value) || 0 })} /></td>
                      <td className="p-4">
                        <div className="flex justify-end gap-2">
                          <button onClick={handleSaveEdit} className="p-2 text-green-600 hover:bg-green-50 rounded" title="Save"><Check className="w-5 h-5" /></button>
                          <button onClick={handleCancelEdit} className="p-2 text-slate-500 hover:bg-slate-100 rounded" title="Cancel"><X className="w-5 h-5" /></button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="p-4 font-medium text-slate-800">{mac.name}</td>
                      <td className="p-4 text-slate-600">{mac.mttf_minutes ?? 0}</td>
                      <td className="p-4 text-slate-600">{mac.mttr_minutes ?? 0}</td>
                      <td className="p-4 text-slate-600">${mac.downtime_cost_per_hour}</td>
                      <td className="p-4 text-slate-600">{mac.last_maintenance_days_ago}</td>
                      <td className="p-4">
                        <div className="flex justify-end gap-2">
                          <button onClick={() => handleEdit(mac)} className="p-2 text-blue-600 hover:bg-blue-50 rounded transition-colors" title="Edit"><Pencil className="w-5 h-5" /></button>
                          <button onClick={() => handleDelete(mac.id)} className="p-2 text-red-600 hover:bg-red-50 rounded transition-colors" title="Delete"><Trash2 className="w-5 h-5" /></button>
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

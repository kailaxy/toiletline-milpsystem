import { useEffect, useState } from 'react';
import { fetchMachines, fetchMaintenanceData, Machine, MaintenanceMetrics } from '../services/api';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ComposedChart, Line } from 'recharts';
import { Activity, Clock, Wrench } from 'lucide-react';
import { default as DataEntryForms } from '../components/DataEntryForms';

export default function Dashboard() {
  const [machines, setMachines] = useState<Machine[]>([]);
  const [data, setData] = useState<MaintenanceMetrics | null>(null);

  const loadData = () => {
    fetchMachines().then(setMachines);
    fetchMaintenanceData().then(setData);
  };

  useEffect(() => {
    loadData();
  }, []);

  const totalDowntime = data?.downtimeDuration.reduce((acc, curr) => acc + curr.value, 0) || 0;

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12 w-full">
      <h1 className="text-3xl font-bold text-slate-800">Tissue Line Overview</h1>
      
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex items-center gap-4">
          <div className="p-3 bg-blue-100 text-blue-600 rounded-lg"><Activity className="h-6 w-6" /></div>
          <div>
            <p className="text-sm text-slate-500 font-medium whitespace-nowrap">Avg Reliability</p>
            <p className="text-2xl font-bold text-slate-800">
              {machines.length ? (machines.reduce((a, b) => a + b.reliabilityScore, 0) / machines.length).toFixed(1) : 0}%
            </p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex items-center gap-4">
          <div className="p-3 bg-red-100 text-red-600 rounded-lg"><Clock className="h-6 w-6" /></div>
          <div>
             <p className="text-sm text-slate-500 font-medium whitespace-nowrap">YTD Downtime</p>
             <p className="text-2xl font-bold text-slate-800">{totalDowntime} hrs</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex items-center gap-4">
          <div className="p-3 bg-amber-100 text-amber-600 rounded-lg"><Wrench className="h-6 w-6" /></div>
          <div>
            <p className="text-sm text-slate-500 font-medium whitespace-nowrap">Active Anomalies</p>
            <p className="text-2xl font-bold text-slate-800">{machines.filter(m => m.status === 'down').length}</p>
          </div>
        </div>
      </div>

      <DataEntryForms machines={machines} onRefresh={loadData} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 h-96 flex flex-col">
          <h2 className="text-lg font-semibold text-slate-800 mb-4 shrink-0">Breakdown Frequency</h2>
          <div className="flex-1 min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data?.breakdownFrequency || []}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{fill: '#64748B'}} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748B'}} />
                <Tooltip cursor={{ fill: '#F1F5F9' }} />
                <Bar dataKey="value" fill="#3B82F6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 h-96 flex flex-col">
          <h2 className="text-lg font-semibold text-slate-800 mb-4 shrink-0">Pareto (Downtime Causes)</h2>
          <div className="flex-1 min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={data?.paretoDowntime || []}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                <XAxis dataKey="cause" axisLine={false} tickLine={false} tick={{fill: '#64748B'}} />
                <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{fill: '#64748B'}} />
                <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{fill: '#64748B'}} />
                <Tooltip />
                <Bar yAxisId="left" dataKey="hours" fill="#94A3B8" radius={[4, 4, 0, 0]} name="Hours" />
                <Line yAxisId="right" type="monotone" dataKey="hours" stroke="#EF4444" strokeWidth={2} dot={{r: 4}} name="Cumulative" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 col-span-1 lg:col-span-2">
            <h2 className="text-lg font-semibold text-slate-800 mb-4">Machine Reliability Metrics</h2>
            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left whitespace-nowrap">
                    <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-200">
                        <tr>
                            <th className="px-6 py-3 font-medium">Machine</th>
                            <th className="px-6 py-3 font-medium">Status</th>
                            <th className="px-6 py-3 font-medium text-right">MTTF (hrs)</th>
                            <th className="px-6 py-3 font-medium text-right">MTTR (hrs)</th>
                            <th className="px-6 py-3 font-medium text-right">Downtime Cost/hr</th>
                            <th className="px-6 py-3 font-medium">Reliability Score</th>
                        </tr>
                    </thead>
                    <tbody>
                        {machines.map((m) => (
                            <tr key={m.id} className="border-b border-slate-100 hover:bg-slate-50">
                                <td className="px-6 py-4 font-medium text-slate-900">{m.name}</td>
                                <td className="px-6 py-4">
                                    <span className={`px-2 py-1 rounded-full text-xs font-semibold
                                        ${m.status === 'running' ? 'bg-green-100 text-green-700' :
                                          m.status === 'preventive' ? 'bg-amber-100 text-amber-700' :
                                          'bg-red-100 text-red-700'}`}>
                                        {m.status.toUpperCase()}
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-right text-slate-600">{m.mttf_hours ?? 'N/A'}</td>
                                <td className="px-6 py-4 text-right text-slate-600">{m.mttr_hours ?? 'N/A'}</td>
                                <td className="px-6 py-4 text-right text-slate-600">PHP {(m.downtime_cost_per_hour ?? 0).toLocaleString()}</td>
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-2">
                                        <div className="w-full bg-slate-200 rounded-full h-2">
                                            <div className="bg-blue-600 h-2 rounded-full" style={{width: `${m.reliabilityScore}%`}}></div>
                                        </div>
                                        <span className="text-slate-500">{m.reliabilityScore.toFixed(0)}%</span>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
      </div>
    </div>
  );
}

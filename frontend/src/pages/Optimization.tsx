import { useState } from 'react';
import { getMachineColor, MACHINE_COLOR_MAP, runOptimization, OptimizeResponse } from '../services/api';
import { Loader2, ArrowRight } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function Optimization() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<OptimizeResponse | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  
  const [horizonDays, setHorizonDays] = useState(7);
  const [capacity, setCapacity] = useState(2);
  const [avoidPeak, setAvoidPeak] = useState(true);

  const clampInt = (value: number, min: number, max: number) => {
    if (!Number.isFinite(value)) return min;
    return Math.min(max, Math.max(min, Math.trunc(value)));
  };

  const handleOptimize = async () => {
    const boundedHorizon = clampInt(horizonDays, 1, 30);
    const boundedCapacity = clampInt(capacity, 1, 2);

    if (boundedHorizon !== horizonDays) setHorizonDays(boundedHorizon);
    if (boundedCapacity !== capacity) setCapacity(boundedCapacity);

    setApiError(null);
    setLoading(true);

    try {
      const res = await runOptimization({ 
        horizon_days: boundedHorizon,
        maintenance_capacity_per_day: boundedCapacity,
        peak_day_indices: [1, 2], // Mon, Tue demo
        avoid_peak_days: avoidPeak
      });
      setResult(res);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Optimization failed. Please try again.';
      setApiError(message);
    } finally {
      setLoading(false);
    }
  };

  const effectiveHorizon = result?.kpis.horizon_days && result.kpis.horizon_days > 0
    ? result.kpis.horizon_days
    : horizonDays;

  const hasSlotAwareSchedule = Boolean(
    result && (
      (result.kpis.horizon_slots ?? 0) > 0 ||
      (result.kpis.slots_per_day ?? 0) > 0 ||
      result.schedule.some(item =>
        item.slot_index !== null && item.slot_index !== undefined ||
        item.slot_in_day !== null && item.slot_in_day !== undefined ||
        Boolean(item.slot_label) ||
        Boolean(item.start_datetime_label)
      )
    )
  );

  const slotsPerDay = result?.kpis.slots_per_day && result.kpis.slots_per_day > 0
    ? Math.trunc(result.kpis.slots_per_day)
    : null;

  const getSlotIndex = (item: OptimizeResponse['schedule'][number]): number | null => {
    if (item.slot_index !== null && item.slot_index !== undefined) {
      return Math.trunc(item.slot_index);
    }

    if (
      slotsPerDay &&
      slotsPerDay > 0 &&
      item.day_index !== null &&
      item.day_index !== undefined &&
      item.slot_in_day !== null &&
      item.slot_in_day !== undefined
    ) {
      return Math.trunc(item.day_index) * slotsPerDay + Math.trunc(item.slot_in_day);
    }

    return null;
  };

  const effectiveTimelineUnits = hasSlotAwareSchedule
    ? result?.kpis.horizon_slots && result.kpis.horizon_slots > 0
      ? Math.trunc(result.kpis.horizon_slots)
      : slotsPerDay && slotsPerDay > 0
        ? effectiveHorizon * slotsPerDay
        : effectiveHorizon
    : effectiveHorizon;

  // Convert schedule to chart data
  const chartData = Array.from({ length: effectiveTimelineUnits }, (_, i) => {
    const matchingSlotItems = hasSlotAwareSchedule
      ? result?.schedule.filter(item => getSlotIndex(item) === i) || []
      : [];

    const machinesInBucket = hasSlotAwareSchedule
      ? matchingSlotItems
      : result?.schedule.filter(s =>
          (s.day_index ?? -1) === i ||
          (s.day_index ?? -1) <= i && (s.day_index ?? -1) + (s.maintenance_duration_days || 1) > i
        ) || [];

    const axisLabel = hasSlotAwareSchedule
      ? slotsPerDay && slotsPerDay > 0
        ? `D${Math.floor(i / slotsPerDay) + 1} S${(i % slotsPerDay) + 1}`
        : `S${i + 1}`
      : `Day ${i + 1}`;

    const slotTitle = hasSlotAwareSchedule
      ? matchingSlotItems.find(item => item.start_datetime_label)?.start_datetime_label
        || matchingSlotItems.find(item => item.slot_label)?.slot_label
        || (slotsPerDay && slotsPerDay > 0
          ? `Day ${Math.floor(i / slotsPerDay) + 1} Slot ${(i % slotsPerDay) + 1}`
          : `Slot ${i + 1}`)
      : `Day ${i + 1}`;

    return {
      bucket: axisLabel,
      title: slotTitle,
      count: machinesInBucket.length,
      machineNames: machinesInBucket.map(m => m.machine)
    };
  });

  const legendMachineNames = result
    ? Array.from(new Set(result.schedule.map(item => item.machine))).sort((a, b) => a.localeCompare(b))
    : Object.keys(MACHINE_COLOR_MAP);

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12 w-full">
      <h1 className="text-3xl font-bold text-slate-800">Schedule Optimization</h1>
      <p className="text-slate-500 mb-6 max-w-2xl">Use Mixed Integer Linear Programming (MILP) to minimize downtime cost while completing pending maintenance.</p>

      <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-200">
        <h2 className="text-xl font-semibold mb-4 text-slate-800">Optimization Parameters</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-end">
           <div className="space-y-1">
             <label className="block text-sm font-medium text-slate-700">Horizon (Days)</label>
             <input type="number" min={1} max={30} value={horizonDays} onChange={e => setHorizonDays(clampInt(Number(e.target.value), 1, 30))} className="w-full rounded-md border-slate-300 shadow-sm border px-3 py-2 text-slate-900 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors" />
           </div>
           <div className="space-y-1">
             <label className="block text-sm font-medium text-slate-700">Daily Capacity</label>
             <input type="number" min={1} max={2} value={capacity} onChange={e => setCapacity(clampInt(Number(e.target.value), 1, 2))} className="w-full rounded-md border-slate-300 shadow-sm border px-3 py-2 text-slate-900 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors" />
           </div>
           <div className="space-y-1 pb-2 flex items-center gap-2">
             <input type="checkbox" id="avoid" checked={avoidPeak} onChange={e => setAvoidPeak(e.target.checked)} className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4" />
             <label htmlFor="avoid" className="text-sm font-medium text-slate-700">Avoid Peak Days</label>
           </div>
           <button 
             onClick={handleOptimize}
             disabled={loading}
             className="w-full px-6 py-2.5 bg-blue-600 text-white rounded-lg shadow-sm font-medium hover:bg-blue-700 disabled:opacity-75 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors"
           >
             {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Run Optimizer'}
           </button>
        </div>

        {apiError && (
          <p className="mt-4 text-sm font-medium text-red-600">{apiError}</p>
        )}
      </div>

      {result && (
        <div className="space-y-6 mt-8">
          <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-200">
            <h2 className="text-xl font-semibold mb-6 flex items-center justify-between text-slate-800">
              Optimization Results 
              <span className="text-xs font-semibold px-3 py-1 bg-green-100 text-green-700 rounded-full tracking-wide">
                SOLUTION FOUND
              </span>
            </h2>

            <p className="text-sm text-slate-500 mb-6">Horizon Used: {effectiveHorizon} day{effectiveHorizon === 1 ? '' : 's'}</p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="p-6 bg-slate-50 rounded-xl border border-slate-100 shadow-sm">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Availability KPI</h3>
                <div className="flex items-center gap-4">
                  <div className="text-3xl text-slate-300 line-through">85.0%</div>
                  <ArrowRight className="text-slate-300 h-6 w-6" />
                  <div className="text-4xl font-black text-blue-600">{result.kpis.availability.toFixed(1)}%</div>
                </div>
              </div>
              
              <div className="p-6 bg-slate-50 rounded-xl border border-slate-100 shadow-sm">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Predicted Downtime (hrs)</h3>
                <div className="flex items-center gap-4">
                  <div className="text-3xl text-slate-300 line-through">45.0</div>
                  <ArrowRight className="text-slate-300 h-6 w-6" />
                  <div className="text-4xl font-black text-green-600">{result.kpis.predicted_downtime.toFixed(1)}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Machine vs Time Slot Visualization */}
          <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-200 h-96 flex flex-col">
            <h2 className="text-xl font-semibold mb-4 text-slate-800 shrink-0">
              {hasSlotAwareSchedule ? 'Maintenance Load by Slot' : 'Maintenance Load by Day'}
            </h2>
            <div className="mb-4 flex flex-wrap gap-x-4 gap-y-2 text-xs text-slate-600">
              {legendMachineNames.map((machineName) => (
                <div key={machineName} className="flex items-center gap-2">
                  <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: getMachineColor(machineName) }} />
                  <span>{machineName}</span>
                </div>
              ))}
            </div>
            <div className="flex-1 min-h-0">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                  <XAxis dataKey="bucket" axisLine={false} tickLine={false} tick={{fill: '#64748B'}} />
                  <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{fill: '#64748B'}} />
                  <Tooltip 
                    cursor={{ fill: '#F1F5F9' }} 
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const d = payload[0].payload;
                        return (
                          <div className="bg-white p-3 border border-slate-200 shadow-lg rounded-lg text-sm">
                            <p className="font-semibold text-slate-800 mb-1">{d.title}</p>
                            <p className="text-slate-600">Machines: {d.count}</p>
                            {Array.isArray(d.machineNames) && d.machineNames.length > 0 && (
                              <div className="mt-1 text-xs space-y-1">
                                {d.machineNames.map((machineName: string) => (
                                  <p key={machineName} style={{ color: getMachineColor(machineName) }}>{machineName}</p>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      }
                      return null;
                    }} 
                  />
                  <Bar dataKey="count" fill="#3B82F6" radius={[4, 4, 0, 0]} name="Machines Under Maintenance" maxBarSize={60} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

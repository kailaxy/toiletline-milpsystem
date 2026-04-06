import { useEffect, useState } from 'react';
import { runOptimization, OptimizeResponse } from '../services/api';
import { CalendarDays, Settings, Clock, CheckCircle } from 'lucide-react';

export default function Schedule() {
  const [schedule, setSchedule] = useState<OptimizeResponse['schedule']>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // For MVP demo, call optimization with default params to fetch a schedule
    runOptimization({ 
      horizon_days: 7, 
      maintenance_capacity_per_day: 2, 
      peak_day_indices: [], 
      avoid_peak_days: false 
    }).then(res => {
      // Sort schedule by day_index if available, otherwise by day string
      const sorted = res.schedule.sort((a, b) => {
        if (a.day_index != null && b.day_index != null) {
          return a.day_index - b.day_index;
        }
        return a.day.localeCompare(b.day);
      });
      setSchedule(sorted);
      setLoading(false);
    });
  }, []);

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12 w-full">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">Maintenance Schedule</h1>
          <p className="text-slate-500 mt-2">Upcoming optimally scheduled preventive maintenance operations.</p>
        </div>
        <button className="px-5 py-2 text-sm font-semibold bg-white border border-slate-300 rounded-lg text-slate-700 shadow-sm hover:bg-slate-50 transition flex items-center gap-2">
          <CalendarDays className="w-4 h-4" />
          Export Schedule
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider w-1/4">Machine</th>
                <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Scheduled Time</th>
                <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Duration</th>
                <th scope="col" className="px-6 py-4 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Est. Downtime (hrs)</th>
                <th scope="col" className="px-6 py-4 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Cost Impact</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={5} className="p-12 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center gap-3">
                      <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                      <p>Calculating optimal schedule...</p>
                    </div>
                  </td>
                </tr>
              ) : schedule.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-12 text-center text-slate-500 flex flex-col items-center">
                    <CheckCircle className="w-10 h-10 text-green-500 mb-3" />
                    No scheduled maintenance required inside the current horizon.
                  </td>
                </tr>
              ) : (
                schedule.map((task, idx) => (
                  <tr key={idx} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-50 text-blue-600 rounded-lg"><Settings className="h-4 w-4" /></div>
                        <span className="font-medium text-slate-900">{task.machine}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-col">
                        <div className="flex items-center gap-2 text-slate-600 font-medium">
                          <CalendarDays className="h-4 w-4 text-slate-400" />
                          {task.day}
                        </div>
                        <div className="flex items-center gap-2 text-slate-500 text-sm mt-1">
                          <Clock className="h-4 w-4 text-slate-400" />
                          {task.time}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {task.maintenance_duration_days ? (
                        <div className="flex items-center gap-2 text-slate-600">
                          {task.maintenance_duration_days} day(s)
                        </div>
                      ) : (
                        <span className="text-slate-400 text-sm">N/A</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right font-medium text-amber-600">
                      {task.expected_downtime_hours != null ? task.expected_downtime_hours : <span className="text-slate-300 font-normal">-</span>}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right font-medium text-red-600">
                      {task.estimated_cost_impact != null ? `PHP ${task.estimated_cost_impact.toLocaleString()}` : <span className="text-slate-300 font-normal">-</span>}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

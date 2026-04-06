import { useEffect, useState } from 'react';
import { getLatestOptimizationResponse, getMachineColor, OptimizeResponse, ScheduleItem } from '../services/api';
import { CalendarDays, Settings, Clock, CheckCircle } from 'lucide-react';

const formatDuration = (task: ScheduleItem): string => {
  if (task.maintenance_duration_minutes != null) {
    return `${task.maintenance_duration_minutes.toFixed(0)} min`;
  }

  if (task.maintenance_duration_hours != null) {
    return `${task.maintenance_duration_hours.toFixed(2)} hrs`;
  }

  if (task.maintenance_duration_days != null) {
    return `${task.maintenance_duration_days} day(s)`;
  }

  return 'N/A';
};

const hasValue = (value: string | null | undefined): value is string => {
  return typeof value === 'string' && value.trim().length > 0;
};

const toSortableNumber = (value: number | null | undefined): number | null => {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
};

const compareScheduleItems = (a: ScheduleItem, b: ScheduleItem): number => {
  const dayIndexA = toSortableNumber(a.day_index);
  const dayIndexB = toSortableNumber(b.day_index);
  const normalizedDayIndexA = dayIndexA ?? Number.MAX_SAFE_INTEGER;
  const normalizedDayIndexB = dayIndexB ?? Number.MAX_SAFE_INTEGER;

  if (normalizedDayIndexA !== normalizedDayIndexB) {
    return normalizedDayIndexA - normalizedDayIndexB;
  }

  const slotIndexA = toSortableNumber(a.slot_index);
  const slotIndexB = toSortableNumber(b.slot_index);

  if (slotIndexA != null || slotIndexB != null) {
    const normalizedSlotIndexA = slotIndexA ?? Number.MAX_SAFE_INTEGER;
    const normalizedSlotIndexB = slotIndexB ?? Number.MAX_SAFE_INTEGER;

    if (normalizedSlotIndexA !== normalizedSlotIndexB) {
      return normalizedSlotIndexA - normalizedSlotIndexB;
    }
  }

  const dayTextComparison = a.day.localeCompare(b.day);
  if (dayTextComparison !== 0) {
    return dayTextComparison;
  }

  const timeTextComparison = a.time.localeCompare(b.time);
  if (timeTextComparison !== 0) {
    return timeTextComparison;
  }

  return 0;
};

const getScheduledTimeLabels = (task: ScheduleItem): { primary: string; secondary: string } => {
  const hasSlotMetadata = hasValue(task.start_datetime_label) || hasValue(task.slot_label) || task.slot_in_day != null;

  if (!hasSlotMetadata) {
    return {
      primary: task.day,
      secondary: task.time,
    };
  }

  const primary = hasValue(task.start_datetime_label) ? task.start_datetime_label : task.day;

  if (hasValue(task.slot_label)) {
    return {
      primary,
      secondary: task.slot_label,
    };
  }

  if (task.slot_in_day != null) {
    return {
      primary,
      secondary: `Slot ${task.slot_in_day + 1}`,
    };
  }

  return {
    primary,
    secondary: task.time,
  };
};

export default function Schedule() {
  const [schedule, setSchedule] = useState<OptimizeResponse['schedule']>([]);
  const [hasCachedOptimization, setHasCachedOptimization] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const latestOptimization = getLatestOptimizationResponse();

    if (!latestOptimization) {
      setHasCachedOptimization(false);
      setSchedule([]);
      setLoading(false);
      return;
    }

    // Use deterministic ordering: day index, then slot index, then legacy text fields.
    const sorted = latestOptimization.schedule
      .map((task, originalIndex) => ({ task, originalIndex }))
      .sort((a, b) => {
        const primaryComparison = compareScheduleItems(a.task, b.task);
        if (primaryComparison !== 0) {
          return primaryComparison;
        }

        return a.originalIndex - b.originalIndex;
      })
      .map(({ task }) => task);

    setHasCachedOptimization(true);
    setSchedule(sorted);
    setLoading(false);
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
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={3} className="p-12 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center gap-3">
                      <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                      <p>Loading schedule...</p>
                    </div>
                  </td>
                </tr>
              ) : !hasCachedOptimization ? (
                <tr>
                  <td colSpan={3} className="p-12 text-center text-slate-500 flex flex-col items-center">
                    <CalendarDays className="w-10 h-10 text-slate-400 mb-3" />
                    No optimization result is available yet. Run an optimization first to view the generated schedule.
                  </td>
                </tr>
              ) : schedule.length === 0 ? (
                <tr>
                  <td colSpan={3} className="p-12 text-center text-slate-500 flex flex-col items-center">
                    <CheckCircle className="w-10 h-10 text-green-500 mb-3" />
                    No scheduled maintenance required inside the optimized horizon.
                  </td>
                </tr>
              ) : (
                schedule.map((task, idx) => {
                  const scheduledTimeLabels = getScheduledTimeLabels(task);

                  return (
                  <tr key={idx} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg" style={{ backgroundColor: `${getMachineColor(task.machine)}20`, color: getMachineColor(task.machine) }}><Settings className="h-4 w-4" /></div>
                        <span className="font-medium" style={{ color: getMachineColor(task.machine) }}>{task.machine}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-col">
                        <div className="flex items-center gap-2 text-slate-600 font-medium">
                          <CalendarDays className="h-4 w-4 text-slate-400" />
                          {scheduledTimeLabels.primary}
                        </div>
                        <div className="flex items-center gap-2 text-slate-500 text-sm mt-1">
                          <Clock className="h-4 w-4 text-slate-400" />
                          {scheduledTimeLabels.secondary}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2 text-slate-600">
                        {formatDuration(task)}
                      </div>
                    </td>
                  </tr>
                )})
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

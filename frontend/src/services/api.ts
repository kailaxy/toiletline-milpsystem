export const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
const LOCAL_DEMO_MODE = String(import.meta.env.VITE_LOCAL_DEMO_MODE || '').toLowerCase() === 'true';

const isLocalhostApiBase = (baseUrl: string): boolean => {
  try {
    const host = new URL(baseUrl).hostname;
    return host === 'localhost' || host === '127.0.0.1' || host === '::1';
  } catch {
    return baseUrl.includes('localhost') || baseUrl.includes('127.0.0.1');
  }
};

export interface Machine {
  id: number;
  name: string;
  created_at?: string;
  mttf_minutes?: number;
  mttr_minutes?: number;
  mttf_hours?: number;
  mttr_hours?: number;
  downtime_cost_per_hour?: number;
  last_maintenance_days_ago?: number;
  status: 'running' | 'preventive' | 'down';
  reliabilityScore: number;
}

export interface MaintenanceData {
  id: number;
  machine_id: number;
  machine_name: string;
  performed_at: string;
  duration_hours: number;
  notes: string;
}

export interface MaintenanceMetrics {
  breakdownFrequency: { month: string; value: number }[];
  downtimeDuration: { month: string; value: number }[];
  paretoDowntime: { cause: string; hours: number }[];
}

export interface OptimizeRequest {
  horizon_days: number;
  slots_per_day?: number;
  maintenance_capacity_per_day: number;
  peak_day_indices: number[];
  avoid_peak_days: boolean;
  machineData?: any;
  constraints?: any;
}

export interface ScheduleItem {
  machine: string;
  day: string;
  time: string;
  slot_index?: number | null;
  slot_in_day?: number | null;
  slot_label?: string | null;
  start_datetime_label?: string | null;
  machine_id?: number | null;
  day_index?: number | null;
  maintenance_duration_days?: number | null;
  maintenance_duration_hours?: number | null;
  maintenance_duration_minutes?: number | null;
  expected_downtime_hours?: number | null;
  estimated_cost_impact?: number | null;
}

export const MACHINE_COLOR_MAP: Record<string, string> = {
  Rewinder: '#2563EB',
  Accumulator: '#0891B2',
  Distributor: '#16A34A',
  'Log Saw': '#D97706',
  'Log Saw 2': '#DC2626',
  Packaging: '#7C3AED',
};

const MACHINE_COLOR_FALLBACK = '#64748B';

export const getMachineColor = (machineName: string | null | undefined): string => {
  if (!machineName) {
    return MACHINE_COLOR_FALLBACK;
  }
  return MACHINE_COLOR_MAP[machineName] || MACHINE_COLOR_FALLBACK;
};

export interface KPIResponse {
  predicted_downtime: number;
  availability: number;
  predicted_downtime_hours?: number | null;
  fleet_availability?: number | null;
  horizon_days?: number | null;
  slots_per_day?: number | null;
  horizon_slots?: number | null;
  [key: string]: number | null | undefined;
}

export interface OptimizeResponse {
  schedule: ScheduleItem[];
  kpis: KPIResponse;
}

const MINUTES_PER_HOUR = 60;
const OPTIMIZATION_CACHE_KEY = 'milp.latestOptimizationSnapshot.v2';

type OptimizationSnapshot = {
  request: OptimizeRequest;
  response: OptimizeResponse;
  saved_at: string;
};

const parseApiErrorMessage = async (res: Response, fallbackPrefix: string): Promise<string> => {
  const defaultMessage = `${fallbackPrefix} (${res.status} ${res.statusText})`;

  try {
    const contentType = res.headers.get('content-type') || '';

    if (contentType.includes('application/json')) {
      const payload = await res.json();
      const detail = payload?.detail ?? payload?.message ?? payload?.error;

      if (typeof detail === 'string' && detail.trim().length > 0) {
        return detail;
      }

      if (Array.isArray(detail) && detail.length > 0) {
        const normalized = detail
          .map((item: any) => {
            if (typeof item === 'string') return item;
            if (item && typeof item === 'object') {
              const location = Array.isArray(item.loc) ? item.loc.join('.') : '';
              const message = typeof item.msg === 'string' ? item.msg : JSON.stringify(item);
              return location ? `${location}: ${message}` : message;
            }
            return String(item);
          })
          .filter(Boolean)
          .join('; ');

        if (normalized.length > 0) {
          return normalized;
        }
      }

      if (detail && typeof detail === 'object') {
        return JSON.stringify(detail);
      }

      if (payload && typeof payload === 'object') {
        return JSON.stringify(payload);
      }
    }

    const textBody = (await res.text()).trim();
    if (textBody.length > 0) {
      return textBody;
    }
  } catch {
    // Fall through to default error message.
  }

  return defaultMessage;
};

const getSafeStorage = (): Storage | null => {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return null;
    }
    return window.localStorage;
  } catch {
    return null;
  }
};

const readOptimizationSnapshot = (): OptimizationSnapshot | null => {
  const storage = getSafeStorage();
  if (!storage) {
    return null;
  }

  try {
    const raw = storage.getItem(OPTIMIZATION_CACHE_KEY);
    if (!raw) {
      return null;
    }

    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') {
      return null;
    }

    const candidate = parsed as Partial<OptimizationSnapshot>;
    if (!candidate.request || !candidate.response) {
      return null;
    }

    return {
      request: candidate.request,
      response: candidate.response,
      saved_at: typeof candidate.saved_at === 'string' ? candidate.saved_at : '',
    };
  } catch {
    return null;
  }
};

const writeOptimizationSnapshot = (request: OptimizeRequest, response: OptimizeResponse): void => {
  const storage = getSafeStorage();
  if (!storage) {
    return;
  }

  try {
    const snapshot: OptimizationSnapshot = {
      request,
      response,
      saved_at: new Date().toISOString(),
    };
    storage.setItem(OPTIMIZATION_CACHE_KEY, JSON.stringify(snapshot));
  } catch {
    // Ignore cache failures and keep request flow unaffected.
  }
};

export const getLatestOptimizationRequest = (): OptimizeRequest | null => {
  const snapshot = readOptimizationSnapshot();
  return snapshot ? snapshot.request : null;
};

export const getLatestOptimizationResponse = (): OptimizeResponse | null => {
  const snapshot = readOptimizationSnapshot();
  return snapshot ? snapshot.response : null;
};

const getDemoOptimizationResult = (params: OptimizeRequest): Promise<OptimizeResponse> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      const slotsPerDay = typeof params.slots_per_day === 'number' && Number.isFinite(params.slots_per_day)
        ? params.slots_per_day
        : null;
      const horizonSlots = slotsPerDay !== null ? params.horizon_days * slotsPerDay : null;

      resolve({
        schedule: [
          {
            machine: 'Log Saw',
            day: 'Day 1',
            time: '08:00',
            slot_index: 0,
            slot_in_day: 0,
            slot_label: 'Day 1 Slot 1',
            start_datetime_label: 'Day 1 08:00',
            machine_id: 4,
            day_index: 0,
            maintenance_duration_days: 1,
            maintenance_duration_hours: 8.4,
            maintenance_duration_minutes: 504,
            expected_downtime_hours: 8.4,
            estimated_cost_impact: 25200,
          },
          {
            machine: 'Accumulator',
            day: 'Day 3',
            time: '08:00',
            slot_index: 2,
            slot_in_day: 0,
            slot_label: 'Day 3 Slot 1',
            start_datetime_label: 'Day 3 08:00',
            machine_id: 2,
            day_index: 2,
            maintenance_duration_days: 1,
            maintenance_duration_hours: 4.2,
            maintenance_duration_minutes: 252,
            expected_downtime_hours: 4.2,
            estimated_cost_impact: 7560,
          },
          {
            machine: 'Log Saw 2',
            day: 'Day 5',
            time: '08:00',
            slot_index: 4,
            slot_in_day: 0,
            slot_label: 'Day 5 Slot 1',
            start_datetime_label: 'Day 5 08:00',
            machine_id: 5,
            day_index: 4,
            maintenance_duration_days: 1,
            maintenance_duration_hours: 8.4,
            maintenance_duration_minutes: 504,
            expected_downtime_hours: 8.4,
            estimated_cost_impact: 25200,
          },
        ],
        kpis: {
          predicted_downtime: 21.0,
          availability: 95.8,
          predicted_downtime_hours: 21.0,
          fleet_availability: 95.8,
          horizon_days: params.horizon_days,
          slots_per_day: slotsPerDay,
          horizon_slots: horizonSlots,
        }
      });
    }, 1200);
  });
};

// Fallback Data for Tissue Production MVP
const DEMO_MACHINES: Machine[] = [
  { id: 1, name: 'Rewinder', created_at: new Date().toISOString(), mttf_minutes: 30000, mttr_minutes: 480, mttf_hours: 500, mttr_hours: 8, downtime_cost_per_hour: 2500, last_maintenance_days_ago: 15, status: 'running', reliabilityScore: 89 },
  { id: 2, name: 'Accumulator', created_at: new Date().toISOString(), mttf_minutes: 27000, mttr_minutes: 360, mttf_hours: 450, mttr_hours: 6, downtime_cost_per_hour: 1800, last_maintenance_days_ago: 30, status: 'preventive', reliabilityScore: 75 },
  { id: 3, name: 'Distributor', created_at: new Date().toISOString(), mttf_minutes: 36000, mttr_minutes: 240, mttf_hours: 600, mttr_hours: 4, downtime_cost_per_hour: 1500, last_maintenance_days_ago: 10, status: 'running', reliabilityScore: 92 },
  { id: 4, name: 'Log Saw', created_at: new Date().toISOString(), mttf_minutes: 21000, mttr_minutes: 720, mttf_hours: 350, mttr_hours: 12, downtime_cost_per_hour: 3000, last_maintenance_days_ago: 45, status: 'down', reliabilityScore: 60 },
  { id: 5, name: 'Log Saw 2', created_at: new Date().toISOString(), mttf_minutes: 21000, mttr_minutes: 720, mttf_hours: 350, mttr_hours: 12, downtime_cost_per_hour: 3000, last_maintenance_days_ago: 20, status: 'running', reliabilityScore: 82 },
  { id: 6, name: 'Packaging', created_at: new Date().toISOString(), mttf_minutes: 42000, mttr_minutes: 300, mttf_hours: 700, mttr_hours: 5, downtime_cost_per_hour: 2000, last_maintenance_days_ago: 5, status: 'running', reliabilityScore: 96 }
];

const DEMO_METRICS: MaintenanceMetrics = {
  breakdownFrequency: [
    { month: 'Jan', value: 8 }, { month: 'Feb', value: 5 },
    { month: 'Mar', value: 12 }, { month: 'Apr', value: 7 },
    { month: 'May', value: 4 }, { month: 'Jun', value: 6 },
  ],
  downtimeDuration: [
    { month: 'Jan', value: 30 }, { month: 'Feb', value: 20 },
    { month: 'Mar', value: 45 }, { month: 'Apr', value: 25 },
    { month: 'May', value: 15 }, { month: 'Jun', value: 22 },
  ],
  paretoDowntime: [
    { cause: 'Blade Wear (Log Saw)', hours: 60 },
    { cause: 'Web Break (Rewinder)', hours: 45 },
    { cause: 'Drive Belt Snap', hours: 30 },
    { cause: 'Roll Jam', hours: 15 },
    { cause: 'Sensor Fault', hours: 7 },
  ]
};

const toFiniteNumber = (value: unknown): number | null => {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
};

const hoursToMinutes = (hours: number): number => hours * MINUTES_PER_HOUR;
const minutesToHours = (minutes: number): number => minutes / MINUTES_PER_HOUR;

const toMinutesFromPayload = (machine: any, minuteKey: 'mttf_minutes' | 'mttr_minutes', hourKey: 'mttf_hours' | 'mttr_hours'): number | undefined => {
  const minutes = toFiniteNumber(machine?.[minuteKey]);
  if (minutes !== null) {
    return minutes;
  }

  const hours = toFiniteNumber(machine?.[hourKey]);
  if (hours !== null) {
    return hoursToMinutes(hours);
  }

  return undefined;
};

const normalizeMachinePayload = (machine: any): Machine => {
  const mttf_minutes = toMinutesFromPayload(machine, 'mttf_minutes', 'mttf_hours');
  const mttr_minutes = toMinutesFromPayload(machine, 'mttr_minutes', 'mttr_hours');
  const mttf_hours = mttf_minutes === undefined ? undefined : minutesToHours(mttf_minutes);
  const mttr_hours = mttr_minutes === undefined ? undefined : minutesToHours(mttr_minutes);
  const health = deriveMachineHealth({
    ...machine,
    mttf_hours,
    last_maintenance_days_ago: toFiniteNumber(machine?.last_maintenance_days_ago),
  });

  return {
    id: Number(machine?.id),
    name: String(machine?.name || ''),
    created_at: machine?.created_at,
    mttf_minutes,
    mttr_minutes,
    mttf_hours,
    mttr_hours,
    downtime_cost_per_hour: toFiniteNumber(machine?.downtime_cost_per_hour) ?? undefined,
    last_maintenance_days_ago: toFiniteNumber(machine?.last_maintenance_days_ago) ?? undefined,
    status: health.status,
    reliabilityScore: health.reliabilityScore,
  };
};

const toBackendMachinePayload = (
  machine: Partial<Omit<Machine, 'id' | 'created_at' | 'status' | 'reliabilityScore'>>
): Record<string, unknown> => {
  const payload: Record<string, unknown> = {
    ...machine,
  };

  if (Object.prototype.hasOwnProperty.call(machine, 'mttf_minutes')) {
    const value = toFiniteNumber(machine.mttf_minutes);
    payload.mttf_hours = value === null ? undefined : minutesToHours(value);
  }

  if (Object.prototype.hasOwnProperty.call(machine, 'mttr_minutes')) {
    const value = toFiniteNumber(machine.mttr_minutes);
    payload.mttr_hours = value === null ? undefined : minutesToHours(value);
  }

  delete payload.mttf_minutes;
  delete payload.mttr_minutes;

  return payload;
};

const deriveMachineHealth = (machineInput: any): Pick<Machine, 'status' | 'reliabilityScore'> => {
  const machine = {
    mttf_hours: toFiniteNumber(machineInput?.mttf_hours),
    last_maintenance_days_ago: toFiniteNumber(machineInput?.last_maintenance_days_ago),
  };

  // Guard invalid values while preserving the exact formula for valid inputs.
  if (
    machine.mttf_hours === null
    || machine.mttf_hours <= 0
    || machine.last_maintenance_days_ago === null
    || machine.last_maintenance_days_ago < 0
  ) {
    return { status: 'down', reliabilityScore: 0 };
  }

  const ageHours = machine.last_maintenance_days_ago * 24;
  const reliabilityScore = Math.round(Math.max(0, ((machine.mttf_hours - ageHours) / machine.mttf_hours) * 100));

  const status: Machine['status'] = reliabilityScore >= 85
    ? 'running'
    : reliabilityScore > 0 && reliabilityScore < 85
      ? 'preventive'
      : 'down';

  return { status, reliabilityScore };
};

export const fetchMachines = async (): Promise<Machine[]> => {
  try {
    const res = await fetch(`${API_BASE}/machines`);
    if (res.ok) {
      const data = await res.json();
      return data.map((d: any) => normalizeMachinePayload(d));
    }
  } catch (e) {
    console.warn('Backend unavailable, using fallback machines data');
  }
  return DEMO_MACHINES.map((machine) => normalizeMachinePayload(machine));
};

export const fetchMaintenanceData = async (): Promise<MaintenanceMetrics> => {
  try {
    const res = await fetch(`${API_BASE}/maintenance-data`);
    if (res.ok) {
      const data: MaintenanceData[] = await res.json();
      if (data && data.length > 0) {
        // Aggregate maintenance data into metrics
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const breakdownMap: Record<string, number> = {};
        const durationMap: Record<string, number> = {};
        const paretoMap: Record<string, number> = {};

        data.forEach(record => {
               const date = new Date(record.performed_at);
               const monthName = months[date.getMonth()];
               
               breakdownMap[monthName] = (breakdownMap[monthName] || 0) + 1;
               durationMap[monthName] = (durationMap[monthName] || 0) + record.duration_hours;
               
               // For demo purposes, we treat machine name as a basic "cause" or aggregate by note
               const cause = record.notes ? record.notes : `Routine (${record.machine_name})`;
               paretoMap[cause] = (paretoMap[cause] || 0) + record.duration_hours;
        });

        // Ensure we show at least a few months even if empty
        const breakdownFrequency = Object.keys(breakdownMap).map(k => ({ month: k, value: breakdownMap[k] }));
        const downtimeDuration = Object.keys(durationMap).map(k => ({ month: k, value: durationMap[k] }));
        const paretoDowntime = Object.keys(paretoMap)
          .map(k => ({ cause: k, hours: paretoMap[k] }))
          .sort((a, b) => b.hours - a.hours)
          .slice(0, 10);

        return { breakdownFrequency, downtimeDuration, paretoDowntime };
      }
      return DEMO_METRICS;
    }
  } catch (e) {
    console.warn('Backend unavailable, using fallback maintenance data');
  }
  return DEMO_METRICS;
};

export const runOptimization = async (params: OptimizeRequest): Promise<OptimizeResponse> => {
  try {
    const res = await fetch(`${API_BASE}/optimize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params)
    });
    if (!res.ok) {
      const message = await parseApiErrorMessage(res, 'Optimization request failed');
      throw new Error(message);
    }
    const response: OptimizeResponse = await res.json();
    writeOptimizationSnapshot(params, response);
    return response;
  } catch (e) {
    const isUnreachable = e instanceof TypeError;
    const canUseDemoFallback = isUnreachable && LOCAL_DEMO_MODE && isLocalhostApiBase(API_BASE);

    if (canUseDemoFallback) {
      console.warn('Backend unreachable in local demo mode, using fallback optimization data');
      const response = await getDemoOptimizationResult(params);
      writeOptimizationSnapshot(params, response);
      return response;
    }

    if (e instanceof Error) {
      throw e;
    }

    throw new Error('Optimization failed due to an unknown error');
  }
};

export const createMachine = async (machine: Omit<Machine, 'id' | 'created_at' | 'status' | 'reliabilityScore'>): Promise<Machine> => {
  const res = await fetch(`${API_BASE}/machines`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(toBackendMachinePayload(machine))
  });
  if (!res.ok) throw new Error('Failed to create machine');
  const data = await res.json();
  return normalizeMachinePayload(data);
};

export const createMaintenanceData = async (data: Omit<MaintenanceData, 'id' | 'machine_name'>): Promise<MaintenanceData> => {
  const res = await fetch(`${API_BASE}/maintenance-data`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error('Failed to log maintenance data');
  return res.json();
};

export const getMachineById = async (id: number): Promise<Machine> => {
  const res = await fetch(`${API_BASE}/machines/${id}`);
  if (!res.ok) throw new Error('Failed to fetch machine');
  const data = await res.json();
  return normalizeMachinePayload(data);
};

export const updateMachine = async (id: number, machine: Partial<Omit<Machine, 'id' | 'created_at' | 'status' | 'reliabilityScore'>>): Promise<Machine> => {
  const res = await fetch(`${API_BASE}/machines/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(toBackendMachinePayload(machine))
  });
  if (!res.ok) throw new Error('Failed to update machine');
  const data = await res.json();
  return normalizeMachinePayload(data);
};

export const deleteMachine = async (id: number): Promise<void> => {
  const res = await fetch(`${API_BASE}/machines/${id}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error('Failed to delete machine');
};

export const fetchMaintenanceRecords = async (): Promise<MaintenanceData[]> => {
  const res = await fetch(`${API_BASE}/maintenance-data`);
  if (!res.ok) throw new Error('Failed to fetch maintenance records');
  return res.json();
};

export const getMaintenanceRecordById = async (id: number): Promise<MaintenanceData> => {
  const res = await fetch(`${API_BASE}/maintenance-data/${id}`);
  if (!res.ok) throw new Error('Failed to fetch maintenance record');
  return res.json();
};

export const updateMaintenanceData = async (id: number, data: Partial<Omit<MaintenanceData, 'id' | 'machine_name'>>): Promise<MaintenanceData> => {
  const res = await fetch(`${API_BASE}/maintenance-data/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error('Failed to update maintenance data');
  return res.json();
};

export const deleteMaintenanceData = async (id: number): Promise<void> => {
  const res = await fetch(`${API_BASE}/maintenance-data/${id}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error('Failed to delete maintenance data');
};






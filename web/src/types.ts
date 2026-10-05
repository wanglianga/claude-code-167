// 与后端共享的数据类型
export interface Needs {
  visitorName?: string;
  phone?: string;
  visitDate?: string;
  timeSlot?: string;
  partySize: number;
  wheelchairCount: number;
  signLanguage: boolean;
  slowTour: boolean;
  withElderly: boolean;
  withChildren: boolean;
  closeParking: boolean;
  canStandLong: boolean;
  note?: string;
}

export interface Leg {
  seq: number;
  from: string; to: string;
  fromName: string; toName: string;
  fromType: string; toType: string;
  distance: number; maxSlope: number; minutes: number;
  uses: { elevator: string[]; ramp: boolean; stairs: boolean };
  path: string[]; rests: string[]; toilets: string[];
  suggestedRest: { name: string; detour: number } | null;
  note: string;
}

export interface Route {
  generatedAt: string;
  needs: Needs;
  stepFree: boolean;
  legs: Leg[];
  totalDistance: number;
  totalMinutes: number;
  hallCount: number;
  restStops: number;
  warnings: string[];
}

export interface Task {
  id: string; visitId: string; code: string; visitor: string;
  nodeId: string; nodeName: string;
  title: string; detail: string; kind: string;
  eta: string; status: 'pending' | 'done';
  doneAt: string | null; doneBy?: string;
}

export interface Incident {
  id: string; type: string; note: string; at: string;
  status: 'open' | 'resolved'; by: string;
  resolution?: string; resolvedAt?: string;
}

export interface TimelineItem { at: string; actor: string; text: string }

export interface Visit {
  id: string; code: string; status: 'booked' | 'checked_in' | 'completed';
  visitDate: string; timeSlot: string;
  reservation: Required<Needs>;
  route: Route | null;
  routeVersions: { at: string; reason: string }[];
  loans: { type: string; count: number; at: string; returned: number; by: string }[];
  staff: { guideId: string | null; volunteerIds: string[] };
  tasks: Task[];
  incidents: Incident[];
  timeline: TimelineItem[];
  createdAt: string;
  checkedInAt?: string;
}

export interface Facilities {
  elevators: { id: string; name: string; status: 'ok' | 'fault' }[];
  halls: { id: string; status: 'open' | 'closed'; crowd: number; name?: string }[];
  wheelchairs: { total: number; available: number };
  guides: { id: string; name: string; skills: string[]; status: 'available' | 'leave' }[];
  volunteers: { id: string; name: string; status: 'available' | 'leave' }[];
}

export interface Record {
  id: string; code: string; phone: string; visitorName: string;
  visitDate: string; timeSlot: string;
  reservation: Required<Needs>;
  routeSummary: { totalDistance: number; totalMinutes: number; halls: string[] } | null;
  loans: Visit['loans']; staff: Visit['staff'];
  incidents: Incident[]; timeline: TimelineItem[];
  completedAt: string; outcome: string;
}

export interface Meta {
  halls: { id: string; name: string; status: string; crowd: number }[];
  elevators: Facilities['elevators'];
  wheelchairs: Facilities['wheelchairs'];
  timeSlots: string[];
}

export const INCIDENT_TYPES: { value: string; label: string }[] = [
  { value: 'elevator_fault', label: '电梯临时故障' },
  { value: 'wheelchair_shortage', label: '轮椅库存不足' },
  { value: 'late_arrival', label: '观众迟到' },
  { value: 'overcrowding', label: '展厅过度拥挤' },
  { value: 'extra_companion', label: '陪同人临时增加' },
  { value: 'guide_leave', label: '讲解员请假' },
  { value: 'visitor_unwell', label: '观众身体不适' },
  { value: 'hall_closed', label: '展区临时闭馆' },
];

export function incidentLabel(t: string) {
  return INCIDENT_TYPES.find((x) => x.value === t)?.label || t;
}

export function fmtTime(iso?: string | null) {
  if (!iso) return '-';
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function fmtDateTime(iso?: string | null) {
  if (!iso) return '-';
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()} ${fmtTime(iso)}`;
}

export function localToday() {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

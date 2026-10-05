import { create } from 'zustand';
import { api, setToken } from './api';
import type { Facilities, Meta, Needs, Record, Route, Task, Visit } from './types';

interface Account { username: string; name: string; role: string; roleName: string }

interface State {
  mode: 'visitor' | 'staff';
  visitorView: 'book' | 'mine';
  staffTab: 'desk' | 'tasks' | 'facility' | 'records';
  meta: Meta | null;
  facilities: Facilities | null;
  // 观众端
  preview: { route: Route; staffPlan: { guide: string | null; problems: string[] } } | null;
  booked: Visit | null;
  myPhone: string;
  myCode: string;
  myVisit: Visit | null;
  myRecords: Record[];
  // 工作端
  account: Account | null;
  deskDate: string;
  deskVisits: Visit[];
  tasks: Task[];
  records: Record[];
  // 通用
  error: string;
  notice: string;

  setMode(m: 'visitor' | 'staff'): void;
  setVisitorView(v: 'book' | 'mine'): void;
  setStaffTab(t: State['staffTab']): void;
  setError(e: string): void;
  setNotice(n: string): void;
  loadMeta(): Promise<void>;
  loadFacilities(): Promise<void>;
  previewRoute(n: Needs): Promise<void>;
  book(n: Needs): Promise<void>;
  resetBooked(): void;
  setMyPhone(p: string): void;
  setMyCode(c: string): void;
  loadMyVisits(): Promise<void>;
  loadMyVisit(id: string): Promise<void>;
  sendSos(nodeId: string, note: string): Promise<void>;
  staffLogin(u: string, p: string): Promise<void>;
  staffLogout(): void;
  setDeskDate(d: string): void;
  loadDesk(): Promise<void>;
  visitAction(id: string, action: string, body?: unknown): Promise<Visit | null>;
  loadTasks(): Promise<void>;
  taskDone(id: string): Promise<void>;
  updateFacilities(body: unknown): Promise<void>;
  loadRecords(phone?: string): Promise<void>;
}

const today = () => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

export const useStore = create<State>((set, get) => ({
  mode: 'visitor',
  visitorView: 'book',
  staffTab: 'desk',
  meta: null,
  facilities: null,
  preview: null,
  booked: null,
  myPhone: localStorage.getItem('museum_phone') || '',
  myCode: '',
  myVisit: null,
  myRecords: [],
  account: null,
  deskDate: today(),
  deskVisits: [],
  tasks: [],
  records: [],
  error: '',
  notice: '',

  setMode: (mode) => set({ mode, error: '', notice: '' }),
  setVisitorView: (visitorView) => set({ visitorView, error: '' }),
  setStaffTab: (staffTab) => set({ staffTab, error: '' }),
  setError: (error) => set({ error }),
  setNotice: (notice) => set({ notice }),

  loadMeta: async () => {
    try {
      set({ meta: await api.get<Meta>('/api/meta') });
    } catch (e) { set({ error: (e as Error).message }); }
  },
  loadFacilities: async () => {
    try {
      const d = await api.get<{ facilities: Facilities }>('/api/facilities');
      set({ facilities: d.facilities });
    } catch (e) { set({ error: (e as Error).message }); }
  },

  previewRoute: async (n) => {
    try {
      set({ preview: await api.post('/api/route-preview', n), error: '' });
    } catch (e) { set({ error: (e as Error).message }); }
  },

  book: async (n) => {
    try {
      const d = await api.post<{ visit: Visit }>('/api/reservations', n);
      localStorage.setItem('museum_phone', n.phone || '');
      set({ booked: d.visit, myPhone: n.phone || '', myCode: d.visit.code, error: '' });
    } catch (e) { set({ error: (e as Error).message }); throw e; }
  },
  resetBooked: () => set({ booked: null, preview: null }),

  setMyPhone: (myPhone) => set({ myPhone }),
  setMyCode: (myCode) => set({ myCode }),
  loadMyVisits: async () => {
    const { myPhone } = get();
    if (!myPhone) return;
    try {
      const d = await api.get<{ visits: Visit[]; records: Record[] }>(`/api/reservations?phone=${myPhone}`);
      set({ myVisit: d.visits[0] || null, myRecords: d.records, error: d.visits.length ? '' : '未查询到进行中的预约' });
      if (d.visits[0]) set({ myCode: d.visits[0].code });
    } catch (e) { set({ error: (e as Error).message }); }
  },
  loadMyVisit: async (id) => {
    const { myPhone, myCode } = get();
    try {
      const d = await api.get<{ visit: Visit }>(`/api/visits/${id}?phone=${myPhone}&code=${encodeURIComponent(myCode)}`);
      set({ myVisit: d.visit, error: '' });
    } catch (e) { set({ error: (e as Error).message }); }
  },
  sendSos: async (nodeId, note) => {
    const { myVisit, myPhone, myCode } = get();
    if (!myVisit) return;
    try {
      await api.post(`/api/visits/${myVisit.id}/incidents`, { type: 'visitor_unwell', note, nodeId });
      await get().loadMyVisit(myVisit.id);
      set({ notice: '已通知服务台与就近工作人员，请原地休息等待协助' });
    } catch (e) { set({ error: (e as Error).message }); }
  },

  staffLogin: async (u, p) => {
    try {
      const d = await api.post<{ token: string; account: Account }>('/api/auth/staff', { username: u, password: p });
      setToken(d.token);
      set({ account: d.account, error: '' });
      await get().loadDesk();
      await get().loadFacilities();
    } catch (e) { set({ error: (e as Error).message }); }
  },
  staffLogout: () => { setToken(''); set({ account: null }); },

  setDeskDate: (deskDate) => set({ deskDate }),
  loadDesk: async () => {
    try {
      const d = await api.get<{ visits: Visit[]; facilities: Facilities }>(`/api/visits?date=${get().deskDate}`, true);
      set({ deskVisits: d.visits, facilities: d.facilities, error: '' });
    } catch (e) { set({ error: (e as Error).message }); }
  },

  visitAction: async (id, action, body) => {
    try {
      const d = await api.post<{ visit: Visit; facilities?: Facilities }>(`/api/visits/${id}/${action}`, body, true);
      if (d.facilities) set({ facilities: d.facilities });
      await get().loadDesk();
      return d.visit;
    } catch (e) {
      set({ error: (e as Error).message });
      await get().loadDesk();
      return null;
    }
  },

  loadTasks: async () => {
    try {
      const d = await api.get<{ tasks: Task[] }>(`/api/tasks?date=${get().deskDate}`, true);
      set({ tasks: d.tasks, error: '' });
    } catch (e) { set({ error: (e as Error).message }); }
  },
  taskDone: async (id) => {
    try {
      await api.post(`/api/tasks/${id}/done`, {}, true);
      await get().loadTasks();
    } catch (e) { set({ error: (e as Error).message }); }
  },

  updateFacilities: async (body) => {
    try {
      const d = await api.post<{ facilities: Facilities; changed: string[] }>('/api/facilities', body, true);
      set({ facilities: d.facilities, notice: d.changed.length ? `已更新：${d.changed.join('；')}` : '状态未变化', error: '' });
      await get().loadDesk();
    } catch (e) { set({ error: (e as Error).message }); }
  },

  loadRecords: async (phone) => {
    try {
      const d = await api.get<{ records: Record[] }>(`/api/records${phone ? `?phone=${phone}` : ''}`, true);
      set({ records: d.records, error: '' });
    } catch (e) { set({ error: (e as Error).message }); }
  },
}));

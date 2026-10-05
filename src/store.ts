import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { STAFF } from './data/museum'
import { planRoute } from './lib/planner'
import type { LiveSignals } from './lib/planner'
import type { EventType, PartyProfile, Visit } from './types'
import { shortCode, todayISO, uid } from './utils'

export interface GlobalSignals {
  elevatorsDown: string[]
  closedHalls: string[]
  crowdOverride: Record<string, number>
  staffExtraLeave: string[]
  wheelchairOffset: number
}

const DEFAULT_GLOBAL: GlobalSignals = {
  elevatorsDown: [],
  closedHalls: [],
  crowdOverride: {},
  staffExtraLeave: [],
  wheelchairOffset: 0
}

export interface VisitSignals {
  lateMin: number
  visitorUnwell: boolean
}

interface StoreState {
  visits: Visit[]
  global: GlobalSignals
  visitSignals: Record<string, VisitSignals>
  hydrated: boolean

  createVisit: (input: { date: string; arrivalMin: number; party: PartyProfile }) => string
  updateBooking: (id: string, patch: { date?: string; arrivalMin?: number; party?: Partial<PartyProfile> }, cause?: string) => void
  cancelVisit: (id: string) => void
  checkIn: (id: string) => void
  setStatus: (id: string, status: Visit['status']) => void
  loanWheelchair: (id: string) => void
  returnWheelchair: (id: string, loanId: string) => void
  assignEscort: (id: string, staffId: string) => void
  addEvent: (id: string, type: EventType, text: string, actor?: string) => void
  recordAssist: (id: string, text: string) => void
  setGlobalSignals: (patch: Partial<GlobalSignals>, cause: string) => void
  setVisitSignals: (id: string, patch: Partial<VisitSignals>, cause: string) => void
  setExtraCompanions: (id: string, n: number) => void
  addFeedback: (id: string, text: string) => void
  resetDemo: () => void
  seedDemo: () => void
}

function mergeSignals(global: GlobalSignals, vs?: VisitSignals): LiveSignals {
  return {
    elevatorsDown: global.elevatorsDown,
    closedHalls: global.closedHalls,
    crowdOverride: global.crowdOverride,
    staffExtraLeave: global.staffExtraLeave,
    wheelchairOffset: global.wheelchairOffset,
    lateMin: vs?.lateMin ?? 0,
    visitorUnwell: vs?.visitorUnwell ?? false
  }
}

function addEvent(visit: Visit, type: EventType, text: string, actor = '系统'): Visit {
  return {
    ...visit,
    events: [...visit.events, { id: uid('ev'), ts: new Date().toISOString(), type, actor, text }]
  }
}

function replanWithin(state: StoreState, visit: Visit, vs: VisitSignals | undefined, cause: string): Visit {
  const plan = planRoute({
    party: visit.party,
    date: visit.date,
    arrivalMin: visit.baseArrivalMin,
    signals: mergeSignals(state.global, vs),
    visits: state.visits,
    staff: STAFF,
    selfId: visit.id,
    version: visit.route ? visit.route.version + 1 : 1
  })
  let next: Visit = { ...visit, route: plan, escortId: plan.escortId }
  if (cause) next = addEvent(next, 'route_change', `路线 v${plan.version}：${cause}`, '调度台')
  return next
}

function makeVisit(state: StoreState, date: string, arrivalMin: number, party: PartyProfile): Visit {
  const id = uid('v')
  const plan = planRoute({
    party, date, arrivalMin,
    signals: mergeSignals(state.global),
    visits: state.visits, staff: STAFF, selfId: id
  })
  const visit: Visit = {
    id, code: shortCode(), date, baseArrivalMin: arrivalMin, status: 'booked', party, route: plan,
    escortId: plan.escortId, loans: [],
    events: [{ id: uid('ev'), ts: new Date().toISOString(), type: 'book', actor: '观众', text: `提交预约：${party.size} 人，${date} 到馆` }],
    createdAt: new Date().toISOString()
  }
  return visit
}

function emptyParty(): PartyProfile {
  return {
    contactName: '', phone: '', size: 1,
    usesWheelchair: false, borrowWheelchair: false,
    needSign: false, needSlow: false,
    hasElder: false, hasChild: false,
    needParking: false, canStandLong: true, extraCompanions: 0
  }
}

export { emptyParty }

const SEED_FLAG = 'museum_seed_v1'

export const useStore = create<StoreState>()(
  persist(
    (set, get) => ({
      visits: [],
      global: DEFAULT_GLOBAL,
      visitSignals: {},
      hydrated: false,

      createVisit: ({ date, arrivalMin, party }) => {
        const v = makeVisit(get(), date, arrivalMin, party)
        let visit = addEvent(v, 'note', `系统生成无障碍路线 v1：${v.route?.stops.length ?? 0} 个展厅、约 ${v.route?.totalDistance ?? 0} 米`, '系统')
        if (v.route?.parkingSlot) visit = addEvent(visit, 'parking', `预留无障碍车位 ${v.route.parkingSlot}`, '服务台')
        if (v.route?.escortId) visit = addEvent(visit, 'escort_assign', `已排班：${v.route.escortKind}${v.route.escortName}`, '调度台')
        set((s) => ({ visits: [...s.visits, visit] }))
        return v.id
      },

      updateBooking: (id, patch, cause) => {
        set((s) => ({
          visits: s.visits.map((v) => {
            if (v.id !== id) return v
            const next: Visit = {
              ...v,
              date: patch.date ?? v.date,
              baseArrivalMin: patch.arrivalMin ?? v.baseArrivalMin,
              party: { ...v.party, ...patch.party }
            }
            return replanWithin({ ...s, visits: s.visits }, next, s.visitSignals[id], cause ?? '预约信息变更，已重新核算路线与排班')
          })
        }))
      },

      cancelVisit: (id) => {
        set((s) => ({
          visits: s.visits.map((v) => (v.id === id ? addEvent({ ...v, status: 'cancelled' }, 'note', '预约已取消', '观众') : v))
        }))
      },

      checkIn: (id) => {
        set((s) => ({
          visits: s.visits.map((v) => {
            if (v.id !== id) return v
            let next = addEvent({ ...v, status: 'checked_in' }, 'checkin', '服务台核验预约、核验身份与安检通过', '服务台')
            if (v.party.needParking && v.route?.parkingSlot) next = addEvent(next, 'parking', `车位 ${v.route.parkingSlot} 已确认入场`, '门岗')
            if (v.route?.escortId) {
              const st = STAFF.find((x) => x.id === v.route!.escortId)
              next = addEvent(next, 'escort_assign', `${v.route.escortKind}${v.route.escortName ?? st?.name ?? ''}已到服务台对接`, '调度台')
            }
            return next
          })
        }))
      },

      setStatus: (id, status) => {
        set((s) => ({
          visits: s.visits.map((v) => {
            if (v.id !== id) return v
            let next: Visit = { ...v, status }
            if (status === 'completed') next = addEvent(next, 'complete', '参观结束，服务记录归档，欢迎下次再来', '服务台')
            if (status === 'visiting') next = addEvent(next, 'note', '正式开始参观，各楼层工作人员按预计到达时间接应', '讲解员')
            return next
          })
        }))
      },

      loanWheelchair: (id) => {
        set((s) => ({
          visits: s.visits.map((v) => {
            if (v.id !== id) return v
            const code = 'WC-' + Math.random().toString(36).slice(2, 6).toUpperCase()
            const loan = { id: uid('loan'), assetCode: code, loanedAt: new Date().toISOString() }
            let next: Visit = { ...v, loans: [...v.loans, loan] }
            next = addEvent(next, 'wheelchair_loan', `借出轮椅 ${code}，已协助调节脚踏、刹车并示范`, '服务台')
            return next
          })
        }))
      },

      returnWheelchair: (id, loanId) => {
        set((s) => ({
          visits: s.visits.map((v) => {
            if (v.id !== id) return v
            const loan = v.loans.find((l) => l.id === loanId)
            if (!loan || loan.returnedAt) return v
            let next: Visit = {
              ...v,
              loans: v.loans.map((l) => (l.id === loanId ? { ...l, returnedAt: new Date().toISOString() } : l))
            }
            next = addEvent(next, 'wheelchair_return', `轮椅 ${loan.assetCode} 已归还并检查入库`, '服务台')
            return next
          })
        }))
      },

      assignEscort: (id, staffId) => {
        set((s) => ({
          visits: s.visits.map((v) => {
            if (v.id !== id || !v.route) return v
            const st = STAFF.find((x) => x.id === staffId)
            if (!st) return v
            const route = { ...v.route, escortId: st.id, escortName: st.name, escortKind: st.role, escortIssue: undefined }
            let next: Visit = { ...v, route, escortId: st.id }
            next = addEvent(next, 'escort_assign', `人工改派：${st.role}${st.name} 全程陪同`, '调度台')
            return next
          })
        }))
      },

      addEvent: (id, type, text, actor) => {
        set((s) => ({ visits: s.visits.map((v) => (v.id === id ? addEvent(v, type, text, actor ?? '工作人员') : v)) }))
      },

      recordAssist: (id, text) => {
        set((s) => ({ visits: s.visits.map((v) => (v.id === id ? addEvent(v, 'assist', text, '展厅工作人员') : v)) }))
      },

      setGlobalSignals: (patch, cause) => {
        const global = { ...get().global, ...patch }
        // 受影响（未取消、未完成）的预约全部重算
        const affected = get().visits.filter((v) => v.status !== 'cancelled' && v.status !== 'completed')
        const interim: StoreState = { ...get(), global, visits: get().visits }
        const byId = new Map(affected.map((v) => [v.id, replanWithin(interim, v, get().visitSignals[v.id], cause)]))
        set((s) => ({
          global,
          visits: s.visits.map((v) => byId.get(v.id) ?? v)
        }))
      },

      setVisitSignals: (id, patch, cause) => {
        set((s) => {
          const prev = s.visitSignals[id] ?? { lateMin: 0, visitorUnwell: false }
          const vs: VisitSignals = { ...prev, ...patch }
          const visitSignals = { ...s.visitSignals, [id]: vs }
          const target = s.visits.find((v) => v.id === id)
          if (!target || target.status === 'cancelled') return { visitSignals }
          const replanned = replanWithin({ ...s, visitSignals }, target, vs, cause)
          return { visitSignals, visits: s.visits.map((v) => (v.id === id ? replanned : v)) }
        })
      },

      setExtraCompanions: (id, n) => {
        const v = get().visits.find((x) => x.id === id)
        if (!v) return
        get().updateBooking(id, { party: { extraCompanions: Math.max(0, n) } }, `陪同人员临时${n > (v.party.extraCompanions ?? 0) ? '增加' : '调整'}为 ${n} 人，已复核队伍规模与接应安排`)
      },

      addFeedback: (id, text) => {
        set((s) => ({
          visits: s.visits.map((v) => (v.id === id ? addEvent({ ...v, feedback: text }, 'note', `参观后反馈与偏好记录：${text}`, '观众') : v))
        }))
      },

      resetDemo: () => {
        localStorage.removeItem(SEED_FLAG)
        set({ visits: [], global: DEFAULT_GLOBAL, visitSignals: {} })
      },

      seedDemo: () => {
        if (localStorage.getItem(SEED_FLAG) || get().visits.length > 0) return
        const today = todayISO()
        const state0: StoreState = { ...get(), visits: [] }
        const mk = (arrival: number, party: PartyProfile, status: Visit['status'], mutate?: (v: Visit) => Visit): Visit => {
          const v = makeVisit({ ...state0, visits: state0.visits }, today, arrival, party)
          state0.visits = [...state0.visits, v]
          let next = v
          if (status === 'checked_in' || status === 'visiting' || status === 'completed') {
            next = addEvent({ ...next, status: status === 'completed' ? 'completed' : status }, 'checkin', '服务台核验预约、安检通过', '服务台')
          }
          if (status === 'visiting') next = addEvent(next, 'note', '已开始参观', '讲解员')
          if (status === 'completed') next = addEvent(next, 'complete', '参观结束并归档', '服务台')
          if (mutate) next = mutate(next)
          state0.visits[state0.visits.length - 1] = next
          return next
        }
        mk(9 * 60 + 30, {
          ...emptyParty(), contactName: '张女士', phone: '13800000219', size: 2,
          borrowWheelchair: true, needSlow: true, hasElder: true, needParking: true, canStandLong: false
        }, 'checked_in', (v) => {
          let n = v
          const loan = { id: uid('loan'), assetCode: 'WC-1042', loanedAt: new Date().toISOString() }
          n = { ...n, loans: [loan] }
          n = addEvent(n, 'wheelchair_loan', '借出轮椅 WC-1042', '服务台')
          return n
        })
        mk(10 * 60 + 0, {
          ...emptyParty(), contactName: '林先生', phone: '13900008851', size: 3,
          usesWheelchair: true, needSign: true, hasChild: false, canStandLong: true
        }, 'booked')
        mk(11 * 60 + 15, {
          ...emptyParty(), contactName: '吴阿姨', phone: '13700003340', size: 4,
          needSlow: true, hasElder: true, hasChild: true, canStandLong: false
        }, 'booked')
        set({ visits: state0.visits })
        localStorage.setItem(SEED_FLAG, '1')
      }
    }),
    {
      name: 'museum-access-visit-v1',
      partialize: (s) => ({ visits: s.visits, global: s.global, visitSignals: s.visitSignals }),
      onRehydrateStorage: () => (state) => {
        state?.seedDemo()
      }
    }
  )
)

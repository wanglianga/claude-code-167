// store 运行时冒烟测试（node + localStorage 垫片）
const mem = new Map<string, string>()
globalThis.localStorage = {
  getItem: (k) => (mem.has(k) ? mem.get(k)! : null),
  setItem: (k, v) => void mem.set(k, v),
  removeItem: (k) => void mem.delete(k),
  clear: () => mem.clear()
} as unknown as Storage

const { useStore } = await import('../src/store.ts')
const { todayISO } = await import('../src/utils.ts')

let pass = 0, fail = 0
const assert = (c: boolean, m: string) => { c ? (pass++, console.log('  ✅', m)) : (fail++, console.log('  ❌', m)) }

useStore.getState().resetDemo()
useStore.getState().seedDemo()
let st = useStore.getState()
assert(st.visits.length === 3, `seedDemo 生成 3 组今日演示预约（实际 ${st.visits.length}）`)

const today = todayISO()
const id = st.createVisit({
  date: today, arrivalMin: 10 * 60,
  party: {
    contactName: '测试观众', phone: '13900000000', size: 2,
    usesWheelchair: false, borrowWheelchair: true, needSign: false, needSlow: true,
    hasElder: true, hasChild: false, needParking: true, canStandLong: false, extraCompanions: 0
  }
})
st = useStore.getState()
const v0 = st.visits.find((v) => v.id === id)!
assert(!!v0.route && v0.route.version === 1, '新预约生成路线 v1')
assert(v0.events.some((e) => e.type === 'book'), '写入预约事件')
assert(!!v0.route?.parkingSlot && !!v0.route.escortId, '同时排到车位与陪同')

// 电梯故障 → 全局联动重规划
useStore.getState().setGlobalSignals({ elevatorsDown: ['el1'] }, '1号客梯故障演练')
st = useStore.getState()
const v1 = st.visits.find((v) => v.id === id)!
assert(v1.route!.version === 2 && v1.events.some((e) => e.type === 'route_change'), '故障后该预约升级 v2 并留路线调整记录')
assert(!v1.route!.trace.some((t) => t.startsWith('ev1')), 'v2 轨迹不含故障电梯')

// 核验 + 借轮椅
useStore.getState().checkIn(id)
useStore.getState().loanWheelchair(id)
st = useStore.getState()
const v2 = st.visits.find((v) => v.id === id)!
assert(v2.status === 'checked_in', '服务台核验入馆')
assert(v2.loans.length === 1 && !!v2.loans[0].loanedAt, `借出轮椅 ${v2.loans[0]?.assetCode}`)

// 迟到
useStore.getState().setVisitSignals(id, { lateMin: 30 }, '迟到演练')
st = useStore.getState()
const v3 = st.visits.find((v) => v.id === id)!
assert(v3.route!.arrivalMin === 10 * 60 + 30, `接应顺延至 ${v3.route!.arrivalMin}（期望 630）`)

// 身体不适 → 缩减
const before = v3.route!.stops.length
useStore.getState().setVisitSignals(id, { visitorUnwell: true }, '不适演练')
st = useStore.getState()
const v4 = st.visits.find((v) => v.id === id)!
assert(v4.route!.reduced && v4.route!.stops.length <= before, `身体不适后展厅 ${before}→${v4.route!.stops.length}`)

// 陪同人临时增加
useStore.getState().setExtraCompanions(id, 2)
st = useStore.getState()
assert(st.visits.find((v) => v.id === id)!.party.extraCompanions === 2, '临时增加陪同 2 人已入同一服务')

// 突发协助
useStore.getState().recordAssist(id, '三楼坡道协助推行并在休息区测量血压')
st = useStore.getState()
assert(st.visits.find((v) => v.id === id)!.events.some((e) => e.type === 'assist'), '突发协助写入服务记录')

// 归还 + 完成 + 反馈
useStore.getState().returnWheelchair(id, v4.loans[0].id)
useStore.getState().setStatus(id, 'completed')
useStore.getState().addFeedback(id, '偏好慢速讲解，希望下次仍安排王老师')
st = useStore.getState()
const v5 = st.visits.find((v) => v.id === id)!
assert(!!v5.loans[0].returnedAt, '轮椅归还入库有时间戳')
assert(v5.status === 'completed' && v5.feedback?.includes('王老师'), '归档并保留参观后偏好，供下次延续')
assert(v5.events.every((e) => typeof e.text === 'string' && e.ts), `全链路事件 ${v5.events.length} 条均完整`)

// 演示预约不应被 seed 两次
useStore.getState().seedDemo()
assert(useStore.getState().visits.length === 4, `不重复播种（实际 ${useStore.getState().visits.length}）`)

console.log(`\n结果：${pass} 通过，${fail} 失败`)
if (fail) process.exit(1)

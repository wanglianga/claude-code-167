// 场馆图数据与初始种子数据
// 节点类型: parking 停车场 / gate 大门 / desk 服务台 / lobby 大厅 / hall 展厅
//           elevator 电梯井道 / ramp 坡道平台 / rest 休息点 / toilet 卫生间 / shop 商店 / exit 出口
// 边类型:   walk 步行 / ramp 坡道 / elevator 电梯 / stairs 楼梯

export const GRAPH = {
  nodes: [
    { id: 'parking', name: '无障碍停车场', type: 'parking', floor: 0 },
    { id: 'gate', name: '场馆正门', type: 'gate', floor: 0 },
    { id: 'desk', name: '服务台', type: 'desk', floor: 1 },
    { id: 'lobby', name: '中央大厅', type: 'lobby', floor: 1 },
    { id: 'hallA', name: '古代文明厅', type: 'hall', floor: 1 },
    { id: 'hallB', name: '自然科普厅', type: 'hall', floor: 1 },
    { id: 'rest1', name: '一层休息区', type: 'rest', floor: 1 },
    { id: 'wc1', name: '一层无障碍卫生间', type: 'toilet', floor: 1 },
    { id: 'e1f1', name: '1号电梯(1F)', type: 'elevator', floor: 1 },
    { id: 'e1f2', name: '1号电梯(2F)', type: 'elevator', floor: 2 },
    { id: 'e1f3', name: '1号电梯(3F)', type: 'elevator', floor: 3 },
    { id: 'e2f1', name: '2号电梯(1F)', type: 'elevator', floor: 1 },
    { id: 'e2f2', name: '2号电梯(2F)', type: 'elevator', floor: 2 },
    { id: 'e2f3', name: '2号电梯(3F)', type: 'elevator', floor: 3 },
    { id: 'mezz2', name: '二层坡道平台', type: 'ramp', floor: 2 },
    { id: 'hallC', name: '艺术珍品厅', type: 'hall', floor: 2 },
    { id: 'hallD', name: '现代设计厅', type: 'hall', floor: 2 },
    { id: 'rest2', name: '二层休息区', type: 'rest', floor: 2 },
    { id: 'wc2', name: '二层无障碍卫生间', type: 'toilet', floor: 2 },
    { id: 'mezz3', name: '三层坡道平台', type: 'ramp', floor: 3 },
    { id: 'hallE', name: '特展展厅', type: 'hall', floor: 3 },
    { id: 'rest3', name: '三层休息角', type: 'rest', floor: 3 },
    { id: 'wc3', name: '三层卫生间', type: 'toilet', floor: 3 },
    { id: 'shop', name: '文创商店', type: 'shop', floor: 1 },
    { id: 'exit', name: '出口', type: 'exit', floor: 1 },
  ],
  // distance 米, slope 坡度%, kind 通行方式, elevator 所属电梯(仅 elevator 边)
  edges: [
    { a: 'parking', b: 'gate', distance: 40, slope: 1, kind: 'walk', name: '无障碍通道' },
    { a: 'gate', b: 'desk', distance: 15, slope: 0, kind: 'walk' },
    { a: 'desk', b: 'lobby', distance: 20, slope: 0, kind: 'walk' },
    { a: 'lobby', b: 'hallA', distance: 35, slope: 0, kind: 'walk' },
    { a: 'lobby', b: 'hallB', distance: 45, slope: 0, kind: 'walk' },
    { a: 'lobby', b: 'rest1', distance: 15, slope: 0, kind: 'walk' },
    { a: 'rest1', b: 'wc1', distance: 8, slope: 0, kind: 'walk' },
    { a: 'hallA', b: 'wc1', distance: 20, slope: 0, kind: 'walk' },
    { a: 'hallA', b: 'hallB', distance: 30, slope: 0, kind: 'walk' },
    { a: 'hallB', b: 'e2f1', distance: 15, slope: 0, kind: 'walk' },
    { a: 'lobby', b: 'e1f1', distance: 10, slope: 0, kind: 'walk' },
    { a: 'e1f1', b: 'e1f2', distance: 0, slope: 0, kind: 'elevator', elevator: 'elev1' },
    { a: 'e1f2', b: 'e1f3', distance: 0, slope: 0, kind: 'elevator', elevator: 'elev1' },
    { a: 'e2f1', b: 'e2f2', distance: 0, slope: 0, kind: 'elevator', elevator: 'elev2' },
    { a: 'e2f2', b: 'e2f3', distance: 0, slope: 0, kind: 'elevator', elevator: 'elev2' },
    { a: 'e1f2', b: 'hallC', distance: 18, slope: 0, kind: 'walk' },
    { a: 'e1f2', b: 'hallD', distance: 28, slope: 0, kind: 'walk' },
    { a: 'e1f3', b: 'hallE', distance: 22, slope: 0, kind: 'walk' },
    { a: 'e2f2', b: 'hallD', distance: 12, slope: 0, kind: 'walk' },
    { a: 'e2f2', b: 'hallC', distance: 20, slope: 0, kind: 'walk' },
    { a: 'e2f3', b: 'hallE', distance: 15, slope: 0, kind: 'walk' },
    { a: 'lobby', b: 'mezz2', distance: 72, slope: 6, kind: 'ramp', name: '中央坡道' },
    { a: 'mezz2', b: 'hallC', distance: 15, slope: 0, kind: 'walk' },
    { a: 'mezz2', b: 'hallD', distance: 20, slope: 0, kind: 'walk' },
    { a: 'mezz2', b: 'rest2', distance: 10, slope: 0, kind: 'walk' },
    { a: 'rest2', b: 'wc2', distance: 8, slope: 0, kind: 'walk' },
    { a: 'hallC', b: 'hallD', distance: 25, slope: 0, kind: 'walk' },
    { a: 'hallC', b: 'wc2', distance: 16, slope: 0, kind: 'walk' },
    { a: 'mezz2', b: 'mezz3', distance: 45, slope: 6, kind: 'ramp', name: '东区坡道' },
    { a: 'mezz3', b: 'hallE', distance: 12, slope: 0, kind: 'walk' },
    { a: 'mezz3', b: 'rest3', distance: 8, slope: 0, kind: 'walk' },
    { a: 'rest3', b: 'wc3', distance: 6, slope: 0, kind: 'walk' },
    { a: 'lobby', b: 'mezz2', distance: 30, slope: 0, kind: 'stairs', name: '中央楼梯' },
    { a: 'mezz2', b: 'mezz3', distance: 25, slope: 0, kind: 'stairs', name: '东区楼梯' },
    { a: 'lobby', b: 'shop', distance: 18, slope: 0, kind: 'walk' },
    { a: 'shop', b: 'exit', distance: 10, slope: 0, kind: 'walk' },
    { a: 'exit', b: 'parking', distance: 35, slope: 1, kind: 'walk', name: '无障碍通道' },
  ],
};

export const STAFF_ACCOUNTS = [
  { username: 'desk', password: 'desk123', name: '王服务', role: 'desk', roleName: '服务台' },
  { username: 'hall', password: 'hall123', name: '李展厅', role: 'hall', roleName: '展厅工作人员' },
  { username: 'admin', password: 'admin123', name: '赵调度', role: 'admin', roleName: '场馆调度' },
];

export function seedFacilities() {
  return {
    elevators: [
      { id: 'elev1', name: '1号电梯', status: 'ok' },
      { id: 'elev2', name: '2号电梯', status: 'ok' },
    ],
    // crowd: 0-100 拥挤度; status: open 开放 / closed 临时闭馆
    halls: [
      { id: 'hallA', status: 'open', crowd: 30 },
      { id: 'hallB', status: 'open', crowd: 45 },
      { id: 'hallC', status: 'open', crowd: 55 },
      { id: 'hallD', status: 'open', crowd: 25 },
      { id: 'hallE', status: 'open', crowd: 60 },
    ],
    wheelchairs: { total: 6, available: 6 },
    // skills: sign 手语 / slow 慢速讲解; status: available 在岗 / leave 请假
    guides: [
      { id: 'g1', name: '陈讲解', skills: ['sign', 'slow'], status: 'available' },
      { id: 'g2', name: '刘讲解', skills: ['slow'], status: 'available' },
      { id: 'g3', name: '林讲解', skills: ['sign'], status: 'available' },
    ],
    volunteers: [
      { id: 'v1', name: '小周(志愿者)', status: 'available' },
      { id: 'v2', name: '小吴(志愿者)', status: 'available' },
    ],
  };
}

export function localDate(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function todayPlus(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return localDate(d);
}

// 演示预约: 固定预约码, 便于 README 中给出测试账号
export function seedVisits() {
  return [
    {
      id: 'visit-demo-1',
      code: 'VA1001',
      status: 'booked',
      visitDate: todayPlus(0),
      timeSlot: '09:30',
      reservation: {
        visitorName: '张奶奶家属', phone: '13800000001', partySize: 3,
        wheelchairCount: 1, signLanguage: false, slowTour: true,
        withElderly: true, withChildren: false, closeParking: true, canStandLong: false,
        note: '老人行动不便, 希望节奏慢一点',
      },
      route: null, routeVersions: [], loans: [],
      staff: { guideId: null, volunteerIds: [] },
      tasks: [], incidents: [],
      timeline: [{ at: new Date().toISOString(), actor: '观众', text: '提交预约：轮椅1辆、慢速讲解、同行有老人、需近距离停车' }],
      createdAt: new Date().toISOString(),
    },
    {
      id: 'visit-demo-2',
      code: 'VA1002',
      status: 'booked',
      visitDate: todayPlus(0),
      timeSlot: '14:00',
      reservation: {
        visitorName: '刘先生', phone: '13800000002', partySize: 2,
        wheelchairCount: 0, signLanguage: true, slowTour: false,
        withElderly: false, withChildren: true, closeParking: false, canStandLong: true,
        note: '需要手语讲解, 带一名儿童',
      },
      route: null, routeVersions: [], loans: [],
      staff: { guideId: null, volunteerIds: [] },
      tasks: [], incidents: [], timeline: [],
      createdAt: new Date().toISOString(),
    },
    {
      id: 'visit-demo-3',
      code: 'VA1003',
      status: 'booked',
      visitDate: todayPlus(1),
      timeSlot: '10:00',
      reservation: {
        visitorName: '陈女士', phone: '13800000003', partySize: 4,
        wheelchairCount: 2, signLanguage: false, slowTour: true,
        withElderly: true, withChildren: true, closeParking: true, canStandLong: false,
        note: '两位老人各需一辆轮椅',
      },
      route: null, routeVersions: [], loans: [],
      staff: { guideId: null, volunteerIds: [] },
      tasks: [], incidents: [], timeline: [],
      createdAt: new Date().toISOString(),
    },
  ];
}

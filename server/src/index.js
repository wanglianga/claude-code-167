import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { getDb, saveDb, findVisit, addTimeline, addIncident, archiveVisit, incidentTypeName } from './db.js';
import { buildRoute, generateTasks, matchStaff } from './router.js';
import { STAFF_ACCOUNTS, localDate } from './seed.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json());

const PORT = process.env.PORT || 8080;

// ---------- 简易会话 ----------
const tokens = new Map(); // token -> account
function authStaff(req, res, next) {
  const token = req.headers['x-token'];
  const acc = token && tokens.get(token);
  if (!acc) return res.status(401).json({ error: '未登录或登录已过期' });
  req.staff = acc;
  next();
}

function genCode() {
  const db = getDb();
  const all = new Set([...db.visits.map((v) => v.code), ...db.records.map((r) => r.code)]);
  let code;
  do {
    code = 'V' + String(Math.floor(10000 + Math.random() * 90000));
  } while (all.has(code));
  return code;
}

function validateNeeds(b) {
  const errs = [];
  if (!b.visitorName || !String(b.visitorName).trim()) errs.push('请填写联系人姓名');
  if (!/^1\d{10}$/.test(String(b.phone || ''))) errs.push('请填写 11 位手机号');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(b.visitDate || ''))) errs.push('请选择参观日期');
  if (!b.timeSlot) errs.push('请选择入馆时段');
  const party = Number(b.partySize);
  if (!Number.isInteger(party) || party < 1 || party > 20) errs.push('人数需为 1-20');
  const wc = Number(b.wheelchairCount || 0);
  if (!Number.isInteger(wc) || wc < 0 || wc > party) errs.push('轮椅数量需在 0 与人数之间');
  return errs;
}

function publicVisit(v) {
  return v; // 演示项目直接返回全量；生产应按角色裁剪
}

// 设施变化后, 重算在馆参观的路线并记录
function rerouteActiveVisits(reason, actor) {
  const db = getDb();
  const affected = [];
  for (const v of db.visits) {
    if (v.status !== 'checked_in') continue;
    const route = buildRoute(db, v.reservation);
    v.routeVersions.push({ at: new Date().toISOString(), reason, route });
    v.route = route;
    // 重新生成未完成任务
    v.tasks = v.tasks.filter((t) => t.status === 'done');
    v.tasks.push(...generateTasks(db, v, new Date().toISOString()));
    addTimeline(v, actor || '系统', `路线已更新（${reason}），协助任务已同步调整`);
    affected.push(v);
  }
  return affected;
}

// ---------- 认证 ----------
app.post('/api/auth/staff', (req, res) => {
  const { username, password } = req.body || {};
  const acc = STAFF_ACCOUNTS.find((a) => a.username === username && a.password === password);
  if (!acc) return res.status(401).json({ error: '账号或密码错误' });
  const token = 'tok-' + Math.random().toString(36).slice(2) + Date.now().toString(36);
  tokens.set(token, { username: acc.username, name: acc.name, role: acc.role, roleName: acc.roleName });
  res.json({ token, account: { username: acc.username, name: acc.name, role: acc.role, roleName: acc.roleName } });
});

// ---------- 公共信息 ----------
app.get('/api/meta', (req, res) => {
  const db = getDb();
  res.json({
    halls: db.facilities.halls.map((h) => ({
      ...h,
      name: db.graph.nodes.find((n) => n.id === h.id)?.name,
    })),
    elevators: db.facilities.elevators,
    wheelchairs: db.facilities.wheelchairs,
    timeSlots: ['09:30', '10:30', '13:00', '14:00', '15:00'],
  });
});

// ---------- 路线试算（预约前预览）----------
app.post('/api/route-preview', (req, res) => {
  const db = getDb();
  const route = buildRoute(db, { ...req.body, canStandLong: req.body.canStandLong !== false });
  const staff = matchStaff(db, req.body || {});
  res.json({ route, staffPlan: { guide: staff.guide?.name || null, problems: staff.problems } });
});

// ---------- 预约 ----------
app.post('/api/reservations', (req, res) => {
  const b = req.body || {};
  const errs = validateNeeds(b);
  if (errs.length) return res.status(400).json({ error: errs.join('；') });
  const db = getDb();

  // 历史接待记录（下次接待延续）
  const history = db.records.filter((r) => r.phone === b.phone).slice(0, 3);

  const visit = {
    id: 'visit-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    code: genCode(),
    status: 'booked',
    visitDate: b.visitDate,
    timeSlot: b.timeSlot,
    reservation: {
      visitorName: String(b.visitorName).trim(),
      phone: String(b.phone),
      partySize: Number(b.partySize),
      wheelchairCount: Number(b.wheelchairCount || 0),
      signLanguage: !!b.signLanguage,
      slowTour: !!b.slowTour,
      withElderly: !!b.withElderly,
      withChildren: !!b.withChildren,
      closeParking: !!b.closeParking,
      canStandLong: b.canStandLong !== false,
      note: String(b.note || ''),
    },
    route: null, routeVersions: [], loans: [],
    staff: { guideId: null, volunteerIds: [] },
    tasks: [], incidents: [], timeline: [],
    createdAt: new Date().toISOString(),
  };
  visit.route = buildRoute(db, visit.reservation);
  visit.routeVersions.push({ at: new Date().toISOString(), reason: '预约生成', route: visit.route });

  // 预约时即规划讲解员
  const plan = matchStaff(db, visit.reservation);
  if (plan.guide) visit.staff.guideId = plan.guide.id;
  for (const p of plan.problems) addTimeline(visit, '系统', '人员安排提示：' + p);

  // 轮椅库存预警 → 自动登记突发事件
  if (visit.reservation.wheelchairCount > db.facilities.wheelchairs.available) {
    addIncident(visit, 'wheelchair_shortage',
      `需要 ${visit.reservation.wheelchairCount} 辆，当前库存 ${db.facilities.wheelchairs.available} 辆`, '系统');
  }
  if (visit.reservation.closeParking) {
    addTimeline(visit, '系统', '已预留无障碍停车位（近距离停车需求）');
  }
  addTimeline(visit, '观众', `提交预约：${visit.visitDate} ${visit.timeSlot}，${visit.reservation.partySize} 人`);
  if (history.length) {
    addTimeline(visit, '系统', `识别到 ${history.length} 条历史接待记录，已参考延续服务偏好`);
  }
  db.visits.push(visit);
  saveDb();
  res.json({ visit: publicVisit(visit), history });
});

// 观众查询自己的预约（手机号）
app.get('/api/reservations', (req, res) => {
  const db = getDb();
  const phone = String(req.query.phone || '');
  const visits = db.visits.filter((v) => v.reservation.phone === phone);
  const records = db.records.filter((r) => r.phone === phone);
  res.json({ visits: visits.map(publicVisit), records });
});

// 参观服务详情：观众凭 手机号+预约码，工作人员凭 token
app.get('/api/visits/:id', (req, res) => {
  const v = findVisit(req.params.id);
  if (!v) return res.status(404).json({ error: '预约不存在' });
  const token = req.headers['x-token'];
  if (tokens.has(token)) return res.json({ visit: publicVisit(v) });
  const { phone, code } = req.query;
  if (v.reservation.phone === phone && v.code === String(code || '').toUpperCase()) {
    return res.json({ visit: publicVisit(v) });
  }
  return res.status(401).json({ error: '请使用预约手机号与预约码查看' });
});

// ---------- 服务台 ----------
app.get('/api/visits', authStaff, (req, res) => {
  const db = getDb();
  const date = String(req.query.date || localDate());
  res.json({
    visits: db.visits.filter((v) => v.visitDate === date).map(publicVisit),
    facilities: db.facilities,
  });
});

// 入馆核验（自动识别迟到）
app.post('/api/visits/:id/checkin', authStaff, (req, res) => {
  const v = findVisit(req.params.id);
  if (!v) return res.status(404).json({ error: '预约不存在' });
  if (v.status !== 'booked') return res.status(400).json({ error: '当前状态不可核验' });
  const now = new Date();
  const slotStart = new Date(`${v.visitDate}T${v.timeSlot}:00`);
  const lateMin = Math.floor((now - slotStart) / 60000);
  v.status = 'checked_in';
  v.checkedInAt = now.toISOString();
  addTimeline(v, req.staff.name, `服务台核验通过，预约码 ${v.code}`);
  if (lateMin > 15) {
    addIncident(v, 'late_arrival', `迟到 ${lateMin} 分钟，后续节点预计到达时间已顺延`, '系统');
  }
  // 入馆时按最新设施状态重算路线并生成协助任务
  const db = getDb();
  v.route = buildRoute(db, v.reservation);
  v.routeVersions.push({ at: now.toISOString(), reason: '入馆核验时按现场情况更新', route: v.route });
  v.tasks = generateTasks(db, v, now.toISOString());
  addTimeline(v, '系统', `已生成 ${v.tasks.length} 项协助任务并推送至展厅工作人员`);
  saveDb();
  res.json({ visit: publicVisit(v) });
});

// 轮椅借出/归还
app.post('/api/visits/:id/wheelchair', authStaff, (req, res) => {
  const v = findVisit(req.params.id);
  if (!v) return res.status(404).json({ error: '预约不存在' });
  const db = getDb();
  const { action, count } = req.body || {};
  const n = Math.max(1, Number(count) || 1);
  if (action === 'loan') {
    if (db.facilities.wheelchairs.available < n) {
      addIncident(v, 'wheelchair_shortage',
        `借出 ${n} 辆时库存不足（余 ${db.facilities.wheelchairs.available} 辆）`, req.staff.name);
      saveDb();
      return res.status(409).json({ error: `轮椅库存不足，仅余 ${db.facilities.wheelchairs.available} 辆`, visit: publicVisit(v) });
    }
    db.facilities.wheelchairs.available -= n;
    v.loans.push({ type: 'wheelchair', count: n, at: new Date().toISOString(), returned: 0, by: req.staff.name });
    addTimeline(v, req.staff.name, `借出轮椅 ${n} 辆（剩余库存 ${db.facilities.wheelchairs.available}）`);
  } else if (action === 'return') {
    const loaned = v.loans.filter((l) => l.type === 'wheelchair').reduce((s, l) => s + l.count - l.returned, 0);
    const ret = Math.min(n, loaned);
    if (ret <= 0) return res.status(400).json({ error: '没有待归还的轮椅' });
    db.facilities.wheelchairs.available = Math.min(db.facilities.wheelchairs.total, db.facilities.wheelchairs.available + ret);
    let left = ret;
    for (const l of v.loans.filter((l) => l.type === 'wheelchair')) {
      const can = l.count - l.returned;
      const use = Math.min(can, left);
      l.returned += use; left -= use;
      if (!left) break;
    }
    addTimeline(v, req.staff.name, `归还轮椅 ${ret} 辆（库存 ${db.facilities.wheelchairs.available}）`);
  } else {
    return res.status(400).json({ error: 'action 需为 loan 或 return' });
  }
  saveDb();
  res.json({ visit: publicVisit(v), facilities: db.facilities });
});

// 安排讲解员/志愿者
app.post('/api/visits/:id/assign', authStaff, (req, res) => {
  const v = findVisit(req.params.id);
  if (!v) return res.status(404).json({ error: '预约不存在' });
  const db = getDb();
  const { guideId, volunteerIds } = req.body || {};
  if (guideId !== undefined) {
    const g = db.facilities.guides.find((x) => x.id === guideId);
    if (guideId && !g) return res.status(400).json({ error: '讲解员不存在' });
    if (g && g.status !== 'available') return res.status(409).json({ error: `${g.name} 当前请假，无法安排` });
    v.staff.guideId = guideId || null;
    addTimeline(v, req.staff.name, g ? `安排讲解员：${g.name}` : '取消讲解员安排');
  }
  if (Array.isArray(volunteerIds)) {
    v.staff.volunteerIds = volunteerIds.filter((id) => db.facilities.volunteers.some((x) => x.id === id));
    const names = v.staff.volunteerIds.map((id) => db.facilities.volunteers.find((x) => x.id === id)?.name);
    addTimeline(v, req.staff.name, `安排志愿者陪同：${names.join('、') || '无'}`);
  }
  saveDb();
  res.json({ visit: publicVisit(v) });
});

// 陪同人临时增加 / 需求变更
app.post('/api/visits/:id/companion', authStaff, (req, res) => {
  const v = findVisit(req.params.id);
  if (!v) return res.status(404).json({ error: '预约不存在' });
  const db = getDb();
  const party = Number(req.body?.partySize);
  const wc = req.body?.wheelchairCount !== undefined ? Number(req.body.wheelchairCount) : v.reservation.wheelchairCount;
  if (!Number.isInteger(party) || party < 1 || party > 20) return res.status(400).json({ error: '人数需为 1-20' });
  const old = v.reservation.partySize;
  v.reservation.partySize = party;
  v.reservation.wheelchairCount = wc;
  if (party > old) {
    addIncident(v, 'extra_companion', `陪同人由 ${old} 人增至 ${party} 人`, req.staff.name);
  } else {
    addTimeline(v, req.staff.name, `人数调整为 ${party} 人`);
  }
  if (wc > db.facilities.wheelchairs.available + v.loans.reduce((s, l) => s + l.count - l.returned, 0)) {
    addIncident(v, 'wheelchair_shortage', `变更后需 ${wc} 辆轮椅，库存紧张`, '系统');
  }
  // 人数/轮椅变化影响体力与设备 → 重算路线
  v.route = buildRoute(db, v.reservation);
  v.routeVersions.push({ at: new Date().toISOString(), reason: '陪同人/轮椅需求变更', route: v.route });
  if (v.status === 'checked_in') {
    v.tasks = v.tasks.filter((t) => t.status === 'done');
    v.tasks.push(...generateTasks(db, v, new Date().toISOString()));
  }
  saveDb();
  res.json({ visit: publicVisit(v) });
});

// 突发事件登记（服务台/展厅/观众SOS 共用）
app.post('/api/visits/:id/incidents', (req, res) => {
  const v = findVisit(req.params.id);
  if (!v) return res.status(404).json({ error: '预约不存在' });
  const { type, note, nodeId } = req.body || {};
  if (!type) return res.status(400).json({ error: '缺少事件类型' });
  const token = req.headers['x-token'];
  const actor = tokens.get(token)?.name || '观众';
  const db = getDb();
  const inc = addIncident(v, type, note || incidentTypeName(type), actor);
  if (type === 'visitor_unwell') {
    const node = db.graph.nodes.find((n) => n.id === nodeId) || db.graph.nodes.find((n) => n.id === 'rest1');
    v.tasks.unshift({
      id: 'task-' + Math.random().toString(36).slice(2, 8),
      visitId: v.id, code: v.code, visitor: v.reservation.visitorName,
      nodeId: node.id, nodeName: node.name,
      title: '⚠ 紧急：观众身体不适', detail: note || '请立即前往协助，必要时联系医务点',
      kind: 'urgent', eta: new Date().toISOString(), status: 'pending', doneAt: null,
    });
    addTimeline(v, '系统', `已生成紧急协助任务（${node.name}），并通知就近工作人员`);
  }
  saveDb();
  res.json({ visit: publicVisit(v), incident: inc });
});

// 事件处理完结
app.post('/api/visits/:id/incidents/:iid/resolve', authStaff, (req, res) => {
  const v = findVisit(req.params.id);
  if (!v) return res.status(404).json({ error: '预约不存在' });
  const inc = v.incidents.find((i) => i.id === req.params.iid);
  if (!inc) return res.status(404).json({ error: '事件不存在' });
  inc.status = 'resolved';
  inc.resolution = String(req.body?.resolution || '已处理');
  inc.resolvedAt = new Date().toISOString();
  addTimeline(v, req.staff.name, `事件处理完成：${incidentTypeName(inc.type)} — ${inc.resolution}`);
  saveDb();
  res.json({ visit: publicVisit(v) });
});

// 手动重新规划路线
app.post('/api/visits/:id/reroute', authStaff, (req, res) => {
  const v = findVisit(req.params.id);
  if (!v) return res.status(404).json({ error: '预约不存在' });
  const db = getDb();
  v.route = buildRoute(db, v.reservation);
  v.routeVersions.push({ at: new Date().toISOString(), reason: String(req.body?.reason || '人工重新规划'), route: v.route });
  if (v.status === 'checked_in') {
    v.tasks = v.tasks.filter((t) => t.status === 'done');
    v.tasks.push(...generateTasks(db, v, new Date().toISOString()));
  }
  addTimeline(v, req.staff.name, '已重新规划路线');
  saveDb();
  res.json({ visit: publicVisit(v) });
});

// 结束参观 → 归档服务记录
app.post('/api/visits/:id/complete', authStaff, (req, res) => {
  const v = findVisit(req.params.id);
  if (!v) return res.status(404).json({ error: '预约不存在' });
  const db = getDb();
  // 自动归还剩余轮椅
  const loaned = v.loans.filter((l) => l.type === 'wheelchair').reduce((s, l) => s + l.count - l.returned, 0);
  if (loaned > 0) {
    db.facilities.wheelchairs.available = Math.min(db.facilities.wheelchairs.total, db.facilities.wheelchairs.available + loaned);
    for (const l of v.loans) l.returned = l.count;
    addTimeline(v, '系统', `离馆自动归还轮椅 ${loaned} 辆`);
  }
  const record = archiveVisit(v, String(req.body?.outcome || ''), req.staff.name);
  saveDb();
  res.json({ record });
});

// ---------- 展厅协助任务 ----------
app.get('/api/tasks', authStaff, (req, res) => {
  const db = getDb();
  const date = String(req.query.date || localDate());
  const tasks = db.visits
    .filter((v) => v.visitDate === date && v.status === 'checked_in')
    .flatMap((v) => v.tasks);
  tasks.sort((a, b) => (a.status === 'done' ? 1 : 0) - (b.status === 'done' ? 1 : 0) || a.eta.localeCompare(b.eta));
  res.json({ tasks });
});

app.post('/api/tasks/:id/done', authStaff, (req, res) => {
  const db = getDb();
  for (const v of db.visits) {
    const t = v.tasks.find((x) => x.id === req.params.id);
    if (t) {
      t.status = 'done';
      t.doneAt = new Date().toISOString();
      t.doneBy = req.staff.name;
      addTimeline(v, req.staff.name, `完成协助任务：${t.title}（${t.nodeName}）`);
      saveDb();
      return res.json({ task: t });
    }
  }
  res.status(404).json({ error: '任务不存在' });
});

// ---------- 设施状态（调度模拟）----------
app.get('/api/facilities', (req, res) => {
  res.json({ facilities: getDb().facilities });
});

app.post('/api/facilities', authStaff, (req, res) => {
  const db = getDb();
  const f = db.facilities;
  const b = req.body || {};
  const actor = req.staff.name;
  const reasons = [];

  if (b.elevator) {
    const e = f.elevators.find((x) => x.id === b.elevator.id);
    if (e && e.status !== b.elevator.status) {
      e.status = b.elevator.status;
      reasons.push(`${e.name}${e.status === 'ok' ? '恢复运行' : '临时故障'}`);
      if (e.status !== 'ok') {
        for (const v of db.visits.filter((x) => x.status === 'checked_in')) {
          addIncident(v, 'elevator_fault', `${e.name}临时故障，路线已改用坡道/其他电梯`, actor);
        }
      }
    }
  }
  if (b.hall) {
    const h = f.halls.find((x) => x.id === b.hall.id);
    if (h) {
      const name = db.graph.nodes.find((n) => n.id === h.id)?.name;
      if (b.hall.status && h.status !== b.hall.status) {
        h.status = b.hall.status;
        reasons.push(`「${name}」${h.status === 'closed' ? '临时闭馆' : '恢复开放'}`);
        if (h.status === 'closed') {
          for (const v of db.visits.filter((x) => x.status === 'checked_in')) {
            addIncident(v, 'hall_closed', `「${name}」临时闭馆，路线已跳过该展区`, actor);
          }
        }
      }
      if (b.hall.crowd !== undefined) {
        const c = Math.max(0, Math.min(100, Number(b.hall.crowd)));
        const wasCrowded = h.crowd > 75;
        h.crowd = c;
        if (c > 75 && !wasCrowded) {
          reasons.push(`「${name}」拥挤度升至 ${c}%`);
          for (const v of db.visits.filter((x) => x.status === 'checked_in')) {
            addIncident(v, 'overcrowding', `「${name}」过度拥挤(${c}%)，该展厅已调整至行程后段`, actor);
          }
        }
      }
    }
  }
  if (b.wheelchairs) {
    const total = Math.max(0, Number(b.wheelchairs.total ?? f.wheelchairs.total));
    const avail = Math.max(0, Math.min(total, Number(b.wheelchairs.available ?? f.wheelchairs.available)));
    f.wheelchairs = { total, available: avail };
    reasons.push(`轮椅库存调整为 ${avail}/${total}`);
  }
  if (b.guide) {
    const g = f.guides.find((x) => x.id === b.guide.id);
    if (g && g.status !== b.guide.status) {
      g.status = b.guide.status;
      reasons.push(`讲解员${g.name}${g.status === 'leave' ? '请假' : '返岗'}`);
      if (g.status === 'leave') {
        for (const v of db.visits.filter((x) => x.staff.guideId === g.id && x.status !== 'completed')) {
          addIncident(v, 'guide_leave', `讲解员${g.name}请假，需重新安排`, actor);
          const plan = matchStaff(db, v.reservation);
          v.staff.guideId = plan.guide?.id || null;
          addTimeline(v, '系统', plan.guide ? `已自动改派讲解员：${plan.guide.name}` : '暂无可改派讲解员，请服务台人工协调');
        }
      }
    }
  }
  if (reasons.length) {
    rerouteActiveVisits(reasons.join('；'), actor);
  }
  saveDb();
  res.json({ facilities: f, changed: reasons });
});

// ---------- 服务记录 ----------
app.get('/api/records', authStaff, (req, res) => {
  const db = getDb();
  const phone = String(req.query.phone || '');
  const list = phone ? db.records.filter((r) => r.phone === phone) : db.records;
  res.json({ records: list.slice(0, 50) });
});

// ---------- 静态托管前端 ----------
const distDir = path.join(__dirname, '..', 'public');
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir));
  app.get(/^(?!\/api\/).*/, (req, res) => res.sendFile(path.join(distDir, 'index.html')));
}

app.listen(PORT, () => {
  console.log(`博物馆无障碍参观服务系统已启动: http://localhost:${PORT}`);
});

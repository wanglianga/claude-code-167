// 简易 JSON 文件持久化（演示规模足够，零原生依赖，Docker 构建稳定）
import fs from 'node:fs';
import path from 'node:path';
import { GRAPH, seedFacilities, seedVisits } from './seed.js';
import { buildRoute, matchStaff } from './router.js';

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

let db = null;

export function loadDb() {
  if (db) return db;
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (fs.existsSync(DB_FILE)) {
    try {
      db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    } catch {
      db = null;
    }
  }
  if (!db) {
    db = {
      graph: GRAPH,
      facilities: seedFacilities(),
      visits: seedVisits(),
      records: [], // 已完结的参观服务记录（预约前/中/后全量时间线）
    };
    // 为种子预约生成路线与人员预案，保证开箱即有完整演示数据
    for (const v of db.visits) {
      v.route = buildRoute(db, v.reservation);
      v.routeVersions.push({ at: new Date().toISOString(), reason: '预约生成', route: v.route });
      const plan = matchStaff(db, v.reservation);
      if (plan.guide) v.staff.guideId = plan.guide.id;
    }
    saveDb();
  }
  return db;
}

export function saveDb() {
  if (!db) return;
  const tmp = DB_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
  fs.renameSync(tmp, DB_FILE);
}

export function getDb() {
  return loadDb();
}

export function findVisit(id) {
  return getDb().visits.find((v) => v.id === id);
}

export function addTimeline(visit, actor, text) {
  visit.timeline.push({ at: new Date().toISOString(), actor, text });
  visit.updatedAt = new Date().toISOString();
}

export function addIncident(visit, type, note, actor) {
  const inc = {
    id: 'inc-' + Math.random().toString(36).slice(2, 8),
    type, note,
    at: new Date().toISOString(),
    status: 'open',
    by: actor,
  };
  visit.incidents.push(inc);
  addTimeline(visit, actor, `突发情况：${incidentTypeName(type)} — ${note}`);
  return inc;
}

export function incidentTypeName(type) {
  return {
    elevator_fault: '电梯临时故障',
    wheelchair_shortage: '轮椅库存不足',
    late_arrival: '观众迟到',
    overcrowding: '展厅过度拥挤',
    extra_companion: '陪同人临时增加',
    guide_leave: '讲解员请假',
    visitor_unwell: '观众身体不适',
    hall_closed: '展区临时闭馆',
  }[type] || type;
}

// 完结参观：归档为服务记录，供下次接待延续
export function archiveVisit(visit, outcome, actor) {
  visit.status = 'completed';
  addTimeline(visit, actor, `参观结束（${outcome || '正常完成'}），服务记录已归档`);
  const record = {
    id: visit.id,
    code: visit.code,
    phone: visit.reservation.phone,
    visitorName: visit.reservation.visitorName,
    visitDate: visit.visitDate,
    timeSlot: visit.timeSlot,
    reservation: visit.reservation,
    routeSummary: visit.route
      ? {
          totalDistance: visit.route.totalDistance,
          totalMinutes: visit.route.totalMinutes,
          halls: visit.route.legs.filter((l) => l.toType === 'hall').map((l) => l.toName),
        }
      : null,
    loans: visit.loans,
    staff: visit.staff,
    incidents: visit.incidents,
    timeline: visit.timeline,
    completedAt: new Date().toISOString(),
    outcome: outcome || '正常完成',
  };
  const db = getDb();
  db.records.unshift(record);
  db.visits = db.visits.filter((v) => v.id !== visit.id);
  saveDb();
  return record;
}

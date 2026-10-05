// 无障碍路线生成引擎
// 输入: 预约需求 + 当前设施状态(电梯/坡道/拥挤度/临时闭馆/轮椅库存)
// 输出: 分段路线(每段距离/坡度/休息点/卫生间)、总耗时、提示信息
//
// 路线推荐同时考虑: 展厅覆盖、观众体力(休息点密度/坡度上限)、设备可用(电梯/轮椅)、
// 展厅拥挤(拥挤展厅排后段)、工作人员接应(由任务生成环节消费 legs)

export function buildRoute(db, needs) {
  const { graph, facilities } = db;
  const nodeById = Object.fromEntries(graph.nodes.map((n) => [n.id, n]));
  const hallInfo = Object.fromEntries(facilities.halls.map((h) => [h.id, h]));
  const elevatorOk = Object.fromEntries(facilities.elevators.map((e) => [e.id, e.status === 'ok']));

  const useWheelchair = needs.wheelchairCount > 0;
  const stepFree = useWheelchair || !needs.canStandLong || needs.withElderly;
  const maxSlope = useWheelchair ? 6 : stepFree ? 8 : 12;
  const needRest = needs.withElderly || needs.withChildren || !needs.canStandLong;
  const restThreshold = needRest ? 60 : 120; // 每走多少米应安排休息
  const speed = Math.max(
    32,
    (needs.slowTour ? 38 : 50) - (useWheelchair ? 5 : 0) - (needs.withChildren ? 4 : 0),
  ); // 米/分钟
  const dwellPerHall = needs.slowTour ? 25 : 15; // 每个展厅停留分钟

  const warnings = [];

  function edgeDisabled(e) {
    if (e.kind === 'stairs' && stepFree) return true;
    if (e.kind === 'elevator' && !elevatorOk[e.elevator]) return true;
    if (e.slope > maxSlope) return true;
    for (const nid of [e.a, e.b]) {
      const n = nodeById[nid];
      if (n.type === 'hall' && hallInfo[n.id]?.status === 'closed') return true;
    }
    return false;
  }

  function edgeMinutes(e) {
    let t = e.distance / speed;
    if (e.kind === 'elevator') t = 1.5; // 含候梯
    if (e.kind === 'stairs') t *= 2;
    const nb = nodeById[e.b];
    if (nb.type === 'hall') {
      const c = hallInfo[nb.id]?.crowd ?? 0;
      if (c > 60) t *= 1 + (c - 60) / 40; // 拥挤惩罚
    }
    return t;
  }

  // Dijkstra（图很小，直接 O(n^2)）
  function shortest(start, goal) {
    const dist = { [start]: 0 };
    const prev = {};
    const done = new Set();
    while (true) {
      let cur = null;
      let best = Infinity;
      for (const [k, v] of Object.entries(dist)) {
        if (!done.has(k) && v < best) { best = v; cur = k; }
      }
      if (cur === null) return null;
      if (cur === goal) break;
      done.add(cur);
      for (const e of graph.edges) {
        if (edgeDisabled(e)) continue;
        for (const [from, to] of [[e.a, e.b], [e.b, e.a]]) {
          if (from !== cur) continue;
          const nd = dist[cur] + edgeMinutes({ ...e, a: from, b: to });
          if (dist[to] === undefined || nd < dist[to]) {
            dist[to] = nd;
            prev[to] = { node: from, edge: { ...e, a: from, b: to } };
          }
        }
      }
    }
    const path = [];
    const edges = [];
    let cur = goal;
    while (cur !== start) {
      path.unshift(cur);
      const p = prev[cur];
      if (!p) return null;
      edges.unshift(p.edge);
      cur = p.node;
    }
    path.unshift(start);
    const distance = edges.reduce((s, e) => s + e.distance, 0);
    const maxSlopeOnPath = edges.reduce((s, e) => Math.max(s, e.slope), 0);
    return { path, edges, distance, maxSlope: maxSlopeOnPath, minutes: dist[goal] };
  }

  // ---- 确定要覆盖的展厅 ----
  const closedHalls = facilities.halls.filter((h) => h.status === 'closed');
  if (closedHalls.length) {
    warnings.push(
      `临时闭馆：${closedHalls.map((h) => nodeById[h.id].name).join('、')}，本次路线已跳过`,
    );
  }
  let remaining = facilities.halls.filter((h) => h.status !== 'closed').map((h) => h.id);

  // ---- 展厅排序: 最近邻 + 拥挤展厅(>75)排后段 ----
  const startId = needs.closeParking ? 'parking' : 'gate';
  const ordered = [];
  let cursor = 'lobby'; // 从大厅出发规划展厅顺序
  while (remaining.length) {
    let bestId = null;
    let bestScore = Infinity;
    for (const hid of remaining) {
      const r = shortest(cursor, hid);
      if (!r) continue;
      const crowd = hallInfo[hid]?.crowd ?? 0;
      const score = r.minutes * (crowd > 75 ? 3 : 1);
      if (score < bestScore) { bestScore = score; bestId = hid; }
    }
    if (bestId === null) break;
    ordered.push(bestId);
    remaining = remaining.filter((h) => h !== bestId);
    cursor = bestId;
  }
  for (const hid of ordered) {
    const c = hallInfo[hid]?.crowd ?? 0;
    if (c > 75) warnings.push(`「${nodeById[hid].name}」当前拥挤(${c}%)，已安排在行程后段，请听从现场引导`);
  }

  // ---- 途经点序列: 起点 → 服务台 → 各展厅 → 商店 → 出口 ----
  const waypoints = [startId];
  if (startId === 'parking') waypoints.push('gate');
  waypoints.push('desk', 'lobby', ...ordered, 'shop', 'exit');

  // ---- 生成 legs ----
  const legs = [];
  let totalDistance = 0;
  let walkMinutes = 0;
  let failed = false;
  for (let i = 0; i < waypoints.length - 1; i++) {
    const a = waypoints[i];
    const b = waypoints[i + 1];
    if (a === b) continue;
    const r = shortest(a, b);
    if (!r) {
      warnings.push(`无法从「${nodeById[a].name}」到达「${nodeById[b].name}」：无障碍通路中断`);
      failed = true;
      continue;
    }
    const uses = {
      elevator: [...new Set(r.edges.filter((e) => e.kind === 'elevator').map((e) => e.elevator))],
      ramp: r.edges.some((e) => e.kind === 'ramp'),
      stairs: r.edges.some((e) => e.kind === 'stairs'),
    };
    const rests = r.path.filter((id) => nodeById[id].type === 'rest').map((id) => nodeById[id].name);
    const toilets = r.path.filter((id) => nodeById[id].type === 'toilet').map((id) => nodeById[id].name);
    legs.push({
      seq: legs.length + 1,
      from: a, to: b,
      fromName: nodeById[a].name, toName: nodeById[b].name,
      fromType: nodeById[a].type, toType: nodeById[b].type,
      distance: Math.round(r.distance),
      maxSlope: r.maxSlope,
      minutes: Math.max(1, Math.round(r.minutes)),
      uses, path: r.path, rests, toilets,
      suggestedRest: null,
      note: legNote(r, uses, nodeById),
    });
    totalDistance += r.distance;
    walkMinutes += r.minutes;
  }

  // ---- 休息点检查: 连续步行超过阈值且无休息点 → 建议就近休息 ----
  if (!failed) {
    let sinceRest = 0;
    for (const leg of legs) {
      sinceRest += leg.distance;
      if (leg.rests.length > 0) { sinceRest = 0; continue; }
      if (sinceRest > restThreshold) {
        const mid = leg.path[Math.floor(leg.path.length / 2)];
        let bestRest = null;
        let bestD = Infinity;
        for (const n of graph.nodes) {
          if (n.type !== 'rest') continue;
          const r = shortest(mid, n.id);
          if (r && r.distance < bestD) { bestD = r.distance; bestRest = n; }
        }
        if (bestRest) {
          leg.suggestedRest = { name: bestRest.name, detour: Math.round(bestD * 2) };
          sinceRest = 0;
        }
      }
    }
  }

  const restStops = legs.filter((l) => l.suggestedRest).length +
    legs.reduce((s, l) => s + l.rests.length, 0);
  const restMinutes = restStops * 10;
  const hallCount = legs.filter((l) => l.toType === 'hall').length;
  const totalMinutes = Math.round(walkMinutes + hallCount * dwellPerHall + restMinutes);

  // ---- 设备与人员提示 ----
  if (useWheelchair && facilities.wheelchairs.available < needs.wheelchairCount) {
    warnings.push(
      `轮椅库存不足：需要 ${needs.wheelchairCount} 辆，当前仅余 ${facilities.wheelchairs.available} 辆，服务台将协调备用轮椅或建议您调整时段`,
    );
  }
  if (stepFree) {
    const fault = facilities.elevators.filter((e) => e.status !== 'ok');
    if (fault.length) {
      warnings.push(`${fault.map((e) => e.name).join('、')}故障，已改用坡道/其他电梯的无障碍路线`);
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    needs: {
      wheelchairCount: needs.wheelchairCount, signLanguage: !!needs.signLanguage,
      slowTour: !!needs.slowTour, withElderly: !!needs.withElderly,
      withChildren: !!needs.withChildren, closeParking: !!needs.closeParking,
      canStandLong: needs.canStandLong !== false, partySize: needs.partySize || 1,
    },
    stepFree, legs,
    totalDistance: Math.round(totalDistance),
    totalMinutes,
    hallCount,
    restStops,
    warnings,
  };
}

function legNote(r, uses, nodeById) {
  const parts = [];
  if (uses.elevator.length) {
    parts.push(`乘${uses.elevator.map((id) => (id === 'elev1' ? '1号电梯' : '2号电梯')).join('、')}`);
  }
  if (uses.ramp) {
    const rampNames = [...new Set(r.edges.filter((e) => e.kind === 'ramp' && e.name).map((e) => e.name))];
    parts.push(`经${rampNames.join('、') || '坡道'}`);
  }
  if (uses.stairs) parts.push('经楼梯（体力不足者建议改乘电梯）');
  if (r.maxSlope > 0 && !uses.ramp) parts.push(`最大坡度 ${r.maxSlope}%`);
  return parts.join('；');
}

// ---- 入馆后根据路线生成协助任务（展厅工作人员平板端可见）----
export function generateTasks(db, visit, baseTimeISO) {
  const { graph } = db;
  const nodeById = Object.fromEntries(graph.nodes.map((n) => [n.id, n]));
  const route = visit.route;
  if (!route) return [];
  const tasks = [];
  let t = new Date(baseTimeISO).getTime();
  const add = (min) => { t += min * 60000; };
  const fmt = () => new Date(t).toISOString();
  const mk = (nodeId, title, detail, kind) => ({
    id: 'task-' + Math.random().toString(36).slice(2, 8),
    visitId: visit.id, code: visit.code,
    visitor: visit.reservation.visitorName,
    nodeId, nodeName: nodeById[nodeId]?.name || nodeId,
    title, detail, kind,
    eta: fmt(), status: 'pending', doneAt: null,
  });

  const needs = route.needs;
  if (needs.wheelchairCount > 0) {
    tasks.push(mk('desk', `轮椅借出 ${needs.wheelchairCount} 辆`, `为 ${visit.reservation.visitorName} 准备并登记轮椅`, 'equipment'));
  }
  tasks.push(mk('desk', '入馆核验接待', `预约码 ${visit.code}，${visit.reservation.partySize} 人`, 'reception'));

  for (const leg of route.legs) {
    add(leg.minutes);
    if (leg.uses.elevator.length && route.stepFree) {
      for (const el of leg.uses.elevator) {
        const elNode = leg.path.find((id) => id.startsWith(el === 'elev1' ? 'e1' : 'e2'));
        tasks.push(mk(elNode || leg.to, '电梯口接应', `协助乘坐${el === 'elev1' ? '1号' : '2号'}电梯（${leg.fromName} → ${leg.toName}）`, 'assist'));
      }
    }
    if (leg.suggestedRest) {
      tasks.push(mk(leg.to, '休息点关照', `观众连续步行较长，引导至「${leg.suggestedRest.name}」休息`, 'rest'));
    }
    if (leg.toType === 'hall') {
      const dwell = needs.slowTour ? 25 : 15;
      const extra = [];
      if (needs.signLanguage) extra.push('手语讲解');
      if (needs.slowTour) extra.push('慢速讲解');
      tasks.push(mk(leg.to, `展厅接应：${leg.toName}`, `预计停留 ${dwell} 分钟${extra.length ? '，需' + extra.join('、') : ''}`, 'hall'));
      add(dwell);
    }
    if (leg.suggestedRest || leg.rests.length) add(10);
  }
  tasks.push(mk('exit', '离馆送别与轮椅回收', '确认观众离馆、回收借用设备并登记', 'reception'));
  return tasks;
}

// ---- 讲解员/志愿者匹配 ----
export function matchStaff(db, needs) {
  const { guides, volunteers } = db.facilities;
  const free = guides.filter((g) => g.status === 'available');
  let guide = null;
  if (needs.signLanguage) {
    guide = free.find((g) => g.skills.includes('sign') && (needs.slowTour ? g.skills.includes('slow') : true))
      || free.find((g) => g.skills.includes('sign'));
  }
  if (!guide && needs.slowTour) guide = free.find((g) => g.skills.includes('slow'));
  if (!guide) guide = free[0] || null;
  const volunteer = volunteers.find((v) => v.status === 'available') || null;
  const problems = [];
  if (needs.signLanguage && !free.some((g) => g.skills.includes('sign'))) {
    problems.push('暂无会手语的讲解员在岗，将安排志愿者陪同并提供文字导览册');
  }
  if (!guide) problems.push('讲解员均不在岗，将安排志愿者陪同');
  return { guide, volunteer, problems };
}

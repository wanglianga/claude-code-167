import { useEffect, useMemo, useState } from 'react';
import { useStore } from '../store';
import { RouteCard } from '../components/common';
import { localToday, type Needs } from '../types';

const defaultNeeds: Needs = {
  visitorName: '', phone: '', visitDate: localToday(),
  timeSlot: '09:30', partySize: 2, wheelchairCount: 0,
  signLanguage: false, slowTour: false, withElderly: false, withChildren: false,
  closeParking: false, canStandLong: true, note: '',
};

function Toggle({ label, hint, on, onChange }: { label: string; hint?: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="switch-row">
      <div className="txt">
        {label}
        {hint && <span className="hint">{hint}</span>}
      </div>
      <button
        type="button" role="switch" aria-checked={on} aria-label={label}
        className={`toggle ${on ? 'on' : ''}`}
        onClick={() => onChange(!on)}
      />
    </div>
  );
}

export default function BookPage() {
  const { meta, facilities, preview, previewRoute, book, booked, resetBooked, setVisitorView, error } = useStore();
  const [form, setForm] = useState<Needs>(defaultNeeds);
  const [submitting, setSubmitting] = useState(false);
  const set = <K extends keyof Needs>(k: K, v: Needs[K]) => setForm((f) => ({ ...f, [k]: v }));

  // 需求变化时实时试算路线（防抖）
  const previewKey = useMemo(() => JSON.stringify([
    form.wheelchairCount, form.canStandLong, form.withElderly, form.withChildren,
    form.slowTour, form.closeParking, form.partySize,
  ]), [form]);
  useEffect(() => {
    const t = setTimeout(() => previewRoute(form), 350);
    return () => clearTimeout(t);
  }, [previewKey]);

  useEffect(() => { load0(); }, []);
  const load0 = () => useStore.getState().loadFacilities();

  const submit = async () => {
    setSubmitting(true);
    try { await book(form); } finally { setSubmitting(false); }
  };

  if (booked) {
    return (
      <div>
        <section className="card" style={{ textAlign: 'center' }}>
          <h2>预约成功</h2>
          <p style={{ margin: '4px 0', color: 'var(--ink-soft)', fontSize: '0.88rem' }}>
            入馆当天请向服务台出示预约码
          </p>
          <div className="big-code" aria-label="预约码">{booked.code}</div>
          <p style={{ fontSize: '0.9rem' }}>
            {booked.visitDate} {booked.timeSlot} · {booked.reservation.partySize} 人 · {booked.reservation.visitorName}
          </p>
          {booked.reservation.closeParking && <span className="badge info">已预留无障碍停车位</span>}
        </section>
        <section className="card">
          <h2>为您规划的无障碍路线</h2>
          {booked.route && <RouteCard route={booked.route} />}
        </section>
        <div className="btn-row">
          <button className="btn block" onClick={() => setVisitorView('mine')}>查看我的参观</button>
          <button className="btn ghost block" onClick={resetBooked}>再约一场</button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <section className="card">
        <h2>参观预约</h2>
        <div className="field">
          <label htmlFor="f-name">联系人姓名</label>
          <input id="f-name" value={form.visitorName} onChange={(e) => set('visitorName', e.target.value)} placeholder="怎么称呼您" />
        </div>
        <div className="field">
          <label htmlFor="f-phone">手机号(用于查询预约与服务记录)</label>
          <input id="f-phone" inputMode="numeric" maxLength={11} value={form.phone}
            onChange={(e) => set('phone', e.target.value.replace(/\D/g, ''))} placeholder="11 位手机号" />
        </div>
        <div className="grid cols-2">
          <div className="field">
            <label htmlFor="f-date">参观日期</label>
            <input id="f-date" type="date" min={localToday()}
              value={form.visitDate} onChange={(e) => set('visitDate', e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="f-slot">入馆时段</label>
            <select id="f-slot" value={form.timeSlot} onChange={(e) => set('timeSlot', e.target.value)}>
              {(meta?.timeSlots || ['09:30']).map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>
        <div className="grid cols-2">
          <div className="field">
            <label htmlFor="f-party">参观人数(含陪同)</label>
            <input id="f-party" type="number" min={1} max={20} value={form.partySize}
              onChange={(e) => set('partySize', Math.max(1, Number(e.target.value) || 1))} />
          </div>
          <div className="field">
            <label htmlFor="f-wc">借用轮椅数量</label>
            <input id="f-wc" type="number" min={0} max={form.partySize} value={form.wheelchairCount}
              onChange={(e) => set('wheelchairCount', Math.max(0, Math.min(form.partySize, Number(e.target.value) || 0)))} />
          </div>
        </div>
        {facilities && form.wheelchairCount > 0 && (
          <p style={{ fontSize: '0.8rem', color: form.wheelchairCount > facilities.wheelchairs.available ? 'var(--danger)' : 'var(--ink-soft)', margin: '0 0 8px' }}>
            当前轮椅库存 {facilities.wheelchairs.available}/{facilities.wheelchairs.total} 辆
            {form.wheelchairCount > facilities.wheelchairs.available && '，库存不足，提交后服务台将主动联系协调'}
          </p>
        )}
      </section>

      <section className="card">
        <h2>无障碍需求</h2>
        <Toggle label="需要手语讲解" hint="将匹配会手语的讲解员" on={form.signLanguage} onChange={(v) => set('signLanguage', v)} />
        <Toggle label="需要慢速讲解" hint="放慢节奏、增加停留时间" on={form.slowTour} onChange={(v) => set('slowTour', v)} />
        <Toggle label="同行有老人" hint="路线将增加休息点、避开楼梯" on={form.withElderly} onChange={(v) => set('withElderly', v)} />
        <Toggle label="同行有儿童" hint="适当放慢行进速度" on={form.withChildren} onChange={(v) => set('withChildren', v)} />
        <Toggle label="需要近距离停车" hint="预留无障碍车位，路线从停车场开始" on={form.closeParking} onChange={(v) => set('closeParking', v)} />
        <Toggle label="能长时间站立" hint="关闭后路线将避开楼梯并加密休息点" on={form.canStandLong} onChange={(v) => set('canStandLong', v)} />
        <div className="field" style={{ marginTop: 10 }}>
          <label htmlFor="f-note">其他需求备注</label>
          <textarea id="f-note" rows={2} value={form.note} onChange={(e) => set('note', e.target.value)}
            placeholder="如：需要助听器、对强光敏感等" />
        </div>
      </section>

      {preview && (
        <section className="card" aria-live="polite">
          <h2>路线预览(根据当前场馆状态实时生成)</h2>
          <RouteCard route={preview.route} />
          {preview.staffPlan.guide && (
            <p style={{ fontSize: '0.85rem', margin: '8px 0 0' }}>拟安排讲解员：<b>{preview.staffPlan.guide}</b></p>
          )}
          {preview.staffPlan.problems.map((p, i) => (
            <p key={i} style={{ fontSize: '0.85rem', color: 'var(--warn)', margin: '4px 0 0' }}>⚠ {p}</p>
          ))}
        </section>
      )}

      {error && <div className="error-box" role="alert">{error}</div>}
      <button className="btn block" disabled={submitting} onClick={submit}>
        {submitting ? '提交中…' : '提交预约'}
      </button>
      <p className="footer-note">提交即表示同意我们在参观当天为您提供现场协助调度</p>
    </div>
  );
}

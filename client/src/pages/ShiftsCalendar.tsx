import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { startOfWeek, addDays, format, isSameDay, parseISO } from 'date-fns';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { api } from '../lib/api';
import { Shift, Candidate, Client } from '../lib/types';
import {
  Badge, Card, Spinner, Modal, PageHeader,
  inputCls, btnPrimary, btnGhost, fmtStatus,
} from '../components/ui';
import clsx from 'clsx';

type ShiftType = Shift['shift_type'];

const TYPE_COLORS: Record<ShiftType, string> = {
  day: '#1863dc',
  night: '#0b3560',
  early: '#01aef0',
  late: '#7bdcb5',
  long_day: '#8b5cf6',
};

const SHIFT_PRESETS: Record<ShiftType, { start: string; end: string; hours: string }> = {
  day: { start: '07:30', end: '20:00', hours: '12' },
  night: { start: '20:00', end: '07:30', hours: '12' },
  early: { start: '07:00', end: '14:30', hours: '7.5' },
  late: { start: '14:00', end: '21:30', hours: '7.5' },
  long_day: { start: '07:30', end: '21:30', hours: '13.5' },
};

const SHIFT_TYPES: ShiftType[] = ['day', 'night', 'early', 'late', 'long_day'];
const STATUSES: Shift['status'][] = ['booked', 'completed', 'cancelled', 'no_show'];

const labelCls = 'mb-1 block text-xs font-medium text-slate-600';

function weekLabel(start: Date) {
  const end = addDays(start, 6);
  return start.getMonth() === end.getMonth()
    ? `${format(start, 'd')} – ${format(end, 'd MMM yyyy')}`
    : `${format(start, 'd MMM')} – ${format(end, 'd MMM yyyy')}`;
}

export default function ShiftsCalendar() {
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [shifts, setShifts] = useState<Shift[] | null>(null);
  const [clientFilter, setClientFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [clients, setClients] = useState<Client[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    candidate_id: '', client_id: '', shift_date: format(new Date(), 'yyyy-MM-dd'),
    shift_type: 'day' as ShiftType, start_time: '07:30', end_time: '20:00', hours: '12',
    pay_rate: '', charge_rate: '',
  });

  const weekEnd = addDays(weekStart, 6);
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);

  const fetchShifts = () => {
    const params = new URLSearchParams({
      from: format(weekStart, 'yyyy-MM-dd'),
      to: format(weekEnd, 'yyyy-MM-dd'),
    });
    if (clientFilter) params.set('client_id', clientFilter);
    if (statusFilter) params.set('status', statusFilter);
    api.get<Shift[]>(`/shifts?${params}`).then(setShifts).catch(() => setShifts([]));
  };

  useEffect(fetchShifts, [weekStart, clientFilter, statusFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    api.get<Client[]>('/clients').then(setClients).catch(() => {});
    api.get<{ data: Candidate[] }>('/candidates?limit=200').then((r) => setCandidates(r.data)).catch(() => {});
  }, []);

  const visible = useMemo(
    () => (shifts ?? []).filter((s) => !typeFilter || s.shift_type === typeFilter),
    [shifts, typeFilter]
  );

  const summary = useMemo(() => ({
    total: visible.length,
    completed: visible.filter((s) => s.status === 'completed').length,
    booked: visible.filter((s) => s.status === 'booked').length,
    cancelled: visible.filter((s) => s.status === 'cancelled' || s.status === 'no_show').length,
    hours: visible.reduce((sum, s) => sum + Number(s.hours || 0), 0),
  }), [visible]);

  const setType = (t: ShiftType) => {
    const p = SHIFT_PRESETS[t];
    setForm((f) => ({ ...f, shift_type: t, start_time: p.start, end_time: p.end, hours: p.hours }));
  };

  const submit = async () => {
    if (!form.candidate_id || !form.client_id || !form.shift_date) {
      setError('Candidate, care home and date are required.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await api.post('/shifts', {
        candidate_id: +form.candidate_id,
        client_id: +form.client_id,
        shift_date: form.shift_date,
        shift_type: form.shift_type,
        start_time: form.start_time,
        end_time: form.end_time,
        hours: form.hours ? +form.hours : null,
        pay_rate: form.pay_rate || null,
        charge_rate: form.charge_rate || null,
      });
      setShowModal(false);
      setForm({
        candidate_id: '', client_id: '', shift_date: format(new Date(), 'yyyy-MM-dd'),
        shift_type: 'day', start_time: '07:30', end_time: '20:00', hours: '12',
        pay_rate: '', charge_rate: '',
      });
      fetchShifts();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to book shift');
    } finally {
      setSaving(false);
    }
  };

  const stats = [
    { label: 'Shifts this week', value: summary.total },
    { label: 'Booked', value: summary.booked },
    { label: 'Completed', value: summary.completed },
    { label: 'Cancelled / No-show', value: summary.cancelled },
    { label: 'Total hours', value: summary.hours % 1 === 0 ? summary.hours : summary.hours.toFixed(1) },
  ];

  return (
    <div>
      <PageHeader title="Shift Calendar" subtitle="Weekly view of booked, completed and cancelled shifts.">
        <button className={btnPrimary} onClick={() => setShowModal(true)}>
          <Plus className="h-4 w-4" /> Book Shift
        </button>
      </PageHeader>

      {/* Summary strip */}
      <div className="mb-5 grid grid-cols-2 gap-4 md:grid-cols-5">
        {stats.map(({ label, value }) => (
          <Card key={label} className="px-4 py-3">
            <p className="text-xl font-bold tracking-tight text-ink">{value}</p>
            <p className="text-xs font-medium text-slate-600">{label}</p>
          </Card>
        ))}
      </div>

      {/* Filter + week nav bar */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1">
          <button className={clsx(btnGhost, 'px-2.5')} onClick={() => setWeekStart(addDays(weekStart, -7))} aria-label="Previous week">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button className={btnGhost} onClick={() => setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))}>
            Today
          </button>
          <button className={clsx(btnGhost, 'px-2.5')} onClick={() => setWeekStart(addDays(weekStart, 7))} aria-label="Next week">
            <ChevronRight className="h-4 w-4" />
          </button>
          <span className="ml-2 font-display text-[15px] font-semibold text-ink">{weekLabel(weekStart)}</span>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <select value={clientFilter} onChange={(e) => setClientFilter(e.target.value)} className={clsx(inputCls, 'w-auto')}>
            <option value="">All care homes</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={clsx(inputCls, 'w-auto')}>
            <option value="">All statuses</option>
            {STATUSES.map((s) => <option key={s} value={s}>{fmtStatus(s)}</option>)}
          </select>
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className={clsx(inputCls, 'w-auto')}>
            <option value="">All shift types</option>
            {SHIFT_TYPES.map((t) => <option key={t} value={t}>{fmtStatus(t)}</option>)}
          </select>
        </div>
      </div>

      {/* Calendar */}
      {!shifts ? (
        <Spinner label="Loading shifts…" />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
          {days.map((day) => {
            const dayShifts = visible.filter((s) => isSameDay(parseISO(s.shift_date), day));
            const today = isSameDay(day, new Date());
            return (
              <div key={day.toISOString()} className="flex min-h-56 flex-col rounded-xl border border-slate-200 bg-white shadow-sm">
                <div className={clsx(
                  'rounded-t-xl border-b px-3 py-2.5',
                  today ? 'border-brand-200 bg-brand-500 text-white' : 'border-slate-100 bg-slate-50/60'
                )}>
                  <p className={clsx('text-[11px] font-semibold uppercase tracking-wide', today ? 'text-brand-100' : 'text-slate-400')}>
                    {format(day, 'EEE')}
                  </p>
                  <p className={clsx('font-display text-sm font-bold', today ? 'text-white' : 'text-ink')}>
                    {format(day, 'd MMM')}
                  </p>
                </div>
                <div className="scroll-thin flex-1 space-y-2 overflow-y-auto p-2">
                  {dayShifts.map((s) => (
                    <Link
                      key={s.id}
                      to={`/candidates/${s.candidate_id}`}
                      className="block rounded-lg border border-slate-200 border-l-4 bg-white p-2 transition-shadow hover:shadow-sm"
                      style={{ borderLeftColor: TYPE_COLORS[s.shift_type] }}
                    >
                      <p className="text-[11px] font-semibold text-slate-500">
                        {s.start_time.slice(0, 5)}–{s.end_time.slice(0, 5)}
                      </p>
                      <p className="truncate text-xs font-medium text-ink">{s.candidate_name}</p>
                      <p className="truncate text-[11px] text-slate-500">{s.client_name}</p>
                      <Badge value={s.status} className="mt-1" />
                    </Link>
                  ))}
                  {!dayShifts.length && (
                    <p className="px-2 py-6 text-center text-[11px] text-slate-300">No shifts</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Book shift modal */}
      <Modal open={showModal} onClose={() => setShowModal(false)} title="Book Shift">
        <div className="space-y-4">
          <div>
            <label className={labelCls}>Candidate *</label>
            <select
              value={form.candidate_id}
              onChange={(e) => setForm({ ...form, candidate_id: e.target.value })}
              className={inputCls}
            >
              <option value="">Select candidate…</option>
              {candidates.map((c) => (
                <option key={c.id} value={c.id}>{c.first_name} {c.last_name} — {c.role}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Care Home *</label>
            <select
              value={form.client_id}
              onChange={(e) => setForm({ ...form, client_id: e.target.value })}
              className={inputCls}
            >
              <option value="">Select care home…</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Date *</label>
              <input
                type="date" value={form.shift_date}
                onChange={(e) => setForm({ ...form, shift_date: e.target.value })}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Shift type</label>
              <select
                value={form.shift_type}
                onChange={(e) => setType(e.target.value as ShiftType)}
                className={inputCls}
              >
                {SHIFT_TYPES.map((t) => <option key={t} value={t}>{fmtStatus(t)}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={labelCls}>Start</label>
              <input
                type="time" value={form.start_time}
                onChange={(e) => setForm({ ...form, start_time: e.target.value })}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>End</label>
              <input
                type="time" value={form.end_time}
                onChange={(e) => setForm({ ...form, end_time: e.target.value })}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Hours</label>
              <input
                type="number" step="0.5" min="0" value={form.hours}
                onChange={(e) => setForm({ ...form, hours: e.target.value })}
                className={inputCls}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Pay rate £/hr</label>
              <input
                type="number" step="0.01" min="0" value={form.pay_rate}
                onChange={(e) => setForm({ ...form, pay_rate: e.target.value })}
                className={inputCls} placeholder="14.50"
              />
            </div>
            <div>
              <label className={labelCls}>Charge rate £/hr</label>
              <input
                type="number" step="0.01" min="0" value={form.charge_rate}
                onChange={(e) => setForm({ ...form, charge_rate: e.target.value })}
                className={inputCls} placeholder="19.00"
              />
            </div>
          </div>
          {error && <p className="text-xs font-medium text-red-600">{error}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <button className={btnGhost} onClick={() => setShowModal(false)}>Cancel</button>
            <button className={btnPrimary} onClick={submit} disabled={saving}>
              {saving ? 'Booking…' : 'Book Shift'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import clsx from 'clsx';
import {
  Inbox, Phone, Mail, Users, MessageSquare, FileText, ArrowRightLeft, Send,
} from 'lucide-react';
import { api } from '../lib/api';
import { Activity, User, Candidate, Client, Vacancy } from '../lib/types';
import { Card, CardHeader, Avatar, Spinner, PageHeader, inputCls, btnPrimary } from '../components/ui';
import { ActivityFeed } from '../components/ActivityFeed';

const TYPE_FILTERS = [
  { key: 'all', label: 'All activity', icon: Inbox },
  { key: 'call', label: 'Calls', icon: Phone },
  { key: 'email', label: 'Emails', icon: Mail },
  { key: 'meeting', label: 'Meetings', icon: Users },
  { key: 'sms', label: 'SMS', icon: MessageSquare },
  { key: 'note', label: 'Notes', icon: FileText },
  { key: 'status_change', label: 'Status changes', icon: ArrowRightLeft },
] as const;

const COMPOSE_TYPES: { key: Activity['type']; label: string }[] = [
  { key: 'call', label: 'Call' },
  { key: 'email', label: 'Email' },
  { key: 'meeting', label: 'Meeting' },
  { key: 'note', label: 'Note' },
  { key: 'sms', label: 'SMS' },
];

type EntType = 'candidate' | 'client' | 'vacancy';

const ENT_TYPES: { key: EntType; label: string }[] = [
  { key: 'candidate', label: 'Candidate' },
  { key: 'client', label: 'Care home' },
  { key: 'vacancy', label: 'Vacancy' },
];

interface EntOption {
  id: number;
  label: string;
  sub?: string;
}

const CURRENT_USER = 2;

export default function InboxPage() {
  const [activities, setActivities] = useState<Activity[] | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [userFilter, setUserFilter] = useState<number>(0);

  // composer state
  const [type, setType] = useState<Activity['type']>('call');
  const [entType, setEntType] = useState<EntType>('candidate');
  const [entityId, setEntityId] = useState('');
  const [entOpts, setEntOpts] = useState<EntOption[]>([]);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [direction, setDirection] = useState<'outbound' | 'inbound'>('outbound');
  const [posting, setPosting] = useState(false);

  useEffect(() => {
    api.get<Activity[]>('/activities?limit=200').then(setActivities);
    api.get<User[]>('/users').then(setUsers);
  }, []);

  // populate the related-record select whenever the entity type changes
  useEffect(() => {
    setEntityId('');
    if (entType === 'candidate') {
      api.get<{ data: Candidate[] }>('/candidates?limit=200')
        .then((r) => setEntOpts(r.data.map((c) => ({ id: c.id, label: `${c.first_name} ${c.last_name}`, sub: c.role }))));
    } else if (entType === 'client') {
      api.get<Client[]>('/clients')
        .then((r) => setEntOpts(r.map((c) => ({ id: c.id, label: c.name, sub: c.town ?? undefined }))));
    } else {
      api.get<Vacancy[]>('/vacancies')
        .then((r) => setEntOpts(r.map((v) => ({ id: v.id, label: v.title, sub: v.client_name }))));
    }
  }, [entType]);

  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    (activities ?? []).forEach((a) => { counts[a.type] = (counts[a.type] ?? 0) + 1; });
    return counts;
  }, [activities]);

  const userCounts = useMemo(() => {
    const counts: Record<number, number> = {};
    (activities ?? []).forEach((a) => { if (a.user_id) counts[a.user_id] = (counts[a.user_id] ?? 0) + 1; });
    return counts;
  }, [activities]);

  const filtered = useMemo(() => {
    return (activities ?? []).filter((a) => {
      if (typeFilter !== 'all' && a.type !== typeFilter) return false;
      if (userFilter && a.user_id !== userFilter) return false;
      return true;
    });
  }, [activities, typeFilter, userFilter]);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!entityId || !subject.trim() || posting) return;
    setPosting(true);
    try {
      const created = await api.post<Activity>('/activities', {
        entity_type: entType,
        entity_id: +entityId,
        type,
        subject: subject.trim(),
        body: body.trim() || null,
        direction: ['call', 'email', 'sms'].includes(type) ? direction : null,
        user_id: CURRENT_USER,
      });
      const u = users.find((x) => x.id === CURRENT_USER);
      const opt = entOpts.find((o) => o.id === +entityId);
      const enriched: Activity = {
        ...created,
        user_name: u?.name ?? 'You',
        initials: u?.initials,
        color: u?.color,
        entity_name: opt?.label ?? created.entity_name,
      };
      setActivities((prev) => [enriched, ...(prev ?? [])]);
      setSubject('');
      setBody('');
    } catch (err) {
      console.error(err);
    } finally {
      setPosting(false);
    }
  }

  if (!activities) return <Spinner label="Loading communications…" />;

  const directed = ['call', 'email', 'sms'].includes(type);
  const calls = typeCounts['call'] ?? 0;
  const emails = typeCounts['email'] ?? 0;

  return (
    <div>
      <PageHeader
        title="Communications"
        subtitle={`${activities.length} touchpoints logged · ${calls} calls · ${emails} emails`}
      />

      <div className="flex flex-col gap-5 lg:flex-row">
        {/* Filter rail */}
        <div className="w-full shrink-0 lg:w-60">
          <Card>
            <div className="border-b border-slate-100 px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Activity type</p>
            </div>
            <div className="space-y-0.5 px-2 py-2">
              {TYPE_FILTERS.map(({ key, label, icon: Icon }) => {
                const count = key === 'all' ? activities.length : typeCounts[key] ?? 0;
                const active = typeFilter === key;
                return (
                  <button
                    key={key}
                    onClick={() => setTypeFilter(key)}
                    className={clsx(
                      'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium transition-colors',
                      active ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-50'
                    )}
                  >
                    <Icon className={clsx('h-4 w-4', active ? 'text-brand-600' : 'text-slate-400')} />
                    <span className="flex-1 text-left">{label}</span>
                    <span className={clsx('text-[11px]', active ? 'text-brand-600' : 'text-slate-400')}>{count}</span>
                  </button>
                );
              })}
            </div>
            <div className="border-b border-slate-100 px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Team member</p>
            </div>
            <div className="space-y-0.5 px-2 py-2">
              <button
                onClick={() => setUserFilter(0)}
                className={clsx(
                  'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium transition-colors',
                  userFilter === 0 ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-50'
                )}
              >
                <Users className={clsx('h-4 w-4', userFilter === 0 ? 'text-brand-600' : 'text-slate-400')} />
                <span className="flex-1 text-left">Everyone</span>
              </button>
              {users.map((u) => {
                const active = userFilter === u.id;
                return (
                  <button
                    key={u.id}
                    onClick={() => setUserFilter(active ? 0 : u.id)}
                    className={clsx(
                      'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium transition-colors',
                      active ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-50'
                    )}
                  >
                    <Avatar initials={u.initials} color={u.color} name={u.name} size="xs" />
                    <span className="flex-1 truncate text-left">{u.name}</span>
                    <span className={clsx('text-[11px]', active ? 'text-brand-600' : 'text-slate-400')}>
                      {userCounts[u.id] ?? 0}
                    </span>
                  </button>
                );
              })}
            </div>
          </Card>
        </div>

        {/* Main column */}
        <div className="min-w-0 flex-1 space-y-5">
          {/* Composer */}
          <Card>
            <CardHeader title="Log an activity" subtitle="Record a call, email, meeting or note against a record" />
            <form onSubmit={submit} className="space-y-3 px-5 py-4">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <select value={type} onChange={(e) => setType(e.target.value as Activity['type'])} className={inputCls}>
                  {COMPOSE_TYPES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
                </select>
                <select value={entType} onChange={(e) => setEntType(e.target.value as EntType)} className={inputCls}>
                  {ENT_TYPES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
                </select>
                <select value={entityId} onChange={(e) => setEntityId(e.target.value)} className={inputCls} required>
                  <option value="">Select record…</option>
                  {entOpts.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.label}{o.sub ? ` — ${o.sub}` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Subject — e.g. Called about weekend availability"
                className={inputCls}
                required
              />
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Notes from the conversation…"
                rows={3}
                className={clsx(inputCls, 'resize-none')}
              />
              <div className="flex items-center justify-between gap-3">
                {directed ? (
                  <select
                    value={direction}
                    onChange={(e) => setDirection(e.target.value as 'outbound' | 'inbound')}
                    className={clsx(inputCls, 'w-36')}
                  >
                    <option value="outbound">Outbound</option>
                    <option value="inbound">Inbound</option>
                  </select>
                ) : <span />}
                <button type="submit" disabled={posting || !entityId || !subject.trim()} className={clsx(btnPrimary, 'disabled:opacity-50')}>
                  <Send className="h-3.5 w-3.5" />
                  {posting ? 'Logging…' : 'Log activity'}
                </button>
              </div>
            </form>
          </Card>

          {/* Feed */}
          <Card>
            <CardHeader
              title="Activity log"
              subtitle={`${filtered.length} of ${activities.length} shown — newest first`}
            />
            <div className="scroll-thin max-h-[42rem] overflow-y-auto px-5 py-4">
              <ActivityFeed activities={filtered} showEntity />
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

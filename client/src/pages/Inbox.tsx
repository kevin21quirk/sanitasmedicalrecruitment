import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import clsx from 'clsx';
import {
  Inbox, Phone, Mail, Users, MessageSquare, FileText, ArrowRightLeft, Send,
} from 'lucide-react';
import { api } from '../lib/api';
import { Activity, User, Candidate, Client, Vacancy, Message } from '../lib/types';
import { Card, CardHeader, Avatar, Spinner, PageHeader, Badge, inputCls, btnPrimary, btnGhost } from '../components/ui';
import { ActivityFeed } from '../components/ActivityFeed';
import { fmtDateTime } from '../lib/format';
import { useAuth } from '../lib/auth';

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

export default function InboxPage() {
  const { account } = useAuth();
  const CURRENT_USER = account?.userId ?? 0;
  const [tab, setTab] = useState<'activity' | 'outbox'>('activity');
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
      >
        <div className="flex gap-1 rounded-lg bg-slate-100 p-1">
          {(['activity', 'outbox'] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={clsx('rounded-md px-4 py-1.5 text-xs font-medium capitalize',
                tab === t ? 'bg-white text-ink shadow-sm' : 'text-slate-500 hover:text-slate-700')}>
              {t === 'activity' ? 'Activity log' : 'Outbox'}
            </button>
          ))}
        </div>
      </PageHeader>

      {tab === 'outbox' && <Outbox />}

      {tab === 'activity' && (<div className="flex flex-col gap-5 lg:flex-row">
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
      </div>)}
    </div>
  );
}

interface OutboxMessage extends Message {
  wa_link: string | null;
  mailto_link: string | null;
}

// 4.2/4.3/4.6 — queued notifications with click-to-send wa.me / mailto links.
function Outbox() {
  const [msgs, setMsgs] = useState<OutboxMessage[] | null>(null);
  const [filter, setFilter] = useState<'queued' | 'sent' | 'all'>('queued');
  const [composing, setComposing] = useState(false);
  const [cForm, setCForm] = useState({ channel: 'whatsapp', to_name: '', to_contact: '', subject: '', body: '' });

  const load = () => {
    const qs = filter === 'all' ? '' : `?status=${filter}`;
    api.get<OutboxMessage[]>(`/messages${qs}`).then(setMsgs).catch(() => setMsgs([]));
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(load, [filter]);

  const markSent = async (id: number) => {
    await api.patch(`/messages/${id}`, { status: 'sent' });
    load();
  };

  const compose = async () => {
    try {
      const msg = await api.post<OutboxMessage>('/messages', cForm);
      setComposing(false);
      setCForm({ channel: 'whatsapp', to_name: '', to_contact: '', subject: '', body: '' });
      load();
      const link = msg.wa_link ?? msg.mailto_link;
      if (link) window.open(link, '_blank');
    } catch (e) { alert(e instanceof Error ? e.message : 'Failed'); }
  };

  const queued = msgs?.filter((m) => m.status === 'queued') ?? [];

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader
          title="Outbox"
          subtitle="WhatsApp opens a wa.me link you send from your phone; email opens your mail app — both are logged here (4.6)."
          action={
            <div className="flex items-center gap-2">
              <select className={clsx(inputCls, 'w-32')} value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)}>
                <option value="queued">Queued</option>
                <option value="sent">Sent</option>
                <option value="all">All</option>
              </select>
              <button className={btnPrimary} onClick={() => setComposing(true)}><Send className="h-3.5 w-3.5" /> Compose</button>
            </div>
          }
        />
        {!msgs ? <Spinner /> : !msgs.length ? (
          <p className="px-5 py-6 text-center text-sm text-slate-400">
            {filter === 'queued' ? 'Nothing waiting — confirmations and reminders land here automatically.' : 'No messages.'}
          </p>
        ) : (
          <ul className="divide-y divide-slate-50">
            {msgs.map((m) => (
              <li key={m.id} className="px-5 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 text-sm font-medium text-ink">
                      {m.channel === 'whatsapp' ? <MessageSquare className="h-3.5 w-3.5 text-emerald-600" /> : <Mail className="h-3.5 w-3.5 text-brand-500" />}
                      {m.to_name ?? m.to_contact}
                      <Badge value={m.status === 'sent' ? 'valid' : m.status === 'queued' ? 'pending' : m.status === 'failed' ? 'expired' : 'done'} />
                    </p>
                    {m.subject && <p className="text-xs font-medium text-slate-600">{m.subject}</p>}
                    <p className="mt-0.5 whitespace-pre-wrap text-xs text-slate-500">{m.body}</p>
                    <p className="mt-1 text-[10px] text-slate-400">
                      {m.created_by_name && `${m.created_by_name} · `}{fmtDateTime(m.created_at as unknown as string)}
                      {m.sent_at && ` · sent ${fmtDateTime(m.sent_at)}`}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    {m.wa_link && (
                      <a href={m.wa_link} target="_blank" rel="noreferrer" className={btnPrimary}
                        onClick={() => markSent(m.id)}>
                        Open WhatsApp
                      </a>
                    )}
                    {m.mailto_link && (
                      <a href={m.mailto_link} className={btnPrimary} onClick={() => markSent(m.id)}>
                        Open email
                      </a>
                    )}
                    {m.status === 'queued' && (
                      <button className="text-[11px] text-slate-400 hover:text-slate-600" onClick={() => markSent(m.id)}>
                        Mark sent without opening
                      </button>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
        {!!queued.length && <p className="border-t border-slate-100 px-5 py-2 text-[11px] text-slate-400">{queued.length} queued</p>}
      </Card>

      {composing && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-brand-950/40 p-3 backdrop-blur-sm sm:items-center" onClick={() => setComposing(false)}>
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-display text-lg font-semibold">New message</h2>
            <div className="mt-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <select className={inputCls} value={cForm.channel} onChange={(e) => setCForm({ ...cForm, channel: e.target.value })}>
                  <option value="whatsapp">WhatsApp</option>
                  <option value="email">Email</option>
                </select>
                <input className={inputCls} placeholder="Name" value={cForm.to_name} onChange={(e) => setCForm({ ...cForm, to_name: e.target.value })} />
              </div>
              <input className={inputCls} placeholder={cForm.channel === 'whatsapp' ? 'Mobile number' : 'Email address'}
                value={cForm.to_contact} onChange={(e) => setCForm({ ...cForm, to_contact: e.target.value })} />
              {cForm.channel === 'email' && (
                <input className={inputCls} placeholder="Subject" value={cForm.subject} onChange={(e) => setCForm({ ...cForm, subject: e.target.value })} />
              )}
              <textarea className={clsx(inputCls, 'resize-none')} rows={4} placeholder="Message…"
                value={cForm.body} onChange={(e) => setCForm({ ...cForm, body: e.target.value })} />
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button className={btnGhost} onClick={() => setComposing(false)}>Cancel</button>
              <button className={btnPrimary} disabled={!cForm.to_contact || !cForm.body} onClick={compose}>Create & open</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

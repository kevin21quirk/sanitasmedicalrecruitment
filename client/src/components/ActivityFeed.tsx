import { Activity } from '../lib/types';
import { ago } from '../lib/format';
import { Avatar, EmptyState } from './ui';
import { Phone, Mail, Users, FileText, MessageSquare, ArrowRightLeft, Inbox } from 'lucide-react';

const ICONS = {
  call: Phone,
  email: Mail,
  meeting: Users,
  note: FileText,
  sms: MessageSquare,
  status_change: ArrowRightLeft,
} as const;

export function ActivityFeed({ activities, showEntity = false }: { activities: Activity[]; showEntity?: boolean }) {
  if (!activities.length) {
    return <EmptyState icon={<Inbox className="h-5 w-5" />} title="No activity yet" hint="Calls, emails and notes will appear here." />;
  }
  return (
    <ol className="relative space-y-0">
      {activities.map((a, i) => {
        const Icon = ICONS[a.type] ?? FileText;
        return (
          <li key={a.id} className="relative flex gap-3 pb-5">
            {i < activities.length - 1 && (
              <span className="absolute left-[17px] top-9 h-full w-px bg-slate-100" aria-hidden />
            )}
            <span className="z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600 ring-4 ring-white">
              <Icon className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1 pt-0.5">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                <p className="text-sm font-medium text-ink">{a.subject ?? a.type}</p>
                {a.direction && (
                  <span className="text-[10px] font-medium uppercase tracking-wide text-slate-400">{a.direction}</span>
                )}
                {showEntity && a.entity_name && (
                  <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">
                    {a.entity_type}: {a.entity_name}
                  </span>
                )}
              </div>
              {a.body && <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">{a.body}</p>}
              <div className="mt-1 flex items-center gap-1.5 text-[11px] text-slate-400">
                {a.initials && <Avatar initials={a.initials} color={a.color} size="xs" />}
                <span>{a.user_name ?? 'System'}</span>
                <span>·</span>
                <span>{ago(a.created_at)}</span>
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

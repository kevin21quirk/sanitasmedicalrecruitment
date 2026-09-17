import { format, formatDistanceToNow, parseISO, isPast, differenceInDays } from 'date-fns';

export const gbp = (n: number | string | null | undefined, dp = 0) =>
  n == null ? '—' : `£${Number(n).toLocaleString('en-GB', { minimumFractionDigits: dp, maximumFractionDigits: dp })}`;

export const gbp2 = (n: number | string | null | undefined) => gbp(n, 2);

export const fmtDate = (d: string | null | undefined) =>
  d ? format(parseISO(d), 'd MMM yyyy') : '—';

export const fmtDateTime = (d: string | null | undefined) =>
  d ? format(parseISO(d), 'd MMM yyyy, HH:mm') : '—';

export const ago = (d: string | null | undefined) =>
  d ? formatDistanceToNow(parseISO(d), { addSuffix: true }) : '—';

export const daysUntil = (d: string | null | undefined) =>
  d == null ? null : differenceInDays(parseISO(d), new Date());

export const isOverdue = (d: string | null | undefined) =>
  d != null && isPast(parseISO(d));

export const initials = (name: string) =>
  name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();

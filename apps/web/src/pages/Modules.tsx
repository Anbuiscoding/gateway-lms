import React from 'react';
import { INFO } from '../modules';
import { EmptyState, ErrorNote } from '../ui';
import { useApi } from '../session';

const pretty = (k: string) => k.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase());
const tel = (p: string) => 'tel:' + p.replace(/[^+\d]/g, '');
function cell(k: string, v: unknown): React.ReactNode {
  if (v == null || v === '') return '–';
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  const s = String(v);
  if (/^\d{4}-\d\d-\d\dT/.test(s)) return new Date(s).toLocaleDateString('en-IN');
  if (k === 'email') return <a href={`mailto:${s}`}>{s}</a>;
  if (k === 'phone') return <a href={tel(s)}>{s}</a>;
  return s;
}

/** A read-only table for modules backed by GET /api/v1/<slug>: trainers, administrators and all users. */
export function Generic({ slug }: { slug: string }) {
  const { data, error, loading, reload } = useApi<Record<string, unknown>[]>('/' + slug);
  const title = INFO[slug]?.[1] ?? pretty(slug.replace(/-/g, ' '));
  if (loading) return <div className="skeleton tall" aria-busy="true" />;
  if (error) return <ErrorNote text={error} onRetry={reload} />;
  if (!data?.length) return <section className="panel"><EmptyState compact title={`No ${title.toLowerCase()} yet`} text="Records appear here as soon as they are added." /></section>;
  const cols = Object.keys(data[0]).filter((k) => !['id', '_id', '__v', 'updatedAt', 'passwordHash'].includes(k)).slice(0, 6);
  return (
    <div className="tablewrap"><table>
      <thead><tr>{cols.map((c) => <th key={c}>{pretty(c)}</th>)}</tr></thead>
      <tbody>{data.map((r, i) => <tr key={String(r.id ?? r._id ?? i)}>{cols.map((c) => <td key={c}>{cell(c, r[c])}</td>)}</tr>)}</tbody>
    </table></div>
  );
}

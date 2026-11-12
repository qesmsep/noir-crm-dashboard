/**
 * Small in-memory stand-in for the supabase-js query builder, for unit tests.
 *
 * Supports the subset our server code uses: select / insert / update / upsert /
 * delete with eq, neq, in, is, gt, gte, lt, lte, not('col','is',null), or()
 * (simple comma list of col.op.value), order, limit, single, maybeSingle.
 * Embedded relations are not joined — store rows pre-joined and filter on
 * dotted paths (e.g. 'campaigns.trigger_type').
 *
 * Unique constraints can be declared per table to exercise 23505 handling.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */

type Row = Record<string, any>;
type Filter = (row: Row) => boolean;

export interface UniqueRule {
  columns: string[];
  where?: (row: Row) => boolean;
}

export interface FakeDbOptions {
  unique?: Record<string, UniqueRule[]>;
  /** Columns that "don't exist" yet: inserting/updating them errors like PostgREST. */
  missingColumns?: Record<string, string[]>;
}

let idCounter = 0;
export function fakeId(): string {
  idCounter += 1;
  const hex = idCounter.toString(16).padStart(12, '0');
  return `00000000-0000-4000-8000-${hex}`;
}

function get(row: Row, path: string): any {
  return path.split('.').reduce((v, k) => (v == null ? v : v[k]), row as any);
}

function coerce(v: string): any {
  if (v === 'null') return null;
  if (v === 'true') return true;
  if (v === 'false') return false;
  return v;
}

function parseOr(expr: string): Filter {
  const parts = expr.split(',').map((p) => p.trim());
  const fs: Filter[] = parts.map((p) => {
    const [col, op, ...rest] = p.split('.');
    const val = coerce(rest.join('.'));
    switch (op) {
      case 'eq': return (r) => get(r, col) == val;
      case 'neq': return (r) => get(r, col) != null && get(r, col) != val;
      case 'is': return (r) => (val === null ? get(r, col) == null : get(r, col) === val);
      case 'gte': return (r) => get(r, col) >= val;
      case 'lte': return (r) => get(r, col) <= val;
      default: throw new Error(`fakeSupabase: unsupported or() op ${op}`);
    }
  });
  return (r) => fs.some((f) => f(r));
}

export class FakeDb {
  tables: Record<string, Row[]> = {};
  opts: FakeDbOptions;
  calls: Array<{ table: string; op: string; payload?: any }> = [];

  constructor(seed: Record<string, Row[]> = {}, opts: FakeDbOptions = {}) {
    for (const [t, rows] of Object.entries(seed)) this.tables[t] = rows.map((r) => ({ ...r }));
    this.opts = opts;
  }

  rows(table: string): Row[] {
    return (this.tables[table] ||= []);
  }

  from(table: string) {
    return new Query(this, table);
  }

  rpc() {
    return Promise.resolve({ data: null, error: { message: 'rpc not supported in fake' } });
  }
}

class Query implements PromiseLike<any> {
  private filters: Filter[] = [];
  private op: 'select' | 'insert' | 'update' | 'delete' | 'upsert' = 'select';
  private payload: any;
  private returning = false;
  private singleMode: 'single' | 'maybe' | null = null;
  private limitN: number | null = null;
  private orderBy: { col: string; asc: boolean } | null = null;
  private upsertConflict: string[] | null = null;
  private countMode = false;

  constructor(private db: FakeDb, private table: string) {}

  select(_cols?: string, opts?: { count?: string; head?: boolean }) {
    if (opts?.count) this.countMode = true;
    if (this.op !== 'select') this.returning = true;
    return this;
  }
  insert(payload: any) { this.op = 'insert'; this.payload = payload; return this; }
  update(payload: any) { this.op = 'update'; this.payload = payload; return this; }
  delete() { this.op = 'delete'; return this; }
  upsert(payload: any, opts?: { onConflict?: string }) {
    this.op = 'upsert';
    this.payload = payload;
    this.upsertConflict = (opts?.onConflict || 'id').split(',').map((s) => s.trim());
    return this;
  }

  eq(col: string, v: any) { this.filters.push((r) => get(r, col) === v); return this; }
  neq(col: string, v: any) { this.filters.push((r) => get(r, col) != null && get(r, col) !== v); return this; }
  in(col: string, vs: any[]) { this.filters.push((r) => vs.includes(get(r, col))); return this; }
  is(col: string, v: any) { this.filters.push((r) => (v === null ? get(r, col) == null : get(r, col) === v)); return this; }
  gt(col: string, v: any) { this.filters.push((r) => get(r, col) > v); return this; }
  gte(col: string, v: any) { this.filters.push((r) => get(r, col) >= v); return this; }
  lt(col: string, v: any) { this.filters.push((r) => get(r, col) < v); return this; }
  lte(col: string, v: any) { this.filters.push((r) => get(r, col) <= v); return this; }
  not(col: string, op: string, v: any) {
    if (op === 'is' && v === null) this.filters.push((r) => get(r, col) != null);
    else if (op === 'in') {
      const list = String(v).replace(/[()]/g, '').split(',').map((s) => s.trim().replace(/^"|"$/g, ''));
      this.filters.push((r) => !list.includes(get(r, col)));
    } else throw new Error(`fakeSupabase: unsupported not(${op})`);
    return this;
  }
  or(expr: string) { this.filters.push(parseOr(expr)); return this; }
  ilike(col: string, pattern: string) {
    const re = new RegExp('^' + pattern.replace(/%/g, '.*') + '$', 'i');
    this.filters.push((r) => re.test(String(get(r, col) ?? '')));
    return this;
  }
  order(col: string, opts?: { ascending?: boolean }) { this.orderBy = { col, asc: opts?.ascending !== false }; return this; }
  limit(n: number) { this.limitN = n; return this; }
  range(from: number, to: number) { this.limitN = to - from + 1; return this; }
  single() { this.singleMode = 'single'; return this; }
  maybeSingle() { this.singleMode = 'maybe'; return this; }

  then<T1 = any, T2 = never>(onFulfilled?: ((v: any) => T1 | PromiseLike<T1>) | null, onRejected?: ((e: any) => T2 | PromiseLike<T2>) | null) {
    return Promise.resolve().then(() => this.run()).then(onFulfilled, onRejected);
  }

  private matches(r: Row) { return this.filters.every((f) => f(r)); }

  private missingColumn(row: Row): string | null {
    const missing = this.db.opts.missingColumns?.[this.table] || [];
    return Object.keys(row).find((k) => missing.includes(k)) || null;
  }

  private violatesUnique(candidate: Row, ignore?: Row): boolean {
    const rules = this.db.opts.unique?.[this.table] || [];
    return rules.some((rule) => {
      if (rule.where && !rule.where(candidate)) return false;
      return this.db.rows(this.table).some(
        (existing) =>
          existing !== ignore &&
          (!rule.where || rule.where(existing)) &&
          rule.columns.every((c) => existing[c] === candidate[c] && candidate[c] != null),
      );
    });
  }

  private finish(rows: Row[]) {
    let out = rows;
    if (this.orderBy) {
      const { col, asc } = this.orderBy;
      out = [...out].sort((a, b) => (get(a, col) > get(b, col) ? 1 : get(a, col) < get(b, col) ? -1 : 0) * (asc ? 1 : -1));
    }
    if (this.limitN != null) out = out.slice(0, this.limitN);
    const copy = out.map((r) => ({ ...r }));
    if (this.singleMode === 'single') {
      if (copy.length !== 1) return { data: null, error: { code: 'PGRST116', message: 'not exactly one row' } };
      return { data: copy[0], error: null };
    }
    if (this.singleMode === 'maybe') return { data: copy[0] ?? null, error: null };
    return { data: copy, error: null, count: this.countMode ? copy.length : undefined };
  }

  private run(): any {
    const table = this.db.rows(this.table);
    this.db.calls.push({ table: this.table, op: this.op, payload: this.payload });

    if (this.op === 'select') return this.finish(table.filter((r) => this.matches(r)));

    if (this.op === 'insert' || this.op === 'upsert') {
      const items: Row[] = Array.isArray(this.payload) ? this.payload : [this.payload];
      const inserted: Row[] = [];
      for (const item of items) {
        const missing = this.missingColumn(item);
        if (missing) return { data: null, error: { code: 'PGRST204', message: `Could not find the '${missing}' column` } };
        if (this.op === 'upsert' && this.upsertConflict) {
          const existing = table.find((r) => this.upsertConflict!.every((c) => r[c] === item[c]));
          if (existing) {
            Object.assign(existing, item);
            inserted.push(existing);
            continue;
          }
        }
        const row = { id: fakeId(), created_at: new Date().toISOString(), ...item };
        if (this.violatesUnique(row)) return { data: null, error: { code: '23505', message: 'duplicate key value violates unique constraint' } };
        table.push(row);
        inserted.push(row);
      }
      if (!this.returning) return { data: null, error: null };
      return this.finish(inserted);
    }

    if (this.op === 'update') {
      const missing = this.missingColumn(this.payload);
      if (missing) return { data: null, error: { code: 'PGRST204', message: `Could not find the '${missing}' column` } };
      const hit = table.filter((r) => this.matches(r));
      for (const r of hit) {
        const next = { ...r, ...this.payload };
        if (this.violatesUnique(next, r)) return { data: null, error: { code: '23505', message: 'duplicate key value violates unique constraint' } };
        Object.assign(r, this.payload);
      }
      if (!this.returning) return { data: null, error: null };
      return this.finish(hit);
    }

    if (this.op === 'delete') {
      const keep = table.filter((r) => !this.matches(r));
      const removed = table.filter((r) => this.matches(r));
      this.db.tables[this.table] = keep;
      if (!this.returning) return { data: null, error: null };
      return this.finish(removed);
    }
    return { data: null, error: { message: 'unsupported' } };
  }
}

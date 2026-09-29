/**
 * @jest-environment node
 */
import fs from 'fs';
import path from 'path';
import { API_ACCESS_RULES, classifyApiRequest } from '../api-access-policy';

const access = (p: string, m = 'GET') => classifyApiRequest(p, m).access;

describe('classifyApiRequest', () => {
  it('defaults every unlisted route to admin', () => {
    expect(access('/api/admins')).toBe('admin');
    expect(access('/api/admins', 'POST')).toBe('admin');
    expect(access('/api/admins', 'DELETE')).toBe('admin');
    expect(access('/api/sendText', 'POST')).toBe('admin');
    expect(access('/api/send-bulk-message', 'POST')).toBe('admin');
    expect(access('/api/subscriptions/cancel', 'POST')).toBe('admin');
    expect(access('/api/accounts/failed-payments-summary')).toBe('admin');
    expect(access('/api/settings')).toBe('admin');
    expect(access('/api/settings', 'PUT')).toBe('admin');
    expect(access('/api/reservations/abc/cancel-refund', 'POST')).toBe('admin');
    expect(access('/api/reservations/abc/cancel-charge', 'POST')).toBe('admin');
    expect(access('/api/test-env')).toBe('admin');
    expect(access('/api/something-new')).toBe('admin');
  });

  it('opens only the methods a public flow needs', () => {
    expect(access('/api/reservations', 'POST')).toBe('public');
    expect(access('/api/reservations', 'GET')).toBe('admin');
    expect(access('/api/reservations/r1', 'DELETE')).toBe('public');
    expect(access('/api/reservations/r1', 'GET')).toBe('admin');
    expect(access('/api/reservations/r1', 'PATCH')).toBe('admin');
    expect(access('/api/tables', 'GET')).toBe('public');
    expect(access('/api/tables', 'POST')).toBe('admin');
    expect(access('/api/members', 'GET')).toBe('public');
    expect(access('/api/members', 'PUT')).toBe('admin');
    expect(access('/api/members', 'POST')).toBe('admin');
    expect(access('/api/settings/hold-fee-config', 'GET')).toBe('public');
    expect(access('/api/settings/hold-fee-config', 'PUT')).toBe('admin');
    expect(access('/api/admin/menu-files', 'GET')).toBe('public');
    expect(access('/api/admin/upload-menu', 'POST')).toBe('admin');
  });

  it('does not let a dynamic segment rule swallow a sibling route', () => {
    expect(access('/api/rsvp/some-event-url')).toBe('public');
    expect(access('/api/rsvp/update', 'PUT')).toBe('admin');
    expect(access('/api/rsvp/delete', 'DELETE')).toBe('admin');
    expect(access('/api/rsvp/attendee-count')).toBe('public');
  });

  it('puts member portal routes behind a member session', () => {
    expect(access('/api/member/transactions')).toBe('member');
    expect(access('/api/member/reservations/cancel', 'POST')).toBe('member');
    expect(access('/api/member/verify-phone', 'POST')).toBe('public');
    expect(access('/api/member/sync-photo', 'POST')).toBe('admin');
    expect(access('/api/chargeBalance', 'POST')).toBe('member');
    expect(access('/api/stripe/payment-methods/list')).toBe('member');
    expect(access('/api/stripe/checkout/setup-ach', 'POST')).toBe('admin');
    expect(access('/api/accounts/acct-1')).toBe('member');
    expect(access('/api/accounts/acct-1/invoices')).toBe('admin');
    expect(access('/api/member-portal/profile')).toBe('member-supabase');
    expect(access('/api/member-portal/create-profile', 'POST')).toBe('admin');
    expect(access('/api/auth/verify-phone-otp', 'POST')).toBe('public');
  });

  it('requires the cron secret on scheduled routes', () => {
    expect(access('/api/cron-process-reminders')).toBe('cron');
    expect(access('/api/process-campaign-messages')).toBe('cron');
    expect(access('/api/process-intake-messages')).toBe('cron');
    expect(access('/api/cron/monthly-billing')).toBe('cron');
    expect(access('/api/cron/retry-failed-payments')).toBe('cron');
  });

  it('normalises trailing and duplicate slashes and treats HEAD as GET', () => {
    expect(access('/api/locations/')).toBe('public');
    expect(access('//api//admins')).toBe('admin');
    expect(access('/api/locations', 'HEAD')).toBe('public');
    expect(access('/api/locations', 'DELETE')).toBe('admin');
  });

  it('only names routes that exist', () => {
    const root = path.join(__dirname, '..', '..');
    const routes: string[] = [];
    const walk = (dir: string, kind: 'pages' | 'app', base: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(full, kind, base);
        } else if (kind === 'pages' && /\.(ts|js)$/.test(entry.name)) {
          routes.push('/api' + full.slice(base.length).replace(/\.(ts|js)$/, '').replace(/\/index$/, ''));
        } else if (kind === 'app' && /^route\.(ts|js)$/.test(entry.name)) {
          routes.push('/api' + path.dirname(full).slice(base.length));
        }
      }
    };
    walk(path.join(root, 'pages', 'api'), 'pages', path.join(root, 'pages', 'api'));
    walk(path.join(root, 'app', 'api'), 'app', path.join(root, 'app', 'api'));

    const normalise = (p: string) => p.replace(/\[[^\]]+\]/g, ':x').replace(/:[A-Za-z]+/g, ':x');
    const known = new Set(routes.map(normalise));

    for (const rule of API_ACCESS_RULES) {
      const p = normalise(rule.path);
      const ok = p.endsWith('/*')
        ? routes.some((r) => normalise(r).startsWith(p.slice(0, -1)))
        : known.has(p);
      expect({ rule: rule.path, exists: ok }).toEqual({ rule: rule.path, exists: true });
    }
  });
});

import React, { useState } from 'react';
import AdminLayout from '../../components/layouts/AdminLayout';
import { Spinner } from '@/components/ui/spinner';
import { useToast } from '@/hooks/useToast';
import {
  JourneyAttentionCard,
  JourneyRoster,
  JourneyStepView,
  TodaysMembersCard,
  journeyRequest,
  useMemberJourney,
} from '@/components/admin/MemberJourneyCards';

// Admin > Member journey: the first 90 days of a new member.
//   - what needs a person today, and who is coming in
//   - where every new member is
//   - the onboarding texts: on/off, the words, the day each one sends

const inputClass =
  'w-full rounded-lg border border-[#DAD7D0] bg-white px-3 py-2 text-sm text-[#1F1F1F] min-h-[44px] focus:outline-none focus:ring-2 focus:ring-[#A59480]';
const panel = 'bg-white rounded-2xl border border-[#ECEAE5] shadow-sm p-4 md:p-5';

function StepEditor({ step, onSaved }: { step: JourneyStepView; onSaved: () => void }) {
  const { toast } = useToast();
  const [body, setBody] = useState(step.body);
  const [day, setDay] = useState(String(step.day_offset));
  const [saving, setSaving] = useState(false);
  const dirty = body !== step.body || day !== String(step.day_offset);

  const save = async (extra: Record<string, unknown> = {}) => {
    setSaving(true);
    try {
      await journeyRequest('PUT', { step: { key: step.key, body, day_offset: parseInt(day, 10), ...extra } });
      toast({ title: 'Saved', description: step.label });
      onSaved();
    } catch (err: any) {
      toast({ title: 'Could not save', description: err.message, variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={`rounded-xl border border-[#ECEAE5] p-3 flex flex-col gap-2 ${step.is_active ? 'bg-[#FAF9F7]' : 'bg-[#F1F0EC] opacity-70'}`}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-[#A59480] mr-auto">{step.label}</span>
        {step.audience === 'primary' && (
          <span className="rounded-full bg-[#ECEAE5] px-2 py-0.5 text-[0.6875rem] font-semibold text-[#5A5A5A]">Account holder only</span>
        )}
        {step.postPublished === false && (
          <a href="/admin/noir-life" className="rounded-full bg-[#FFF7EC] border border-[#E7C9A0] px-2 py-0.5 text-[0.6875rem] font-semibold text-[#5A4A35]">
            Waits for its post: still a draft
          </a>
        )}
        {step.postPublished === true && (
          <span className="rounded-full bg-[#E9F7EC] px-2 py-0.5 text-[0.6875rem] font-semibold text-[#248a3d]">Post published</span>
        )}
      </div>
      <textarea
        className={`${inputClass} min-h-[110px]`}
        value={body}
        maxLength={1000}
        onChange={e => setBody(e.target.value)}
        aria-label={`${step.label} text`}
      />
      {step.preview && !dirty && (
        <details>
          <summary className="cursor-pointer text-xs font-semibold text-[#5A5A5A] min-h-[28px] flex items-center">How it reads on their phone</summary>
          <div className="mt-1 whitespace-pre-wrap rounded-2xl rounded-bl-sm bg-[#E9E9EB] px-3 py-2 text-sm text-[#1F1F1F] max-w-[420px]">{step.preview}</div>
        </details>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <label className="text-xs text-[#5A5A5A] flex items-center gap-2">
          Sends on day
          <input
            type="number" min={0} max={90} inputMode="numeric"
            className={`${inputClass} w-20`}
            value={day}
            onChange={e => setDay(e.target.value)}
          />
        </label>
        <div className="ml-auto flex gap-2">
          <button
            type="button"
            disabled={saving}
            onClick={() => save({ is_active: !step.is_active })}
            className="min-h-[44px] rounded-lg border border-[#DAD7D0] bg-white px-3 text-sm font-semibold text-[#1F1F1F] disabled:opacity-50"
          >
            {step.is_active ? 'Turn off' : 'Turn on'}
          </button>
          <button
            type="button"
            disabled={saving || !dirty}
            onClick={() => save()}
            className="min-h-[44px] rounded-lg bg-[#A59480] px-4 text-sm font-semibold text-white disabled:opacity-40"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

export default function MemberJourneyPage() {
  const { toast } = useToast();
  const { data, error, reload, markDone } = useMemberJourney();
  const [busy, setBusy] = useState(false);
  const [footer, setFooter] = useState<string | null>(null);

  const setEnabled = async (enabled: boolean) => {
    if (!data) return;
    const message = enabled
      ? data.settings.start_date
        ? 'Turn the onboarding texts back on? Members who joined on or after ' + data.settings.start_date + ' will get their next text at 10:28 AM.'
        : 'Turn the onboarding texts on? Members who join from today on will get the series. Current members are not texted.'
      : 'Pause the onboarding texts? Nothing sends until you turn them back on.';
    if (!window.confirm(message)) return;
    setBusy(true);
    try {
      await journeyRequest('PUT', { settings: { enabled } });
      await reload();
    } catch (err: any) {
      toast({ title: 'Could not update', description: err.message, variant: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const saveFooter = async () => {
    if (footer === null) return;
    setBusy(true);
    try {
      await journeyRequest('PUT', { settings: { footer } });
      setFooter(null);
      await reload();
      toast({ title: 'Saved', description: 'Line under every text' });
    } catch (err: any) {
      toast({ title: 'Could not save', description: err.message, variant: 'error' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <AdminLayout>
      <div className="bg-[#F6F5F2] min-h-screen py-6 md:py-10">
        <div className="max-w-[1100px] mx-auto px-4 md:px-8 flex flex-col gap-5">
          <div>
            <h1 className="text-2xl font-bold text-[#1F1F1F]" style={{ fontFamily: 'IvyJournal, serif' }}>Member journey</h1>
            <p className="mt-1 text-gray-600 text-sm">
              A new member&apos;s first 90 days: who needs a personal touch, who is coming in today, and the onboarding texts.
            </p>
          </div>

          {!data && !error && <div className="flex justify-center py-16"><Spinner size="lg" /></div>}

          {(data || error) && (
            <>
              <JourneyAttentionCard data={data} error={error} onDone={markDone} showRoster={false} />
              <TodaysMembersCard data={data} error={error} />
            </>
          )}

          {data?.ready && (
            <>
              <div className={panel}>
                <h2 className="text-base font-bold text-[#1F1F1F]">New members ({data.roster.length})</h2>
                <p className="text-xs text-[#5A5A5A] mb-1">
                  Everyone in their first 90 days. Day 0 is the day they joined. Visits are counted from house-account charges.
                </p>
                <JourneyRoster rows={data.roster} />
              </div>

              <div className={`${panel} flex flex-col gap-3`}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-base font-bold text-[#1F1F1F]">Onboarding texts</h2>
                    <p className="text-xs text-[#5A5A5A]">
                      {data.settings.enabled
                        ? `On. Members who joined on or after ${data.settings.start_date} get one text at 10:28 AM on the day shown.`
                        : data.settings.start_date
                          ? `Paused. Started ${data.settings.start_date}.`
                          : 'Off. Nothing has been sent. Turning this on starts the series for members who join from that day.'}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => setEnabled(!data.settings.enabled)}
                    className={`min-h-[44px] rounded-lg px-4 text-sm font-semibold disabled:opacity-50 ${data.settings.enabled ? 'border border-[#DAD7D0] bg-white text-[#1F1F1F]' : 'bg-[#A59480] text-white'}`}
                  >
                    {data.settings.enabled ? 'Pause texts' : 'Turn texts on'}
                  </button>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-[#1F1F1F] mb-1">Line under every text</label>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      className={inputClass}
                      value={footer ?? data.settings.footer}
                      maxLength={300}
                      onChange={e => setFooter(e.target.value)}
                    />
                    <button
                      type="button"
                      disabled={busy || footer === null || footer === data.settings.footer}
                      onClick={saveFooter}
                      className="min-h-[44px] rounded-lg bg-[#A59480] px-4 text-sm font-semibold text-white disabled:opacity-40"
                    >
                      Save
                    </button>
                  </div>
                  <p className="mt-1 text-xs text-[#5A5A5A]">
                    {'{{n}}'} and {'{{total}}'} become the count, such as 3 of 16. In a text, {'{{first_name}}'}, {'{{blog_link}}'} and {'{{referral_link}}'} are filled in for each member.
                  </p>
                </div>

                {data.steps.map(s => (
                  <StepEditor key={`${s.key}-${s.body.length}-${s.day_offset}-${s.is_active}`} step={s} onSaved={reload} />
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}

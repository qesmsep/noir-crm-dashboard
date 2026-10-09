import { supabaseAdmin } from '../supabase';
import { folderToBusinessDate, parseItemSelectionCsv } from '../toastSalesCore';
import { withToastSftp, exportRoot, listDayFolders, readDayFile } from './sftp';

export interface ToastSyncResult {
  run_id: string | null;
  days_imported: number;
  lines_imported: number;
  folders_seen: number;
}

const CHUNK = 500;

/**
 * Pull every day on the Toast export server that isn't fully imported yet.
 * Safe to run any number of times: lines are keyed by Toast's selection id,
 * and a day whose stored line count already matches the file is skipped.
 */
export async function runToastSync(trigger: 'cron' | 'manual'): Promise<ToastSyncResult> {
  const { data: run } = await supabaseAdmin
    .from('toast_sync_runs')
    .insert({ trigger })
    .select('id')
    .single();
  const runId: string | null = run?.id ?? null;

  let daysImported = 0;
  let linesImported = 0;
  let foldersSeen = 0;

  try {
    await withToastSftp(async sftp => {
      const root = await exportRoot(sftp);
      const folders = await listDayFolders(sftp, root);
      foldersSeen = folders.length;

      const dates = folders.map(f => folderToBusinessDate(f)).filter((d): d is string => !!d);
      const { data: existing, error: existingErr } = await supabaseAdmin
        .from('toast_sales_days')
        .select('business_date, line_count, status')
        .in('business_date', dates.length ? dates : ['1900-01-01']);
      if (existingErr) throw new Error(`toast_sales_days read: ${existingErr.message}`);
      const known = new Map((existing || []).map(d => [d.business_date as string, d]));

      for (const folder of folders) {
        const businessDate = folderToBusinessDate(folder);
        if (!businessDate) continue;

        const prior = known.get(businessDate);
        if (prior) {
          const { count } = await supabaseAdmin
            .from('toast_sales_lines')
            .select('item_selection_id', { count: 'exact', head: true })
            .eq('business_date', businessDate);
          if ((count ?? 0) >= prior.line_count) continue; // fully imported
        }

        const csv = await readDayFile(sftp, root, folder, 'ItemSelectionDetails.csv');
        if (csv === null) continue; // Toast hasn't written it (yet)
        const lines = parseItemSelectionCsv(csv, businessDate);

        const { error: dayErr } = await supabaseAdmin
          .from('toast_sales_days')
          .upsert({ business_date: businessDate, export_folder: folder, line_count: lines.length }, { onConflict: 'business_date' });
        if (dayErr) throw new Error(`toast_sales_days ${businessDate}: ${dayErr.message}`);

        for (let i = 0; i < lines.length; i += CHUNK) {
          const { error } = await supabaseAdmin
            .from('toast_sales_lines')
            .upsert(lines.slice(i, i + CHUNK), { onConflict: 'item_selection_id', ignoreDuplicates: true });
          if (error) throw new Error(`toast_sales_lines ${businessDate}: ${error.message}`);
        }

        // New lines on a day already applied reopen it for review.
        if (prior?.status === 'applied') {
          const { count: pending } = await supabaseAdmin
            .from('toast_sales_lines')
            .select('item_selection_id', { count: 'exact', head: true })
            .eq('business_date', businessDate)
            .is('applied_at', null)
            .eq('voided', false)
            .gt('qty', 0);
          if ((pending ?? 0) > 0) {
            await supabaseAdmin.from('toast_sales_days').update({ status: 'partial' }).eq('business_date', businessDate);
          }
        }

        daysImported++;
        linesImported += lines.length;
      }
    });

    if (runId) {
      await supabaseAdmin
        .from('toast_sync_runs')
        .update({ status: 'success', days_imported: daysImported, lines_imported: linesImported, finished_at: new Date().toISOString() })
        .eq('id', runId);
    }
    return { run_id: runId, days_imported: daysImported, lines_imported: linesImported, folders_seen: foldersSeen };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (runId) {
      await supabaseAdmin
        .from('toast_sync_runs')
        .update({ status: 'error', error: message.slice(0, 2000), days_imported: daysImported, lines_imported: linesImported, finished_at: new Date().toISOString() })
        .eq('id', runId);
    }
    throw err;
  }
}

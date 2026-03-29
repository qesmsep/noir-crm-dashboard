import { createClient } from "@supabase/supabase-js";

// Initialize Supabase with service role key
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Helper function to get current date in local timezone as YYYY-MM-DD
function getTodayLocalDate() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Fetch all ledger rows (no row limit) and aggregate per-account balances and LTVs
async function aggregateAccountData() {
  const { data: allTx, error } = await supabaseAdmin
    .from("ledger")
    .select("account_id, type, amount, note");
  if (error) throw error;
  const balances = {};
  const ltvs = {};
  (allTx || []).forEach(tx => {
    const aid = tx.account_id;
    const amt = Number(tx.amount);
    if (!balances[aid]) balances[aid] = 0;
    balances[aid] += amt;
    if (!ltvs[aid]) ltvs[aid] = 0;
    if (tx.type === 'payment' && amt > 0 &&
        !tx.note?.includes('4%') &&
        !tx.note?.toLowerCase().includes('processing fee')) {
      ltvs[aid] += amt;
    }
  });
  // Round to 2 decimal places to avoid IEEE 754 floating point drift
  for (const aid of Object.keys(balances)) {
    balances[aid] = Math.round(balances[aid] * 100) / 100;
    ltvs[aid] = Math.round(ltvs[aid] * 100) / 100;
  }
  return { balances, ltvs };
}

// TODO: Add auth middleware - all admin API routes currently lack authentication.
// This requires a coordinated change: either Next.js middleware for /api/* routes,
// or updating all frontend callers to pass Authorization headers.

export default async function handler(req, res) {
  console.log('Ledger handler:', req.method, req.body, req.query);
  try {
    if (req.method === "GET") {
      const { member_id, account_id, outstanding, account_balances } = req.query;

      // Single source of truth for account balances and LTV - computed server-side without row limits
      if (account_balances === '1') {
        try {
          const result = await aggregateAccountData();
          return res.status(200).json(result);
        } catch (err) {
          console.error("Ledger account_balances error:", err);
          return res.status(500).json({ error: err.message });
        }
      }

      if (outstanding === '1') {
        try {
          const { balances } = await aggregateAccountData();
          // Sum only negative balances (amounts owed to us)
          const total = Object.values(balances)
            .filter(balance => balance < 0)
            .reduce((sum, balance) => sum + Math.abs(balance), 0);
          return res.status(200).json({ total });
        } catch (err) {
          console.error("Ledger outstanding error:", err);
          return res.status(500).json({ error: err.message });
        }
      }

      let query = supabaseAdmin.from("ledger").select("*", { count: 'exact' });
      if (member_id) query = query.eq("member_id", member_id);
      if (account_id) query = query.eq("account_id", account_id);
      query = query.order("date", { ascending: true }).limit(10000);
      const { data, error } = await query;
      if (error) {
        console.error("Ledger GET error:", error);
        return res.status(500).json({ error: error.message });
      }

      // When fetching for a specific account, compute balance server-side
      // from ALL rows (not limited) so it matches the admin page calculation.
      let balance;
      if (account_id) {
        const { data: balRows, error: balErr } = await supabaseAdmin
          .from("ledger")
          .select("amount")
          .eq("account_id", account_id);
        if (!balErr && balRows) {
          balance = Math.round(balRows.reduce((sum, tx) => sum + Number(tx.amount), 0) * 100) / 100;
        }
      }

      // If we have ledger data, fetch attachment counts for each transaction
      if (data && data.length > 0) {
        const ledgerIds = data.map(tx => tx.id);
        const { data: attachmentCounts, error: attachmentError } = await supabaseAdmin
          .from("transaction_attachments")
          .select("ledger_id")
          .in("ledger_id", ledgerIds);

        if (!attachmentError && attachmentCounts) {
          // Create a map of ledger_id to attachment count
          const attachmentCountMap = attachmentCounts.reduce((acc, attachment) => {
            acc[attachment.ledger_id] = (acc[attachment.ledger_id] || 0) + 1;
            return acc;
          }, {});

          // Add attachment count to each ledger entry
          data.forEach(tx => {
            tx.attachment_count = attachmentCountMap[tx.id] || 0;
          });
        }
      }

      return res.status(200).json({ data, ...(balance !== undefined && { balance }) });
    }

    if (req.method === "POST") {
      const { member_id, account_id, type, amount, note, date } = req.body;
      if (!account_id || !type || !amount) {
        return res.status(400).json({ error: "Missing required fields" });
      }
      
      // Convert purchase amounts to negative for storage
      let amt = Number(amount);
      if (type === 'purchase') amt = -Math.abs(amt);
      
      // Insert the transaction and return the inserted row
      const { data, error } = await supabaseAdmin
        .from("ledger")
        .insert([
          {
            member_id: member_id || null,
            account_id,
            type,
            amount: amt,
            note,
            date: date || getTodayLocalDate()
          }
        ])
        .select()
        .single();
      if (error) {
        return res.status(500).json({ error: error.message });
      }
      return res.status(200).json({ data });
    }

    if (req.method === "PUT") {
      const { id, type, amount, note, date } = req.body;
      let amt = Number(amount);
      if (type === 'purchase') amt = -Math.abs(amt);
      if (!id || !type || isNaN(amt)) {
        return res.status(400).json({ error: "Missing required fields" });
      }
      const dateString = date ? date : getTodayLocalDate();
      const { data, error } = await supabaseAdmin
        .from("ledger")
        .update({ type, amount: amt, note, date: dateString })
        .eq('id', id)
        .select();
      if (error) {
        console.error("Ledger PUT error:", error);
        return res.status(500).json({ error: error.message });
      }
      if (!data || data.length === 0) {
        console.error("Ledger PUT returned no data");
        return res.status(500).json({ error: 'No data returned from update' });
      }
      return res.status(200).json({ data: data[0] });
    }

    if (req.method === "DELETE") {
      const { id } = req.body;
      if (!id) {
        return res.status(400).json({ error: "Missing required field: id" });
      }
      const { error } = await supabaseAdmin
        .from("ledger")
        .delete()
        .eq("id", id);
      if (error) {
        console.error("Ledger DELETE error:", error);
        return res.status(500).json({ error: error.message });
      }
      return res.status(200).json({ success: true });
    }

    res.setHeader("Allow", ["GET", "POST", "PUT", "DELETE"]);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  } catch (err) {
    console.error("Ledger handler unexpected error:", err);
    return res.status(500).json({ error: "Internal server error", details: err.message });
  }
}
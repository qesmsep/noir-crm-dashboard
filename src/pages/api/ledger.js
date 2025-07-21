import { createClient } from "@supabase/supabase-js";

// Initialize Supabase with service role key
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  console.log('Ledger handler:', req.method, req.body, req.query);
  try {
    if (req.method === "GET") {
      const { member_id, account_id, outstanding } = req.query;
      let query = supabaseAdmin.from("ledger").select("*");
      if (member_id) query = query.eq("member_id", member_id);
      if (account_id) query = query.eq("account_id", account_id);
      query = query.order("date", { ascending: true });
      const { data, error } = await query;
      if (error) {
        console.error("Ledger GET error:", error);
        return res.status(500).json({ error: error.message });
      }
      if (outstanding === '1') {
        // FIXED: Outstanding = sum of all negative account balances (amounts owed to us)
        const accountBalances = {};
        (data || []).forEach(tx => {
          if (!accountBalances[tx.account_id]) {
            accountBalances[tx.account_id] = 0;
          }
          accountBalances[tx.account_id] += Number(tx.amount);
        });
        
        // Sum only negative balances (amounts owed to us)
        const total = Object.values(accountBalances)
          .filter(balance => balance < 0)
          .reduce((sum, balance) => sum + Math.abs(balance), 0);
        
        return res.status(200).json({ total });
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

      return res.status(200).json({ data });
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
            date: date || new Date().toISOString().split('T')[0]
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
      const dateString = date ? date : new Date().toISOString().split('T')[0];
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

    res.setHeader("Allow", ["GET", "POST", "PUT"]);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  } catch (err) {
    console.error("Ledger handler unexpected error:", err);
    return res.status(500).json({ error: "Internal server error", details: err.message });
  }
}
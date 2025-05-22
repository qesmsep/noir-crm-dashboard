import { createClient } from "@supabase/supabase-js";

// Initialize Supabase with service role key
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  console.log('Ledger handler:', req.method, req.body, req.query);
  try {
    if (req.method === "GET") {
      const { member_id, account_id } = req.query;
      if (!member_id && !account_id) {
        return res.status(400).json({ error: "Missing member_id or account_id" });
      }
      let query = supabaseAdmin.from("ledger").select("*");
      if (member_id) query = query.eq("member_id", member_id);
      if (account_id) query = query.eq("account_id", account_id);
      query = query.order("date", { ascending: true });
      const { data, error } = await query;
      if (error) {
        console.error("Ledger GET error:", error);
        return res.status(500).json({ error: error.message });
      }
      return res.status(200).json({ data });
    }

    if (req.method === "POST") {
      const { member_id, account_id, type, amount, note, date } = req.body;
      let amt = Number(amount);
      if (type === 'purchase') amt = -Math.abs(amt);
      if ((!member_id && !account_id) || !type || isNaN(amt)) {
        return res.status(400).json({ error: "Missing required fields" });
      }
      const timestamp = date ? new Date(date).toISOString() : new Date().toISOString();
      const { data, error } = await supabaseAdmin
        .from("ledger")
        .insert(
          [{ member_id: member_id || null, account_id: account_id || null, type, amount: amt, note, date: timestamp }],
          { returning: 'representation' }
        );
      if (error) {
        console.error("Ledger POST error:", error);
        return res.status(500).json({ error: error.message });
      }
      if (!data || data.length === 0) {
        console.error("Ledger POST returned no data");
        return res.status(500).json({ error: 'No data returned from insert' });
      }
      return res.status(200).json({ data: data[0] });
    }

    if (req.method === "PUT") {
      const { id, type, amount, note, date } = req.body;
      let amt = Number(amount);
      if (type === 'purchase') amt = -Math.abs(amt);
      if (!id || !type || isNaN(amt)) {
        return res.status(400).json({ error: "Missing required fields" });
      }
      const timestamp = date ? new Date(date).toISOString() : new Date().toISOString();
      const { data, error } = await supabaseAdmin
        .from("ledger")
        .update({ type, amount: amt, note, date: timestamp })
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

    res.setHeader("Allow", ["GET", "POST", "PUT"]);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  } catch (err) {
    console.error("Ledger handler unexpected error:", err);
    return res.status(500).json({ error: "Internal server error", details: err.message });
  }
}
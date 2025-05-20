

import { createClient } from "@supabase/supabase-js";

// Initialize Supabase with service role key
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  // Allow only GET and POST
  if (req.method === "GET") {
    const { member_id } = req.query;
    if (!member_id) {
      return res.status(400).json({ error: "Missing member_id" });
    }
    const { data, error } = await supabaseAdmin
      .from("ledger")
      .select("*")
      .eq("member_id", member_id)
      .order("date", { ascending: true });
    if (error) {
      console.error("Ledger GET error:", error);
      return res.status(500).json({ error: error.message });
    }
    return res.status(200).json({ data });
  }

  if (req.method === "POST") {
    const { member_id, type, amount, note } = req.body;
    if (!member_id || !type || amount == null) {
      return res.status(400).json({ error: "Missing required fields" });
    }
    const timestamp = new Date().toISOString();
    const { data, error } = await supabaseAdmin
      .from("ledger")
      .insert([{ member_id, type, amount, note, date: timestamp }]);
    if (error) {
      console.error("Ledger POST error:", error);
      return res.status(500).json({ error: error.message });
    }
    return res.status(200).json({ data: data[0] });
  }

  res.setHeader("Allow", ["GET", "POST"]);
  return res.status(405).end(`Method ${req.method} Not Allowed`);
}
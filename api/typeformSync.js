import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const { form_response } = req.body;

    // Example: Extract answers by their question refs or order
    // You may want to log form_response to see the structure
    // Here, map fields by question reference
    const answers = {};
    if (form_response && form_response.answers) {
      for (const ans of form_response.answers) {
        // Use ans.field.ref as the key if your form uses refs
        answers[ans.field.ref || ans.field.id] = ans[ans.type];
      }
    }

    // Map your Typeform question refs/ids to your member fields:
    const firstName = answers['first_name'] || '';
    const lastName = answers['last_name'] || '';
    const email = answers['email'] || '';
    const phone = answers['phone'] || '';
    const membership = answers['membership'] || '';
    const photo = answers['photo'] || '';
    const dob = answers['dob'] || '';
    // Add more fields as needed...

    if (!email) {
      res.status(400).json({ error: 'Missing required email' });
      return;
    }

    // Optional: Try to find existing Stripe customer by email
    let stripe_customer_id = null;
    try {
      const customers = await stripe.customers.list({ email, limit: 1 });
      if (customers.data.length > 0) {
        stripe_customer_id = customers.data[0].id;
      }
    } catch (err) {
      // Stripe lookup failed; not fatal
    }

    // Upsert member in Supabase
    const { error } = await supabase.from('members').upsert([
      {
        first_name: firstName,
        last_name: lastName,
        email,
        phone,
        membership,
        photo,
        dob,
        stripe_customer_id
      }
    ], { onConflict: ['email'] });

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    res.status(200).json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

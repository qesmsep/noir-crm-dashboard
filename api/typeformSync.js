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
    console.log('Incoming body:', JSON.stringify(req.body, null, 2));
    const form = req.body.form_response || req.body;

    // Example: Extract answers by their question refs or order
    // You may want to log form to see the structure
    // Here, map fields by question reference
    const answers = {};
    if (form && form.answers) {
      for (const ans of form.answers) {
        // Use ans.field.ref as the key if your form uses refs
        answers[ans.field.ref || ans.field.id] = ans[ans.type];
      }
    }

    // Map Typeform refs to your member fields:
    const firstName    = answers['a229bb86-2442-4cbd-bdf6-c6f2cd4d4b9d'] || ''; // First name
    const lastName     = answers['9c123e7b-2643-4819-9b4d-4a9f236302c9'] || ''; // Last name
    const phone        = answers['6ed12e4b-95a2-4b30-96b2-a7095f673db6'] || ''; // Phone number
    const email        = answers['ee4bcd7b-768d-49fb-b7cc-80cdd25c750a'] || ''; // Email
    const company      = answers['d32131fd-318b-4e39-8fcd-41eed4096d36'] || ''; // Company
    const dob          = answers['1432cfc0-d3dc-48fc-8561-bf0053ccc097'] || ''; // DOB
    const address      = answers['d8ef8992-e207-4165-a296-67dd22de7cc6'] || ''; // Address
    const city         = answers['b70d8409-0f17-4bc8-9e12-35f8b50d1e74'] || ''; // City/Town
    const state        = answers['9ab3b62d-a361-480a-856c-7200224f65ac'] || ''; // State/Region/Province
    const zip          = answers['f79dcd7d-a82d-4fca-8987-85014e42e115'] || ''; // Zip
    const photo        = answers['ddc3eeeb-f2ae-4070-846d-c3194008d0d9'] || ''; // Photo upload (URL)
    const referredBy   = answers['dff5344e-93e0-4ae5-967c-b92e0ad51f65'] || ''; // Who referred you

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
        company,
        dob,
        address,
        city,
        state,
        zip,
        photo,
        referred_by: referredBy,
        stripe_customer_id
        // Add other fields as needed
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

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
    // Support both Typeform webhook payloads and raw testing
    const form = req.body.form_response || req.body;

    // Map answers by field.ref for easy access
    const answers = {};
    if (form && form.answers) {
      for (const ans of form.answers) {
        // Save both .ref and .id in case of ref missing
        if (ans.field.ref) answers[ans.field.ref] = ans[ans.type];
        answers[ans.field.id] = ans[ans.type];
      }
    }

    // Extract answers using refs (preferred) or IDs
    const firstName      = answers['a229bb86-2442-4cbd-bdf6-c6f2cd4d4b9d'] || ''; // First name
    const lastName       = answers['9c123e7b-2643-4819-9b4d-4a9f236302c9'] || ''; // Last name
    const phone          = answers['6ed12e4b-95a2-4b30-96b2-a7095f673db6'] || '';
    const email          = answers['ee4bcd7b-768d-49fb-b7cc-80cdd25c750a'] || '';
    const company        = answers['d32131fd-318b-4e39-8fcd-41eed4096d36'] || '';
    const dob            = answers['1432cfc0-d3dc-48fc-8561-bf0053ccc097'] || '';
    const address        = answers['d8ef8992-e207-4165-a296-67dd22de7cc6'] || '';
    const address2       = answers['fb3d4079-af85-4914-962a-71c9316b89e2'] || '';
    const city           = answers['b70d8409-0f17-4bc8-9e12-35f8b50d1e74'] || '';
    const state          = answers['9ab3b62d-a361-480a-856c-7200224f65ac'] || '';
    const zip            = answers['f79dcd7d-a82d-4fca-8987-85014e42e115'] || '';
    const photo          = answers['ddc3eeeb-f2ae-4070-846d-c3194008d0d9'] || '';
    const referredBy     = answers['dff5344e-93e0-4ae5-967c-b92e0ad51f65'] || '';

    if (!email) {
      res.status(400).json({ error: 'Missing required email' });
      return;
    }

    // Lookup Stripe customer by email (optional, recommended for linking)
    let stripe_customer_id = null;
    try {
      const customers = await stripe.customers.list({ email, limit: 1 });
      if (customers.data.length > 0) {
        stripe_customer_id = customers.data[0].id;
      }
    } catch (err) {
      // Stripe lookup failed; not fatal
    }

    // Upsert member to Supabase, mapping all columns from members_rows.csv with fallbacks/defaults
    const { error } = await supabase.from('members').upsert([
      {
        first_name: firstName || '',
        last_name: lastName || '',
        email: email || '',
        phone: phone || '',
        company: company || '',
        dob: dob || '',
        address: address || '',
        address_2: address2 || '',
        city: city || '',
        state: state || '',
        zip: zip || '',
        photo: photo || '',
        // Referral field (updated property name)
        referral: referredBy || '',
        stripe_customer_id: stripe_customer_id || null,
        spouse_first: '',
        spouse_last: '',
        spouse_email: '',
        spouse_phone: '',
        membership: '',
        status: 'pending',
        balance: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        // Add any other fields from your CSV here, defaulting as needed
      }
    ], { onConflict: ['email'] });

    if (error) {
      console.error('Supabase error:', error);
      res.status(500).json({ error: error.message, details: error.details, hint: error.hint, code: error.code });
      return;
    }

    res.status(200).json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';
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
    const form = req.body.form_response || req.body;
    function findAnswer(fieldRefs, type = null) {
      const ans = (form.answers || []).find(
        a =>
          (fieldRefs.includes(a.field.ref) || fieldRefs.includes(a.field.id))
          && (!type || a.type === type)
      );
      if (!ans) return null;
      if (type === 'choice' && ans.choice) return ans.choice.label;
      if (type === 'file_url' && ans.file_url) return ans.file_url;
      if (type === 'phone_number' && ans.phone_number) return ans.phone_number;
      if (type === 'email' && ans.email) return ans.email;
      if (type === 'date' && ans.date) return ans.date;
      if (ans.text) return ans.text;
      return null;
    }

    // Generate a new account_id for this submission
    const account_id = uuidv4();

    // Create the account record
    const { error: accountError } = await supabase
      .from('accounts')
      .insert({
        account_id,
        stripe_customer_id: null,
        created_at: new Date().toISOString()
      });

    if (accountError) {
      console.error('Error creating account:', accountError);
      res.status(500).json({ error: accountError.message });
      return;
    }

    // Main member
    const member1 = {
      member_id: uuidv4(),
      account_id,
      first_name:   findAnswer(['a229bb86-2442-4cbd-bdf6-c6f2cd4d4b9d']),
      last_name:    findAnswer(['9c123e7b-2643-4819-9b4d-4a9f236302c9']),
      email:        findAnswer(['ee4bcd7d-768d-49fb-b7cc-80cdd25c750a'], 'email'),
      phone:        findAnswer(['6ed12e4b-95a2-4b30-96b2-a7095f673db6'], 'phone_number'),
      company:      findAnswer(['d32131fd-318b-4cbd-41eed4096d36', 'd32131fd-318b-4e39-8fcd-41eed4096d36']),
      dob:          findAnswer(['1432cfc0-d3dc-48fc-8561-bf0053ccc097'], 'date'),
      address:      findAnswer(['d8ef8992-e207-4165-a296-67dd22de7cc6']),
      address_2:    findAnswer(['fb3d4079-af85-4914-962a-71c9316b89e2']),
      city:         findAnswer(['b70d8409-0f17-4bc8-9e12-35f8b50d1e74']),
      state:        findAnswer(['9ab3b62d-a361-480a-856c-7200224f65ac']),
      zip:          findAnswer(['f79dcd7d-a82d-4fca-8987-85014e42e115']),
      country:      findAnswer(['8e920793-22ca-4c89-a25e-2b76407e171f']),
      membership:   findAnswer(['8101b9b5-5734-4db6-a2d1-27f122c05f9e'], 'choice'),
      photo:        findAnswer(['ddc3eeeb-f2ae-4070-846d-c3194008d0d9'], 'file_url'),
      referral:     findAnswer(['dff5344e-93e0-4ae5-967c-b92e0ad51f65']),
      monthly_dues: 0,
      stripe_customer_id: null,
      join_date:    form.submitted_at,
      token:        form.token || null,
    };
    // Set monthly_dues based on membership
    const duesMap = { 
      'Membership': 100, 
      'Membership + Partner': 125, 
      'Membership + Daytime': 350, 
      'Membership + Partner + Daytime': 375,
      // Keep legacy support for existing members
      'Solo': 100, 
      'Duo': 125, 
      'Premier': 250, 
      'Reserve': 1000, 
      'Host': 1 
    };
    member1.monthly_dues = duesMap[member1.membership] || 0;

    // Second member (if present)
    const member2FirstName = findAnswer(['4418ddd8-d940-4896-9589-565b78c252c8']);
    let members = [member1];
    if (member2FirstName) {
      const member2 = {
        member_id: uuidv4(),
        account_id,
        first_name: member2FirstName,
        last_name:  findAnswer(['ac1b6049-8826-4f71-a748-bbbb41c2ce9e']),
        email:      findAnswer(['b9cde49b-3a69-4181-a738-228f5a11f27c'], 'email'),
        phone:      findAnswer(['9c2688e3-34c0-4da0-8e17-c44a81778cf3'], 'phone_number'),
        company:    findAnswer(['c1f6eef0-4884-49e6-8928-c803b60a115f']),
        photo:      findAnswer(['95940d74-dda1-4531-be16-ffd01839c49f'], 'file_url'),
        status:     'pending',
        balance:    0,
        stripe_customer_id: null,
        join_date:  form.submitted_at,
        renewal_date: null,
        token:      form.token || null,
      };
      members.push(member2);
    }

    // Stripe Customer lookup for main member (optional)
    if (member1.email) {
      try {
        const customers = await stripe.customers.list({ email: member1.email, limit: 1 });
        if (customers.data.length > 0) {
          member1.stripe_customer_id = customers.data[0].id;
          // Update the account with the Stripe customer ID
          await supabase
            .from('accounts')
            .update({ stripe_customer_id: customers.data[0].id })
            .eq('account_id', account_id);
        }
      } catch {}
    }

    // Insert both members
    const { error } = await supabase.from('members').insert(members);

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

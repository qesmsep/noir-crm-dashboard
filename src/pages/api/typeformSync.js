import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

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
      if (type === 'boolean' && ans.boolean !== undefined) return ans.boolean;
      if (ans.text) return ans.text;
      return null;
    }

    // Validate required fields
    const requiredFields = {
      first_name: findAnswer(['a229bb86-2442-4cbd-bdf6-c6f2cd4d4b9d']),
      last_name: findAnswer(['9c123e7b-2643-4819-9b4d-4a9f236302c9']),
      email: findAnswer(['ee4bcd7b-768d-49fb-b7cc-80cdd25c750a'], 'email'),
      phone: findAnswer(['6ed12e4b-95a2-4b30-96b2-a7095f673db6'], 'phone_number'),
      company: findAnswer(['d32131fd-318b-4cbd-41eed4096d36', 'd32131fd-318b-4e39-8fcd-41eed4096d36'])
    };

    const missingFields = Object.entries(requiredFields)
      .filter(([key, value]) => !value)
      .map(([key]) => key);

    if (missingFields.length > 0) {
      res.status(400).json({ 
        error: 'Missing required fields', 
        missingFields 
      });
      return;
    }

    // Generate a new account_id for this submission
    const account_id = uuidv4();

    // Check if partner is being added (question 5)
    const hasPartner = findAnswer(['f0b72d00-d153-4030-9644-cb3ab890f7dc'], 'boolean');
    
    // Check for explicit membership type selection (if field exists)
    const explicitMembershipType = findAnswer(['membership_type_field_id'], 'choice'); // Update with actual field ID when available
    
    // Check for Honorary Member or Host membership indicators
    // These would be determined by specific questions or routing logic in Typeform
    const isHonoraryMember = findAnswer(['honorary_member_field_id'], 'boolean'); // Update with actual field ID
    const isHostMember = findAnswer(['host_member_field_id'], 'boolean'); // Update with actual field ID
    
    // Determine membership type
    let membershipType = 'Solo';
    if (explicitMembershipType) {
      // Use explicit selection if available
      membershipType = explicitMembershipType;
    } else if (isHonoraryMember === true) {
      membershipType = 'Honorary Member';
    } else if (isHostMember === true) {
      membershipType = 'Host';
    } else if (hasPartner === true) {
      // Fall back to partner-based logic
      membershipType = 'Duo';
    }

    // Main member
    const member1 = {
      member_id: uuidv4(),
      account_id,
      first_name:   findAnswer(['a229bb86-2442-4cbd-bdf6-c6f2cd4d4b9d']),
      last_name:    findAnswer(['9c123e7b-2643-4819-9b4d-4a9f236302c9']),
      email:        findAnswer(['ee4bcd7b-768d-49fb-b7cc-80cdd25c750a'], 'email'),
      phone:        findAnswer(['6ed12e4b-95a2-4b30-96b2-a7095f673db6'], 'phone_number'),
      company:      findAnswer(['d32131fd-318b-4cbd-41eed4096d36', 'd32131fd-318b-4e39-8fcd-41eed4096d36']),
      dob:          findAnswer(['1432cfc0-d3dc-48fc-8561-bf0053ccc097'], 'date'),
      address:      findAnswer(['d8ef8992-e207-4165-a296-67dd22de7cc6']),
      address_2:    findAnswer(['fb3d4079-af85-4914-962a-71c9316b89e2']),
      city:         findAnswer(['b70d8409-0f17-4bc8-9e12-35f8b50d1e74']),
      state:        findAnswer(['9ab3b62d-a361-480a-856c-7200224f65ac']),
      zip:          findAnswer(['f79dcd7d-a82d-4fca-8987-85014e42e115']),
      country:      findAnswer(['8e920793-22ca-4c89-a25e-2b76407e171f']),
      membership:   membershipType,
      photo:        findAnswer(['ddc3eeeb-f2ae-4070-846d-c3194008d0d9'], 'file_url'),
      referral:     findAnswer(['dff5344e-93e0-4ae5-967c-b92e0ad51f65']),
      monthly_dues: 0,
      stripe_customer_id: null,
      join_date:    form.submitted_at,
      token:        form.token || null,
      member_type:  'primary',
      deactivated:  false,
      has_password: false,
      ledger_notifications_enabled: true,
      status: 'pending'
    };

    // Set monthly_dues based on membership
    const duesMap = { 
      'Solo': 100, 
      'Duo': 125,
      'Honorary Member': 10,
      // Keep legacy support for existing members
      'Membership': 100, 
      'Membership + Partner': 125, 
      'Membership + Daytime': 350, 
      'Membership + Partner + Daytime': 375,
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
        dob:        findAnswer(['b6623266-477c-47aa-99fc-2311888fc733'], 'date'),
        photo:      findAnswer(['95940d74-dda1-4531-be16-ffd01839c49f'], 'file_url'),
        monthly_dues: 0, // Secondary members don't pay separately
        stripe_customer_id: null,
        join_date:  form.submitted_at,
        token:      form.token || null,
        member_type:  'secondary',
        deactivated:  false,
        has_password: false,
        ledger_notifications_enabled: true,
        status: 'pending'
      };
      members.push(member2);
    }

    // Validate photos based on membership type
    const primaryPhoto = findAnswer(['ddc3eeeb-f2ae-4070-846d-c3194008d0d9'], 'file_url');
    const secondaryPhoto = member2FirstName ? findAnswer(['95940d74-dda1-4531-be16-ffd01839c49f'], 'file_url') : null;
    
    // Photo requirements by membership type
    const photoRequirements = {
      'Solo': { primary: true, secondary: false },
      'Duo': { primary: true, secondary: true },
      'Honorary Member': { primary: true, secondary: true }, // Honorary requires 2 photos
      'Host': { primary: true, secondary: false },
      'Premier': { primary: true, secondary: false },
      'Reserve': { primary: true, secondary: false }
    };
    
    const requirements = photoRequirements[membershipType] || { primary: true, secondary: false };
    
    if (requirements.primary && !primaryPhoto) {
      res.status(400).json({ 
        error: `Photo is required for primary member in ${membershipType} membership` 
      });
      return;
    }
    
    if (requirements.secondary && member2FirstName && !secondaryPhoto) {
      res.status(400).json({ 
        error: `Photo is required for secondary member in ${membershipType} membership` 
      });
      return;
    }



    // Insert both members
    const { error } = await supabase.from('members').insert(members);

    if (error) {
      console.error('Supabase error:', error);
      res.status(500).json({ error: error.message, details: error.details, hint: error.hint, code: error.code });
      return;
    }

    // Trigger followup campaign for the primary member
    try {
      const primaryMember = member1;
      console.log('Triggering followup campaign for member:', primaryMember.member_id);
      
      const campaignResponse = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/trigger-member-campaign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          member_id: primaryMember.member_id,
          activation_date: form.submitted_at
        })
      });

      if (campaignResponse.ok) {
        const campaignData = await campaignResponse.json();
        console.log('Followup campaign triggered successfully:', campaignData);
      } else {
        console.error('Failed to trigger followup campaign:', await campaignResponse.text());
      }
    } catch (campaignError) {
      console.error('Error triggering followup campaign:', campaignError);
      // Don't fail the entire request if campaign trigger fails
    }

    res.status(200).json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

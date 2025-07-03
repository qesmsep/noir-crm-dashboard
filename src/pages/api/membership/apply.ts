import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { method } = req;

  try {
    switch (method) {
      case 'POST':
        return await submitApplication(req, res);
      case 'GET':
        return await getApplication(req, res);
      case 'PUT':
        return await updateApplication(req, res);
      default:
        res.setHeader('Allow', ['GET', 'POST', 'PUT']);
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

async function getApplication(req: NextApiRequest, res: NextApiResponse) {
  const { id, email } = req.query;

  if (!id && !email) {
    return res.status(400).json({ error: 'Application ID or email is required' });
  }

  let query = supabase
    .from('member_applications')
    .select(`
      *,
      questionnaire_responses (
        *,
        questionnaire_questions (
          question_text,
          question_type,
          options
        )
      ),
      agreement_signatures (*),
      questionnaires (title, description),
      agreements (title, content)
    `);

  if (id) {
    query = query.eq('id', id);
  } else {
    query = query.eq('email', email);
  }

  const { data, error } = await query.single();

  if (error) {
    return res.status(404).json({ error: 'Application not found' });
  }

  return res.status(200).json(data);
}

async function submitApplication(req: NextApiRequest, res: NextApiResponse) {
  const { 
    email, 
    phone, 
    first_name, 
    last_name, 
    questionnaire_id, 
    responses = [],
    step = 'questionnaire',
    waitlist_id = null,
    token = null
  } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  // If token provided, validate it and get waitlist_id
  let validatedWaitlistId = waitlist_id;
  if (token && !waitlist_id) {
    const { data: tokenData } = await supabase
      .rpc('get_waitlist_by_token', { token_param: token });
    
    if (tokenData && tokenData.length > 0 && tokenData[0].is_valid) {
      validatedWaitlistId = tokenData[0].id;
    } else {
      return res.status(400).json({ error: 'Invalid or expired application token' });
    }
  }

  // Check if application already exists
  const { data: existingApp } = await supabase
    .from('member_applications')
    .select('*')
    .eq('email', email)
    .single();

  let application;

  if (existingApp) {
    // Update existing application
    const updateData: any = {
      phone,
      first_name,
      last_name,
      questionnaire_id,
      updated_at: new Date().toISOString()
    };

    // Only update waitlist_id if we have a valid one and it's not already set
    if (validatedWaitlistId && !existingApp.waitlist_id) {
      updateData.waitlist_id = validatedWaitlistId;
    }

    const { data: updatedApp, error: updateError } = await supabase
      .from('member_applications')
      .update(updateData)
      .eq('id', existingApp.id)
      .select()
      .single();

    if (updateError) {
      return res.status(400).json({ error: updateError.message });
    }

    application = updatedApp;
  } else {
    // Create new application
    const { data: newApp, error: createError } = await supabase
      .from('member_applications')
      .insert({
        email,
        phone,
        first_name,
        last_name,
        questionnaire_id,
        waitlist_id: validatedWaitlistId,
        status: 'questionnaire_pending'
      })
      .select()
      .single();

    if (createError) {
      return res.status(400).json({ error: createError.message });
    }

    application = newApp;
  }

  // Handle questionnaire responses
  if (step === 'questionnaire' && responses.length > 0) {
    // Delete existing responses for this application
    await supabase
      .from('questionnaire_responses')
      .delete()
      .eq('application_id', application.id);

    // Insert new responses
    const formattedResponses = responses.map((response: any) => ({
      application_id: application.id,
      question_id: response.question_id,
      response_text: response.response_text,
      response_data: response.response_data
    }));

    const { error: responsesError } = await supabase
      .from('questionnaire_responses')
      .insert(formattedResponses);

    if (responsesError) {
      return res.status(400).json({ error: responsesError.message });
    }

    // Update application status
    await supabase
      .from('member_applications')
      .update({
        status: 'questionnaire_completed',
        questionnaire_completed_at: new Date().toISOString()
      })
      .eq('id', application.id);
  }

  return res.status(200).json(application);
}

async function updateApplication(req: NextApiRequest, res: NextApiResponse) {
  const { 
    id, 
    step, 
    agreement_signature, 
    status,
    stripe_customer_id,
    stripe_payment_intent_id,
    payment_amount
  } = req.body;

  if (!id) {
    return res.status(400).json({ error: 'Application ID is required' });
  }

  const updateData: any = {
    updated_at: new Date().toISOString()
  };

  // Handle different steps
  if (step === 'agreement' && agreement_signature) {
    // Get current agreement
    const { data: agreement } = await supabase
      .from('agreements')
      .select('*')
      .eq('is_current', true)
      .eq('status', 'active')
      .single();

    if (!agreement) {
      return res.status(400).json({ error: 'No active agreement found' });
    }

    // Create agreement signature
    const { error: signatureError } = await supabase
      .from('agreement_signatures')
      .insert({
        application_id: id,
        agreement_id: agreement.id,
        signature_data: {
          ...agreement_signature,
          timestamp: new Date().toISOString(),
          ip_address: req.headers['x-forwarded-for'] || req.socket.remoteAddress
        }
      });

    if (signatureError) {
      return res.status(400).json({ error: signatureError.message });
    }

    updateData.agreement_id = agreement.id;
    updateData.status = 'agreement_completed';
    updateData.agreement_completed_at = new Date().toISOString();

  } else if (step === 'payment') {
    updateData.stripe_customer_id = stripe_customer_id;
    updateData.stripe_payment_intent_id = stripe_payment_intent_id;
    updateData.payment_amount = payment_amount;
    updateData.status = status || 'payment_pending';

    if (status === 'payment_completed') {
      updateData.payment_completed_at = new Date().toISOString();
    }
  }

  const { data: application, error } = await supabase
    .from('member_applications')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    return res.status(400).json({ error: error.message });
  }

  return res.status(200).json(application);
}
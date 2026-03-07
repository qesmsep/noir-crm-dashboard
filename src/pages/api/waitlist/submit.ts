import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { questionnaire_id, responses } = req.body;

  if (!questionnaire_id || !responses) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    // Extract basic contact info from responses
    const questions = await getQuestionMap(questionnaire_id);

    const firstName = findResponseByQuestionText(responses, questions, 'First Name');
    const lastName = findResponseByQuestionText(responses, questions, 'Last Name');
    const email = findResponseByQuestionText(responses, questions, 'Email');
    const phone = findResponseByQuestionText(responses, questions, 'Phone SMS')
      || findResponseByQuestionText(responses, questions, 'Phone'); // Fallback for older data
    const company = findResponseByQuestionText(responses, questions, 'Company (Owned or Employed by)')
      || findResponseByQuestionText(responses, questions, 'Company'); // Fallback for older data
    const howDidYouHear = findResponseByQuestionText(responses, questions, 'Who referred you to Noir?')
      || findResponseByQuestionText(responses, questions, 'How did you hear about Noir?'); // Fallback for existing data
    const whyNoir = findResponseByQuestionText(responses, questions, 'Why are you interested in joining Noir?');
    const occupation = findResponseByQuestionText(responses, questions, 'Occupation');
    const industry = findResponseByQuestionText(responses, questions, 'Industry');

    // Extract photo URL from responses (will be a URL starting with http)
    let photoUrl: string | null = null;
    for (const [questionId, value] of Object.entries(responses)) {
      if (typeof value === 'string' && value.startsWith('http') && value.includes('supabase')) {
        photoUrl = value;
        break;
      }
    }

    // Create waitlist entry
    const { data: waitlistEntry, error: waitlistError } = await supabase
      .from('waitlist')
      .insert({
        first_name: firstName,
        last_name: lastName,
        email,
        phone,
        company,
        how_did_you_hear: howDidYouHear,
        why_noir: whyNoir,
        occupation,
        industry,
        photo_url: photoUrl,
        status: 'review',
        submitted_at: new Date().toISOString()
      })
      .select()
      .single();

    if (waitlistError) throw waitlistError;

    // Save questionnaire response (uses existing schema with jsonb answers)
    const { error: responsesError } = await supabase
      .from('questionnaire_responses')
      .insert({
        questionnaire_id: questionnaire_id,
        answers: responses,
        file_urls: photoUrl ? { photo: photoUrl } : {},
        tracking_id: waitlistEntry.id // Link to waitlist entry
      });

    if (responsesError) throw responsesError;

    // Send confirmation SMS (optional)
    if (phone && firstName) {
      try {
        await sendConfirmationSMS(phone, firstName);
      } catch (smsError) {
        console.error('Failed to send SMS:', smsError);
        // Don't fail the request if SMS fails
      }
    }

    return res.status(200).json({
      success: true,
      waitlist_id: waitlistEntry.id,
      message: 'Application submitted successfully'
    });

  } catch (error: any) {
    console.error('Waitlist submission error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}

// Helper function to get question map
async function getQuestionMap(questionnaireId: string): Promise<Record<string, any>> {
  // First try to get from questionnaire_templates (current schema)
  const { data: template } = await supabase
    .from('questionnaire_templates')
    .select('questions')
    .eq('id', questionnaireId)
    .single();

  const map: Record<string, any> = {};

  if (template && Array.isArray(template.questions)) {
    template.questions.forEach((q: any) => {
      map[q.id] = q;
    });
    return map;
  }

  // Fallback to questionnaire_questions table
  const { data: questions } = await supabase
    .from('questionnaire_questions')
    .select('*')
    .eq('questionnaire_id', questionnaireId);

  questions?.forEach(q => {
    map[q.id] = q;
  });
  return map;
}

// Helper function to find response by question text
function findResponseByQuestionText(
  responses: Record<string, any>,
  questions: Record<string, any>,
  questionText: string
): string | undefined {
  for (const [questionId, value] of Object.entries(responses)) {
    const question = questions[questionId];
    if (question && question.question_text === questionText) {
      return typeof value === 'string' ? value : JSON.stringify(value);
    }
  }
  return undefined;
}

// Helper function to send confirmation SMS
async function sendConfirmationSMS(phone: string, firstName: string): Promise<void> {
  const message = `Hi ${firstName}! Thank you for applying to join Noir. We've received your application and will review it shortly. We typically respond within 24 hours. 🖤`;

  // Send SMS using shared utility
  const { sendSMS } = await import('@/lib/sms');
  await sendSMS({
    to: phone,
    content: message
  });
}

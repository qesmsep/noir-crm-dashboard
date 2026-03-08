import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function createQuestionnaires() {
  // Create INVITATION questionnaire for /signup/[token]
  const invitationQuestions = [
    { id: 'q1', question_text: 'First Name', question_type: 'text', is_required: true },
    { id: 'q2', question_text: 'Last Name', question_type: 'text', is_required: true },
    { id: 'q3', question_text: 'Email', question_type: 'email', is_required: true },
    { id: 'q4', question_text: 'Phone', question_type: 'phone', is_required: true },
    { id: 'q5', question_text: 'Company', question_type: 'text', is_required: false },
    { id: 'q6', question_text: 'Occupation', question_type: 'text', is_required: false },
    { id: 'q7', question_text: 'City, State', question_type: 'text', is_required: false },
    { id: 'q8', question_text: 'How did you hear about Noir?', question_type: 'textarea', is_required: false },
    { id: 'q9', question_text: 'Why are you interested in joining Noir?', question_type: 'textarea', is_required: false },
    { id: 'q10', question_text: 'Profile Photo', question_type: 'file', is_required: false }
  ];

  const { data: invitation, error: invError } = await supabase
    .from('questionnaire_templates')
    .insert({
      id: '11111111-1111-1111-1111-111111111111',
      name: 'Member Invitation Application',
      questions: invitationQuestions
    })
    .select()
    .single();

  if (invError) {
    console.error('Error creating INVITATION questionnaire:', invError);
  } else {
    console.log('✅ Created INVITATION questionnaire');
  }

  // Create SKYLINE questionnaire for /skyline/[token]
  const skylineQuestions = [
    { id: 'q1', question_text: 'First Name', question_type: 'text', is_required: true },
    { id: 'q2', question_text: 'Last Name', question_type: 'text', is_required: true },
    { id: 'q3', question_text: 'Email', question_type: 'email', is_required: true },
    { id: 'q4', question_text: 'Phone', question_type: 'phone', is_required: true },
    { id: 'q5', question_text: 'Company', question_type: 'text', is_required: false },
    { id: 'q6', question_text: 'Occupation', question_type: 'text', is_required: false },
    { id: 'q7', question_text: 'City, State', question_type: 'text', is_required: false },
    { id: 'q8', question_text: 'How did you hear about Noir?', question_type: 'textarea', is_required: false },
    { id: 'q9', question_text: 'Why are you interested in Skyline membership?', question_type: 'textarea', is_required: false },
    { id: 'q10', question_text: 'Profile Photo', question_type: 'file', is_required: false }
  ];

  const { data: skyline, error: skyError } = await supabase
    .from('questionnaire_templates')
    .insert({
      id: '22222222-2222-2222-2222-222222222222',
      name: 'Skyline Member Application',
      questions: skylineQuestions
    })
    .select()
    .single();

  if (skyError) {
    console.error('Error creating SKYLINE questionnaire:', skyError);
  } else {
    console.log('✅ Created SKYLINE questionnaire');
  }
}

createQuestionnaires();

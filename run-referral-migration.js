const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function runMigration() {
  try {
    console.log('🔄 Updating referral question...');

    // Update question text
    const { error: updateError } = await supabase
      .from('questionnaire_questions')
      .update({
        question_text: 'Who referred you to Noir?',
        placeholder: 'Enter referrer name or select option'
      })
      .eq('questionnaire_id', '00000000-0000-0000-0000-000000000001')
      .eq('question_text', 'How did you hear about Noir?');

    if (updateError) {
      console.error('❌ Error updating question:', updateError);
      process.exit(1);
    }

    // Update options
    const { error: optionsError } = await supabase
      .from('questionnaire_questions')
      .update({
        options: [
          { value: "member_referral", label: "Current Member Referral" },
          { value: "friend_family", label: "Friend or Family" },
          { value: "social_media", label: "Social Media" },
          { value: "event", label: "Attended an Event" },
          { value: "website", label: "Website" },
          { value: "other", label: "Other" }
        ]
      })
      .eq('questionnaire_id', '00000000-0000-0000-0000-000000000001')
      .eq('question_text', 'Who referred you to Noir?');

    if (optionsError) {
      console.error('❌ Error updating options:', optionsError);
      process.exit(1);
    }

    console.log('✅ Migration completed successfully!');
    console.log('   Question updated: "Who referred you to Noir?"');
    console.log('   Options updated with member referral focus');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

runMigration();

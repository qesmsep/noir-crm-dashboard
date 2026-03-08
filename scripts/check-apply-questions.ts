import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkQuestions() {
  // Get all questionnaire templates
  const { data: templates, error } = await supabase
    .from('questionnaire_templates')
    .select('*')
    .order('created_at');

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log('All Questionnaire Templates:');
  console.log('============================\n');

  templates?.forEach((template: any) => {
    console.log(`\n📋 ${template.name} (${template.type})`);
    console.log(`   ID: ${template.id}`);
    console.log(`   Questions: ${template.questions?.length || 0}`);

    if (template.questions && template.questions.length > 0) {
      template.questions.forEach((q: any, i: number) => {
        console.log(`   ${i + 1}. [${q.id}] "${q.question_text}" (${q.question_type})`);
      });
    }
  });

  console.log('\n\n🔍 Checking hardcoded IDs used in code:');
  console.log('========================================');
  console.log('✓ /apply uses: a201cee3-3e34-459d-83c8-25b073fd26f7');
  console.log('⚠️  /signup/[token] uses: 11111111-1111-1111-1111-111111111111');
  console.log('⚠️  /skyline/[token] uses: 22222222-2222-2222-2222-222222222222');
}

checkQuestions();

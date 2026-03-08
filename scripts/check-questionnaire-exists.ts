import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkQuestionnaires() {
  const idsToCheck = [
    { name: 'INVITATION (used in /apply)', id: 'a201cee3-3e34-459d-83c8-25b073fd26f7' },
    { name: 'INVITATION (used in /signup)', id: '11111111-1111-1111-1111-111111111111' },
    { name: 'SKYLINE (used in /skyline)', id: '22222222-2222-2222-2222-222222222222' }
  ];

  console.log('Checking questionnaire IDs:\n');

  for (const item of idsToCheck) {
    const { data, error } = await supabase
      .from('questionnaire_templates')
      .select('id, name, questions')
      .eq('id', item.id)
      .single();

    if (error || !data) {
      console.log(`❌ ${item.name}`);
      console.log(`   ID: ${item.id}`);
      console.log(`   Status: NOT FOUND`);
      console.log('');
    } else {
      console.log(`✅ ${item.name}`);
      console.log(`   ID: ${item.id}`);
      console.log(`   Name: ${data.name}`);
      console.log(`   Questions: ${data.questions?.length || 0}`);
      console.log('');
    }
  }
}

checkQuestionnaires();

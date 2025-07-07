const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function testMinutePrecision() {
  console.log('🧪 Testing Minute-Level Precision System\n');

  try {
    // 1. Fetch all reminder templates
    console.log('1️⃣ Fetching reminder templates...');
    const { data: templates, error: templatesError } = await supabase
      .from('reservation_reminder_templates')
      .select('*')
      .order('reminder_type', 'send_time', 'send_time_minutes');

    if (templatesError) {
      console.error('❌ Error fetching templates:', templatesError);
      return;
    }

    console.log(`✅ Found ${templates.length} templates\n`);

    // 2. Display all templates with their time formats
    console.log('2️⃣ Template Details:');
    templates.forEach((template, index) => {
      const timeDisplay = formatTemplateTime(template);
      console.log(`   ${index + 1}. ${template.name}`);
      console.log(`      Type: ${template.reminder_type}`);
      console.log(`      Send Time: ${template.send_time} (${typeof template.send_time})`);
      console.log(`      Minutes: ${template.send_time_minutes || 0}`);
      console.log(`      Display: ${timeDisplay}`);
      console.log(`      Active: ${template.is_active ? '✅' : '❌'}\n`);
    });

    // 3. Test specific templates
    console.log('3️⃣ Testing Specific Templates:');
    
    // Test 10:05 AM template
    const tenFiveTemplate = templates.find(t => 
      t.name.includes('10:05') || 
      (t.reminder_type === 'day_of' && t.send_time === '10' && t.send_time_minutes === 5)
    );
    
    if (tenFiveTemplate) {
      console.log('   ✅ Found 10:05 AM template:');
      console.log(`      ${formatTemplateTime(tenFiveTemplate)}`);
    } else {
      console.log('   ❌ 10:05 AM template not found');
    }

    // Test 30 minutes before template
    const thirtyMinTemplate = templates.find(t => 
      t.name.includes('30 Minutes') || 
      (t.reminder_type === 'hour_before' && t.send_time === '0' && t.send_time_minutes === 30)
    );
    
    if (thirtyMinTemplate) {
      console.log('   ✅ Found 30 minutes before template:');
      console.log(`      ${formatTemplateTime(thirtyMinTemplate)}`);
    } else {
      console.log('   ❌ 30 minutes before template not found');
    }

    // 4. Test scheduling logic
    console.log('\n4️⃣ Testing Scheduling Logic:');
    
    // Create a test reservation for tomorrow at 7:00 PM
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(19, 0, 0, 0); // 7:00 PM
    
    console.log(`   Test reservation: ${tomorrow.toLocaleString()}`);
    
    templates.forEach(template => {
      if (template.is_active) {
        const scheduledTime = calculateScheduledTime(template, tomorrow);
        console.log(`   ${template.name}: ${scheduledTime.toLocaleString()}`);
      }
    });

    console.log('\n✅ Minute-level precision test completed successfully!');

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

function formatTemplateTime(template) {
  if (template.reminder_type === 'hour_before') {
    let hours = 0, minutes = 0;
    
    if (typeof template.send_time === 'number') {
      hours = template.send_time;
    } else if (typeof template.send_time === 'string') {
      const parts = template.send_time.split(':');
      hours = parseInt(parts[0]);
      minutes = parts.length > 1 ? parseInt(parts[1]) : 0;
    }
    
    if (template.send_time_minutes !== undefined) {
      minutes = template.send_time_minutes;
    }
    
    let result = '';
    if (hours > 0) result += `${hours} Hour${hours === 1 ? '' : 's'}`;
    if (hours > 0 && minutes > 0) result += ' ';
    if (minutes > 0) result += `${minutes} Minute${minutes === 1 ? '' : 's'}`;
    if (!result) result = '0 Minutes';
    return result + ' Before';
  } else {
    let hours = 0, minutes = 0;
    
    if (typeof template.send_time === 'number') {
      hours = template.send_time;
    } else if (typeof template.send_time === 'string') {
      const parts = template.send_time.split(':');
      hours = parseInt(parts[0]);
      minutes = parts.length > 1 ? parseInt(parts[1]) : 0;
    }
    
    if (template.send_time_minutes !== undefined) {
      minutes = template.send_time_minutes;
    }
    
    const hour12 = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
    const ampm = hours < 12 ? 'AM' : 'PM';
    return `${hour12.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')} ${ampm}`;
  }
}

function calculateScheduledTime(template, reservationTime) {
  if (template.reminder_type === 'day_of') {
    let hours = 0, minutes = 0;
    
    if (typeof template.send_time === 'number') {
      hours = template.send_time;
    } else if (typeof template.send_time === 'string') {
      const parts = template.send_time.split(':');
      hours = parseInt(parts[0]);
      minutes = parts.length > 1 ? parseInt(parts[1]) : 0;
    }
    
    if (template.send_time_minutes !== undefined) {
      minutes = template.send_time_minutes;
    }
    
    const scheduledTime = new Date(reservationTime);
    scheduledTime.setHours(hours, minutes, 0, 0);
    return scheduledTime;
  } else {
    let hours = 0, minutes = 0;
    
    if (typeof template.send_time === 'number') {
      hours = template.send_time;
    } else if (typeof template.send_time === 'string') {
      const parts = template.send_time.split(':');
      hours = parseInt(parts[0]);
      minutes = parts.length > 1 ? parseInt(parts[1]) : 0;
    }
    
    if (template.send_time_minutes !== undefined) {
      minutes = template.send_time_minutes;
    }
    
    const scheduledTime = new Date(reservationTime);
    scheduledTime.setHours(scheduledTime.getHours() - hours);
    scheduledTime.setMinutes(scheduledTime.getMinutes() - minutes);
    return scheduledTime;
  }
}

testMinutePrecision(); 
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testWebhookFix() {
  console.log('Testing webhook fix...');
  
  try {
    // Simulate the availability check for today (Tuesday)
    const testDate = new Date();
    const dateStr = testDate.toISOString().split('T')[0];
    const dayOfWeek = testDate.getDay();
    
    console.log('Test date:', dateStr, 'Day of week:', dayOfWeek);
    
    // 1. Check for base hours
    const { data: baseHoursData, error: baseHoursError } = await supabase
      .from('venue_hours')
      .select('*')
      .eq('type', 'base')
      .eq('day_of_week', dayOfWeek);
    
    if (baseHoursError) {
      console.error('Error fetching base hours:', baseHoursError);
    }
    
    console.log('Base hours data for day', dayOfWeek, ':', baseHoursData);
    
    if (!baseHoursData || baseHoursData.length === 0) {
      console.log('No base hours found for day of week:', dayOfWeek);
      
      // Build base hours descriptor for all days
      const { data: allBaseHours, error: allBaseHoursError } = await supabase
        .from('venue_hours')
        .select('day_of_week, time_ranges')
        .eq('type', 'base');
      
      if (allBaseHoursError) {
        console.error('Error fetching all base hours:', allBaseHoursError);
      }
      
      console.log('All base hours data:', allBaseHours);
      
      if (allBaseHours && allBaseHours.length > 0) {
        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const availableDays = [];
        
        // Group by day and format
        for (let i = 0; i < 7; i++) {
          const dayHours = allBaseHours.filter(h => h.day_of_week === i);
          if (dayHours.length > 0) {
            const timeRanges = dayHours.flatMap(h => h.time_ranges || []);
            if (timeRanges.length > 0) {
              const formattedRanges = timeRanges.map(range => {
                const startTime = new Date(`2000-01-01T${range.start}:00`);
                const endTime = new Date(`2000-01-01T${range.end}:00`);
                
                const startStr = startTime.toLocaleTimeString('en-US', {
                  hour: 'numeric',
                  minute: '2-digit',
                  hour12: true
                });
                
                const endStr = endTime.toLocaleTimeString('en-US', {
                  hour: 'numeric',
                  minute: '2-digit',
                  hour12: true
                });
                
                return `${startStr} to ${endStr}`;
              });
              
              availableDays.push(`${dayNames[i]}s (${formattedRanges.join(' and ')})`);
            }
          }
        }
        
        const baseHoursDescriptor = availableDays.join(', ');
        
        console.log('✅ Would return proper message:', `Thank you for your reservation request. Noir is currently available for reservations on ${baseHoursDescriptor}. Please resubmit your reservation within these windows. Thank you.`);
        return;
      }
      
      console.log('✅ Would return: The venue is not open on this day of the week');
      return;
    }
    
    console.log('✅ Base hours found, would continue with availability check');
    
  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

// Run the test
testWebhookFix().then(() => {
  console.log('\nTest completed');
  process.exit(0);
}).catch(error => {
  console.error('Test failed:', error);
  process.exit(1);
}); 
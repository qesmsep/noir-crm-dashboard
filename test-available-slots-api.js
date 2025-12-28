/**
 * Test the available-slots API to see what it returns for 7:30pm today
 */

require('dotenv').config({ path: '.env.local' });
const { DateTime } = require('luxon');

async function testAvailableSlots() {
  const today = DateTime.now().setZone('America/Chicago');
  const dateStr = today.toFormat('yyyy-MM-dd');
  
  console.log(`Testing available-slots API for date: ${dateStr}`);
  console.log(`Testing party sizes: 2, 4, 6, 8\n`);
  
  for (const partySize of [2, 4, 6, 8]) {
    console.log(`\n=== Party Size: ${partySize} ===`);
    
    try {
      const response = await fetch('http://localhost:3000/api/available-slots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: dateStr, party_size: partySize })
      });
      
      if (!response.ok) {
        console.log(`  ❌ API Error: ${response.status} ${response.statusText}`);
        const errorText = await response.text();
        console.log(`  Error details: ${errorText}`);
        continue;
      }
      
      const data = await response.json();
      const slots = Array.isArray(data?.slots) ? data.slots : [];
      
      console.log(`  Total available slots: ${slots.length}`);
      
      // Check if 7:30pm is in the list
      const time730 = '7:30pm';
      const has730 = slots.includes(time730);
      
      if (has730) {
        console.log(`  ✅ 7:30pm IS AVAILABLE`);
      } else {
        console.log(`  ❌ 7:30pm IS NOT AVAILABLE`);
        // Show nearby times
        const nearby = slots.filter(s => {
          const [time, ampm] = s.split(/(am|pm)/);
          const [hour, min] = time.split(':').map(Number);
          let hour24 = hour;
          if (ampm === 'pm' && hour !== 12) hour24 += 12;
          if (ampm === 'am' && hour === 12) hour24 = 0;
          return hour24 === 19 && Math.abs(min - 30) <= 30;
        });
        if (nearby.length > 0) {
          console.log(`  Nearby times: ${nearby.join(', ')}`);
        }
      }
      
      if (slots.length > 0 && slots.length <= 20) {
        console.log(`  Available slots: ${slots.join(', ')}`);
      } else if (slots.length > 20) {
        console.log(`  First 10 slots: ${slots.slice(0, 10).join(', ')}...`);
      }
      
    } catch (error) {
      console.log(`  ❌ Request failed: ${error.message}`);
    }
  }
}

// Check if we're running in a Node environment that supports fetch
if (typeof fetch === 'undefined') {
  console.log('Note: This script requires Node 18+ with fetch support, or you can test manually via curl:');
  console.log('curl -X POST http://localhost:3000/api/available-slots -H "Content-Type: application/json" -d \'{"date":"2025-12-13","party_size":2}\'');
  process.exit(1);
}

testAvailableSlots().catch(console.error);




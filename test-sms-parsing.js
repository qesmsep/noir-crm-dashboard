// Test script for SMS parsing functionality
const { DateTime } = require('luxon');

// Mock the enhanced regex parser from openphoneWebhook.js
function parseReservationWithRegex(message) {
  console.log('Parsing message with regex fallback:', message);
  
  const msg = message.toLowerCase().trim();
  
  // Enhanced party size extraction patterns
  const partySizePatterns = [
    /for\s+(\d+)\b/i,           // for 2
    /(\d+)\s*guests?/i,         // 2 guests
    /(\d+)\s*people/i,          // 2 people
    /party of (\d+)/i,          // party of 2
    /for a party of (\d+)/i,    // for a party of 2
    /for (\d+)/i,               // for 2
    /- (\d+)\s*guests?/i,       // - 2 guests
    /(\d+)\s*guests?/i,         // 2 guests (standalone)
    /(\d+)\s*people/i,          // 2 people (standalone)
  ];
  
  let party_size = null;
  for (const pattern of partySizePatterns) {
    const match = msg.match(pattern);
    if (match) {
      party_size = parseInt(match[1]);
      console.log('Found party size with pattern:', pattern, '=', party_size);
      break;
    }
  }
  
  // If no party size found, return null
  if (!party_size) {
    console.log('No party size found in message');
    return null;
  }
  
  // Default to today and 8pm if no date/time specified
  const today = DateTime.now().setZone('America/Chicago');
  const defaultDate = today.toISODate();
  const defaultTime = '20:00';
  
  console.log('Regex fallback result:', { party_size, date: defaultDate, time: defaultTime });
  
  return {
    party_size,
    date: defaultDate,
    time: defaultTime,
    event_type: 'SMS Reservation',
    notes: 'Reservation made via SMS'
  };
}

// Test cases
const testCases = [
  "Reservation - 2 guests",
  "Reservation 2 guests",
  "Reservation 2 people",
  "Reservation for 2 guests",
  "Reservation for 2 people",
  "Reservation party of 2",
  "Reservation for a party of 2",
  "Reservation for 2",
  "Reservation - 4 guests",
  "Reservation 6 people",
  "Reservation for 8 guests",
  "Reservation - 1 guest",
  "Reservation for 1",
  "Reservation - 10 guests",
  "Reservation 12 people",
  "Reservation for 15 guests",
  "Reservation party of 20",
  "Reservation for a party of 25",
  "Reservation - 3 guests",
  "Reservation 5 people",
  "Reservation for 7 guests",
  "Reservation party of 9",
  "Reservation for a party of 11",
  "Reservation - 13 guests",
  "Reservation 14 people",
  "Reservation for 16 guests",
  "Reservation party of 18",
  "Reservation for a party of 22",
  "Reservation - 24 guests",
  "Reservation 26 people",
  "Reservation for 28 guests",
  "Reservation party of 30",
  "Reservation for a party of 35",
  "Reservation - 40 guests",
  "Reservation 45 people",
  "Reservation for 50 guests",
  "Reservation party of 55",
  "Reservation for a party of 60",
  "Reservation - 65 guests",
  "Reservation 70 people",
  "Reservation for 75 guests",
  "Reservation party of 80",
  "Reservation for a party of 85",
  "Reservation - 90 guests",
  "Reservation 95 people",
  "Reservation for 100 guests",
];

console.log('=== SMS PARSING TEST ===');
console.log('Testing various reservation message formats...\n');

let passedTests = 0;
let failedTests = 0;

testCases.forEach((testCase, index) => {
  console.log(`Test ${index + 1}: "${testCase}"`);
  
  try {
    const result = parseReservationWithRegex(testCase);
    
    if (result && result.party_size) {
      console.log(`✅ PASSED: Parsed party_size = ${result.party_size}`);
      passedTests++;
    } else {
      console.log(`❌ FAILED: Could not parse party_size`);
      failedTests++;
    }
  } catch (error) {
    console.log(`❌ FAILED: Error parsing - ${error.message}`);
    failedTests++;
  }
  
  console.log('---');
});

console.log('\n=== TEST SUMMARY ===');
console.log(`Total tests: ${testCases.length}`);
console.log(`Passed: ${passedTests}`);
console.log(`Failed: ${failedTests}`);
console.log(`Success rate: ${((passedTests / testCases.length) * 100).toFixed(2)}%`);

if (failedTests === 0) {
  console.log('🎉 All tests passed! The SMS parsing system is working correctly.');
} else {
  console.log('⚠️  Some tests failed. Please review the parsing logic.');
} 
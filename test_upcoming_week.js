// Test the upcoming week logic
function getNextWeekdayDate(weekday, testDate = null) {
  const today = testDate || new Date();
  const result = new Date(today);
  result.setHours(0, 0, 0, 0);
  
  const currentDay = today.getDay();
  
  // If it's Sunday (0), show next week's Thursday, Friday, Saturday
  if (currentDay === 0) {
    const daysUntilNextWeek = (weekday + 7 - currentDay) % 7;
    result.setDate(today.getDate() + daysUntilNextWeek);
  } else {
    // For all other days (Mon-Sat), show this week's Thursday, Friday, Saturday
    // Calculate days until the target weekday this week
    let daysToAdd = weekday - currentDay;
    if (daysToAdd <= 0) {
      // If the target day has passed this week, add 7 to get next week's
      daysToAdd += 7;
    }
    result.setDate(today.getDate() + daysToAdd);
  }
  
  return result;
}

// Test the function with current date
const today = new Date();
console.log('Today:', today.toLocaleDateString(), 'Day of week:', today.getDay());

const nextThursday = getNextWeekdayDate(4);
const nextFriday = getNextWeekdayDate(5);
const nextSaturday = getNextWeekdayDate(6);

console.log('Next Thursday:', nextThursday.toLocaleDateString());
console.log('Next Friday:', nextFriday.toLocaleDateString());
console.log('Next Saturday:', nextSaturday.toLocaleDateString());

// Test with different days of the week
const testDays = [
  new Date(2024, 0, 15), // Monday
  new Date(2024, 0, 16), // Tuesday
  new Date(2024, 0, 17), // Wednesday
  new Date(2024, 0, 18), // Thursday
  new Date(2024, 0, 19), // Friday
  new Date(2024, 0, 20), // Saturday
  new Date(2024, 0, 21), // Sunday
];

console.log('\nTesting with different days:');
testDays.forEach(testDate => {
  const thursday = getNextWeekdayDate(4, testDate);
  const friday = getNextWeekdayDate(5, testDate);
  const saturday = getNextWeekdayDate(6, testDate);
  
  console.log(`${testDate.toLocaleDateString()} (${['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][testDate.getDay()]}): Thu=${thursday.toLocaleDateString()}, Fri=${friday.toLocaleDateString()}, Sat=${saturday.toLocaleDateString()}`);
}); 
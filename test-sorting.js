// Test script to debug campaign sorting
const { calculateSortingOffset, sortCampaignTemplates } = require('./src/utils/campaignSorting.ts');

// Mock data based on the image
const testTemplates = [
  {
    id: '1',
    name: 'Balance',
    timing_type: 'specific_time',
    specific_time: '10:04',
    specific_time_quantity: 2,
    specific_time_unit: 'day',
    specific_time_proximity: 'after'
  },
  {
    id: '2', 
    name: 'House Account',
    timing_type: 'specific_time',
    specific_time: '10:00',
    specific_time_quantity: 1,
    specific_time_unit: 'day',
    specific_time_proximity: 'after'
  },
  {
    id: '3',
    name: 'Welcome to Noir',
    timing_type: 'duration',
    duration_quantity: 1,
    duration_unit: 'min',
    duration_proximity: 'after'
  }
];

console.log('Test templates:', testTemplates);

// Test individual offsets
testTemplates.forEach(template => {
  const offset = calculateSortingOffset(template);
  console.log(`${template.name}: ${offset} minutes`);
});

// Test sorting
const sorted = sortCampaignTemplates(testTemplates);
console.log('Sorted templates:', sorted.map(t => t.name)); 
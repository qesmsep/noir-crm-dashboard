// Test script for dynamic field mapping
const { FIELD_MAPPING, FIELD_TYPES, REQUIRED_FIELDS } = require('./config/typeform-mapping');

// Enhanced function to find answer in Typeform response
function findAnswer(answers, fieldRefs, type) {
  for (const ref of fieldRefs) {
    const answer = answers.find(
      a => (a.field.ref === ref || a.field.id === ref || a.field.title === ref) &&
           (!type || a.type === type)
    );
    
    if (answer) {
      // Extract value based on type
      if (type === 'choice' && answer.choice) return answer.choice.label;
      if (type === 'file_url' && answer.file_url) return answer.file_url;
      if (type === 'phone_number' && answer.phone_number) return answer.phone_number;
      if (type === 'email' && answer.email) return answer.email;
      if (type === 'date' && answer.date) return answer.date;
      if (type === 'long_text' && answer.text) return answer.text;
      if (answer.text) return answer.text;
      
      return null;
    }
  }
  return null;
}

// Function to extract all form data using dynamic mapping
function extractFormData(answers) {
  const data = {};
  
  Object.entries(FIELD_MAPPING).forEach(([dbField, fieldRefs]) => {
    const fieldType = FIELD_TYPES[dbField];
    const value = findAnswer(answers, fieldRefs, fieldType);
    if (value !== null) {
      data[dbField] = value;
    }
  });
  
  return data;
}

// Test with sample data
const testAnswers = [
  {
    field: {
      ref: 'Q1',
      id: 'first_name_field',
      title: 'First name'
    },
    type: 'text',
    text: 'John'
  },
  {
    field: {
      ref: 'Q2',
      id: 'last_name_field',
      title: 'Last name'
    },
    type: 'text',
    text: 'Doe'
  },
  {
    field: {
      ref: 'Q3',
      id: 'email_field',
      title: 'Email'
    },
    type: 'email',
    email: 'john.doe@example.com'
  },
  {
    field: {
      ref: 'Q4',
      id: 'phone_field',
      title: 'Phone number'
    },
    type: 'phone_number',
    phone_number: '+15551234567'
  },
  {
    field: {
      ref: 'Q5',
      id: 'company_field',
      title: 'Company'
    },
    type: 'text',
    text: 'Test Company'
  },
  {
    field: {
      ref: 'Q6',
      id: 'city_state_field',
      title: 'We\'re exploring where to bring the Noir experience next. What city and state do you call home?'
    },
    type: 'text',
    text: 'Overland Park, KS'
  },
  {
    field: {
      ref: 'Q7',
      id: 'referral_field',
      title: 'Who referred you to Noir\'s Membership?'
    },
    type: 'text',
    text: 'Friend'
  },
  {
    field: {
      ref: 'Q8',
      id: 'visit_frequency_field',
      title: 'How often do you see yourself visiting Noir?'
    },
    type: 'choice',
    choice: { label: '2x month' }
  },
  {
    field: {
      ref: 'Q9',
      id: 'go_to_drink_field',
      title: 'What\'s your go-to drink order?'
    },
    type: 'text',
    text: 'Cask & Blossom'
  }
];

console.log('Testing dynamic field mapping...');
console.log('Field mapping configuration:', FIELD_MAPPING);
console.log('Field types:', FIELD_TYPES);
console.log('Required fields:', REQUIRED_FIELDS);

const extractedData = extractFormData(testAnswers);
console.log('\nExtracted data:', extractedData);

// Validate required fields
const missingFields = REQUIRED_FIELDS.filter(field => !extractedData[field]);
if (missingFields.length > 0) {
  console.log('❌ Missing required fields:', missingFields);
} else {
  console.log('✅ All required fields present');
}

console.log('\n✅ Dynamic mapping test completed!'); 
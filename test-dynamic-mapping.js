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

// Test with actual Typeform data structure
const testAnswers = [
  {
    "type": "text",
    "text": "Testy",
    "field": {
      "id": "awkpAkWItTkD",
      "type": "short_text",
      "ref": "a229bb86-2442-4cbd-bdf6-c6f2cd4d4b9d"
    }
  },
  {
    "type": "text",
    "text": "Timmerson",
    "field": {
      "id": "vtsJcH4QqrKD",
      "type": "short_text",
      "ref": "9c123e7b-2643-4819-9b4d-4a9f236302c9"
    }
  },
  {
    "type": "phone_number",
    "phone_number": "+18584129797",
    "field": {
      "id": "KXH2CEFMTFdn",
      "type": "phone_number",
      "ref": "6ed12e4b-95a2-4b30-96b2-a7095f673db6"
    }
  },
  {
    "type": "email",
    "email": "tim@skylinerooftops.com",
    "field": {
      "id": "Nv9dEUvj5A1d",
      "type": "email",
      "ref": "ee4bcd7b-768d-49fb-b7cc-80cdd25c750a"
    }
  },
  {
    "type": "text",
    "text": "The New Forward",
    "field": {
      "id": "et3s7EMSamUX",
      "type": "short_text",
      "ref": "d32131fd-318b-4e39-8fcd-41eed4096d36"
    }
  },
  {
    "type": "text",
    "text": "KS",
    "field": {
      "id": "938oHZ5xsU7y",
      "type": "short_text",
      "ref": "f09c98b9-233e-46d9-870f-8220df2bd4f4"
    }
  },
  {
    "type": "text",
    "text": "The first time",
    "field": {
      "id": "o8Qtfm9EbAzQ",
      "type": "short_text",
      "ref": "dff5344e-93e0-4ae5-967c-b92e0ad51f65"
    }
  },
  {
    "type": "text",
    "text": "The only way",
    "field": {
      "id": "GUrKHIc9jUkD",
      "type": "short_text",
      "ref": "e63865bb-bfd2-4546-8bbe-d66946f66aa1"
    }
  },
  {
    "type": "text",
    "text": "The only reason",
    "field": {
      "id": "Je2OHV7ZoxrV",
      "type": "short_text",
      "ref": "2761aaee-1aa7-4ce8-b640-af2e0ebd18c7"
    }
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
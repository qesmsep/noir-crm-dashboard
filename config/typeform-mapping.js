// Typeform field mapping configuration
// Maps Typeform field refs/IDs to database column names
// Add new fields here when you update your Typeform

const FIELD_MAPPING = {
  // Core required fields - Updated with actual Typeform field refs
  'first_name': ['awkpAkWItTkD', 'a229bb86-2442-4cbd-bdf6-c6f2cd4d4b9d'],
  'last_name': ['vtsJcH4QqrKD', '9c123e7b-2643-4819-9b4d-4a9f236302c9'],
  'phone': ['KXH2CEFMTFdn', '6ed12e4b-95a2-4b30-96b2-a7095f673db6'],
  'email': ['Nv9dEUvj5A1d', 'ee4bcd7b-768d-49fb-b7cc-80cdd25c750a'],
  
  // Optional fields - Updated with actual Typeform field refs
  'company': ['et3s7EMSamUX', 'd32131fd-318b-4e39-8fcd-41eed4096d36'],
  'city_state': ['938oHZ5xsU7y', 'f09c98b9-233e-46d9-870f-8220df2bd4f4'],
  'referral': ['o8Qtfm9EbAzQ', 'dff5344e-93e0-4ae5-967c-b92e0ad51f65'],
  'visit_frequency': ['GUrKHIc9jUkD', 'e63865bb-bfd2-4546-8bbe-d66946f66aa1'],
  'go_to_drink': ['Je2OHV7ZoxrV', '2761aaee-1aa7-4ce8-b640-af2e0ebd18c7'],
  
  // Future fields - uncomment and update when you add them to Typeform
  // 'occupation': ['Q10', 'occupation_field', 'What is your occupation?'],
  // 'industry': ['Q11', 'industry_field', 'What industry do you work in?'],
  // 'budget': ['Q12', 'budget_field', 'What is your monthly entertainment budget?'],
  // 'membership_type': ['Q13', 'membership_type_field', 'What type of membership are you interested in?'],
  // 'special_requests': ['Q14', 'special_requests_field', 'Any special requests or notes?'],
};

// Field type mapping for proper value extraction
const FIELD_TYPES = {
  'email': 'email',
  'phone': 'phone_number',
  'first_name': 'text',
  'last_name': 'text',
  'company': 'text',
  'city_state': 'text',
  'referral': 'text',
  'visit_frequency': 'choice',
  'go_to_drink': 'text',
  // 'occupation': 'text',
  // 'industry': 'choice',
  // 'budget': 'choice',
  // 'membership_type': 'choice',
  // 'special_requests': 'long_text',
};

// Required fields that must be present for a valid submission
const REQUIRED_FIELDS = ['first_name', 'last_name', 'email', 'phone'];

module.exports = {
  FIELD_MAPPING,
  FIELD_TYPES,
  REQUIRED_FIELDS
}; 
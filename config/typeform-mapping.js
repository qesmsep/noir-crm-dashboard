// Typeform field mapping configuration
// Maps Typeform field refs/IDs to database column names
// Add new fields here when you update your Typeform

const FIELD_MAPPING = {
  // Core required fields
  'first_name': ['Q1', 'first_name_field', 'First name'],
  'last_name': ['Q2', 'last_name_field', 'Last name'],
  'email': ['Q3', 'email_field', 'Email'],
  'phone': ['Q4', 'phone_field', 'Phone number'],
  
  // Optional fields
  'company': ['Q5', 'company_field', 'Company'],
  'city_state': ['Q6', 'city_state_field', 'We\'re exploring where to bring the Noir experience next. What city and state do you call home?'],
  'referral': ['Q7', 'referral_field', 'Who referred you to Noir\'s Membership?'],
  'visit_frequency': ['Q8', 'visit_frequency_field', 'How often do you see yourself visiting Noir?'],
  'go_to_drink': ['Q9', 'go_to_drink_field', 'What\'s your go-to drink order?'],
  
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
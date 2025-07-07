// Sample questionnaires based on screenshots, in order by timestamp

export const sampleQuestionnaires = [
  // Questionnaire 1 (earlier timestamp)
  {
    id: 'q1',
    name: 'Noir Membership Application',
    description: 'Please provide your basic information.',
    questions: [
      { question_text: 'First name', question_type: 'text', is_required: true, placeholder: 'Jane' },
      { question_text: 'Last name', question_type: 'text', is_required: true, placeholder: 'Smith' },
      { question_text: 'Phone number', question_type: 'phone', is_required: true, placeholder: '(201) 555-0123' },
      { question_text: 'Email', question_type: 'text', is_required: true, placeholder: 'name@example.com' },
      { question_text: 'Company', question_type: 'text', is_required: true, placeholder: 'Acme Corporation' },
      { question_text: 'Who referred you to become a Noir Member?', question_type: 'text', is_required: true, description: 'While not required, it definitely helps to have a Noir Member as a referral. Otherwise, please state how you heard about the Noir Membership.' },
      { question_text: 'What city and state do you call home?', question_type: 'text', is_required: false, description: 'Description (optional)' },
      { question_text: 'What\'s your go-to drink order?', question_type: 'text', is_required: true, description: 'Description (optional)' },
      { question_text: 'How often do you see yourself visiting Noir?', question_type: 'text', is_required: true, description: 'Description (optional)' },
      { question_text: 'Please provide your date of birth.', question_type: 'date', is_required: true, description: 'Must be over 21 to be a member' },
      { question_text: 'Please upload a photo of yourself so our team can recognize you upon arrival.', question_type: 'photo', is_required: true, description: 'Please make sure we can see your face clearly. Thank you!' },
    ],
    faq: [
      'What happens to unused beverage credit? Your beverage credit rolls over month-to-month.',
      'What can I use the credit for? Your monthly credit covers your time at Noir—for you and your guests. All orders can go on your house account, so you can settle tabs however you prefer.',
      'Can my guests visit without me? Guests must be accompanied by a Noir Member. You may add a partner via the Duo account for $25/month -- Partners receive the same member benefits under your house account. Currently only one partner per account.',
      'How do I make reservations? Simply text us or use the traditional online system. We\'ll confirm availability and hold your spot. Currently, we\'re accepting reservations up to 2 weeks out.',
      'How do Noir events work? Events are ticketed and available first come, first served. We try to host 2+ curated gatherings each month depending on the season.',
      'Is there a minimum commitment? Nope. Cancel anytime. Memberships and dues paid are non-refundable.',
      'What if I spend more than my credit? No problem. Any overages are applied to your house account and settled before your next renewal.',
      'Can I transfer or gift my credit? Credit is non-transferable and for member use only.'
    ],
    thankYou: {
      message: 'Thank you. Your request has been received. You\'ll be notified of our decision soon.',
      faqPrompt: 'see below for FAQ (scroll)\n|\n|\nV',
    },
  },
  // Questionnaire 2 (later timestamp)
  {
    id: 'q2',
    name: 'Noir Partner Information',
    description: 'What is your partner\'s information?',
    questions: [
      { question_text: 'First name', question_type: 'text', is_required: true, placeholder: 'Jane' },
      { question_text: 'Last name', question_type: 'text', is_required: true, placeholder: 'Smith' },
      { question_text: 'Phone number', question_type: 'phone', is_required: true, placeholder: '(201) 555-0123' },
      { question_text: 'Email', question_type: 'text', is_required: true, placeholder: 'name@example.com' },
      { question_text: 'What\'s your address?', question_type: 'text', is_required: true, description: 'Description (optional)' },
      { question_text: 'Address line 2', question_type: 'text', is_required: false },
      { question_text: 'City/Town', question_type: 'text', is_required: true },
      { question_text: 'State/Region/Province', question_type: 'text', is_required: true },
      { question_text: 'Please upload a photo of your partner so our team can recognize them upon arrival.', question_type: 'photo', is_required: true, description: 'Description (optional)' },
      { question_text: 'Who referred you to Noir\'s Membership?', question_type: 'text', is_required: true, description: 'Description (optional)' },
    ],
  },
]; 
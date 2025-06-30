// Test script for Add Member functionality
const testMemberData = {
  account_id: "550e8400-e29b-41d4-a716-446655440000",
  primary_member: {
    member_id: "550e8400-e29b-41d4-a716-446655440001",
    account_id: "550e8400-e29b-41d4-a716-446655440000",
    first_name: "Test",
    last_name: "Member",
    email: "test@example.com",
    phone: "+1234567890",
    membership: "Membership",
    monthly_dues: 100,
    member_type: "primary",
    join_date: new Date().toISOString().split('T')[0],
    created_at: new Date().toISOString()
  }
};

async function testAddMember() {
  try {
    console.log('Testing Add Member API...');
    console.log('Sending data:', JSON.stringify(testMemberData, null, 2));
    
    const response = await fetch('http://localhost:3000/api/members', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testMemberData),
    });

    console.log('Response status:', response.status);
    
    if (!response.ok) {
      const errorData = await response.text();
      console.error('Error response:', errorData);
      return;
    }

    const result = await response.json();
    console.log('Success! Response:', JSON.stringify(result, null, 2));
    
    // Test GET to verify the member was added
    console.log('\nTesting GET to verify member was added...');
    const getResponse = await fetch('http://localhost:3000/api/members');
    const getResult = await getResponse.json();
    
    const addedMember = getResult.data.find(m => m.member_id === testMemberData.primary_member.member_id);
    if (addedMember) {
      console.log('✅ Member successfully added and found in database!');
      console.log('Added member:', JSON.stringify(addedMember, null, 2));
    } else {
      console.log('❌ Member not found in database after adding');
    }
    
  } catch (error) {
    console.error('Test failed:', error);
  }
}

testAddMember(); 
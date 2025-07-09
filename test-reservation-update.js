const fetch = require('node-fetch');

async function testReservationUpdate() {
  try {
    // First, let's get a list of reservations to find one to update
    console.log('Fetching reservations...');
    const reservationsResponse = await fetch('http://localhost:3000/api/reservations');
    const reservationsData = await reservationsResponse.json();
    
    if (!reservationsData.data || reservationsData.data.length === 0) {
      console.log('No reservations found to test with');
      return;
    }
    
    const testReservation = reservationsData.data[0];
    console.log('Testing with reservation:', testReservation.id);
    
    // Test update data
    const updateData = {
      first_name: testReservation.first_name + ' (TEST)',
      notes: 'Test update from script - ' + new Date().toISOString()
    };
    
    console.log('Sending update data:', updateData);
    
    // Send PATCH request
    const updateResponse = await fetch(`http://localhost:3000/api/reservations/${testReservation.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updateData)
    });
    
    console.log('Update response status:', updateResponse.status);
    
    if (updateResponse.ok) {
      const result = await updateResponse.json();
      console.log('Update successful:', result);
    } else {
      const errorText = await updateResponse.text();
      console.error('Update failed:', errorText);
    }
    
  } catch (error) {
    console.error('Test failed:', error);
  }
}

testReservationUpdate(); 
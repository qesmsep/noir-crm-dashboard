// Test script for the updated Typeform webhook
// This tests the new logic: partner detection, required fields, photo validation, etc.

const testTypeformWebhook = async () => {
  console.log('🧪 Testing Updated Typeform Webhook');
  console.log('====================================');

  // Test data based on the provided Typeform response
  const typeformData = {
    form_response: {
      response_id: "test_updated_webhook_123",
      submitted_at: "2025-07-11T17:15:32Z",
      answers: [
        {
          field: {
            id: "6qLI0IyFrNpc",
            ref: "a229bb86-2442-4cbd-bdf6-c6f2cd4d4b9d"
          },
          type: "text",
          text: "Tim"
        },
        {
          field: {
            id: "MShnAqNi5wsk",
            ref: "9c123e7b-2643-4819-9b4d-4a9f236302c9"
          },
          type: "text",
          text: "Johnson"
        },
        {
          field: {
            id: "5MSbFaP1guv8",
            ref: "6ed12e4b-95a2-4b30-96b2-a7095f673db6"
          },
          type: "phone_number",
          phone_number: "+18584129797"
        },
        {
          field: {
            id: "uzf0zMHzGIzu",
            ref: "ee4bcd7b-768d-49fb-b7cc-80cdd25c750a"
          },
          type: "email",
          email: "tim@828.life"
        },
        {
          field: {
            id: "QPvXZKSgxkDF",
            ref: "d32131fd-318b-4e39-8fcd-41eed4096d36"
          },
          type: "text",
          text: "Testing Company"
        },
        {
          field: {
            id: "4jCNAqvXTvDs",
            ref: "1432cfc0-d3dc-48fc-8561-bf0053ccc097"
          },
          type: "date",
          date: "1982-08-28"
        },
        {
          field: {
            id: "4pO7SKmbMMV3",
            ref: "d8ef8992-e207-4165-a296-67dd22de7cc6"
          },
          type: "text",
          text: "65 hanswen way"
        },
        {
          field: {
            id: "7q54jlHvCRXY",
            ref: "fb3d4079-af85-4914-962a-71c9316b89e2"
          },
          type: "text",
          text: "apartment 4"
        },
        {
          field: {
            id: "UgakS8KppoxC",
            ref: "b70d8409-0f17-4bc8-9e12-35f8b50d1e74"
          },
          type: "text",
          text: "Palo alto"
        },
        {
          field: {
            id: "Ru8GpaQGZsX8",
            ref: "9ab3b62d-a361-480a-856c-7200224f65ac"
          },
          type: "text",
          text: "ca"
        },
        {
          field: {
            id: "ViMJ4bP3cg2D",
            ref: "f79dcd7d-a82d-4fca-8987-85014e42e115"
          },
          type: "text",
          text: "94304"
        },
        {
          field: {
            id: "aoJ0NrrsfD84",
            ref: "8e920793-22ca-4c89-a25e-2b76407e171f"
          },
          type: "text",
          text: "us"
        },
        {
          field: {
            id: "OEIj5ZgluN2b",
            ref: "ddc3eeeb-f2ae-4070-846d-c3194008d0d9"
          },
          type: "file_url",
          file_url: "https://api.typeform.com/responses/files/489c76f5087f861990e21e4da26244068225d896ace2160661e79afcfb95adb0/Photo.pdf"
        },
        {
          field: {
            id: "zF7YpzOEoOxD",
            ref: "f0b72d00-d153-4030-9644-cb3ab890f7dc"
          },
          type: "boolean",
          boolean: true
        },
        {
          field: {
            id: "3JRx5oRJ4wAe",
            ref: "4418ddd8-d940-4896-9589-565b78c252c8"
          },
          type: "text",
          text: "Jane"
        },
        {
          field: {
            id: "1rQhgOAYFFIc",
            ref: "ac1b6049-8826-4f71-a748-bbbb41c2ce9e"
          },
          type: "text",
          text: "Smith"
        },
        {
          field: {
            id: "HRSK6ibOeAyv",
            ref: "9c2688e3-34c0-4da0-8e17-c44a81778cf3"
          },
          type: "phone_number",
          phone_number: "+12015551654"
        },
        {
          field: {
            id: "SwsaJ7Q8EsKg",
            ref: "b9cde49b-3a69-4181-a738-228f5a11f27c"
          },
          type: "email",
          email: "jane@example.com"
        },
        {
          field: {
            id: "Ygcjj39ciLzc",
            ref: "c1f6eef0-4884-49e6-8928-c803b60a115f"
          },
          type: "text",
          text: "Acme Corporation"
        },
        {
          field: {
            id: "xRd5epCwz1nw",
            ref: "b6623266-477c-47aa-99fc-2311888fc733"
          },
          type: "date",
          date: "1985-12-16"
        },
        {
          field: {
            id: "OpkYr2OlDiH2",
            ref: "95940d74-dda1-4531-be16-ffd01839c49f"
          },
          type: "file_url",
          file_url: "https://api.typeform.com/responses/files/77d1412d741761c9bba37e1e6ff925cbf37e13e873026ce8d9d3f964d50e2133/Screenshot_2025_05_28_at_8.41.28_AM.png"
        },
        {
          field: {
            id: "dwULVwUBk9OF",
            ref: "dff5344e-93e0-4ae5-967c-b92e0ad51f65"
          },
          type: "text",
          text: "Tim"
        }
      ]
    }
  };

  console.log('\n📋 Test Data Summary:');
  console.log('- Primary Member: Tim Johnson (tim@828.life)');
  console.log('- Partner: Jane Smith (jane@example.com)');
  console.log('- Company: Testing Company');
  console.log('- Partner Question: Yes (should create Duo membership)');
  console.log('- Photos: Both provided');

  try {
    console.log('\n🚀 Testing webhook...');
    const response = await fetch('http://localhost:3000/api/typeformSync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(typeformData)
    });

    const result = await response.json();
    console.log('\n📊 Response Status:', response.status);
    console.log('📊 Response Body:', JSON.stringify(result, null, 2));

    if (response.ok) {
      console.log('\n✅ Webhook test passed!');
      console.log('Expected behavior:');
      console.log('- Created account with UUID');
      console.log('- Created 2 member records (Tim + Jane)');
      console.log('- Set membership type to "Duo" ($125/month)');
      console.log('- Validated required fields and photos');
      console.log('- Triggered followup campaign');
    } else {
      console.log('\n❌ Webhook test failed!');
      console.log('Error:', result.error);
      if (result.missingFields) {
        console.log('Missing fields:', result.missingFields);
      }
    }
  } catch (error) {
    console.error('\n❌ Error testing webhook:', error);
  }

  // Test 2: Solo membership (no partner)
  console.log('\n\n🧪 Test 2: Solo Membership (No Partner)');
  console.log('==========================================');

  const soloData = {
    form_response: {
      response_id: "test_solo_membership_123",
      submitted_at: "2025-07-11T17:15:32Z",
      answers: [
        {
          field: { ref: "a229bb86-2442-4cbd-bdf6-c6f2cd4d4b9d" },
          type: "text",
          text: "John"
        },
        {
          field: { ref: "9c123e7b-2643-4819-9b4d-4a9f236302c9" },
          type: "text",
          text: "Doe"
        },
        {
          field: { ref: "6ed12e4b-95a2-4b30-96b2-a7095f673db6" },
          type: "phone_number",
          phone_number: "+15551234567"
        },
        {
          field: { ref: "ee4bcd7b-768d-49fb-b7cc-80cdd25c750a" },
          type: "email",
          email: "john@example.com"
        },
        {
          field: { ref: "d32131fd-318b-4e39-8fcd-41eed4096d36" },
          type: "text",
          text: "Solo Company"
        },
        {
          field: { ref: "1432cfc0-d3dc-48fc-8561-bf0053ccc097" },
          type: "date",
          date: "1990-01-01"
        },
        {
          field: { ref: "d8ef8992-e207-4165-a296-67dd22de7cc6" },
          type: "text",
          text: "123 Main St"
        },
        {
          field: { ref: "b70d8409-0f17-4bc8-9e12-35f8b50d1e74" },
          type: "text",
          text: "San Francisco"
        },
        {
          field: { ref: "9ab3b62d-a361-480a-856c-7200224f65ac" },
          type: "text",
          text: "CA"
        },
        {
          field: { ref: "f79dcd7d-a82d-4fca-8987-85014e42e115" },
          type: "text",
          text: "94102"
        },
        {
          field: { ref: "8e920793-22ca-4c89-a25e-2b76407e171f" },
          type: "text",
          text: "US"
        },
        {
          field: { ref: "ddc3eeeb-f2ae-4070-846d-c3194008d0d9" },
          type: "file_url",
          file_url: "https://example.com/photo.jpg"
        },
        {
          field: { ref: "f0b72d00-d153-4030-9644-cb3ab890f7dc" },
          type: "boolean",
          boolean: false
        },
        {
          field: { ref: "dff5344e-93e0-4ae5-967c-b92e0ad51f65" },
          type: "text",
          text: "Friend"
        }
      ]
    }
  };

  try {
    console.log('\n🚀 Testing solo membership...');
    const soloResponse = await fetch('http://localhost:3000/api/typeformSync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(soloData)
    });

    const soloResult = await soloResponse.json();
    console.log('\n📊 Solo Response Status:', soloResponse.status);
    console.log('📊 Solo Response Body:', JSON.stringify(soloResult, null, 2));

    if (soloResponse.ok) {
      console.log('\n✅ Solo membership test passed!');
      console.log('Expected behavior:');
      console.log('- Created account with UUID');
      console.log('- Created 1 member record (John)');
      console.log('- Set membership type to "Solo" ($100/month)');
      console.log('- No photo validation required for solo');
    } else {
      console.log('\n❌ Solo membership test failed!');
      console.log('Error:', soloResult.error);
    }
  } catch (error) {
    console.error('\n❌ Error testing solo membership:', error);
  }

  console.log('\n🎉 All tests completed!');
};

// Run the test
testTypeformWebhook().catch(console.error); 
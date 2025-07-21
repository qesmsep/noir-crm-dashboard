const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

async function testUpload() {
  console.log('🧪 Testing file upload API...\n');

  try {
    // Create a test file
    const testContent = 'This is a test file content';
    const testFilePath = '/tmp/test-file.txt';
    fs.writeFileSync(testFilePath, testContent);

    // Create form data
    const formData = new FormData();
    formData.append('file', fs.createReadStream(testFilePath));
    formData.append('ledgerId', '0fac5cd5-9b49-4a77-adbf-2c29ac4584ad');
    formData.append('memberId', '081d8a5d-9cae-4ebf-88e0-a3c7e9948fd6');
    formData.append('accountId', 'c162a3b7-b3af-44ae-90a7-bab901028a21');

    console.log('📤 Sending upload request...');
    console.log('URL: http://localhost:3000/api/transaction-attachments/upload');
    console.log('File:', testFilePath);

    // Make the request
    const response = await fetch('http://localhost:3000/api/transaction-attachments/upload', {
      method: 'POST',
      body: formData,
      headers: {
        ...formData.getHeaders(),
      },
    });

    console.log('\n📥 Response received:');
    console.log('Status:', response.status);
    console.log('Headers:', Object.fromEntries(response.headers.entries()));

    const responseText = await response.text();
    console.log('Response body:', responseText);

    if (response.ok) {
      console.log('\n✅ Upload successful!');
    } else {
      console.log('\n❌ Upload failed!');
    }

    // Clean up test file
    fs.unlinkSync(testFilePath);

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
  }
}

// Check if server is running
async function checkServer() {
  try {
    const response = await fetch('http://localhost:3000/api/transaction-attachments/0fac5cd5-9b49-4a77-adbf-2c29ac4584ad');
    console.log('✅ Server is running (status:', response.status, ')');
    return true;
  } catch (error) {
    console.log('❌ Server not running or not accessible');
    console.log('💡 Make sure to run: npm run dev');
    return false;
  }
}

async function main() {
  console.log('🔍 Upload Debug Test\n');
  
  const serverRunning = await checkServer();
  if (serverRunning) {
    await testUpload();
  }
}

main(); 
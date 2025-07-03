const puppeteer = require('puppeteer');

async function testMobileFixes() {
  console.log('🧪 Testing mobile fixes...');
  
  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: {
      width: 375,
      height: 667,
      isMobile: true,
      hasTouch: true
    }
  });

  try {
    const page = await browser.newPage();
    
    // Navigate to the application
    console.log('📱 Loading application...');
    await page.goto('http://localhost:3003', { waitUntil: 'networkidle0' });
    
    // Test 1: Check if menu modal opens and displays full image
    console.log('🍽️ Testing menu modal...');
    await page.waitForSelector('button[aria-label="Open Noir Menu"]');
    await page.click('button[aria-label="Open Noir Menu"]');
    
    // Wait for modal to appear
    await page.waitForSelector('.react-modal__content img');
    
    // Check if image is visible and properly sized
    const imageElement = await page.$('.react-modal__content img');
    const imageBox = await imageElement.boundingBox();
    
    console.log(`📏 Menu image dimensions: ${imageBox.width}x${imageBox.height}`);
    
    if (imageBox.width > 0 && imageBox.height > 0) {
      console.log('✅ Menu modal displays image correctly');
    } else {
      console.log('❌ Menu modal image not displaying correctly');
    }
    
    // Close modal
    await page.click('button[aria-label="Close Menu"]');
    
    // Test 2: Check reservation form accessibility
    console.log('📋 Testing reservation form...');
    
    // Scroll to reservation section
    await page.evaluate(() => {
      document.getElementById('reserve').scrollIntoView();
    });
    
    await page.waitForTimeout(1000);
    
    // Check if reservation buttons are visible
    const memberButton = await page.$('button:contains("Noir Members")');
    const nonMemberButton = await page.$('button:contains("Non-Members")');
    
    if (memberButton && nonMemberButton) {
      console.log('✅ Reservation buttons are visible');
    } else {
      console.log('❌ Reservation buttons not found');
    }
    
    // Test 3: Check form validation
    console.log('✅ Testing form validation...');
    
    // Click on non-member button to open form
    await page.click('button:contains("Non-Members")');
    await page.waitForTimeout(500);
    
    // Try to submit without filling required fields
    const submitButton = await page.$('button[type="submit"]');
    if (submitButton) {
      await submitButton.click();
      await page.waitForTimeout(1000);
      
      // Check for validation messages
      const errorMessages = await page.$$('text="Phone number is required"');
      if (errorMessages.length > 0) {
        console.log('✅ Form validation is working');
      } else {
        console.log('❌ Form validation not working');
      }
    }
    
    console.log('🎉 Mobile testing completed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  } finally {
    await browser.close();
  }
}

// Run the test
testMobileFixes().catch(console.error); 
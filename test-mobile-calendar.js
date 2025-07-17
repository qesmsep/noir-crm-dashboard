// Test script for mobile calendar functionality
const puppeteer = require('puppeteer');

async function testMobileCalendar() {
  console.log('🧪 Testing Mobile Calendar Functionality...');
  
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
    
    // Set mobile user agent
    await page.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1');
    
    // Navigate to the calendar page
    console.log('📱 Navigating to calendar page...');
    await page.goto('http://localhost:3000/admin/calendar', { waitUntil: 'networkidle0' });
    
    // Wait for the calendar to load
    await page.waitForSelector('.fc', { timeout: 10000 });
    
    // Test 1: Check if calendar fills the screen
    console.log('✅ Test 1: Checking if calendar fills the screen...');
    const calendarElement = await page.$('.fc');
    const calendarBox = await calendarElement.boundingBox();
    
    if (calendarBox.width >= 350 && calendarBox.height >= 500) {
      console.log('✅ Calendar fills the screen correctly');
    } else {
      console.log('❌ Calendar does not fill the screen properly');
    }
    
    // Test 2: Check if resource column shows only numbers
    console.log('✅ Test 2: Checking resource column format...');
    const resourceTitles = await page.$$eval('.fc-resource-title', elements => 
      elements.map(el => el.textContent.trim())
    );
    
    const hasOnlyNumbers = resourceTitles.every(title => /^\d+$/.test(title));
    if (hasOnlyNumbers) {
      console.log('✅ Resource column shows only table numbers');
    } else {
      console.log('❌ Resource column still shows "Table" prefix');
    }
    
    // Test 3: Check if pinch zoom is enabled
    console.log('✅ Test 3: Checking pinch zoom support...');
    const touchAction = await page.$eval('.fc', el => 
      window.getComputedStyle(el).touchAction
    );
    
    if (touchAction.includes('pinch-zoom')) {
      console.log('✅ Pinch zoom is enabled');
    } else {
      console.log('❌ Pinch zoom is not enabled');
    }
    
    // Test 4: Check mobile-specific elements are hidden
    console.log('✅ Test 4: Checking mobile optimizations...');
    const viewButton = await page.$eval('body', () => {
      const buttons = Array.from(document.querySelectorAll('button'));
      return buttons.find(btn => btn.textContent.includes('View'));
    });
    const privateEventsSection = await page.$eval('body', () => {
      const divs = Array.from(document.querySelectorAll('div'));
      return divs.find(div => div.textContent.includes('Private Events'));
    });
    
    if (!viewButton && !privateEventsSection) {
      console.log('✅ Mobile-optimized elements are properly hidden');
    } else {
      console.log('❌ Some mobile optimizations are not working');
    }
    
    console.log('🎉 Mobile calendar tests completed!');
    
    // Keep browser open for manual testing
    console.log('🔍 Browser will remain open for manual testing. Close it when done.');
    await new Promise(resolve => setTimeout(resolve, 30000));
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  } finally {
    await browser.close();
  }
}

// Run the test
testMobileCalendar().catch(console.error); 
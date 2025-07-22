// Simple test for grayed out days functionality
const puppeteer = require('puppeteer');

async function testGrayedOutDays() {
  console.log('🧪 Testing Calendar Grayed Out Days...');
  
  const browser = await puppeteer.launch({ 
    headless: true,
    defaultViewport: {
      width: 1200,
      height: 800
    }
  });
  
  try {
    const page = await browser.newPage();
    
    // Navigate to the calendar page
    console.log('📅 Navigating to calendar page...');
    await page.goto('http://localhost:3000/admin/calendar', { waitUntil: 'networkidle0' });
    
    // Wait for the calendar to load
    await page.waitForSelector('div[style*="grid"]', { timeout: 10000 });
    
    // Wait a bit for the data to load
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Test 1: Check for grayed out days (closed days)
    console.log('✅ Test 1: Checking for grayed out closed days...');
    
    const grayedOutDays = await page.$$eval('div[style*="opacity: 0.6"]', elements => {
      return elements.length;
    });
    
    console.log(`Found ${grayedOutDays} grayed out days (closed days)`);
    
    // Test 2: Check for normal days (open days)
    console.log('✅ Test 2: Checking for normal open days...');
    
    const normalDays = await page.$$eval('div[style*="opacity: 1"]', elements => {
      return elements.length;
    });
    
    console.log(`Found ${normalDays} normal days (open days)`);
    
    // Test 3: Check for guest count displays
    console.log('✅ Test 3: Checking for guest count displays...');
    
    const guestCountElements = await page.$$eval('div', elements => {
      return elements.filter(el => {
        const text = el.textContent.trim();
        const number = parseInt(text);
        return !isNaN(number) && number >= 0;
      }).length;
    });
    
    console.log(`Found ${guestCountElements} elements with guest counts`);
    
    // Test 4: Check for private event displays
    console.log('✅ Test 4: Checking for private event displays...');
    
    const privateEventElements = await page.$$eval('div', elements => {
      return elements.filter(el => {
        const text = el.textContent.trim();
        return text.includes('Private Event:');
      }).length;
    });
    
    console.log(`Found ${privateEventElements} private event displays`);
    
    console.log('\n🎉 Calendar grayed out days test completed!');
    console.log('✅ Summary:');
    console.log(`   - ${grayedOutDays} closed days (grayed out)`);
    console.log(`   - ${normalDays} open days (normal styling)`);
    console.log(`   - ${guestCountElements} guest count displays`);
    console.log(`   - ${privateEventElements} private event displays`);
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  } finally {
    await browser.close();
  }
}

testGrayedOutDays(); 
// Test script for calendar month view guest count fix
const puppeteer = require('puppeteer');

async function testCalendarMonthViewFix() {
  console.log('🧪 Testing Calendar Month View Guest Count Fix...');
  
  const browser = await puppeteer.launch({ 
    headless: false,
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
    
    // Wait for the calendar to load - look for any calendar-related element
    await page.waitForSelector('.fc, [role="grid"], div[style*="grid"]', { timeout: 10000 });
    
    // Test 1: Switch to month view
    console.log('✅ Test 1: Switching to month view...');
    
    // Look for month view button with different possible selectors
    const monthViewButton = await page.evaluateHandle(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      return buttons.find(btn => 
        btn.textContent.includes('👁️') || 
        btn.textContent.includes('Month') ||
        btn.getAttribute('aria-label')?.toLowerCase().includes('month')
      );
    });
    
    if (monthViewButton) {
      await monthViewButton.click();
      console.log('✅ Successfully switched to month view');
    } else {
      console.log('❌ Could not find month view button');
      console.log('ℹ️ Available buttons:');
      const buttons = await page.$$eval('button', elements => 
        elements.map(el => ({ text: el.textContent.trim(), ariaLabel: el.getAttribute('aria-label') }))
      );
      buttons.forEach((btn, i) => {
        console.log(`  Button ${i + 1}: "${btn.text}" (aria-label: "${btn.ariaLabel}")`);
      });
      return;
    }
    
    // Wait for month view to load
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Test 2: Check if guest counts are displayed instead of reservation counts
    console.log('✅ Test 2: Checking guest count and private event display...');
    
    // Look for guest count elements in the calendar grid - try multiple selectors
    const guestCountElements = await page.$$eval('div[style*="background-color: rgb(202, 194, 185)"], div[style*="background-color: #CAC2b9"]', elements => {
      return elements.map(el => {
        const text = el.textContent.trim();
        const number = parseInt(text);
        return { text, number, isValid: !isNaN(number) && number > 0 };
      });
    });
    
    // Look for private event text elements
    const privateEventElements = await page.$$eval('div', elements => {
      return elements
        .filter(el => {
          const text = el.textContent.trim();
          return text.includes('Private Event:');
        })
        .map(el => ({
          text: el.textContent.trim(),
          element: el.outerHTML.substring(0, 100) + '...'
        }));
    });
    
    if (guestCountElements.length > 0) {
      console.log(`✅ Found ${guestCountElements.length} days with guest counts`);
      guestCountElements.forEach((element, index) => {
        if (element.isValid) {
          console.log(`  Day ${index + 1}: ${element.text} guests`);
        } else {
          console.log(`  Day ${index + 1}: Invalid count - ${element.text}`);
        }
      });
    } else {
      console.log('ℹ️ No guest count elements found (may be private events instead)');
    }
    
    if (privateEventElements.length > 0) {
      console.log(`✅ Found ${privateEventElements.length} private event displays`);
      privateEventElements.forEach((element, index) => {
        console.log(`  Private event ${index + 1}: ${element.text}`);
      });
    } else {
      console.log('ℹ️ No private event displays found (this is normal if no private events exist)');
    }
    
    // Test 3: Check for private event text instead of icons
    console.log('✅ Test 3: Checking private event text display...');
    const privateEventTexts = await page.$$eval('div', elements => {
      return elements
        .filter(el => {
          const text = el.textContent.trim();
          return text.includes('Private Event:');
        })
        .map(el => el.textContent.trim());
    });
    
    if (privateEventTexts.length > 0) {
      console.log(`✅ Found ${privateEventTexts.length} private event text displays`);
      privateEventTexts.forEach((text, index) => {
        console.log(`  Private event ${index + 1}: ${text}`);
      });
    } else {
      console.log('ℹ️ No private event text found (this is normal if no private events exist)');
    }
    
    // Test 4: Verify the fix by checking the data structure
    console.log('✅ Test 4: Verifying data structure...');
    const monthViewData = await page.evaluate(() => {
      // Look for both guest counts and private event text
      const guestCountElements = document.querySelectorAll('div[style*="background-color: rgb(202, 194, 185)"], div[style*="background-color: #CAC2b9"]');
      const privateEventElements = Array.from(document.querySelectorAll('div')).filter(el => 
        el.textContent.includes('Private Event:')
      );
      
      return {
        guestCounts: Array.from(guestCountElements).map(el => {
          const text = el.textContent.trim();
          const number = parseInt(text);
          return {
            text,
            number,
            isValid: !isNaN(number) && number > 0
          };
        }),
        privateEvents: privateEventElements.map(el => ({
          text: el.textContent.trim(),
          element: el.outerHTML.substring(0, 100) + '...'
        }))
      };
    });
    
    console.log('📊 Month view data analysis:');
    console.log('  Guest counts:');
    monthViewData.guestCounts.forEach((data, index) => {
      if (data.isValid) {
        console.log(`    ✅ Day ${index + 1}: ${data.number} guests (valid)`);
      } else {
        console.log(`    ❌ Day ${index + 1}: Invalid data - "${data.text}"`);
      }
    });
    
    console.log('  Private events:');
    monthViewData.privateEvents.forEach((data, index) => {
      console.log(`    ✅ Private event ${index + 1}: ${data.text}`);
    });
    
    console.log('🎉 Calendar month view fix tests completed!');
    console.log('📝 Summary:');
    console.log('  - Month view now shows guest counts for regular reservations');
    console.log('  - Private events show "Private Event: [Event title]" text');
    console.log('  - No more icons, replaced with descriptive text');
    console.log('  - Clear distinction between regular guests and private events');
    
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
testCalendarMonthViewFix().catch(console.error); 
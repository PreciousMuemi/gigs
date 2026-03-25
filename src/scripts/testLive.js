#!/usr/bin/env node

/**
 * Live USSD Testing via ngrok tunnel
 * Tests USSD flows against running server
 * 
 * Usage: npm run test:live
 */

const axios = require('axios');

// ngrok tunnel URL - change this if your ngrok URL is different
const NGROK_URL = 'https://sternal-liam-overlightly.ngrok-free.dev';

// Colors for terminal output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
};

function log(color, message) {
  console.log(`${color}${message}${colors.reset}`);
}

async function testUSSD(sessionId, phoneNumber, input, description) {
  log(colors.cyan, `\n📞 Test: ${description}`);
  log(colors.yellow, `   Phone: ${phoneNumber} | Input: "${input}"`);

  try {
        const params = new URLSearchParams();
        params.append('sessionId', sessionId);
        params.append('phoneNumber', phoneNumber);
        params.append('text', input);
        params.append('serviceCode', '123');

        const response = await axios.post(`${NGROK_URL}/ussd`, 
          params,
          {
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            timeout: 10000,
            validateStatus: () => true, // Accept all status codes
          }
        );

    const responseText = response.data;
        
        // Check response status
        if (response.status >= 400) {
          log(colors.red, `   ✗ HTTP ${response.status}`);
          log(colors.yellow, `   Body: ${typeof responseText === 'string' ? responseText : JSON.stringify(responseText)}`);
        } else {
          log(colors.green, `   ✓ Response: ${responseText.substring(0, 80)}...`);
        }
    
    return {
      success: true,
      response: responseText,
    };
  } catch (error) {
    if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
          log(colors.red, `   ✗ Connection failed (ngrok URL wrong or server down): ${error.message}`);
      log(colors.yellow, `   Make sure:`);
      log(colors.yellow, `     1. ngrok is running: ngrok http 3000`);
      log(colors.yellow, `     2. Server is running: npm run dev:ussd`);
    } else {
      log(colors.red, `   ✗ Error: ${error.message}`);
    }
    
    return {
      success: false,
      error: error.message,
    };
  }
}

async function runTests() {
  log(colors.blue, '\n╔════════════════════════════════════════╗');
  log(colors.blue, '║     LIVE USSD TESTING VIA NGROK        ║');
  log(colors.blue, '╚════════════════════════════════════════╝');
  
  log(colors.cyan, `\nngrok URL: ${NGROK_URL}`);
  log(colors.cyan, `Dashboard: http://localhost:4040\n`);

  // Test 1: Register as Freelancer
  log(colors.blue, '\n--- Test 1: Register as Freelancer ---');
  let session1 = 'session_' + Date.now();
  
  await testUSSD(session1, '254700000001', '1', 'Main menu → Register Freelancer');
  await testUSSD(session1, '254700000001', 'John Doe', 'Enter freelancer name');
  await testUSSD(session1, '254700000001', 'Web Development', 'Enter skill');

  // Test 2: Register as Client
  log(colors.blue, '\n--- Test 2: Register as Client ---');
  let session2 = 'session_' + (Date.now() + 1);
  
  await testUSSD(session2, '254700000002', '2', 'Main menu → Register Client');
  await testUSSD(session2, '254700000002', 'Tech Startup Ltd', 'Enter client name');
  await testUSSD(session2, '254700000002', 'Nairobi', 'Enter location');

  // Test 3: Post a Job
  log(colors.blue, '\n--- Test 3: Post a Job ---');
  let session3 = 'session_' + (Date.now() + 2);
  
  await testUSSD(session3, '254700000002', '3', 'Main menu → Post Job');
  await testUSSD(session3, '254700000002', 'Build E-commerce Site', 'Enter job title');
  await testUSSD(session3, '254700000002', '75000', 'Enter budget');

  // Test 4: Find Freelancer by Skill
  log(colors.blue, '\n--- Test 4: Find Freelancer by Skill ---');
  let session4 = 'session_' + (Date.now() + 3);
  
  await testUSSD(session4, '254700000002', '4', 'Main menu → Find Freelancer');
  await testUSSD(session4, '254700000002', 'Web Development', 'Enter skill');

  // Test 5: Rate Freelancer
  log(colors.blue, '\n--- Test 5: Rate Freelancer ---');
  let session5 = 'session_' + (Date.now() + 4);
  
  await testUSSD(session5, '254700000001', '5', 'Main menu → Rate Freelancer');
  await testUSSD(session5, '254700000001', '254700000002', 'Enter freelancer phone');
  await testUSSD(session5, '254700000001', '5', 'Enter rating (1-5)');

  // Test 6: Invalid input
  log(colors.blue, '\n--- Test 6: Error Handling ---');
  let session6 = 'session_' + (Date.now() + 5);
  
  await testUSSD(session6, '254700000003', '99', 'Invalid menu option');

  // Summary
  log(colors.blue, '\n╔════════════════════════════════════════╗');
  log(colors.green, '║         TESTS COMPLETED               ║');
  log(colors.blue, '╚════════════════════════════════════════╝');
  
  log(colors.cyan, '\nNext Steps:');
  log(colors.cyan, '1. Check ngrok dashboard: http://localhost:4040');
  log(colors.cyan, '2. Review request/response bodies');
  log(colors.cyan, '3. Verify state transitions in server logs');
  log(colors.cyan, '4. Fix database connectivity: npm run db:init\n');
}

// Run tests
runTests().catch(err => {
  log(colors.red, `Fatal error: ${err.message}`);
  process.exit(1);
});

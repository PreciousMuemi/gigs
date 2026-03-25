/**
 * Quick local USSD flow tester
 * Usage: node src/scripts/testUssd.js
 *
 * Simulates USSD requests without hitting Africa's Talking
 */

const { handleUssd } = require('../services/ussdStateMachine');

async function test() {
  // eslint-disable-next-line no-console
  console.log('=== USSD Flow Test ===\n');

  const sessionId = 'test-session-123';
  const phoneNumber = '+254712345678';

  try {
    // Level 1: Main menu
    // eslint-disable-next-line no-console
    console.log('1️⃣ Main menu (empty text):');
    let response = await handleUssd({ sessionId, phoneNumber, text: '' });
    // eslint-disable-next-line no-console
    console.log(response, '\n');

    // Level 2: Select freelancer registration
    // eslint-disable-next-line no-console
    console.log('2️⃣ User selects "1" (Register as Freelancer):');
    response = await handleUssd({ sessionId, phoneNumber, text: '1' });
    // eslint-disable-next-line no-console
    console.log(response, '\n');

    // Level 3: Enter name
    // eslint-disable-next-line no-console
    console.log('3️⃣ User enters name "John Kariuki":');
    response = await handleUssd({ sessionId, phoneNumber, text: '1*John Kariuki' });
    // eslint-disable-next-line no-console
    console.log(response, '\n');

    // Level 4: Enter skill
    // eslint-disable-next-line no-console
    console.log('4️⃣ User enters skill "Plumbing":');
    response = await handleUssd({ sessionId, phoneNumber, text: '1*John Kariuki*Plumbing' });
    // eslint-disable-next-line no-console
    console.log(response, '\n');

    // eslint-disable-next-line no-console
    console.log('✓ Freelancer registration flow complete!');
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Test error:', error.message);
  }
}

test();

// testTelegramAuth.js

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, 'backend', '.env') });
const readline = require('readline');

// Utility for POST requests
async function post(path, body) {
  const res = await fetch(`http://localhost:7007${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status}: ${text}`);
  }
  return res.json();
}

(async () => {
  const phoneNumber = process.env.TEST_PHONE || '+380508329608';
  const sessionId   = process.env.TEST_SESSION || 'user-1';

  // Step 1: request code
  console.log(`→ POST /auth/telegram/start`);
  const { phoneCodeHash } = await post('/auth/telegram/start', { phoneNumber, sessionId });
  console.log('✅ phoneCodeHash:', phoneCodeHash);

  // Step 2: enter code and optional 2FA
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  rl.question('Enter the code you received: ', async (code) => {
    try {
      console.log(`→ POST /auth/telegram/auth (без 2FA)`);
      let result = await post('/auth/telegram/auth', {
        phoneNumber,
        code: code.trim(),
        sessionId
      });
      console.log('✅ Response:', result);

      if (result.status === '2FA_REQUIRED') {
        rl.question('Enter your 2FA password: ', async (password) => {
          try {
            console.log(`→ POST /auth/telegram/auth (з 2FA)`);
            result = await post('/auth/telegram/auth', {
              phoneNumber,
              code: code.trim(),
              sessionId,
              password: password.trim()
            });
            console.log('✅ 2FA Response:', result);
          } catch (err) {
            console.error('❌ 2FA Error:', err.message);
          } finally {
            rl.close();
          }
        });
      } else {
        rl.close();
      }
    } catch (err) {
      console.error('❌ Error:', err.message);
      rl.close();
      process.exit(1);
    }
  });
})();

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');

const PHILSMS_TOKEN = defineSecret('PHILSMS_TOKEN');
const GROQ_API_KEY = defineSecret('GROQ_API_KEY');

function requireAuth(request) {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Authentication required.');
  }
}

exports.sendSms = onCall({ cors: true, secrets: [PHILSMS_TOKEN] }, async (request) => {
  requireAuth(request);

  const { recipient, message } = request.data || {};

  if (!recipient || !message) {
    throw new HttpsError('invalid-argument', 'recipient and message are required');
  }

  const res = await fetch('https://app.philsms.com/api/v3/sms/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${PHILSMS_TOKEN.value()}`,
      'Content-Type': 'application/json',
      Accept: 'application/json'
    },
    body: JSON.stringify({
      recipient,
      sender_id: 'PhilSMS',
      type: 'plain',
      message
    })
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new HttpsError('internal', data.message || `PhilSMS error: HTTP ${res.status}`);
  }

  return { success: true };
});

exports.groqChat = onCall({ cors: true, secrets: [GROQ_API_KEY] }, async (request) => {
  requireAuth(request);

  const { model, messages, temperature, max_tokens } = request.data || {};

  if (!model || !Array.isArray(messages) || messages.length === 0) {
    throw new HttpsError('invalid-argument', 'model and messages are required');
  }

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${GROQ_API_KEY.value()}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model,
      messages,
      temperature,
      max_tokens
    })
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new HttpsError(
      'internal',
      data.error?.message || data.message || `Groq error: HTTP ${res.status}`
    );
  }

  return data;
});

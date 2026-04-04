export const config = { runtime: 'edge' };

const PHILSMS_ENDPOINTS = [
  'https://dashboard.philsms.com/api/v3/sms/send',
  'https://app.philsms.com/api/v3/sms/send'
];

function corsHeaders(request, headers = {}) {
  const origin = request.headers.get('origin');
  return {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
    ...headers
  };
}

function json(request, data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: corsHeaders(request, {
      'Content-Type': 'application/json',
      ...headers
    })
  });
}

async function getBody(request) {
  try {
    return await request.json();
  } catch (_) {
    return {};
  }
}

function normalizeSecret(value) {
  const trimmed = String(value || '').trim();
  const withoutBearer = trimmed.replace(/^Bearer\s+/i, '');
  if (
    (withoutBearer.startsWith('"') && withoutBearer.endsWith('"')) ||
    (withoutBearer.startsWith("'") && withoutBearer.endsWith("'"))
  ) {
    return withoutBearer.slice(1, -1).trim().replace(/^Bearer\s+/i, '');
  }
  return withoutBearer;
}

function normalizeRecipient(value) {
  const text = String(value || '').trim();
  if (!text) {
    return '';
  }

  const matches = text.match(/(?:\+?63|0)?9\d{9}/g) || [];
  for (const match of matches) {
    const digits = match.replace(/\D/g, '');
    if (/^09\d{9}$/.test(digits)) return '63' + digits.slice(1);
    if (/^639\d{9}$/.test(digits)) return digits;
    if (/^9\d{9}$/.test(digits)) return '63' + digits;
  }

  const digitsOnly = text.replace(/\D/g, '');
  if (/^09\d{9}$/.test(digitsOnly)) return '63' + digitsOnly.slice(1);
  if (/^639\d{9}$/.test(digitsOnly)) return digitsOnly;
  if (/^9\d{9}$/.test(digitsOnly)) return '63' + digitsOnly;
  return '';
}

function normalizeMessage(value) {
  return String(value || '').replace(/\r\n?/g, '\n').trim();
}

async function sendViaPhilSms(url, token, payload) {
  const smsResponse = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json'
    },
    body: JSON.stringify(payload)
  });

  const rawText = await smsResponse.text().catch(() => '');
  let data;
  try { data = JSON.parse(rawText); } catch { data = { rawBody: rawText }; }
  return {
    ok: smsResponse.ok && data.status !== 'error',
    status: smsResponse.status,
    data,
    url
  };
}

export async function GET(request) {
  const raw = process.env.PHILSMS_TOKEN || '';
  const token = normalizeSecret(raw);
  const url = new URL(request.url);

  const testPayload = {
    recipient: '639170000000',
    sender_id: 'PhilSMS',
    type: 'plain',
    message: 'ARPS API test — please ignore.'
  };


  if (url.searchParams.get('test') === '1' && token) {
    try {
      const result = await sendViaPhilSms(PHILSMS_ENDPOINTS[0], token, testPayload);
      const result2 = await sendViaPhilSms(PHILSMS_ENDPOINTS[1], token, testPayload);
      return json(request, {
        mode: 'env_var_token',
        endpoint1: { url: result.url, status: result.status, ok: result.ok, response: result.data },
        endpoint2: { url: result2.url, status: result2.status, ok: result2.ok, response: result2.data },
        tokenLength: token.length,
        tokenStart: token.slice(0, 8) + '***'
      });
    } catch (err) {
      return json(request, { error: err.message }, 500);
    }
  }

  return json(request, {
    status: 'SMS endpoint active',
    tokenConfigured: Boolean(token),
    rawStartsWithBearer: raw.trimStart().toLowerCase().startsWith('bearer'),
    rawHasQuotes: raw.includes('"') || raw.includes("'"),
    hint: !token ? 'PHILSMS_TOKEN env var is missing or empty. Add it in Vercel Settings > Environment Variables, then REDEPLOY.' : 'Token is loaded. Add ?test=1 to this URL to test the PhilSMS connection.'
  });
}

export function OPTIONS(request) {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(request, { Allow: 'POST, OPTIONS' })
  });
}

export async function POST(request) {
  const token = normalizeSecret(process.env.PHILSMS_TOKEN);
  if (!token) {
    return json(request, { error: 'PHILSMS_TOKEN is not configured' }, 500);
  }

  const { recipient, message } = await getBody(request);
  const normalizedRecipient = normalizeRecipient(recipient);
  const normalizedMessage = normalizeMessage(message);

  if (!recipient || !message) {
    return json(request, { error: 'recipient and message are required' }, 400);
  }
  if (!normalizedRecipient) {
    return json(request, { error: 'recipient must be a valid PH mobile number' }, 400);
  }

  try {
    const payload = {
      recipient: normalizedRecipient,
      sender_id: 'PhilSMS',
      type: 'plain',
      message: normalizedMessage
    };

    let lastAttempt = null;

    for (const url of PHILSMS_ENDPOINTS) {
      const attempt = await sendViaPhilSms(url, token, payload);
      lastAttempt = attempt;

      if (attempt.ok) {
        return json(request, { success: true, data: attempt.data, providerUrl: attempt.url }, 200);
      }

      const isAuthError = attempt.data?.message === 'Unauthenticated.' || attempt.status === 401;
      if (!isAuthError) {
        const status = attempt.status || 400;
        return json(
          request,
          {
            error: attempt.data?.message || `PhilSMS error: HTTP ${attempt.status}`,
            provider: attempt.data,
            providerUrl: attempt.url
          },
          status
        );
      }
    }

    const status = lastAttempt?.data?.message === 'Unauthenticated.' ? 401 : (lastAttempt?.status || 400);
    return json(
      request,
      {
        error: lastAttempt?.data?.message || `PhilSMS error: HTTP ${lastAttempt?.status || 400}`,
        provider: lastAttempt?.data || {},
        providerUrl: lastAttempt?.url || PHILSMS_ENDPOINTS[0]
      },
      status
    );
  } catch (error) {
    return json(request, { error: error.message || 'Failed to send SMS' }, 500);
  }
}

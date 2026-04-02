export const config = { runtime: 'edge' };

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

export function GET(request) {
  return json(request, { error: 'Method not allowed' }, 405, { Allow: 'POST, OPTIONS' });
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
    const smsResponse = await fetch('https://dashboard.philsms.com/api/v3/sms/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      body: JSON.stringify({
        recipient: normalizedRecipient,
        sender_id: 'PhilSMS',
        type: 'plain',
        message: normalizedMessage
      })
    });

    const data = await smsResponse.json().catch(() => ({}));
    if (!smsResponse.ok || data.status === 'error') {
      const status = data.message === 'Unauthenticated.' ? 401 : smsResponse.status || 400;
      return json(
        request,
        {
          error: data.message || `PhilSMS error: HTTP ${smsResponse.status}`,
          provider: data
        },
        status
      );
    }

    return json(request, { success: true, data }, 200);
  } catch (error) {
    return json(request, { error: error.message || 'Failed to send SMS' }, 500);
  }
}

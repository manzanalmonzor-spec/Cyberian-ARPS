function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...headers
    }
  });
}

async function getBody(request) {
  try {
    return await request.json();
  } catch (_) {
    return {};
  }
}

export default {
  async fetch(request) {
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: { Allow: 'POST, OPTIONS' }
      });
    }

    if (request.method !== 'POST') {
      return json({ error: 'Method not allowed' }, 405, { Allow: 'POST' });
    }

    const token = process.env.PHILSMS_TOKEN;
    if (!token) {
      return json({ error: 'PHILSMS_TOKEN is not configured' }, 500);
    }

    const { recipient, message } = await getBody(request);
    if (!recipient || !message) {
      return json({ error: 'recipient and message are required' }, 400);
    }

    try {
      const smsResponse = await fetch('https://app.philsms.com/api/v3/sms/send', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
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

      const data = await smsResponse.json().catch(() => ({}));
      if (!smsResponse.ok) {
        return json(
          { error: data.message || `PhilSMS error: HTTP ${smsResponse.status}` },
          smsResponse.status
        );
      }

      return json({ success: true, data }, 200);
    } catch (error) {
      return json({ error: error.message || 'Failed to send SMS' }, 500);
    }
  }
};

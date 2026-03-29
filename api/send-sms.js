function getBody(req) {
  if (!req.body) return {};
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body);
    } catch (_) {
      return {};
    }
  }
  return req.body;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const token = process.env.PHILSMS_TOKEN;
  if (!token) {
    return res.status(500).json({ error: 'PHILSMS_TOKEN is not configured' });
  }

  const { recipient, message } = getBody(req);
  if (!recipient || !message) {
    return res.status(400).json({ error: 'recipient and message are required' });
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
      return res.status(smsResponse.status).json({
        error: data.message || `PhilSMS error: HTTP ${smsResponse.status}`
      });
    }

    return res.status(200).json({ success: true, data });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Failed to send SMS' });
  }
};

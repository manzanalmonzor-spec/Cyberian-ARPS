
async function test() {
  const recipient = '09XXXXXXXXX';
  const token = process.env.PHILSMS_TOKEN;

  if (!token) {
    throw new Error('Set PHILSMS_TOKEN before running this script.');
  }

  const res = await fetch('https://dashboard.philsms.com/api/v3/sms/send', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type':  'application/json',
      'Accept':        'application/json'
    },
    body: JSON.stringify({
      recipient,
      sender_id: 'PhilSMS',
      type:      'plain',
      message:
        '[ARPS EMERGENCY ALERT]\n' +
        'Juan Dela Cruz has triggered a Medical Emergency SOS.\n' +
        'Location: Barangay San Roque, Quezon City\n' +
        'Time: 03:45 PM\n\n' +
        'Please respond immediately or contact emergency services (911).\n' +
        '- ARPS Emergency Response System'
    })
  });

  const data = await res.json();
  console.log('Status:', res.status);
  console.log('Response:', JSON.stringify(data, null, 2));
}

test().catch(console.error);

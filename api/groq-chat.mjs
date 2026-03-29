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

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      return json({ error: 'GROQ_API_KEY is not configured' }, 500);
    }

    const { model, messages, temperature, max_tokens } = await getBody(request);
    if (!model || !Array.isArray(messages) || messages.length === 0) {
      return json({ error: 'model and messages are required' }, 400);
    }

    try {
      const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model,
          messages,
          temperature,
          max_tokens
        })
      });

      const data = await groqResponse.json().catch(() => ({}));
      if (!groqResponse.ok) {
        return json(
          {
            error:
              data.error?.message ||
              data.message ||
              `Groq error: HTTP ${groqResponse.status}`
          },
          groqResponse.status
        );
      }

      return json(data, 200);
    } catch (error) {
      return json({ error: error.message || 'Failed to call Groq' }, 500);
    }
  }
};

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

const MODEL_ALIASES = {
  'llama3-8b-8192': 'llama-3.1-8b-instant',
  'llama-3.2-11b-vision-preview': 'meta-llama/llama-4-scout-17b-16e-instruct',
  'llama-3.2-90b-vision-preview': 'meta-llama/llama-4-scout-17b-16e-instruct'
};

function normalizeModel(model) {
  return MODEL_ALIASES[model] || model;
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
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return json(request, { error: 'AI service is not configured. Please contact the administrator.' }, 500);
  }

  const { model, messages, temperature, max_tokens } = await getBody(request);
  if (!model || !Array.isArray(messages) || messages.length === 0) {
    return json(request, { error: 'model and messages are required' }, 400);
  }

  const resolvedModel = normalizeModel(model);

  try {
    const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: resolvedModel,
        messages,
        temperature,
        max_tokens
      })
    });

    const data = await groqResponse.json().catch(() => ({}));
    if (!groqResponse.ok) {
      return json(
        request,
        {
          error:
            data.error?.message ||
            data.message ||
            `Groq error: HTTP ${groqResponse.status}`
        },
        groqResponse.status
      );
    }

    return json(request, data, 200);
  } catch (error) {
    return json(request, { error: error.message || 'Failed to call Groq' }, 500);
  }
}

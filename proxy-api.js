// File: netlify/functions/proxy-api.js

exports.handler = async function (event, context) {
  // รับข้อมูลจาก Client ที่ส่งมา
  const { provider, model, systemPrompt, userKeyword } = JSON.parse(event.body);

  // ดึง API Key จาก Environment Variables ของ Netlify (ปลอดภัย)
  const apiKeys = {
    openai: process.env.OPENAI_API_KEY,
    anthropic: process.env.ANTHROPIC_API_KEY,
    google: process.env.GOOGLE_API_KEY,
  };

  const apiKey = apiKeys[provider];

  if (!apiKey) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: `API Key for ${provider} is not configured.` }),
    };
  }

  // เตรียมข้อมูลสำหรับส่งไปยัง API ของแต่ละเจ้า
  let apiUrl = '';
  let headers = {};
  let body = {};

  if (provider === 'openai') {
    apiUrl = 'https://api.openai.com/v1/chat/completions';
    headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` };
    body = { model: model, messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userKeyword }] };
  } else if (provider === 'anthropic') {
    apiUrl = 'https://api.anthropic.com/v1/messages';
    headers = { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' };
    body = { model: model, system: systemPrompt, max_tokens: 4096, messages: [{ role: 'user', content: userKeyword }] };
  } else if (provider === 'google') {
    apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    headers = { 'Content-Type': 'application/json' };
    body = { contents: [{ parts: [{ text: `${systemPrompt}\n\n${userKeyword}` }] }], generationConfig: { maxOutputTokens: 4096 } };
  }

  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
        const errorData = await response.json();
        return {
            statusCode: response.status,
            body: JSON.stringify({ error: errorData.error?.message || 'API request failed' })
        };
    }

    const data = await response.json();

    return {
      statusCode: 200,
      body: JSON.stringify(data), // ส่งผลลัพธ์กลับไปให้ Client
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
};
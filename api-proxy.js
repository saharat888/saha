exports.handler = async (event, context) => {
  // Headers สำหรับ CORS ที่จะใช้ในทุก response
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*', // หรือระบุ domain ของคุณแทน '*' เพื่อความปลอดภัย
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };

  // จัดการ Preflight OPTIONS request จากเบราว์เซอร์
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ message: 'Preflight check successful' })
    };
  }

  // ตรวจสอบว่าเป็น POST request
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const { provider, model, apiKey, systemPrompt, userPrompt } = JSON.parse(event.body);

    // ตรวจสอบข้อมูลที่จำเป็น
    if (!provider || !model || !apiKey || !userPrompt) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Missing required fields' })
      };
    }

    // กำหนด API endpoints
    const apiEndpoints = {
      claude: 'https://api.anthropic.com/v1/messages',
      openai: 'https://api.openai.com/v1/chat/completions',
      gemini: `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`
    };

    // สร้าง request data ตาม provider
    let requestData;
    let headers = {
      'Content-Type': 'application/json'
    };

    switch (provider) {
      case 'claude':
        requestData = {
          model: model,
          max_tokens: 1000,
          messages: [
            { role: 'user', content: `${systemPrompt}\n\n${userPrompt}` }
          ]
        };
        headers['x-api-key'] = apiKey;
        headers['anthropic-version'] = '2023-06-01';
        break;

      case 'openai':
        requestData = {
          model: model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          max_tokens: 1000
        };
        headers['Authorization'] = `Bearer ${apiKey}`;
        break;

      case 'gemini':
        requestData = {
          contents: [{
            parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }]
          }]
        };
        // สำหรับ Gemini API key ส่งใน URL แล้ว
        break;

      default:
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Unsupported provider' })
        };
    }

    // เรียก API
    const response = await fetch(apiEndpoints[provider], {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(requestData)
    });

    if (!response.ok) {
      const errorText = await response.text();
      return {
        statusCode: response.status,
        headers: corsHeaders, // เพิ่ม headers ที่นี่
        body: JSON.stringify({
          error: `API Error: ${response.status}`,
          details: errorText
        })
      };
    }

    const data = await response.json();

    // ดึงผลลัพธ์ตาม provider
    let result;
    switch (provider) {
      case 'claude':
        result = data.content[0].text;
        break;
      case 'openai':
        result = data.choices[0].message.content;
        break;
      case 'gemini':
        result = data.candidates[0].content.parts[0].text;
        break;
    }

    return {
      statusCode: 200,
      headers: corsHeaders, // เพิ่ม headers ที่นี่
      body: JSON.stringify({ result })
    };

  } catch (error) {
    console.error('Function error:', error);
    return {
      statusCode: 500,
      headers: corsHeaders, // เพิ่ม headers ที่นี่
      body: JSON.stringify({
        error: 'Internal server error',
        details: error.message
      })
    };
  }
};
exports.handler = async (event, context) => {
  // Headers สำหรับ CORS ที่จะใช้ในทุก response
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS, GET'
  };

  // จัดการ Preflight OPTIONS request จากเบราว์เซอร์
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: ''
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
    // ตรวจสอบว่ามี body หรือไม่
    if (!event.body) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Request body is required' })
      };
    }

    const { provider, model, apiKey, systemPrompt, userPrompt } = JSON.parse(event.body);

    // ตรวจสอบข้อมูลที่จำเป็น
    if (!provider || !model || !apiKey || !userPrompt) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ 
          error: 'Missing required fields',
          required: ['provider', 'model', 'apiKey', 'userPrompt']
        })
      };
    }

    // กำหนด API endpoints
    const apiEndpoints = {
      claude: 'https://api.anthropic.com/v1/messages',
      openai: 'https://api.openai.com/v1/chat/completions',
      gemini: `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`
    };

    // ตรวจสอบว่า provider ที่ส่งมาได้รับการสนับสนุน
    if (!apiEndpoints[provider]) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ 
          error: 'Unsupported provider',
          supportedProviders: Object.keys(apiEndpoints)
        })
      };
    }

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
            { role: 'user', content: `${systemPrompt ? systemPrompt + '\n\n' : ''}${userPrompt}` }
          ]
        };
        headers['x-api-key'] = apiKey;
        headers['anthropic-version'] = '2023-06-01';
        break;

      case 'openai':
        const messages = [];
        if (systemPrompt) {
          messages.push({ role: 'system', content: systemPrompt });
        }
        messages.push({ role: 'user', content: userPrompt });
        
        requestData = {
          model: model,
          messages: messages,
          max_tokens: 1000
        };
        headers['Authorization'] = `Bearer ${apiKey}`;
        break;

      case 'gemini':
        requestData = {
          contents: [{
            parts: [{ text: `${systemPrompt ? systemPrompt + '\n\n' : ''}${userPrompt}` }]
          }],
          generationConfig: {
            maxOutputTokens: 1000
          }
        };
        break;

      default:
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Unsupported provider' })
        };
    }

    console.log(`Making request to ${provider} API...`);

    // เรียก API with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000); // 20 วินาที

    const response = await fetch(apiEndpoints[provider], {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(requestData),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`API Error (${response.status}):`, errorText);
      
      return {
        statusCode: response.status,
        headers: corsHeaders,
        body: JSON.stringify({
          error: `API Error: ${response.status}`,
          details: errorText,
          provider: provider
        })
      };
    }

    const data = await response.json();
    console.log(`Response received from ${provider}:`, JSON.stringify(data, null, 2));

    // ดึงผลลัพธ์ตาม provider
    let result;
    try {
      switch (provider) {
        case 'claude':
          result = data.content && data.content[0] ? data.content[0].text : 'No content received';
          break;
        case 'openai':
          result = data.choices && data.choices[0] ? data.choices[0].message.content : 'No content received';
          break;
        case 'gemini':
          result = data.candidates && data.candidates[0] && data.candidates[0].content 
            ? data.candidates[0].content.parts[0].text 
            : 'No content received';
          break;
      }
    } catch (parseError) {
      console.error('Error parsing response:', parseError);
      return {
        statusCode: 500,
        headers: corsHeaders,
        body: JSON.stringify({
          error: 'Error parsing API response',
          details: parseError.message,
          rawResponse: data
        })
      };
    }

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ 
        result: result,
        provider: provider,
        model: model
      })
    };

  } catch (error) {
    console.error('Function error:', error);
    
    // แยกประเภทของ error
    let errorMessage = 'Internal server error';
    let statusCode = 500;
    
    if (error.name === 'AbortError') {
      errorMessage = 'Request timeout';
      statusCode = 408;
    } else if (error.name === 'SyntaxError') {
      errorMessage = 'Invalid JSON in request body';
      statusCode = 400;
    }
    
    return {
      statusCode: statusCode,
      headers: corsHeaders,
      body: JSON.stringify({
        error: errorMessage,
        details: error.message,
        timestamp: new Date().toISOString()
      })
    };
  }
};

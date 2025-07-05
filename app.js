document.addEventListener('DOMContentLoaded', () => {
    // --- ELEMENT SELECTORS ---
    const providerSelect = document.getElementById('provider-select');
    const modelSelect = document.getElementById('model-select');
    const keywordInput = document.getElementById('keyword-input');
    const promptTemplateSelect = document.getElementById('prompt-template-select');
    const systemPromptInput = document.getElementById('system-prompt-input');
    const promptCountInput = document.getElementById('prompt-count-input');
    const generateBtn = document.getElementById('generate-btn');
    const resultContainer = document.getElementById('result-container');

    // --- DATA & CONFIG ---
    const models = {
        openai: ['gpt-4o', 'gpt-4-turbo', 'gpt-3.5-turbo'],
        anthropic: ['claude-3-opus-20240229', 'claude-3-sonnet-20240229', 'claude-3-haiku-20240307'],
        google: ['gemini-1.5-pro-latest', 'gemini-1.5-flash-latest']
    };

    const promptTemplates = {
        default: "You are an expert Midjourney prompt engineer. Your task is to create a detailed, effective, and visually rich prompt based on the user's keywords. The prompt must be in English. Describe the scene, subjects, environment, lighting, colors, style, and camera setup. Structure the prompt clearly. Start with the main subject and add descriptive details, followed by parameters like --ar 16:9 --v 6.0.",
        artistic: "As a master artist, translate the user's keywords into a highly artistic and imaginative Midjourney prompt. The prompt must be in English. Focus on evoking emotion through style, composition, and color palette. Mention specific art styles (e.g., impressionism, surrealism, abstract) or artists. The output should be a poetic and descriptive prompt ready for Midjourney, ending with parameters like --ar 4:5 --style raw --s 250.",
        photography: "You are a professional photographer creating a shot list. Convert the user's keywords into a photorealistic Midjourney prompt. The prompt must be in English. Specify camera type (e.g., DSLR, vintage film), lens (e.g., 85mm f/1.8), aperture, shutter speed, ISO, and lighting (e.g., golden hour, studio lighting). The goal is maximum realism. End with parameters like --ar 3:2 --style raw.",
        fantasy: "You are a world-building loremaster. Forge the user's keywords into an epic fantasy-themed Midjourney prompt. The prompt must be in English. Describe mythical creatures, magical effects, enchanted landscapes, and intricate armor or clothing. Use epic and powerful language. The prompt should feel like it's from a fantasy novel. End with parameters like --ar 16:9 --v 6.0 --s 500.",
        custom: ""
    };

    // --- FUNCTIONS ---

    // ✅ FIXED: This function is now complete.
    function updateModels() {
        const selectedProvider = providerSelect.value;
        modelSelect.innerHTML = '';
        models[selectedProvider].forEach(model => {
            const option = document.createElement('option');
            option.value = model;
            option.textContent = model;
            modelSelect.appendChild(option);
        });
    }

    // ✅ FIXED: This function is now complete.
    function updateSystemPrompt() {
        const selectedTemplate = promptTemplateSelect.value;
        if (selectedTemplate === 'custom') {
            systemPromptInput.value = localStorage.getItem('customSystemPrompt') || "กรุณาใส่ System Prompt ของคุณที่นี่...";
            systemPromptInput.readOnly = false;
            systemPromptInput.focus();
        } else {
            systemPromptInput.value = promptTemplates[selectedTemplate];
            systemPromptInput.readOnly = true;
        }
    }

    // ✅ FIXED: This function is now complete.
    function saveCustomPrompt() {
        if (promptTemplateSelect.value === 'custom') {
            localStorage.setItem('customSystemPrompt', systemPromptInput.value);
        }
    }
    
    async function handleGeneration() {
        const keyword = keywordInput.value.trim();
        if (!keyword) {
            alert('กรุณาใส่ Keyword ที่ต้องการ');
            return;
        }

        const systemPrompt = systemPromptInput.value.trim();
        if (!systemPrompt) {
            alert('System Prompt ว่างเปล่า กรุณาเลือกรูปแบบหรือกำหนดเอง');
            return;
        }

        generateBtn.disabled = true;
        resultContainer.innerHTML = '<p class="placeholder">กำลังสร้าง Prompt กรุณารอสักครู่...</p>';

        try {
            const provider = providerSelect.value;
            const model = modelSelect.value;
            const count = parseInt(promptCountInput.value, 10);

            const finalUserPrompt = `Based on the user's idea, generate ${count} distinct and creative variations for a Midjourney prompt.
            User's Idea: "${keyword}"
            Please format the output clearly. Each prompt must start on a new line and be prefixed with "1. ", "2. ", etc. Do not add any extra text or explanations before or after the list of prompts.`;
            
            const responseText = await callProxyApi(provider, model, systemPrompt, finalUserPrompt);
            displayResults(responseText);

        } catch (error) {
            resultContainer.innerHTML = `<p class="placeholder" style="color: #f44336;">เกิดข้อผิดพลาด: ${error.message}</p>`;
        } finally {
            generateBtn.disabled = false;
        }
    }
    
    async function callProxyApi(provider, model, systemPrompt, userKeyword) {
        const response = await fetch('/api/proxy-api', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                provider,
                model,
                systemPrompt,
                userKeyword
            })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'An unknown error occurred.');
        }
        
        if (provider === 'openai') return data.choices[0].message.content.trim();
        if (provider === 'anthropic') return data.content[0].text.trim();
        if (provider === 'google') return data.candidates[0].content.parts[0].text.trim();
        
        return "ไม่สามารถดึงข้อมูลจาก Provider ที่เลือกได้";
    }
    
    function displayResults(responseText) {
        resultContainer.innerHTML = '';
        const prompts = responseText.split(/\n?\d+\.\s/).filter(p => p.trim() !== '');

        if (prompts.length === 0) {
            resultContainer.innerHTML = '<p class="placeholder">ไม่ได้รับผลลัพธ์ที่ถูกต้องจาก AI ลองใหม่อีกครั้ง</p>';
            return;
        }

        prompts.forEach(promptText => {
            const cleanedText = promptText.trim();
            const itemDiv = document.createElement('div');
            itemDiv.className = 'result-item';
            const textP = document.createElement('p');
            textP.textContent = cleanedText;
            const copyBtn = document.createElement('button');
            copyBtn.textContent = 'คัดลอก';
            copyBtn.className = 'copy-btn-item';
            copyBtn.onclick = () => {
                navigator.clipboard.writeText(cleanedText)
                    .then(() => {
                        copyBtn.textContent = 'คัดลอกแล้ว!';
                        setTimeout(() => { copyBtn.textContent = 'คัดลอก'; }, 2000);
                    })
                    .catch(err => console.error('Copy failed', err));
            };
            itemDiv.appendChild(textP);
            itemDiv.appendChild(copyBtn);
            resultContainer.appendChild(itemDiv);
        });
    }

    // --- EVENT LISTENERS ---
    providerSelect.addEventListener('change', updateModels);
    generateBtn.addEventListener('click', handleGeneration);
    promptTemplateSelect.addEventListener('change', updateSystemPrompt);
    systemPromptInput.addEventListener('input', saveCustomPrompt);

    // --- INITIALIZATION ---
    updateModels();
    updateSystemPrompt();
});
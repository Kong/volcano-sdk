#!/usr/bin/env node
/* eslint-env node */

/**
 * Ollama Health Check
 * Verifies Ollama is running and reachable with a real model inference
 */

const OLLAMA_BASE_URL = process.env.LLAMA_BASE_URL || 'http://127.0.0.1:11434';
const OLLAMA_MODEL = process.env.LLAMA_MODEL || 'llama3.2:3b';

console.log('🔍 Testing Ollama connectivity and model availability...');
console.log(`   Base URL: ${OLLAMA_BASE_URL}`);
console.log(`   Model: ${OLLAMA_MODEL}`);

async function checkOllamaHealth() {
  try {
    // Test 1: Check if server is responding
    console.log('\n1️⃣  Checking if Ollama server is responding...');
    const tagsResponse = await fetch(`${OLLAMA_BASE_URL}/api/tags`);
    if (!tagsResponse.ok) {
      throw new Error(`Server responded with status ${tagsResponse.status}`);
    }
    const tagsData = await tagsResponse.json();
    console.log(`   ✅ Server is responding`);
    console.log(`   Available models:`, tagsData.models?.map(m => m.name) || []);

    // Test 2: Check if our model is available
    console.log(`\n2️⃣  Checking if model "${OLLAMA_MODEL}" is available...`);
    const modelExists = tagsData.models?.some(m => m.name === OLLAMA_MODEL);
    if (!modelExists) {
      throw new Error(`Model "${OLLAMA_MODEL}" not found. Available: ${tagsData.models?.map(m => m.name).join(', ')}`);
    }
    console.log(`   ✅ Model "${OLLAMA_MODEL}" is available`);

    // Test 3: Test actual inference (non-streaming)
    console.log(`\n3️⃣  Testing inference (non-streaming)...`);
    const startTime = Date.now();
    const generateResponse = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        prompt: 'Reply with exactly: HEALTH_CHECK_OK',
        stream: false,
        options: {
          temperature: 0.1,
          num_predict: 20
        }
      })
    });

    if (!generateResponse.ok) {
      const errorText = await generateResponse.text();
      throw new Error(`Generate request failed (${generateResponse.status}): ${errorText}`);
    }

    const generateData = await generateResponse.json();
    const duration = Date.now() - startTime;
    
    if (!generateData.response) {
      throw new Error(`No response in generate result: ${JSON.stringify(generateData)}`);
    }

    console.log(`   ✅ Inference successful in ${duration}ms`);
    console.log(`   Response: "${generateData.response.trim()}"`);

    // Test 4: Test streaming inference
    console.log(`\n4️⃣  Testing streaming inference...`);
    const streamStartTime = Date.now();
    const streamResponse = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        prompt: 'Say: STREAM_OK',
        stream: true,
        options: {
          temperature: 0.1,
          num_predict: 10
        }
      })
    });

    if (!streamResponse.ok) {
      throw new Error(`Stream request failed with status ${streamResponse.status}`);
    }

    let streamedText = '';
    let chunkCount = 0;
    const reader = streamResponse.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      const chunk = decoder.decode(value);
      const lines = chunk.split('\n').filter(line => line.trim());
      
      for (const line of lines) {
        try {
          const json = JSON.parse(line);
          if (json.response) {
            streamedText += json.response;
            chunkCount++;
          }
        } catch {
          // Skip invalid JSON lines
        }
      }
    }

    const streamDuration = Date.now() - streamStartTime;
    console.log(`   ✅ Streaming successful in ${streamDuration}ms`);
    console.log(`   Received ${chunkCount} chunks`);
    console.log(`   Streamed text: "${streamedText.trim()}"`);

    // Test 5: Test OpenAI-compatible endpoint (used by llmLlama)
    console.log(`\n5️⃣  Testing OpenAI-compatible /v1/chat/completions endpoint...`);
    const chatStartTime = Date.now();
    const chatResponse = await fetch(`${OLLAMA_BASE_URL}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        messages: [
          { role: 'user', content: 'Reply with: OPENAI_COMPAT_OK' }
        ],
        temperature: 0.1,
        max_tokens: 20
      })
    });

    if (!chatResponse.ok) {
      const errorText = await chatResponse.text();
      throw new Error(`Chat completions failed (${chatResponse.status}): ${errorText}`);
    }

    const chatData = await chatResponse.json();
    const chatDuration = Date.now() - chatStartTime;

    if (!chatData.choices || !chatData.choices[0]?.message?.content) {
      throw new Error(`Invalid chat response: ${JSON.stringify(chatData)}`);
    }

    console.log(`   ✅ OpenAI-compatible endpoint working in ${chatDuration}ms`);
    console.log(`   Response: "${chatData.choices[0].message.content.trim()}"`);
    console.log(`   Model: ${chatData.model}`);

    // Success!
    console.log('\n' + '='.repeat(60));
    console.log('✅ ALL HEALTH CHECKS PASSED');
    console.log('='.repeat(60));
    console.log(`   Ollama is fully operational and ready for testing`);
    console.log(`   Base URL: ${OLLAMA_BASE_URL}`);
    console.log(`   Model: ${OLLAMA_MODEL}`);
    console.log('='.repeat(60) + '\n');

    process.exit(0);

  } catch (error) {
    console.error('\n' + '='.repeat(60));
    console.error('❌ OLLAMA HEALTH CHECK FAILED');
    console.error('='.repeat(60));
    console.error(`Error: ${error.message}`);
    console.error('\nTroubleshooting:');
    console.error('  1. Check if Ollama is running: curl http://127.0.0.1:11434/api/tags');
    console.error('  2. Check Ollama logs: cat ollama.log');
    console.error('  3. Verify model is installed: ollama list');
    console.error('  4. Try pulling the model: ollama pull llama3.2:3b');
    console.error('='.repeat(60) + '\n');
    process.exit(1);
  }
}

// Run the health check
checkOllamaHealth();


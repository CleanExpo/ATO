import { GoogleGenerativeAI } from '@google/generative-ai';
import { readFileSync } from 'fs';

// Read API key from .env.local
const envFile = readFileSync('.env.local', 'utf-8');
const apiKeyMatch = envFile.match(/GOOGLE_AI_API_KEY=(.+)/);
const apiKey = apiKeyMatch ? apiKeyMatch[1].trim() : null;

if (!apiKey) {
    console.error('❌ GOOGLE_AI_API_KEY not found in .env.local');
    process.exit(1);
}

const genAI = new GoogleGenerativeAI(apiKey);

const modelsToTest = [
    'gemini-3-pro-preview',
    'gemini-3-pro',
    'gemini-3-flash-preview',
    'gemini-3-flash',
    'gemini-2.5-pro',
    'gemini-2.5-flash',
    'gemini-2.0-flash-exp',
];

console.log('🔍 Checking Gemini 3 and 2.5 models...\n');

for (const modelName of modelsToTest) {
    try {
        const model = genAI.getGenerativeModel({ model: modelName });
        const result = await model.generateContent('test');
        const response = await result.response;
        const text = response.text();
        console.log(`✅ ${modelName.padEnd(30)} - WORKING (response: ${text.substring(0, 30)}...)`);
    } catch (error) {
        if (error.message.includes('404') || error.message.includes('not found')) {
            console.log(`❌ ${modelName.padEnd(30)} - NOT FOUND`);
        } else {
            console.log(`⚠️  ${modelName.padEnd(30)} - ERROR: ${error.message.substring(0, 80)}`);
        }
    }
}

console.log('\n✅ Check complete!');

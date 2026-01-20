/**
 * Check available Gemini models
 */
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI('AIzaSyA5i79ERLApgFdXGA3pfY0suhx7nx0WhtI');

console.log('🔍 Checking available Gemini models...\n');

// Test different model names
const modelsToTest = [
  'gemini-2.0-flash-exp',
  'gemini-2.0-flash',
  'gemini-1.5-flash',
  'gemini-1.5-flash-002',
  'gemini-1.5-pro',
  'gemini-1.5-pro-002',
  'gemini-1.5-pro-latest',
  'gemini-pro'
];

for (const modelName of modelsToTest) {
  try {
    const model = genAI.getGenerativeModel({ model: modelName });
    const result = await model.generateContent('Test');
    const response = await result.response;
    console.log(`✅ ${modelName.padEnd(25)} - WORKING`);
  } catch (error) {
    if (error.message.includes('404') || error.message.includes('not found')) {
      console.log(`❌ ${modelName.padEnd(25)} - NOT FOUND`);
    } else {
      console.log(`⚠️  ${modelName.padEnd(25)} - ERROR: ${error.message.substring(0, 50)}`);
    }
  }
}

console.log('\n✅ Check complete!');

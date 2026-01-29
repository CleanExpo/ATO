#!/usr/bin/env ts-node
/**
 * Test Linear API connection only
 */

import * as dotenv from 'dotenv';
import { LinearClient } from '@linear/sdk';

// Load environment variables
dotenv.config({ path: '.env.local' });

async function testLinear() {
  console.log('🔍 Testing Linear API Connection...\n');

  try {
    if (!process.env.LINEAR_API_KEY) {
      console.log('❌ LINEAR_API_KEY not set in .env.local');
      process.exit(1);
    }

    const linear = new LinearClient({
      apiKey: process.env.LINEAR_API_KEY,
    });

    // Test viewer
    console.log('1. Testing authentication...');
    const viewer = await linear.viewer;
    console.log(`   ✅ Authenticated as: ${viewer.name}`);
    console.log(`   📧 Email: ${viewer.email}\n`);

    // Test team access
    console.log('2. Testing team access...');
    const teamId = process.env.LINEAR_TEAM_ID || 'UNI';
    const team = await linear.team(teamId);

    if (!team) {
      console.log(`   ❌ Team ${teamId} not found`);
      console.log('   Available teams:');
      const teams = await linear.teams();
      const teamNodes = await teams.nodes;
      for (const t of teamNodes) {
        console.log(`      - ${t.name} (${t.key})`);
      }
      process.exit(1);
    }

    console.log(`   ✅ Team found: ${team.name}`);
    console.log(`   🔑 Team key: ${team.key}`);
    console.log(`   🆔 Team ID: ${team.id}\n`);

    // Test issue creation (dry run - don't actually create)
    console.log('3. Checking issue creation capability...');
    const states = await team.states();
    console.log(`   ✅ Can access workflow states (${states.nodes.length} states)\n`);

    console.log('✅ Linear API fully functional!');
    console.log('\n📝 Configuration:');
    console.log(`   LINEAR_API_KEY: ${process.env.LINEAR_API_KEY?.substring(0, 15)}...`);
    console.log(`   LINEAR_TEAM_ID: ${teamId}`);
    console.log(`   Team Name: ${team.name}`);
    console.log(`   Team Key: ${team.key}`);

  } catch (error: any) {
    console.error('❌ Linear API Error:', error.message);
    if (error.message.includes('Unauthorized')) {
      console.log('\n💡 Tip: Check your LINEAR_API_KEY in .env.local');
    }
    process.exit(1);
  }
}

testLinear();

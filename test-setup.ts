#!/usr/bin/env ts-node
/**
 * Test script to verify idea intake workflow setup
 */

import * as dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { LinearClient } from '@linear/sdk';

// Load environment variables
dotenv.config({ path: '.env.local' });

async function testSetup() {
  console.log('🔍 Testing Idea Intake Workflow Setup...\n');

  // Test 1: Supabase Connection
  console.log('1. Testing Supabase connection...');
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data, error } = await supabase
      .from('work_queue')
      .select('count')
      .limit(1);

    if (error) {
      if (error.message.includes('relation "work_queue" does not exist')) {
        console.log('   ❌ work_queue table does not exist - migration needed');
        console.log('   → Run migration: supabase/migrations/20260129_create_work_queue.sql\n');
        return false;
      }
      throw error;
    }

    console.log('   ✅ Supabase connected, work_queue table exists\n');
  } catch (error) {
    console.error('   ❌ Supabase error:', error);
    return false;
  }

  // Test 2: Linear API Connection
  console.log('2. Testing Linear API connection...');
  try {
    if (!process.env.LINEAR_API_KEY) {
      console.log('   ❌ LINEAR_API_KEY not set in environment');
      return false;
    }

    const linear = new LinearClient({
      apiKey: process.env.LINEAR_API_KEY,
    });

    const viewer = await linear.viewer;
    console.log(`   ✅ Linear connected as: ${viewer.name} (${viewer.email})\n`);

    // Test team access
    console.log('3. Testing Linear team access...');
    const teamId = process.env.LINEAR_TEAM_ID || 'UNI';
    const team = await linear.team(teamId);

    if (!team) {
      console.log(`   ❌ Team ${teamId} not found`);
      return false;
    }

    console.log(`   ✅ Team found: ${team.name} (${team.key})\n`);

    return true;
  } catch (error: any) {
    console.error('   ❌ Linear error:', error.message);
    return false;
  }
}

// Run tests
testSetup()
  .then((success) => {
    if (success) {
      console.log('✅ All tests passed! Idea Intake Workflow is ready.');
    } else {
      console.log('❌ Some tests failed. Please fix the issues above.');
      process.exit(1);
    }
  })
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });

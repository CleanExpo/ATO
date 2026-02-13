#!/usr/bin/env tsx
/**
 * Daily Report Generator
 *
 * Generates a daily status report showing:
 * - Tasks active per specialist
 * - Tasks completed today
 * - Blocked tasks requiring attention
 *
 * Usage:
 *   npm run agent:daily-report
 *   tsx scripts/agents/daily-report.ts
 */

import { createLinearOrchestrator } from '@/lib/linear/orchestrator';

async function main() {
  console.log('📊 Generating Daily Report...\n');

  // Check environment variables
  if (!process.env.LINEAR_API_KEY) {
    console.error('Error: LINEAR_API_KEY environment variable is required');
    process.exit(1);
  }

  try {
    const orchestrator = createLinearOrchestrator();

    // Generate daily report
    const report = await orchestrator.generateDailyReport();

    // Print report
    console.log('='.repeat(60));
    console.log('📅 DAILY STATUS REPORT');
    console.log('='.repeat(60));
    console.log(`Date: ${new Date(report.date).toLocaleDateString()}`);
    console.log(`Time: ${new Date(report.date).toLocaleTimeString()}\n`);

    console.log('📋 ACTIVE TASKS BY SPECIALIST');
    console.log('-'.repeat(60));
    console.log(`   Specialist A (Architecture): ${report.specialistCounts.A} tasks`);
    console.log(`   Specialist B (Implementation): ${report.specialistCounts.B} tasks`);
    console.log(`   Specialist C (Testing): ${report.specialistCounts.C} tasks`);
    console.log(`   Specialist D (Documentation): ${report.specialistCounts.D} tasks`);
    console.log(`   TOTAL ACTIVE: ${report.totalActive} tasks\n`);

    if (report.completedToday.length > 0) {
      console.log('✅ COMPLETED TODAY');
      console.log('-'.repeat(60));
      report.completedToday.forEach((task, i) => {
        console.log(`   ${i + 1}. ${task}`);
      });
      console.log();
    } else {
      console.log('✅ COMPLETED TODAY');
      console.log('-'.repeat(60));
      console.log('   No tasks completed today\n');
    }

    if (report.blocked.length > 0) {
      console.log('🚫 BLOCKED TASKS (REQUIRES ATTENTION)');
      console.log('-'.repeat(60));
      report.blocked.forEach((task, i) => {
        console.log(`   ${i + 1}. ${task.title}`);
        console.log(`      ${task.url}`);
      });
      console.log();
    } else {
      console.log('🚫 BLOCKED TASKS');
      console.log('-'.repeat(60));
      console.log('   No blocked tasks\n');
    }

    console.log('='.repeat(60));

    // Summary
    const totalCompleted = report.completedToday.length;
    const totalBlocked = report.blocked.length;
    const healthScore =
      report.totalActive > 0
        ? Math.round(
            ((report.totalActive - totalBlocked) / report.totalActive) * 100
          )
        : 100;

    console.log('\n📊 SUMMARY');
    console.log('-'.repeat(60));
    console.log(`   Health Score: ${healthScore}% (${report.totalActive - totalBlocked}/${report.totalActive} unblocked)`);
    console.log(`   Velocity: ${totalCompleted} tasks completed today`);
    console.log(`   Blockers: ${totalBlocked} requiring attention\n`);

    if (totalBlocked > 0) {
      console.log('⚠️  ACTION REQUIRED: Review blocked tasks and resolve blockers\n');
    }
  } catch (error) {
    console.error('\n❌ Error:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

main();

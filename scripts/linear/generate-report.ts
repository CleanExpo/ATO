#!/usr/bin/env tsx
/**
 * Generate Linear Report
 *
 * Generates a comprehensive report from Linear issues including:
 * - Active issues by specialist
 * - Recent completions
 * - Blocked issues
 * - Cycle time metrics
 *
 * Usage:
 *   npm run linear:report
 *   tsx scripts/linear/generate-report.ts
 */

import { createLinearOrchestrator } from '@/lib/linear/orchestrator';

async function main() {
  console.log('📊 Generating Linear Report...\n');

  // Check environment variables
  if (!process.env.LINEAR_API_KEY) {
    console.error('Error: LINEAR_API_KEY environment variable is required');
    process.exit(1);
  }

  try {
    const orchestrator = createLinearOrchestrator();

    // Generate daily report (includes specialist counts, completed today, blocked)
    const dailyReport = await orchestrator.generateDailyReport();

    // Print comprehensive report
    console.log('='.repeat(70));
    console.log('📊 LINEAR COMPREHENSIVE REPORT');
    console.log('='.repeat(70));
    console.log(`Generated: ${new Date().toLocaleString()}\n`);

    // Section 1: Overview
    console.log('📋 OVERVIEW');
    console.log('-'.repeat(70));
    console.log(`   Total Active Issues: ${dailyReport.totalActive}`);
    console.log(`   Completed Today: ${dailyReport.completedToday.length}`);
    console.log(`   Blocked Issues: ${dailyReport.blocked.length}`);

    const healthScore =
      dailyReport.totalActive > 0
        ? Math.round(
            ((dailyReport.totalActive - dailyReport.blocked.length) /
              dailyReport.totalActive) *
              100
          )
        : 100;
    console.log(`   Health Score: ${healthScore}%\n`);

    // Section 2: Specialist Workload
    console.log('👥 SPECIALIST WORKLOAD');
    console.log('-'.repeat(70));
    const specialists = [
      { key: 'A', name: 'Architecture & Design', count: dailyReport.specialistCounts.A },
      { key: 'B', name: 'Implementation & Coding', count: dailyReport.specialistCounts.B },
      { key: 'C', name: 'Testing & Validation', count: dailyReport.specialistCounts.C },
      { key: 'D', name: 'Review & Documentation', count: dailyReport.specialistCounts.D },
    ];

    const maxCount = Math.max(...specialists.map((s) => s.count));

    specialists.forEach((specialist) => {
      const barLength = maxCount > 0 ? Math.round((specialist.count / maxCount) * 30) : 0;
      const bar = '█'.repeat(barLength) + '░'.repeat(30 - barLength);
      console.log(`   ${specialist.key}: ${specialist.name}`);
      console.log(`      ${bar} ${specialist.count} tasks`);
    });
    console.log();

    // Section 3: Recent Completions
    if (dailyReport.completedToday.length > 0) {
      console.log('✅ COMPLETED TODAY');
      console.log('-'.repeat(70));
      dailyReport.completedToday.forEach((task, i) => {
        console.log(`   ${i + 1}. ${task}`);
      });
      console.log();
    }

    // Section 4: Blocked Issues
    if (dailyReport.blocked.length > 0) {
      console.log('🚫 BLOCKED ISSUES (REQUIRES ATTENTION)');
      console.log('-'.repeat(70));
      dailyReport.blocked.forEach((task, i) => {
        console.log(`   ${i + 1}. ${task.title}`);
        console.log(`      🔗 ${task.url}`);
      });
      console.log();
    }

    // Section 5: Recommendations
    console.log('💡 RECOMMENDATIONS');
    console.log('-'.repeat(70));

    const recommendations: string[] = [];

    if (dailyReport.blocked.length > 0) {
      recommendations.push(`Review and resolve ${dailyReport.blocked.length} blocked issue(s)`);
    }

    if (dailyReport.specialistCounts.A > 5) {
      recommendations.push('Architect workload high - consider prioritization');
    }

    if (dailyReport.specialistCounts.B > 10) {
      recommendations.push('Implementation backlog building - may need additional resources');
    }

    if (dailyReport.completedToday.length === 0) {
      recommendations.push('No completions today - check for blockers or resourcing issues');
    }

    const totalTasks =
      dailyReport.specialistCounts.A +
      dailyReport.specialistCounts.B +
      dailyReport.specialistCounts.C +
      dailyReport.specialistCounts.D;

    if (totalTasks === 0) {
      recommendations.push('No active tasks - consider planning next milestone');
    }

    if (healthScore < 70) {
      recommendations.push('Health score below 70% - immediate attention required');
    }

    if (recommendations.length > 0) {
      recommendations.forEach((rec, i) => {
        console.log(`   ${i + 1}. ${rec}`);
      });
    } else {
      console.log('   ✅ No issues detected - system running smoothly');
    }
    console.log();

    // Section 6: Quick Actions
    console.log('⚡ QUICK ACTIONS');
    console.log('-'.repeat(70));
    console.log('   npm run agent:orchestrator -- --task "Description"  Create new task');
    console.log('   npm run agent:daily-report                         View daily status');
    console.log('   npm run agent:quality-gate -- --gate <name>        Check quality gate');
    console.log();

    console.log('='.repeat(70));

    // Exit code based on health
    if (healthScore < 50) {
      console.log('\n⚠️  WARNING: Health score critically low - immediate action required\n');
      process.exit(1);
    } else if (dailyReport.blocked.length > 0) {
      console.log('\n⚠️  ATTENTION: Blocked issues require resolution\n');
      process.exit(0);
    } else {
      console.log('\n✅ System healthy\n');
      process.exit(0);
    }
  } catch (error) {
    console.error('\n❌ Error:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

main();

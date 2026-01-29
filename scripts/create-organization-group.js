#!/usr/bin/env node
/**
 * Create Organization Group
 *
 * Creates an organization group linking Disaster Recovery entities
 * for consolidated tax analysis and reporting.
 *
 * Run: node scripts/create-organization-group.js
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  console.log('\n=== Creating Organization Group ===\n');

  // Get all current organizations
  const { data: orgs, error: orgsError } = await supabase
    .from('organizations')
    .select('*')
    .order('created_at', { ascending: true });

  if (orgsError) {
    console.error('Failed to fetch organizations:', orgsError);
    return;
  }

  console.log(`Found ${orgs.length} organizations:`);
  orgs.forEach((org, i) => {
    console.log(`  ${i + 1}. ${org.name} (${org.id})`);
  });

  if (orgs.length === 0) {
    console.log('\n❌ No organizations found. Connect Xero accounts first.');
    return;
  }

  // Check if group already exists
  const { data: existingGroup } = await supabase
    .from('organization_groups')
    .select('*')
    .eq('name', 'Disaster Recovery Group')
    .single();

  let groupId;

  if (existingGroup) {
    console.log('\n✓ Organization group already exists:', existingGroup.id);
    groupId = existingGroup.id;
  } else {
    // Create organization group
    const { data: newGroup, error: groupError } = await supabase
      .from('organization_groups')
      .insert({
        name: 'Disaster Recovery Group',
        description: 'Consolidated tax analysis for Disaster Recovery entities (DR Qld, DR Main, CARSI)',
        settings: {
          pricing_tier: 'multi_org',
          base_price: 995,
          per_org_price: 199,
          total_orgs: 3, // Will have 3 when CARSI reconnects
        },
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (groupError) {
      console.error('Failed to create group:', groupError);
      return;
    }

    console.log('\n✅ Created organization group:', newGroup.id);
    groupId = newGroup.id;
  }

  // Add all organizations to the group
  console.log('\n=== Linking Organizations to Group ===\n');

  for (const org of orgs) {
    // Check if already linked
    const { data: existing } = await supabase
      .from('organization_group_members')
      .select('*')
      .eq('group_id', groupId)
      .eq('organization_id', org.id)
      .single();

    if (existing) {
      console.log(`  ✓ ${org.name} already linked`);
      continue;
    }

    // Link organization to group
    const { error: linkError } = await supabase
      .from('organization_group_members')
      .insert({
        group_id: groupId,
        organization_id: org.id,
        role: 'member',
        added_at: new Date().toISOString(),
      });

    if (linkError) {
      console.error(`  ❌ Failed to link ${org.name}:`, linkError);
    } else {
      console.log(`  ✅ Linked ${org.name} to group`);
    }
  }

  // Display group summary
  console.log('\n=== Organization Group Summary ===\n');

  const { data: members } = await supabase
    .from('organization_group_members')
    .select(`
      *,
      organization:organizations(*)
    `)
    .eq('group_id', groupId);

  console.log('Group ID:', groupId);
  console.log('Group Name: Disaster Recovery Group');
  console.log('Current Members:', members.length);
  console.log('Target Members: 3 (CARSI pending reconnection)');
  console.log('\nMembers:');
  members.forEach((member, i) => {
    console.log(`  ${i + 1}. ${member.organization.name}`);
    console.log(`     Org ID: ${member.organization.id}`);
    console.log(`     Xero Tenant: ${member.organization.xero_tenant_id}`);
  });

  console.log('\n=== Pricing Calculation ===\n');
  const currentOrgs = members.length;
  const basePrice = 995;
  const perOrgPrice = 199;
  const additionalOrgs = Math.max(0, currentOrgs - 1);
  const currentTotal = basePrice + (additionalOrgs * perOrgPrice);
  const targetTotal = basePrice + (2 * perOrgPrice); // When all 3 connected

  console.log(`Base Price: $${basePrice}`);
  console.log(`Additional Organizations (${additionalOrgs}): $${additionalOrgs * perOrgPrice}`);
  console.log(`Current Total: $${currentTotal}/month`);
  console.log(`Target Total (with CARSI): $${targetTotal}/month`);

  console.log('\n=== Next Steps ===\n');
  console.log('1. Reconnect CARSI via OAuth');
  console.log('2. Run this script again to add CARSI to the group');
  console.log('3. Sync historical data for all organizations');
  console.log('4. Run consolidated forensic audit');
  console.log('5. Generate multi-org report');

  console.log('\n✅ Organization group setup complete!\n');
})();

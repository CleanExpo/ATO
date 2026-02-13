#!/bin/bash

# Test Phases 1 & 2 - Automated Test Script
# Run this after applying database migrations and setting up Xero connection

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}==================================="
echo "Testing Phases 1 & 2"
echo "===================================${NC}"
echo ""

# Check prerequisites
echo -e "${BLUE}Checking prerequisites...${NC}"

# Check if jq is installed
if ! command -v jq &> /dev/null; then
    echo -e "${YELLOW}⚠️  jq not installed (optional but recommended)${NC}"
    echo "   Install with: brew install jq (Mac) or apt-get install jq (Linux)"
fi

# Check if server is running
if ! curl -s http://localhost:3000/api/health &> /dev/null; then
    echo -e "${RED}❌ Dev server not running${NC}"
    echo "   Run: npm run dev"
    exit 1
fi

echo -e "${GREEN}✅ Dev server is running${NC}"

# Get tenant ID
echo ""
echo -e "${BLUE}Getting tenant ID...${NC}"

RESPONSE=$(curl -s http://localhost:3000/api/xero/organizations)

if [ -z "$RESPONSE" ] || [ "$RESPONSE" = "[]" ]; then
    echo -e "${RED}❌ No Xero connection found${NC}"
    echo "   Visit: http://localhost:3000/api/auth/xero to connect"
    exit 1
fi

TENANT_ID=$(echo $RESPONSE | jq -r '.[0].tenantId' 2>/dev/null || echo $RESPONSE | grep -o '"tenantId":"[^"]*"' | cut -d'"' -f4)

if [ -z "$TENANT_ID" ] || [ "$TENANT_ID" = "null" ]; then
    echo -e "${RED}❌ Could not get tenant ID${NC}"
    echo "   Response: $RESPONSE"
    exit 1
fi

echo -e "${GREEN}✅ Tenant ID: $TENANT_ID${NC}"

# Test Phase 1: Historical Sync
echo ""
echo -e "${BLUE}==================================="
echo "Phase 1: Historical Data Sync"
echo "===================================${NC}"
echo ""

echo "Starting sync (1 year for quick test)..."

SYNC_RESPONSE=$(curl -s -X POST http://localhost:3000/api/audit/sync-historical \
  -H "Content-Type: application/json" \
  -d "{\"tenantId\": \"$TENANT_ID\", \"years\": 1}")

echo "$SYNC_RESPONSE" | jq '.' 2>/dev/null || echo "$SYNC_RESPONSE"

# Wait for sync to complete
echo ""
echo "Monitoring sync progress..."
echo "(This may take 2-10 minutes depending on transaction count)"
echo ""

SYNC_START_TIME=$(date +%s)

while true; do
  STATUS=$(curl -s "http://localhost:3000/api/audit/sync-status/$TENANT_ID")

  if command -v jq &> /dev/null; then
    IS_COMPLETE=$(echo $STATUS | jq -r '.isComplete')
    IS_ERROR=$(echo $STATUS | jq -r '.isError')
    PROGRESS=$(echo $STATUS | jq -r '.progress')
    SYNCED=$(echo $STATUS | jq -r '.transactionsSynced')
    TOTAL=$(echo $STATUS | jq -r '.totalEstimated')
    CURRENT_YEAR=$(echo $STATUS | jq -r '.currentYear')
  else
    IS_COMPLETE=$(echo $STATUS | grep -o '"isComplete":[^,]*' | cut -d':' -f2)
    IS_ERROR=$(echo $STATUS | grep -o '"isError":[^,]*' | cut -d':' -f2)
    PROGRESS=$(echo $STATUS | grep -o '"progress":[0-9.]*' | cut -d':' -f2)
  fi

  ELAPSED=$(($(date +%s) - SYNC_START_TIME))

  if command -v jq &> /dev/null; then
    echo -e "Progress: ${GREEN}${PROGRESS}%${NC} | Synced: ${SYNCED}/${TOTAL} | Year: ${CURRENT_YEAR} | Elapsed: ${ELAPSED}s"
  else
    echo "Progress: ${PROGRESS}% | Elapsed: ${ELAPSED}s"
  fi

  if [ "$IS_COMPLETE" = "true" ]; then
    echo ""
    echo -e "${GREEN}✅ Sync complete!${NC}"
    break
  fi

  if [ "$IS_ERROR" = "true" ]; then
    echo ""
    echo -e "${RED}❌ Sync failed:${NC}"
    echo "$STATUS" | jq '.errorMessage' 2>/dev/null || echo "$STATUS"
    exit 1
  fi

  sleep 5
done

# Verify cached data
echo ""
echo "Verifying cached data..."
CACHED=$(curl -s "http://localhost:3000/api/audit/cached-transactions?tenantId=$TENANT_ID&page=1")

if command -v jq &> /dev/null; then
  TOTAL_TRANSACTIONS=$(echo $CACHED | jq -r '.summary.totalTransactions')
  echo -e "${GREEN}✅ Cached ${TOTAL_TRANSACTIONS} transactions${NC}"
  echo ""
  echo "Summary:"
  echo $CACHED | jq '.summary'
else
  echo $CACHED
fi

# Test Phase 2: AI Analysis
echo ""
echo -e "${BLUE}==================================="
echo "Phase 2: AI Forensic Analysis"
echo "===================================${NC}"
echo ""

echo "Starting AI analysis (small batch for quick test)..."

ANALYSIS_RESPONSE=$(curl -s -X POST http://localhost:3000/api/audit/analyze \
  -H "Content-Type: application/json" \
  -d "{\"tenantId\": \"$TENANT_ID\", \"businessName\": \"Test Business\", \"industry\": \"Software\", \"batchSize\": 20}")

echo "$ANALYSIS_RESPONSE" | jq '.' 2>/dev/null || echo "$ANALYSIS_RESPONSE"

if command -v jq &> /dev/null; then
  ESTIMATED_COST=$(echo $ANALYSIS_RESPONSE | jq -r '.estimatedCostUSD')
  echo ""
  echo -e "${YELLOW}Estimated cost: \$${ESTIMATED_COST}${NC}"
fi

# Wait for analysis to complete
echo ""
echo "Monitoring analysis progress..."
echo "(This may take 5-30 minutes depending on transaction count)"
echo ""

ANALYSIS_START_TIME=$(date +%s)

while true; do
  STATUS=$(curl -s "http://localhost:3000/api/audit/analysis-status/$TENANT_ID")

  if command -v jq &> /dev/null; then
    IS_COMPLETE=$(echo $STATUS | jq -r '.isComplete')
    IS_ERROR=$(echo $STATUS | jq -r '.isError')
    PROGRESS=$(echo $STATUS | jq -r '.progress')
    ANALYZED=$(echo $STATUS | jq -r '.transactionsAnalyzed')
    TOTAL=$(echo $STATUS | jq -r '.totalTransactions')
    ETA=$(echo $STATUS | jq -r '.eta')
  else
    IS_COMPLETE=$(echo $STATUS | grep -o '"isComplete":[^,]*' | cut -d':' -f2)
    IS_ERROR=$(echo $STATUS | grep -o '"isError":[^,]*' | cut -d':' -f2)
    PROGRESS=$(echo $STATUS | grep -o '"progress":[0-9.]*' | cut -d':' -f2)
  fi

  ELAPSED=$(($(date +%s) - ANALYSIS_START_TIME))

  if command -v jq &> /dev/null; then
    echo -e "Progress: ${GREEN}${PROGRESS}%${NC} | Analyzed: ${ANALYZED}/${TOTAL} | ETA: ${ETA} | Elapsed: ${ELAPSED}s"
  else
    echo "Progress: ${PROGRESS}% | Elapsed: ${ELAPSED}s"
  fi

  if [ "$IS_COMPLETE" = "true" ]; then
    echo ""
    echo -e "${GREEN}✅ Analysis complete!${NC}"
    break
  fi

  if [ "$IS_ERROR" = "true" ]; then
    echo ""
    echo -e "${RED}❌ Analysis failed:${NC}"
    echo "$STATUS" | jq '.errorMessage' 2>/dev/null || echo "$STATUS"
    exit 1
  fi

  sleep 15
done

# Get results
echo ""
echo "Fetching analysis results..."
RESULTS=$(curl -s "http://localhost:3000/api/audit/analysis-results?tenantId=$TENANT_ID&page=1")

echo ""
echo -e "${GREEN}==================================="
echo "Analysis Summary"
echo "===================================${NC}"

if command -v jq &> /dev/null; then
  echo $RESULTS | jq '.summary'

  # Highlight R&D findings
  RND_CANDIDATES=$(echo $RESULTS | jq -r '.summary.rnd.candidates')
  MEETS_DIV355=$(echo $RESULTS | jq -r '.summary.rnd.meetsDiv355')
  RND_PCT=$(echo $RESULTS | jq -r '.summary.rnd.percentage')

  echo ""
  echo -e "${BLUE}R&D Tax Incentive Findings:${NC}"
  echo -e "  Candidates: ${GREEN}${RND_CANDIDATES}${NC}"
  echo -e "  Meets Division 355: ${GREEN}${MEETS_DIV355}${NC}"
  echo -e "  Percentage: ${GREEN}${RND_PCT}%${NC}"

  # Cost summary
  TOTAL_COST=$(echo $RESULTS | jq -r '.summary.cost.totalCost')
  COST_PER_TXN=$(echo $RESULTS | jq -r '.summary.cost.costPerTransaction')

  echo ""
  echo -e "${YELLOW}Cost Analysis:${NC}"
  echo -e "  Total cost: \$${TOTAL_COST}"
  echo -e "  Cost per transaction: \$${COST_PER_TXN}"
else
  echo $RESULTS
fi

# Final summary
echo ""
echo -e "${GREEN}==================================="
echo "✅ All Tests Passed!"
echo "===================================${NC}"
echo ""
echo "Next steps:"
echo "1. Review analysis results in detail"
echo "2. Check validation logs in .claude/hooks/logs/validation_logs/"
echo "3. Proceed to Phase 3 (Tax Engines)"
echo ""
echo "Quick commands:"
echo "  View R&D candidates:"
echo "    curl \"http://localhost:3000/api/audit/analysis-results?tenantId=$TENANT_ID&isRndCandidate=true&minConfidence=70\" | jq '.results[0]'"
echo ""
echo "  Check database:"
echo "    psql \$DATABASE_URL -c \"SELECT COUNT(*) FROM forensic_analysis_results WHERE tenant_id = '$TENANT_ID';\""
echo ""

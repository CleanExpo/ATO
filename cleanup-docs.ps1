# Documentation Cleanup Script
# Removes 200+ fluff .md files while preserving essentials
# Run with: powershell -ExecutionPolicy Bypass -File cleanup-docs.ps1

param(
    [switch]$WhatIf = $false,
    [switch]$Backup = $true
)

$ErrorActionPreference = "SilentlyContinue"

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "  Documentation Cleanup Script" -ForegroundColor Cyan
Write-Host "  Target: 277 .md files -> ~40-50 files" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Create Backup
if ($Backup -and -not $WhatIf) {
    $backupDir = "docs-backup-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
    Write-Host "Creating backup: $backupDir" -ForegroundColor Yellow
    Copy-Item -Path "ato-app" -Destination $backupDir -Recurse -Force
    Write-Host "Backup complete" -ForegroundColor Green
    Write-Host ""
}

# Files to DELETE - organized by pattern
$patterns = @{
    "Session Summaries" = @(
        "*SESSION*.md"
        "*session*.md"
        "*SUMMARY*.md"
        "*summary*.md"
        "OVERNIGHT_WORK*.md"
        "*PHASE*_COMPLETE*.md"
        "TASK_*_COMPLETION*.md"
        "*_COMPLETION_*.md"
        "*COMPLETE*.md"
        "UNI-230*.md"
        "LINEAR_*_PHASE*.md"
    )
    
    "Daily Reports" = @(
        "daily*.md"
        "*daily*.md"
    )
    
    "Status Reports" = @(
        "*STATUS*.md"
        "*status*.md"
        "SYNC_STATUS*.md"
        "IMPLEMENTATION_STATUS*.md"
        "DEPLOYMENT_STATUS*.md"
        "*PROJECT_STATUS*.md"
        "MISSION_ACCOMPLISHED*.md"
        "ORCHESTRATION_PHASE_COMPLETE*.md"
    )
    
    "Test Reports" = @(
        "TEST_*.md"
        "*TEST*.md"
        "TESTING*.md"
    )
    
    "Integration Summaries" = @(
        "*_INTEGRATION_*.md"
        "*_IMPLEMENTATION_*.md"
        "MYOB_*.md"
        "QUICKBOOKS_*.md"
    )
    
    "Audit/Findings" = @(
        "AUDIT_FINDINGS_*.md"
        "*_AUDIT_*.md"
        "*_FINDINGS*.md"
        "SCHEMA_AUDIT*.md"
    )
    
    "Temporary/One-time" = @(
        "*_NOW.md"
        "START_*.md"
        "RELINK_*.md"
        "RESET_*.md"
        "RECOVERY_*.md"
        "RUNBOOK*.md"
        "QUICK_ENV*.md"
        "RESEARCH*.md"
        "PLAN*.md"
        "STRATEGY*.md"
        "LIMITS*.md"
        "GEMINI*.md"
        "ARCHIVED*.md"
        "MIGRATION_GUIDE*.md"
        "KNOWLEDGE*.md"
        "*FIX*.md"
        "APPLY_*.md"
    )
}

# Files to KEEP (whitelist)
$keepPatterns = @(
    "README.md"
    "CLAUDE.md"
    "spec.md"
    "ARCHITECTURE.md"
    "API_DOCUMENTATION.md"
    "DESIGN_SYSTEM.md"
    "AGENTS_README.md"
    "DATABASE_MIGRATIONS.md"
    "MULTI_AGENT_ARCHITECTURE.md"
    "FORENSIC_AUDIT_GUIDE.md"
    "DEPLOYMENT_INSTRUCTIONS.md"
    "IMPLEMENTATION_GUIDE.md"
    "QUICK_START.md"
    "ENVIRONMENT_VARIABLES_SETUP.md"
    "CODEBASE_AUDIT_SUMMARY.md"
    "DOCUMENTATION_CLEANUP_PLAN.md"
    "*.agent\*.md"
    "*orchestrator*.md"
    "*specialist*.md"
)

# Get all .md files
$allMdFiles = Get-ChildItem -Path "ato-app" -Filter "*.md" -Recurse | Where-Object { $_.FullName -notlike "*node_modules*" }
$rootMdFiles = Get-ChildItem -Path "." -Filter "*.md" -File

Write-Host "Found $($allMdFiles.Count) .md files in ato-app/" -ForegroundColor Cyan
Write-Host "Found $($rootMdFiles.Count) .md files in root" -ForegroundColor Cyan
Write-Host ""

# Process deletions
$deletedCount = 0
$preservedCount = 0

foreach ($patternGroup in $patterns.GetEnumerator()) {
    Write-Host "Processing: $($patternGroup.Key)" -ForegroundColor Yellow
    
    foreach ($pattern in $patternGroup.Value) {
        $files = Get-ChildItem -Path "ato-app" -Filter $pattern -Recurse | Where-Object { 
            $_.FullName -notlike "*node_modules*" -and
            $_.Name -notin @("README.md", "CLAUDE.md", "API_DOCUMENTATION.md", "ARCHITECTURE.md", "spec.md", "DESIGN_SYSTEM.md", "AGENTS_README.md", "DATABASE_MIGRATIONS.md", "MULTI_AGENT_ARCHITECTURE.md", "FORENSIC_AUDIT_GUIDE.md", "DEPLOYMENT_INSTRUCTIONS.md", "IMPLEMENTATION_GUIDE.md", "QUICK_START.md", "ENVIRONMENT_VARIABLES_SETUP.md", "CODEBASE_AUDIT_SUMMARY.md")
        }
        
        foreach ($file in $files) {
            # Check if file is in .agent folder (preserve agent configs)
            if ($file.FullName -like "*\.agent\*") {
                Write-Host "  Preserving agent config: $($file.Name)" -ForegroundColor DarkGray
                $preservedCount++
                continue
            }
            
            if ($WhatIf) {
                Write-Host "  Would delete: $($file.FullName.Replace((Get-Location).Path, ''))" -ForegroundColor Red
            } else {
                Write-Host "  Deleting: $($file.Name)" -ForegroundColor Red
                Remove-Item $file.FullName -Force
            }
            $deletedCount++
        }
    }
}

# Handle SQL files (move to scripts/migrations)
$sqlFiles = Get-ChildItem -Path "ato-app" -Filter "*.sql" -File
if ($sqlFiles.Count -gt 0) {
    Write-Host ""
    Write-Host "Moving SQL files to scripts/migrations/" -ForegroundColor Yellow
    
    if (-not $WhatIf) {
        New-Item -ItemType Directory -Path "ato-app\scripts\migrations" -Force | Out-Null
    }
    
    foreach ($sql in $sqlFiles) {
        if ($WhatIf) {
            Write-Host "  Would move: $($sql.Name) -> scripts/migrations/" -ForegroundColor Cyan
        } else {
            Write-Host "  Moving: $($sql.Name)" -ForegroundColor Cyan
            Move-Item $sql.FullName "ato-app\scripts\migrations\" -Force
        }
    }
}

# Clean root level .md files (c:\ATO)
Write-Host ""
Write-Host "Cleaning root level .md files..." -ForegroundColor Yellow

$rootFilesToDelete = $rootMdFiles | Where-Object { 
    $_.Name -notin @("README.md", "DOCUMENTATION_CLEANUP_PLAN.md", "CONTEXT_FIX_SUMMARY.md", "FIX_TERMINAL_NOW.md")
}

foreach ($file in $rootFilesToDelete) {
    # Check if it's a keeper
    $isKeeper = $false
    foreach ($keep in $keepPatterns) {
        if ($file.Name -like $keep) {
            $isKeeper = $true
            break
        }
    }
    
    # Check if it contains essential keywords
    $content = Get-Content $file.FullName -Raw -ErrorAction SilentlyContinue
    if ($content -and ($content -match "CORE DOCUMENTATION|ESSENTIAL|DO NOT DELETE|CRITICAL")) {
        $isKeeper = $true
    }
    
    if (-not $isKeeper) {
        if ($WhatIf) {
            Write-Host "  Would delete root: $($file.Name)" -ForegroundColor Red
        } else {
            Write-Host "  Deleting root: $($file.Name)" -ForegroundColor Red
            Remove-Item $file.FullName -Force
        }
        $deletedCount++
    } else {
        Write-Host "  Preserving: $($file.Name)" -ForegroundColor Green
        $preservedCount++
    }
}

# Summary
Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "  Cleanup Summary" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
if ($WhatIf) {
    Write-Host "Mode: WHAT-IF (no files actually deleted)" -ForegroundColor Yellow
}
Write-Host "Files to delete: $deletedCount" -ForegroundColor Red
Write-Host "Files preserved: $preservedCount" -ForegroundColor Green
Write-Host ""

# Count remaining
$remaining = (Get-ChildItem -Path "ato-app" -Filter "*.md" -Recurse | Where-Object { $_.FullName -notlike "*node_modules*" }).Count
$remainingRoot = (Get-ChildItem -Path "." -Filter "*.md" -File).Count
Write-Host "Remaining .md files:" -ForegroundColor Cyan
Write-Host "  ato-app/: $remaining" -ForegroundColor White
Write-Host "  root/: $remainingRoot" -ForegroundColor White
Write-Host "  Total: $($remaining + $remainingRoot)" -ForegroundColor White
Write-Host ""

if ($WhatIf) {
    Write-Host "Run without -WhatIf to actually delete files" -ForegroundColor Yellow
    Write-Host "Example: .\cleanup-docs.ps1" -ForegroundColor Yellow
} else {
    Write-Host "Cleanup complete!" -ForegroundColor Green
    if ($Backup) {
        Write-Host "Backup location: $backupDir" -ForegroundColor Yellow
    }
}

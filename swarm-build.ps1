# =============================================================================
# Swarm Build System - PowerShell Orchestration
# ATO Platform | Windows-native | Integrates with .agent/ architecture
# =============================================================================
#
# Usage:
#   . .\swarm-build.ps1       # Source the functions
#   swarm-discover             # Phase 1: Explore
#   swarm-gates                # Run all quality gates
#   swarm-flags                # Red flag scan
#   swarm-validators           # Run domain validators
#   swarm-audit                # Full independent audit
# =============================================================================

$ErrorActionPreference = "Continue"
$script:SwarmRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
if (-not $script:SwarmRoot) { $script:SwarmRoot = Get-Location }

function Write-SwarmHeader {
    param([string]$Phase, [string]$Description)
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "  SWARM: $Phase" -ForegroundColor Cyan
    Write-Host "  $Description" -ForegroundColor Gray
    Write-Host "  $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor Gray
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
}

function Write-Gate {
    param([string]$Name, [bool]$Passed, [string]$Detail)
    if ($Passed) { $icon = "PASS"; $color = "Green" }
    else { $icon = "FAIL"; $color = "Red" }
    Write-Host "  [$icon] $Name" -ForegroundColor $color
    if ($Detail) { Write-Host "        $Detail" -ForegroundColor Gray }
}

# ---- Phase 1: DISCOVER ----

function swarm-discover {
    Write-SwarmHeader "EXPLORE" "Discovering project state"
    Push-Location $script:SwarmRoot

    try {
        $output = @()
        $output += "# Discovery Report"
        $output += "Date: $(Get-Date -Format 'yyyy-MM-ddTHH:mm:ss')"
        $output += ""

        # Test health
        $output += "## Tests"
        $output += '```'
        $testResult = & pnpm test:run 2>&1 | Out-String
        $output += $testResult.Trim()
        $output += '```'
        $output += ""

        # Type health
        $output += "## Type Check"
        $output += '```'
        $typeResult = & npx tsc --noEmit 2>&1 | Out-String
        $trimmed = $typeResult.Trim()
        if ($trimmed) { $output += $trimmed } else { $output += "0 errors" }
        $output += '```'
        $output += ""

        # Lint health
        $output += "## Lint"
        $output += '```'
        $lintResult = & pnpm lint 2>&1 | Out-String
        $output += $lintResult.Trim()
        $output += '```'
        $output += ""

        # Build health
        $output += "## Build"
        $output += '```'
        $buildResult = & pnpm build 2>&1 | Out-String
        $buildLines = ($buildResult -split "`n") | Select-Object -Last 15
        $output += ($buildLines -join "`n").Trim()
        $output += '```'
        $output += ""

        # Source inventory
        $output += "## Source Files"
        $output += '```'
        $tsFiles = Get-ChildItem -Path app, lib -Recurse -Include *.ts, *.tsx -ErrorAction SilentlyContinue | Measure-Object
        $testFiles = Get-ChildItem -Path tests -Recurse -Include *.test.*, *.spec.* -ErrorAction SilentlyContinue | Measure-Object
        $output += "TypeScript source files: $($tsFiles.Count)"
        $output += "Test files: $($testFiles.Count)"
        $output += '```'
        $output += ""

        # Analysis engines
        $output += "## Analysis Engines"
        $output += '```'
        $engines = Get-ChildItem -Path lib/analysis -Filter "*-engine.ts" -ErrorAction SilentlyContinue
        if ($engines) {
            $engines | ForEach-Object { $output += "  $($_.Name)" }
        } else {
            $output += "  NO ENGINES FOUND"
        }
        $output += '```'
        $output += ""

        # API routes
        $output += "## API Routes"
        $output += '```'
        $routes = Get-ChildItem -Path app/api -Recurse -Filter "route.ts" -ErrorAction SilentlyContinue
        if ($routes) {
            $routes | ForEach-Object {
                $rel = $_.DirectoryName -replace [regex]::Escape($script:SwarmRoot), ''
                $output += "  $rel"
            }
        } else {
            $output += "  NO ROUTES FOUND"
        }
        $output += '```'
        $output += ""

        # Git state
        $output += "## Git State"
        $output += '```'
        $gitStatus = & git status --short 2>&1 | Out-String
        $gitTrimmed = $gitStatus.Trim()
        if ($gitTrimmed) { $output += $gitTrimmed } else { $output += "(clean)" }
        $output += ""
        $gitLog = & git log --oneline -10 2>&1 | Out-String
        $output += $gitLog.Trim()
        $output += '```'

        # Write discovery
        $specsDir = Join-Path $script:SwarmRoot "specs"
        if (-not (Test-Path $specsDir)) { New-Item -ItemType Directory -Path $specsDir | Out-Null }
        $output -join "`n" | Set-Content (Join-Path $specsDir "discovery.md") -Encoding UTF8

        Write-Host "Discovery written to specs/discovery.md" -ForegroundColor Green
    }
    finally {
        Pop-Location
    }
}

# ---- Quality Gates ----

function swarm-gates {
    Write-SwarmHeader "QUALITY GATES" "Running all verification checks"
    Push-Location $script:SwarmRoot

    try {
        $allPassed = $true

        # Tests
        Write-Host "Running tests..." -ForegroundColor Yellow
        $testOutput = & pnpm test:run 2>&1 | Out-String
        # Check output text for failures (more reliable than $LASTEXITCODE with piped output)
        $testPassed = ($testOutput -match "\d+ passed" -and $testOutput -notmatch "\d+ failed")
        $testSummary = ($testOutput -split "`n" | Select-String -Pattern "Tests|passed|failed|test" | Select-Object -First 3 | Out-String).Trim()
        Write-Gate "Tests" $testPassed $testSummary
        if (-not $testPassed) { $allPassed = $false }

        # Types
        Write-Host "Running typecheck..." -ForegroundColor Yellow
        $typeOutput = & npx tsc --noEmit 2>&1 | Out-String
        $typePassed = ($LASTEXITCODE -eq 0)
        $typeErrors = ($typeOutput | Select-String -Pattern "error TS" | Measure-Object).Count
        Write-Gate "Types" $typePassed "$typeErrors error(s)"
        if (-not $typePassed) { $allPassed = $false }

        # Lint
        Write-Host "Running lint..." -ForegroundColor Yellow
        $lintOutput = & pnpm lint 2>&1 | Out-String
        $lintPassed = ($LASTEXITCODE -eq 0)
        $lintSummary = ($lintOutput -split "`n" | Select-Object -Last 5 | Out-String).Trim()
        Write-Gate "Lint" $lintPassed $lintSummary
        if (-not $lintPassed) { $allPassed = $false }

        # Build
        Write-Host "Running build..." -ForegroundColor Yellow
        $buildOutput = & pnpm build 2>&1 | Out-String
        $buildPassed = ($LASTEXITCODE -eq 0)
        $buildSummary = ($buildOutput -split "`n" | Select-Object -Last 5 | Out-String).Trim()
        Write-Gate "Build" $buildPassed $buildSummary
        if (-not $buildPassed) { $allPassed = $false }

        Write-Host ""
        if ($allPassed) {
            Write-Host "  ALL GATES PASSED" -ForegroundColor Green
        } else {
            Write-Host "  GATES FAILED - fix issues before continuing" -ForegroundColor Red
        }

        return $allPassed
    }
    finally {
        Pop-Location
    }
}

# ---- Red Flag Scan ----

function swarm-flags {
    Write-SwarmHeader "RED FLAGS" "Scanning for code quality issues"
    Push-Location $script:SwarmRoot

    try {
        $todoCount = (Get-ChildItem -Path lib, app -Recurse -Include *.ts, *.tsx -ErrorAction SilentlyContinue | Select-String -Pattern "TODO|FIXME|HACK" | Measure-Object).Count
        $consoleCount = (Get-ChildItem -Path lib, app -Recurse -Include *.ts, *.tsx -ErrorAction SilentlyContinue | Select-String -Pattern "console\.log" | Measure-Object).Count
        $anyCount = (Get-ChildItem -Path lib, app -Recurse -Include *.ts, *.tsx -ErrorAction SilentlyContinue | Select-String -Pattern ":\s*any\b|as\s+any" | Measure-Object).Count
        $tsIgnoreCount = (Get-ChildItem -Path lib, app -Recurse -Include *.ts, *.tsx -ErrorAction SilentlyContinue | Select-String -Pattern "ts-ignore|ts-expect-error" | Measure-Object).Count
        $eslintCount = (Get-ChildItem -Path lib, app -Recurse -Include *.ts, *.tsx -ErrorAction SilentlyContinue | Select-String -Pattern "eslint-disable" | Measure-Object).Count
        $skipCount = (Get-ChildItem -Path tests -Recurse -Include *.test.*, *.spec.* -ErrorAction SilentlyContinue | Select-String -Pattern "\.skip|\.only|xit|xdescribe" | Measure-Object).Count
        $mockCount = (Get-ChildItem -Path lib/analysis -Recurse -Include *.ts -ErrorAction SilentlyContinue | Select-String -Pattern "mock|fake|dummy" | Measure-Object).Count

        $flags = [ordered]@{
            "TODO/FIXME/HACK"    = $todoCount
            "console.log"        = $consoleCount
            "any type"           = $anyCount
            "ts-ignore"          = $tsIgnoreCount
            "eslint-disable"     = $eslintCount
            "Disabled tests"     = $skipCount
            "Mock in engines"    = $mockCount
        }

        Write-Host "  Flag                     Count" -ForegroundColor Gray
        Write-Host "  ----                     -----" -ForegroundColor Gray
        foreach ($key in $flags.Keys) {
            $count = $flags[$key]
            if ($count -eq 0) { $color = "Green" } else { $color = "Yellow" }
            Write-Host "  $($key.PadRight(25)) $count" -ForegroundColor $color
        }
    }
    finally {
        Pop-Location
    }
}

# ---- Domain Validators ----

function swarm-validators {
    Write-SwarmHeader "DOMAIN VALIDATORS" "Running tax compliance validators"
    Push-Location $script:SwarmRoot

    try {
        $validators = @(
            @{
                Name = "Tax Calculation"
                Script = ".claude/hooks/validators/tax_calculation_validator.py"
                Input = '{"calculation_type":"rnd","eligible_expenditure":100000,"rnd_offset":43500}'
            },
            @{
                Name = "Financial Year"
                Script = ".claude/hooks/validators/financial_year_validator.py"
                Input = '{"financial_year":"FY2024-25","start":"2024-07-01","end":"2025-06-30"}'
            },
            @{
                Name = "Division 7A"
                Script = ".claude/hooks/validators/div7a_validator.py"
                Input = '{"loan_amount":100000,"benchmark_rate":0.0877,"term":7}'
            }
        )

        foreach ($v in $validators) {
            if (Test-Path $v.Script) {
                Write-Host "  Running $($v.Name)..." -ForegroundColor Yellow
                $result = $v.Input | python $v.Script 2>&1 | Out-String
                $passed = ($LASTEXITCODE -eq 0)
                Write-Gate $v.Name $passed $result.Trim()
            } else {
                Write-Host "  [SKIP] $($v.Name) - validator not found" -ForegroundColor Gray
            }
        }
    }
    finally {
        Pop-Location
    }
}

# ---- Full Audit ----

function swarm-audit {
    Write-SwarmHeader "FULL AUDIT" "Clean rebuild + all checks"
    Push-Location $script:SwarmRoot

    try {
        Write-Host "Removing node_modules..." -ForegroundColor Yellow
        if (Test-Path node_modules) {
            Remove-Item -Recurse -Force node_modules -ErrorAction SilentlyContinue
        }

        Write-Host "Installing dependencies..." -ForegroundColor Yellow
        & pnpm install

        Write-Host ""
        $gatesPassed = swarm-gates

        Write-Host ""
        swarm-flags

        Write-Host ""
        swarm-validators

        Write-Host ""
        Write-Host "Running completion audit hook..." -ForegroundColor Yellow
        & python .claude/hooks/completion-audit.py

        Write-Host ""
        if ($gatesPassed) {
            Write-Host "  AUDIT COMPLETE - ALL GATES PASSED" -ForegroundColor Green
        } else {
            Write-Host "  AUDIT COMPLETE - FAILURES DETECTED" -ForegroundColor Red
        }
    }
    finally {
        Pop-Location
    }
}

# ---- Load Message ----

Write-Host "Swarm Build System loaded." -ForegroundColor Cyan
Write-Host "Commands: swarm-discover, swarm-gates, swarm-flags, swarm-validators, swarm-audit" -ForegroundColor Gray

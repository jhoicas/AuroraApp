<#
.SYNOPSIS
  Ejecuta la suite de tests del backend y reporta cobertura (texto + HTML).

.EXAMPLE
  ./scripts/coverage.ps1
  ./scripts/coverage.ps1 -Scope phase2
  ./scripts/coverage.ps1 -Html
#>
param(
    [ValidateSet('all', 'phase1', 'phase2')]
    [string]$Scope = 'all',

    [switch]$Html
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Push-Location $root

try {
    $packages = switch ($Scope) {
        'phase1' { @('./pkg/finance/', './internal/domain/services/') }
        'phase2' { @('./internal/interfaces/http/handlers/', './internal/interfaces/http/middleware/', './internal/application/project/') }
        default { @('./...') }
    }

    # Ficheros que cada fase se compromete a cubrir por encima del 90%.
    $gatedFiles = switch ($Scope) {
        'phase1' {
            @('pkg/finance/calculator.go',
              'domain/services/telemetry_service.go',
              'domain/services/mga_xml_parser.go',
              'domain/services/embedding_provider.go',
              'domain/services/embedding_factory.go')
        }
        'phase2' {
            @('handlers/aurora_chat_handler.go',
              'handlers/aurora_chat_parse.go',
              'handlers/project_evaluation_handler.go',
              'handlers/ai_knowledge_handler.go',
              'handlers/ai_audit_handler.go',
              'handlers/ownership.go',
              'handlers/deps.go',
              'middleware/auth.go',
              'middleware/context.go',
              'middleware/rate_limit.go',
              'application/project/evaluation_service.go')
        }
        default { @() }
    }

    $profile = "coverage_$Scope.out"
    & go test -count=1 "-coverprofile=$profile" @packages
    if ($LASTEXITCODE -ne 0) { throw "go test falló" }

    Write-Host "`n--- Cobertura por función ---" -ForegroundColor Cyan
    & go tool cover "-func=$profile"

    if ($gatedFiles.Count -gt 0) {
        $total = 0
        $covered = 0
        Get-Content $profile | Select-Object -Skip 1 | ForEach-Object {
            $parts = $_ -split ' '
            $file = ($parts[0] -split ':')[0]
            if ($gatedFiles | Where-Object { $file.EndsWith($_) }) {
                $n = [int]$parts[1]
                $total += $n
                if ([int]$parts[2] -gt 0) { $covered += $n }
            }
        }

        $pct = if ($total -gt 0) { 100 * $covered / $total } else { 0 }
        Write-Host ("`nCobertura del alcance '{0}': {1}/{2} sentencias = {3:N1}%" -f $Scope, $covered, $total, $pct) -ForegroundColor Cyan

        if ($pct -lt 90) {
            Write-Error ("Cobertura por debajo del umbral del 90% ({0:N1}%)" -f $pct)
            exit 1
        }
        Write-Host "Umbral del 90% superado." -ForegroundColor Green
    }

    if ($Html) {
        $report = "coverage_$Scope.html"
        & go tool cover "-html=$profile" "-o=$report"
        Write-Host "Reporte HTML: $report" -ForegroundColor Green
    }
}
finally {
    Pop-Location
}

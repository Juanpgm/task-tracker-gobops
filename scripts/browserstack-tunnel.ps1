<#
.SYNOPSIS
  Inicia un túnel BrowserStack Local que expone tu dev server (Vite) a sesiones
  reales de Safari en iPhone / iPad físicos vía https://live.browserstack.com/.

.PARAMETER AccessKey
  Tu BROWSERSTACK_ACCESS_KEY. Si se omite, se usa la variable de entorno.

.PARAMETER LocalIdentifier
  Identificador único del túnel (default: "catatrack-dev"). Útil cuando hay
  múltiples túneles simultáneos.

.EXAMPLE
  $env:BROWSERSTACK_ACCESS_KEY = '...'
  .\scripts\browserstack-tunnel.ps1
#>
[CmdletBinding()]
param(
  [string]$AccessKey = $env:BROWSERSTACK_ACCESS_KEY,
  [string]$LocalIdentifier = 'catatrack-dev',
  [int]$VitePort = 5173
)

$ErrorActionPreference = 'Stop'

if (-not $AccessKey) {
  Write-Error "BROWSERSTACK_ACCESS_KEY no definido. Exporta `$env:BROWSERSTACK_ACCESS_KEY o pasa -AccessKey."
}

$binDir = Join-Path $PSScriptRoot '.browserstack'
$binPath = Join-Path $binDir 'BrowserStackLocal.exe'

if (-not (Test-Path $binPath)) {
  Write-Host "Descargando BrowserStackLocal binary..." -ForegroundColor Cyan
  New-Item -ItemType Directory -Force -Path $binDir | Out-Null
  $zipPath = Join-Path $binDir 'bsl.zip'
  Invoke-WebRequest -Uri 'https://www.browserstack.com/browserstack-local/BrowserStackLocal-win32.zip' -OutFile $zipPath
  Expand-Archive -Path $zipPath -DestinationPath $binDir -Force
  Remove-Item $zipPath
}

# Quick sanity check: Vite dev server reachable?
try {
  $null = Invoke-WebRequest -Uri "http://localhost:$VitePort" -UseBasicParsing -TimeoutSec 3
  Write-Host "[OK] Vite dev server escuchando en :$VitePort" -ForegroundColor Green
} catch {
  Write-Warning "Vite no responde en :$VitePort. Arranca 'npm run dev' en otra terminal antes de probar la sesión."
}

Write-Host ""
Write-Host "Abriendo tunel BrowserStack Local..." -ForegroundColor Cyan
Write-Host "  Identifier: $LocalIdentifier" -ForegroundColor DarkGray
Write-Host ""
Write-Host "Siguiente paso:" -ForegroundColor Yellow
Write-Host "  1. Ve a https://live.browserstack.com/dashboard"
Write-Host "  2. Selecciona iPhone 15 / iPhone SE / iPad Pro -> Safari"
Write-Host "  3. En la URL escribe: http://localhost:$VitePort"
Write-Host "  4. Marca 'Local Testing' en la barra lateral si no esta activo."
Write-Host ""
Write-Host "Presiona Ctrl+C para cerrar el tunel." -ForegroundColor DarkGray
Write-Host ""

& $binPath --key $AccessKey --local-identifier $LocalIdentifier --force-local --verbose 1

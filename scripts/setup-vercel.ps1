# ============================================================================== 
# CATATRACK - Script de Configuración de Vercel (PowerShell)
# ============================================================================== 
# Uso: .\scripts\setup-vercel.ps1

Write-Host "🚀 Configurando CATATRACK en Vercel..." -ForegroundColor Green
Write-Host ""

# Verificar que Vercel CLI esté instalado
$vercelCmd = Get-Command vercel -ErrorAction SilentlyContinue
if (-not $vercelCmd) {
    Write-Host "❌ Vercel CLI no está instalado." -ForegroundColor Red
    Write-Host "   Instálalo con: npm install -g vercel"
    exit 1
}

# Verificar que env.local existe
if (-not (Test-Path "env.local")) {
    Write-Host "❌ No se encuentra env.local" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Vercel CLI detectado" -ForegroundColor Green
Write-Host ""

# Leer env.local
$envContent = Get-Content -Path "env.local" -Raw

# Extraer valores
function Get-EnvValue {
    param([string]$key)
    $pattern = "^$key=(.+)$"
    $match = $envContent | Select-String -Pattern $pattern -AllMatches
    if ($match) {
        return $match.Matches[0].Groups[1].Value.Trim('"')
    }
    return $null
}

$FIREBASE_API_KEY = Get-EnvValue "VITE_FIREBASE_API_KEY"
$FIREBASE_AUTH_DOMAIN = Get-EnvValue "VITE_FIREBASE_AUTH_DOMAIN"
$FIREBASE_PROJECT_ID = Get-EnvValue "VITE_FIREBASE_PROJECT_ID"
$FIREBASE_STORAGE_BUCKET = Get-EnvValue "VITE_FIREBASE_STORAGE_BUCKET"
$FIREBASE_MESSAGING_SENDER_ID = Get-EnvValue "VITE_FIREBASE_MESSAGING_SENDER_ID"
$FIREBASE_APP_ID = Get-EnvValue "VITE_FIREBASE_APP_ID"
$API_URL = Get-EnvValue "VITE_API_URL"
$AUTH_API_URL = Get-EnvValue "VITE_AUTH_API_URL"

Write-Host "📋 Variables encontradas:" -ForegroundColor Cyan
Write-Host "   - FIREBASE_API_KEY: $($FIREBASE_API_KEY.Substring(0, [Math]::Min(20, $FIREBASE_API_KEY.Length)))..."
Write-Host "   - FIREBASE_PROJECT_ID: $FIREBASE_PROJECT_ID"
Write-Host "   - API_URL: $API_URL"
Write-Host "   - AUTH_API_URL: $AUTH_API_URL"
Write-Host ""

# Pedir confirmación
$confirmation = Read-Host "¿Continuar con la configuración en Vercel? (s/n)"
if ($confirmation -ne "s" -and $confirmation -ne "S") {
    Write-Host "❌ Operación cancelada" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "🔐 Agregando variables a Vercel..." -ForegroundColor Yellow

# Configurar variables (necesita estar logueado en Vercel)
& vercel env add VITE_FIREBASE_API_KEY $FIREBASE_API_KEY
& vercel env add VITE_FIREBASE_AUTH_DOMAIN $FIREBASE_AUTH_DOMAIN
& vercel env add VITE_FIREBASE_PROJECT_ID $FIREBASE_PROJECT_ID
& vercel env add VITE_FIREBASE_STORAGE_BUCKET $FIREBASE_STORAGE_BUCKET
& vercel env add VITE_FIREBASE_MESSAGING_SENDER_ID $FIREBASE_MESSAGING_SENDER_ID
& vercel env add VITE_FIREBASE_APP_ID $FIREBASE_APP_ID
& vercel env add VITE_API_URL $API_URL
& vercel env add VITE_AUTH_API_URL $AUTH_API_URL
& vercel env add VITE_USE_FIREBASE "true"

Write-Host ""
Write-Host "✅ Configuración completada" -ForegroundColor Green
Write-Host ""
Write-Host "📦 Próximos pasos:" -ForegroundColor Cyan
Write-Host "   1. Desplegar: vercel --prod"
Write-Host "   2. Ver logs: vercel logs"
Write-Host ""

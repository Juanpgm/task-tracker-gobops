#!/bin/bash
# ============================================================================== 
# CATATRACK - Script de Configuración de Vercel
# ============================================================================== 
# Uso: bash scripts/setup-vercel.sh
# o en Windows PowerShell: .\scripts\setup-vercel.ps1

echo "🚀 Configurando CATATRACK en Vercel..."
echo ""

# Verificar que Vercel CLI esté instalado
if ! command -v vercel &> /dev/null; then
    echo "❌ Vercel CLI no está instalado."
    echo "   Instálalo con: npm install -g vercel"
    exit 1
fi

# Verificar que env.local existe
if [ ! -f "env.local" ]; then
    echo "❌ No se encuentra env.local"
    exit 1
fi

echo "✅ Vercel CLI detectado"
echo ""

# Extraer valores de env.local
FIREBASE_API_KEY=$(grep "VITE_FIREBASE_API_KEY=" env.local | cut -d '=' -f 2)
FIREBASE_AUTH_DOMAIN=$(grep "VITE_FIREBASE_AUTH_DOMAIN=" env.local | cut -d '=' -f 2)
FIREBASE_PROJECT_ID=$(grep "VITE_FIREBASE_PROJECT_ID=" env.local | cut -d '=' -f 2)
FIREBASE_STORAGE_BUCKET=$(grep "VITE_FIREBASE_STORAGE_BUCKET=" env.local | cut -d '=' -f 2)
FIREBASE_MESSAGING_SENDER_ID=$(grep "VITE_FIREBASE_MESSAGING_SENDER_ID=" env.local | cut -d '=' -f 2)
FIREBASE_APP_ID=$(grep "VITE_FIREBASE_APP_ID=" env.local | cut -d '=' -f 2)
API_URL=$(grep "VITE_API_URL=" env.local | grep -v "^#" | head -1 | cut -d '=' -f 2)
AUTH_API_URL=$(grep "VITE_AUTH_API_URL=" env.local | grep -v "^#" | head -1 | cut -d '=' -f 2)

echo "📋 Variables encontradas:"
echo "   - FIREBASE_API_KEY: ${FIREBASE_API_KEY:0:20}..."
echo "   - FIREBASE_PROJECT_ID: $FIREBASE_PROJECT_ID"
echo "   - API_URL: $API_URL"
echo "   - AUTH_API_URL: $AUTH_API_URL"
echo ""

# Pedir confirmación
read -p "¿Continuar con la configuración en Vercel? (s/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Operación cancelada"
    exit 1
fi

echo ""
echo "🔐 Agregando variables a Vercel..."

# Configurar variables (necesita estar logueado en Vercel)
vercel env add VITE_FIREBASE_API_KEY "$FIREBASE_API_KEY"
vercel env add VITE_FIREBASE_AUTH_DOMAIN "$FIREBASE_AUTH_DOMAIN"
vercel env add VITE_FIREBASE_PROJECT_ID "$FIREBASE_PROJECT_ID"
vercel env add VITE_FIREBASE_STORAGE_BUCKET "$FIREBASE_STORAGE_BUCKET"
vercel env add VITE_FIREBASE_MESSAGING_SENDER_ID "$FIREBASE_MESSAGING_SENDER_ID"
vercel env add VITE_FIREBASE_APP_ID "$FIREBASE_APP_ID"
vercel env add VITE_API_URL "$API_URL"
vercel env add VITE_AUTH_API_URL "$AUTH_API_URL"
vercel env add VITE_USE_FIREBASE "true"

echo ""
echo "✅ Configuración completada"
echo ""
echo "📦 Próximos pasos:"
echo "   1. Desplegar: vercel --prod"
echo "   2. Ver logs: vercel logs"
echo ""

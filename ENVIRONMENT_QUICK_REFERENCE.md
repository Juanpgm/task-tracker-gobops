# ⚡ QUICK START - Configuración de Entornos

## 📁 Archivos Creados

```
catatrack/
├── env.local                      ✅ Base principal (todas las credenciales)
├── .env.production                ✅ Variables públicas para Vercel
├── .env.development               ✅ Variables para desarrollo local
├── ENV_SETUP.md                   📖 Documentación completa
├── ENVIRONMENT_QUICK_REFERENCE.md 🚀 Este archivo
├── scripts/
│   ├── setup-vercel.sh           🔧 Setup automático (bash)
│   └── setup-vercel.ps1          🔧 Setup automático (PowerShell)
└── .gitignore (actualizado)       🔐 Protege credenciales
```

---

## 🚀 VERCEL - 3 Pasos

### 1️⃣ Instalar Vercel CLI

```bash
npm install -g vercel
vercel login
```

### 2️⃣ Configurar Variables (OPCIÓN A: Automático)

**Windows (PowerShell):**
```powershell
.\scripts\setup-vercel.ps1
```

**Linux/Mac (Bash):**
```bash
bash scripts/setup-vercel.sh
```

### 2️⃣ Configurar Variables (OPCIÓN B: Manual)

1. Ve a [Vercel Dashboard](https://vercel.com/dashboard)
2. Proyecto → **Settings** → **Environment Variables**
3. Agrega estas variables (valores busca en `env.local`):
   - `VITE_FIREBASE_API_KEY`
   - `VITE_FIREBASE_AUTH_DOMAIN`
   - `VITE_FIREBASE_PROJECT_ID`
   - `VITE_FIREBASE_STORAGE_BUCKET`
   - `VITE_FIREBASE_MESSAGING_SENDER_ID`
   - `VITE_FIREBASE_APP_ID`
   - `VITE_API_URL` = `https://gestorproyectoapi-production.up.railway.app`
   - `VITE_AUTH_API_URL` = `https://web-production-79739.up.railway.app`

### 3️⃣ Desplegar

```bash
vercel --prod
```

---

## 💻 Desarrollo Local

### Opción A: Con APIs en Producción (Railway)
```bash
cd frontend
npm install
npm run dev
# Acceder: http://localhost:5173
```

### Opción B: Con APIs Locales
1. Descomentar en `.env.development`:
   ```
   VITE_API_URL=http://localhost:8000
   VITE_AUTH_API_URL=http://localhost:8001
   ```
2. Ejecutar backends locales (Python/FastAPI por ejemplo)
3. Ejecutar frontend: `npm run dev`

---

## 🔐 Seguridad - Checklist

- ✅ `env.local` está en `.gitignore`
- ✅ Credenciales de Firebase protegidas
- ✅ Vercel secrets nunca se comitean
- ✅ Archivos `.env*` están protegidos

---

## 📝 Resumen de Variables

| Variable | Desarrollo | Producción |
|----------|-----------|-----------|
| VITE_API_URL | localhost:8000 o Railway | Railway |
| VITE_AUTH_API_URL | localhost:8001 o Railway | Railway |
| VITE_FIREBASE_* | Desde env.local | Desde Vercel Dashboard |
| API_ENV | development | production |

---

## 🆘 Ayuda Rápida

| Problema | Solución |
|----------|----------|
| "Variables de entorno no cargan" | Reinicia Vite: `npm run dev` |
| "Cannot find module 'firebase'" | `npm install firebase` |
| "Vercel CLI no encontrado" | `npm install -g vercel` |
| "Variables no en Vercel" | Sube desde Dashboard Settings |

---

**Variables cargadas automáticamente según el entorno:**
- 🔄 Development: `.env.development` + `env.local` (si existe)
- 🔄 Production: `.env.production` + Vercel Dashboard
- 🔄 Build: Usa configuración del entorno actual

Ver [ENV_SETUP.md](ENV_SETUP.md) para documentación completa.

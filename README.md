# Task Tracker GobOps

Sistema de seguimiento de requerimientos para la Alcaldía de Santiago de Cali.

## 🚀 Inicio Rápido

### 1. Clonar el repositorio
```bash
git clone https://github.com/Juanpgm/task-tracker-gobops.git
cd task-tracker-gobops/frontend
```

### 2. Instalar dependencias
```bash
npm install
```

### 3. ⚠️ Configurar credenciales (IMPORTANTE - SEGURIDAD)

**NUNCA** subas archivos con credenciales reales al repositorio.

#### Configuración segura:
```bash
# Copia el archivo de ejemplo
cp .env.local.example .env.local

# Edita .env.local con tus credenciales REALES
nano .env.local
```

#### Credenciales requeridas:
- **Firebase Config**: Obtén desde Firebase Console > Project Settings > General
- **Firebase Service Account**: Descarga JSON desde Firebase Console > Service Accounts
- **URLs de API**: Ya configuradas para producción

#### Archivos sensibles (NUNCA commitear):
- `.env.local` (tu configuración personal)
- Cualquier archivo con `serviceAccountKey.json`
- Claves privadas o secrets

### 4. Ejecutar en desarrollo
```bash
npm run dev
```

### 5. Build para producción
```bash
npm run build
```

## 📋 Características

- ✅ Autenticación con Firebase
- ✅ Seguimiento de requerimientos con Kanban
- ✅ Directorio de enlaces de organismos
- ✅ Registro de visitas programadas
- ✅ Gestión de evidencias fotográficas
- ✅ PWA (Progressive Web App)
- ✅ Responsive design

## 🏗️ Arquitectura

- **Frontend**: Svelte 4 + TypeScript + Vite
- **Backend APIs**:
  - Auth API: `https://web-production-79739.up.railway.app`
  - Project API: `https://gestorproyectoapi-production.up.railway.app`
- **Base de datos**: Firebase + APIs externas
- **PWA**: Service Worker con Workbox

## 📡 APIs

Ver [API_ENDPOINTS.md](./API_ENDPOINTS.md) para documentación completa de 26 endpoints.

## 🔒 Seguridad

- Credenciales sensibles excluidas del repositorio
- Variables de entorno validadas con TypeScript
- Autenticación JWT con Firebase
- HTTPS obligatorio en producción

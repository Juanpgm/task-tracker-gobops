# 🚀 Guía de Despliegue en Vercel

## Configuración de Variables de Entorno

### Paso 1: Instalar Vercel CLI

```bash
npm install -g vercel
```

### Paso 2: Login en Vercel

```bash
vercel login
```

### Paso 3: Configurar Variables Secretas de Firebase

Las variables de Firebase deben configurarse como **secretos** en Vercel para mayor seguridad:

```bash
# API Key de Firebase
vercel secrets add firebase_api_key "TU_FIREBASE_API_KEY_AQUI"

# Auth Domain
vercel secrets add firebase_auth_domain "tu-proyecto.firebaseapp.com"

# Project ID
vercel secrets add firebase_project_id "tu-proyecto-id"

# Storage Bucket
vercel secrets add firebase_storage_bucket "tu-proyecto.appspot.com"

# Messaging Sender ID
vercel secrets add firebase_messaging_sender_id "123456789"

# App ID
vercel secrets add firebase_app_id "1:123456789:web:abc123def456"
```

### Paso 4: Verificar Configuración

Los valores de las APIs ya están configurados en `vercel.json`:
- ✅ `VITE_AUTH_API_URL`: https://web-production-79739.up.railway.app
- ✅ `VITE_API_URL`: https://gestorproyectoapi-production.up.railway.app

### Paso 5: Desplegar

```bash
# Despliegue de prueba
vercel

# Despliegue a producción
vercel --prod
```

---

## Variables de Entorno en Vercel Dashboard

También puedes configurar las variables desde la interfaz web de Vercel:

1. Ve a tu proyecto en Vercel Dashboard
2. Click en **Settings**
3. Click en **Environment Variables**
4. Agrega las siguientes variables:

| Nombre | Valor | Entorno |
|--------|-------|---------|
| `VITE_FIREBASE_API_KEY` | Tu Firebase API Key | Production, Preview, Development |
| `VITE_FIREBASE_AUTH_DOMAIN` | tu-proyecto.firebaseapp.com | Production, Preview, Development |
| `VITE_FIREBASE_PROJECT_ID` | tu-proyecto-id | Production, Preview, Development |
| `VITE_FIREBASE_STORAGE_BUCKET` | tu-proyecto.appspot.com | Production, Preview, Development |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | 123456789 | Production, Preview, Development |
| `VITE_FIREBASE_APP_ID` | 1:123456789:web:abc123def456 | Production, Preview, Development |

> **Nota:** Las variables `VITE_AUTH_API_URL` y `VITE_API_URL` ya están configuradas en `vercel.json` y no necesitan ser agregadas manualmente.

---

## Obtener Credenciales de Firebase

1. Ve a [Firebase Console](https://console.firebase.google.com/)
2. Selecciona tu proyecto
3. Click en el ícono de configuración ⚙️ > **Project Settings**
4. Ve a la pestaña **General**
5. En la sección **Your apps**, busca tu aplicación web
6. Copia los valores de configuración:
   - apiKey
   - authDomain
   - projectId
   - storageBucket
   - messagingSenderId
   - appId

---

## Estructura del Sistema de Autenticación

El sistema implementa la arquitectura completa de **Administración y Control de Accesos**:

### Flujo de Login

1. **Frontend** → Usuario ingresa email y contraseña
2. **Firebase Auth** → Autentica al usuario y genera ID Token (JWT)
3. **Backend API** → Valida el token en `/auth/login`
4. **Respuesta** → Retorna información completa del usuario:
   - `uid`: ID único del usuario
   - `email`: Correo electrónico
   - `full_name`: Nombre completo
   - `roles`: Array de roles asignados
   - `permissions`: Array de permisos permanentes
   - `temporary_permissions`: Array de permisos temporales con fecha de expiración
   - `is_super_admin`: booleano
   - `is_admin`: booleano
   - `nombre_centro_gestor`: Centro gestor asociado
5. **AuthStore** → Guarda toda la información en el estado global y localStorage

### Validación de Sesión

Cada vez que la app se carga o el token se refresca:
1. Firebase verifica el estado de autenticación
2. Se llama a `/auth/validate-session` para obtener datos actualizados
3. Se actualiza el AuthStore con roles y permisos más recientes

### Control de Accesos

El sistema soporta:
- ✅ **Roles múltiples** por usuario
- ✅ **Permisos permanentes** heredados de roles
- ✅ **Permisos temporales** con fecha de expiración
- ✅ **Administración de usuarios** (CRUD completo)
- ✅ **Administración de roles** (listado y detalles)
- ✅ **Super Admins** con permisos totales

---

## Endpoints Implementados

Ver documentación completa en [API_ENDPOINTS.md](./API_ENDPOINTS.md)

### Autenticación Principal
- `POST /auth/login` - Login con Firebase token
- `POST /auth/validate-session` - Validar sesión activa
- `POST /auth/register` - Registro de nuevo usuario
- `POST /auth/google` - Autenticación con Google
- `POST /auth/change-password` - Cambio de contraseña

### Administración de Usuarios
- `GET /auth/admin/users` - Listar todos los usuarios
- `GET /auth/admin/users/{uid}` - Detalles de un usuario
- `PUT /auth/admin/users/{uid}` - Actualizar información de usuario
- `POST /auth/admin/users/{uid}/roles` - Asignar roles
- `POST /auth/admin/users/{uid}/temporary-permissions` - Otorgar permisos temporales
- `DELETE /auth/admin/users/{uid}/temporary-permissions/{permission}` - Revocar permisos temporales

### Administración de Roles
- `GET /auth/admin/roles` - Listar todos los roles
- `GET /auth/admin/roles/{role_id}` - Detalles de un rol

---

## Verificación Post-Despliegue

Después del despliegue, verifica:

1. ✅ El login funciona correctamente
2. ✅ Los roles y permisos se cargan correctamente
3. ✅ La sesión persiste después de recargar
4. ✅ Los permisos temporales se validan por fecha
5. ✅ Los mensajes de error son específicos y claros

---

## Troubleshooting

### Error: "Firebase no está inicializado"
- Verifica que todas las variables de Firebase estén configuradas
- Revisa que no haya typos en los nombres de las variables
- Asegúrate que las variables estén disponibles en el entorno correcto

### Error: "401 Unauthorized" en /auth/login
- El token de Firebase no es válido
- Verifica la configuración de Firebase en el backend
- Asegúrate que el proyecto de Firebase coincida

### Error: "403 Forbidden"
- El usuario no tiene permisos suficientes
- Verifica los roles asignados en Firebase/Backend
- Revisa que los permisos necesarios estén configurados

### Sesión no persiste
- Verifica que localStorage esté habilitado en el navegador
- Revisa que las cookies no estén bloqueadas
- Asegúrate que el dominio de auth sea correcto

---

## Seguridad

🔒 **Importante:**
- Nunca subas archivos `.env.local` al repositorio
- Usa siempre secretos de Vercel para datos sensibles
- Rota las API keys periódicamente
- El backend valida todos los tokens en cada petición
- Los permisos temporales expiran automáticamente

---

## Soporte

Para más información sobre la API:
- Documentación completa: https://web-production-79739.up.railway.app/docs
- Endpoints: [API_ENDPOINTS.md](./API_ENDPOINTS.md)

# 📡 API Endpoints — Task Tracker GobOps

> Documento generado automáticamente a partir del análisis del frontend.
> Fecha: 2026-02-09

---

## 🔑 URLs Base

| Alias | Variable ENV | URL Actual | Propósito |
|-------|-------------|------------|-----------|
| **AUTH_API** | `VITE_AUTH_API_URL` | `https://web-production-79739.up.railway.app` | Autenticación, visitas campo, asistencia, reportes |
| **PROJECT_API** | `VITE_API_URL` | `https://gestorproyectoapi-production.up.railway.app` | Catálogo de Unidades de Proyecto |

> **Nota:** Todos los endpoints autenticados envían header `Authorization: Bearer <Firebase_JWT_Token>`

---

## ✅ SECCIÓN A — Endpoints Activos (Backend Real)

### 1. Autenticación

#### `POST /auth/validate-session`
- **Base:** AUTH_API
- **Auth:** Bearer Token
- **Body:** `{}` (vacío)
- **Response:**
  ```json
  {
    "uid": "string",
    "email": "string",
    "role": "string",
    "displayName": "string"
  }
  ```
- **Usado por:** Login, initAuthListener

#### `POST /auth/register`
- **Base:** AUTH_API (fetch directo, sin auth)
- **Auth:** Ninguna (público)
- **Body:**
  ```json
  {
    "nombre": "string",
    "apellido": "string",
    "email": "string",
    "password": "string",
    "telefono": "string",
    "rol": "string"
  }
  ```
- **Response:** `string` (mensaje)
- **Usado por:** Register.svelte

#### `POST /auth/change-password`
- **Base:** AUTH_API
- **Auth:** Bearer Token
- **Content-Type:** `application/x-www-form-urlencoded`
- **Body:** `new_password=<string>`
- **Response:** `string` (mensaje)
- **Usado por:** ChangePassword.svelte

#### `GET /auth/me`
- **Base:** AUTH_API
- **Auth:** Bearer Token
- **Response:** `string`
- **Usado por:** Interno (auth.ts)

#### `POST /auth/google`
- **Base:** AUTH_API
- **Auth:** Ninguna (token en body)
- **Content-Type:** `application/x-www-form-urlencoded`
- **Body:** `id_token=<string>`
- **Response:**
  ```json
  {
    "uid": "string",
    "email": "string",
    "role": "string",
    "displayName": "string"
  }
  ```
- **Usado por:** loginWithGoogle

---

### 2. Unidades de Proyecto

#### `GET /unidades-proyecto/init-360`
- **Base:** PROJECT_API
- **Auth:** Bearer Token
- **Response:**
  ```json
  [
    {
      "upid": "number",
      "nombre_up": "string",
      "estado": "string",
      "tipo_equipamiento": "string",
      "avance_fisico": "number",
      "avance_financiero": "number",
      "municipio": "string",
      "entidad": "string",
      "sector": "string",
      "latitud": "number | null",
      "longitud": "number | null"
    }
  ]
  ```
- **Usado por:** TablaUnidadesProyecto, DetalleUPVisita, RegistrarVisita

---

### 3. Visitas de Campo (Legacy)

#### `POST /registrar-visita/`
- **Base:** AUTH_API
- **Auth:** Bearer Token
- **Content-Type:** `application/x-www-form-urlencoded`
- **Body:**
  ```
  upid, nombre_up, estado, tipo_equipamiento, avance_fisico, avance_financiero,
  municipio, entidad, sector, fecha_visita, observaciones, latitud, longitud
  ```
- **Response:** `{ message: string }`
- **Usado por:** RegistrarVisita.svelte (legacy)

#### `POST /registrar-requerimiento/`
- **Base:** AUTH_API
- **Auth:** Bearer Token
- **Content-Type:** `multipart/form-data`
- **Body:** FormData con campos del requerimiento + archivos
- **Response:** `unknown`
- **Usado por:** RegistrarRequerimiento.svelte (legacy)

---

### 4. Asistencia

#### `POST /registrar-asistencia-delegado`
- **Base:** AUTH_API
- **Auth:** Bearer Token
- **Content-Type:** `application/x-www-form-urlencoded`
- **Body:**
  ```
  nombre_delegado, cedula_delegado, telefono_delegado, correo_delegado,
  nombre_up, upid, fecha_asistencia, observaciones, latitud, longitud
  ```
- **Usado por:** AsistenciaDelegado.svelte

#### `POST /registrar-asistencia-comunidad`
- **Base:** AUTH_API
- **Auth:** Bearer Token
- **Content-Type:** `application/x-www-form-urlencoded`
- **Body:**
  ```
  nombre_persona, cedula_persona, telefono_persona, correo_persona,
  nombre_up, upid, fecha_asistencia, observaciones, latitud, longitud
  ```
- **Usado por:** AsistenciaComunidad.svelte

---

### 5. Reportes

#### `GET /grupo-operativo/reportes`
- **Base:** AUTH_API
- **Auth:** Bearer Token
- **Response:** `Array<Reporte>`
- **Usado por:** Reportes.svelte

#### `DELETE /grupo-operativo/eliminar-reporte?id=<reporteId>`
- **Base:** AUTH_API
- **Auth:** Bearer Token
- **Query:** `id=string`
- **Response:** `unknown`
- **Usado por:** Reportes.svelte

---

## 🔴 SECCIÓN B — Endpoints Requeridos (Actualmente Mock)

> Estos endpoints son necesarios para reemplazar los datos mock del módulo de seguimiento.
> Se sugiere consolidarlos bajo el prefijo `/seguimiento/`.

---

### 6. Centros Gestores

#### `GET /seguimiento/centros-gestores`
- **Descripción:** Catálogo de entidades/organismos de la alcaldía
- **Auth:** Bearer Token
- **Response:**
  ```json
  [
    {
      "id": "string",
      "nombre": "string",
      "sigla": "string",
      "color": "string"
    }
  ]
  ```
- **Usado por:** RegistrarRequerimientosVisita (multi-select), DirectorioEnlaces (agrupación)
- **Mock actual:** `CENTROS_GESTORES` constante (14 entidades)

---

### 7. Colaboradores

#### `GET /seguimiento/colaboradores`
- **Descripción:** Equipo del grupo operativo para asignar a visitas
- **Auth:** Bearer Token
- **Response:**
  ```json
  [
    {
      "id": "string",
      "nombre": "string",
      "rol": "string",
      "email": "string",
      "activo": "boolean"
    }
  ]
  ```
- **Usado por:** DetalleUPVisita (asignar colaboradores a visita)
- **Mock actual:** `MOCK_COLABORADORES` (8 colaboradores)

---

### 8. Visitas Programadas (CRUD)

#### `GET /seguimiento/visitas`
- **Descripción:** Listar visitas programadas
- **Auth:** Bearer Token
- **Query params (opcionales):** `?estado=programada&upid=123`
- **Response:**
  ```json
  [
    {
      "id": "string",
      "upid": "string",
      "unidad_proyecto": {
        "upid": "number",
        "nombre_up": "string",
        "estado": "string",
        "tipo_equipamiento": "string",
        "avance_fisico": "number",
        "avance_financiero": "number",
        "municipio": "string",
        "entidad": "string",
        "sector": "string"
      },
      "fecha_visita": "string (YYYY-MM-DD)",
      "hora_inicio": "string (HH:mm) | null",
      "hora_fin": "string (HH:mm) | null",
      "estado": "programada | en-curso | finalizada | cancelada",
      "colaboradores": "Colaborador[]",
      "observaciones": "string | null",
      "created_at": "string (ISO 8601)",
      "updated_at": "string (ISO 8601)"
    }
  ]
  ```
- **Mock actual:** `MOCK_VISITAS` (3 visitas)

#### `POST /seguimiento/visitas`
- **Descripción:** Programar nueva visita
- **Auth:** Bearer Token
- **Content-Type:** `application/json`
- **Body:**
  ```json
  {
    "upid": "string",
    "unidad_proyecto": "UnidadProyecto",
    "fecha_visita": "string",
    "hora_inicio": "string | null",
    "hora_fin": "string | null",
    "colaboradores": "string[]",
    "observaciones": "string | null"
  }
  ```
- **Response:** `VisitaProgramada` (creada con id generado)

#### `PATCH /seguimiento/visitas/:visitaId/estado`
- **Descripción:** Cambiar estado de una visita
- **Auth:** Bearer Token
- **Body:**
  ```json
  {
    "estado": "programada | en-curso | finalizada | cancelada"
  }
  ```
- **Response:** `VisitaProgramada` (actualizada)

---

### 9. Requerimientos (CRUD + Gestión)

#### `GET /seguimiento/requerimientos`
- **Descripción:** Listar requerimientos (para Kanban y reportes)
- **Auth:** Bearer Token
- **Query params (opcionales):** `?visita_id=vis-001&estado=en-gestion`
- **Response:**
  ```json
  [
    {
      "id": "string",
      "visita_id": "string",
      "solicitante": {
        "nombre_completo": "string",
        "cedula": "string",
        "telefono": "string",
        "email": "string",
        "direccion": "string",
        "barrio_vereda": "string",
        "comuna_corregimiento": "string"
      },
      "centros_gestores": ["string"],
      "descripcion": "string",
      "observaciones": "string",
      "direccion": "string",
      "latitud": "string",
      "longitud": "string",
      "evidencia_fotos": ["string (URL)"],
      "estado": "nuevo | radicado | en-gestion | asignado | en-proceso | resuelto | cerrado",
      "encargado": "string | null",
      "enlace_id": "string | null",
      "enlace_nombre": "string | null",
      "porcentaje_avance": "number (0-100)",
      "prioridad": "baja | media | alta | urgente",
      "historial": [
        {
          "id": "string",
          "fecha": "string (ISO 8601)",
          "autor": "string",
          "descripcion": "string",
          "estado_anterior": "EstadoRequerimiento",
          "estado_nuevo": "EstadoRequerimiento",
          "porcentaje": "number",
          "evidencias": [
            {
              "tipo": "foto | documento",
              "url": "string",
              "descripcion": "string"
            }
          ]
        }
      ],
      "created_at": "string (ISO 8601)",
      "updated_at": "string (ISO 8601)"
    }
  ]
  ```
- **Mock actual:** `MOCK_REQUERIMIENTOS` (5 requerimientos)

#### `POST /seguimiento/requerimientos`
- **Descripción:** Registrar nuevo requerimiento(s) para una visita
- **Auth:** Bearer Token
- **Content-Type:** `application/json` (o `multipart/form-data` si incluye fotos)
- **Body:**
  ```json
  {
    "visita_id": "string",
    "solicitante": "Solicitante",
    "centros_gestores": ["string"],
    "descripcion": "string",
    "observaciones": "string",
    "direccion": "string",
    "latitud": "string",
    "longitud": "string",
    "evidencia_fotos": ["File | base64"],
    "prioridad": "baja | media | alta | urgente"
  }
  ```
- **Response:** `Requerimiento` (creado)

#### `PATCH /seguimiento/requerimientos/:reqId/estado`
- **Descripción:** Cambiar estado + registrar avance en historial
- **Auth:** Bearer Token
- **Body:**
  ```json
  {
    "estado": "EstadoRequerimiento",
    "descripcion": "string",
    "autor": "string",
    "porcentaje_avance": "number (0-100)",
    "evidencias": "EvidenciaRequerimiento[] (opcional)"
  }
  ```
- **Response:** `Requerimiento` (actualizado con nueva entrada en historial)

#### `PATCH /seguimiento/requerimientos/:reqId/encargado`
- **Descripción:** Asignar encargado del centro gestor a un requerimiento
- **Auth:** Bearer Token
- **Body:**
  ```json
  {
    "encargado": "string"
  }
  ```
- **Response:** `Requerimiento` (actualizado)

#### `PATCH /seguimiento/requerimientos/:reqId/enlace`
- **Descripción:** Asignar enlace del organismo a un requerimiento
- **Auth:** Bearer Token
- **Body:**
  ```json
  {
    "enlace_id": "string",
    "enlace_nombre": "string"
  }
  ```
- **Response:** `Requerimiento` (actualizado)

---

### 10. Enlaces (Directorio de Representantes)

#### `GET /seguimiento/enlaces`
- **Descripción:** Listar todos los enlaces de organismos
- **Auth:** Bearer Token
- **Query params (opcionales):** `?centro_gestor_id=emcali&activo=true`
- **Response:**
  ```json
  [
    {
      "id": "string",
      "nombre": "string",
      "email": "string",
      "telefono": "string",
      "cargo": "string",
      "centro_gestor_id": "string",
      "centro_gestor_nombre": "string",
      "dependencia": "string | null",
      "activo": "boolean"
    }
  ]
  ```
- **Mock actual:** `MOCK_ENLACES` (20 enlaces, 14 centros gestores)

#### `POST /seguimiento/enlaces` *(futuro — crear enlace)*
- **Body:**
  ```json
  {
    "nombre": "string",
    "email": "string",
    "telefono": "string",
    "cargo": "string",
    "centro_gestor_id": "string",
    "dependencia": "string | null"
  }
  ```
- **Response:** `Enlace` (creado)

#### `PATCH /seguimiento/enlaces/:enlaceId` *(futuro — actualizar enlace)*
- **Body:** Campos parciales de Enlace
- **Response:** `Enlace` (actualizado)

#### `DELETE /seguimiento/enlaces/:enlaceId` *(futuro — desactivar enlace)*
- **Response:** `{ message: string }`

---

## 📊 Resumen

| Categoría | Endpoints | Estado |
|-----------|-----------|--------|
| Autenticación | 5 | ✅ Backend real |
| Unidades de Proyecto | 1 | ✅ Backend real |
| Visitas Campo (legacy) | 2 | ✅ Backend real |
| Asistencia | 2 | ✅ Backend real |
| Reportes | 2 | ✅ Backend real |
| **Subtotal Backend Real** | **12** | |
| Centros Gestores | 1 | 🔴 Requiere backend |
| Colaboradores | 1 | 🔴 Requiere backend |
| Visitas Programadas | 3 | 🔴 Requiere backend |
| Requerimientos | 5 | 🔴 Requiere backend |
| Enlaces | 4 | 🔴 Requiere backend |
| **Subtotal Mock** | **14** | |
| **TOTAL** | **26** | |

---

## 🏗️ Modelo de Datos del Backend

### Tablas/Colecciones Sugeridas

```
┌─────────────────────┐     ┌──────────────────────┐
│   centros_gestores   │     │    colaboradores      │
├─────────────────────┤     ├──────────────────────┤
│ id (PK)             │     │ id (PK)              │
│ nombre              │     │ nombre               │
│ sigla               │     │ rol                  │
│ color               │     │ email                │
└─────────┬───────────┘     │ activo               │
          │                 └──────────────────────┘
          │ 1:N
┌─────────▼───────────┐
│      enlaces         │     ┌──────────────────────┐
├─────────────────────┤     │  visitas_programadas   │
│ id (PK)             │     ├──────────────────────┤
│ nombre              │     │ id (PK)              │
│ email               │     │ upid (FK→UP)         │
│ telefono            │     │ fecha_visita         │
│ cargo               │     │ hora_inicio          │
│ centro_gestor_id(FK)│     │ hora_fin             │
│ dependencia         │     │ estado               │
│ activo              │     │ observaciones        │
└─────────────────────┘     │ created_at           │
                            │ updated_at           │
                            └──────────┬───────────┘
                                       │ 1:N
                            ┌──────────▼───────────┐
                            │   requerimientos      │
                            ├──────────────────────┤
                            │ id (PK)              │
                            │ visita_id (FK)       │
                            │ solicitante (JSON)   │
                            │ centros_gestores[]   │
                            │ descripcion          │
                            │ estado               │
                            │ prioridad            │
                            │ encargado            │
                            │ enlace_id (FK→enl)   │
                            │ porcentaje_avance    │
                            │ evidencia_fotos[]    │
                            │ latitud, longitud    │
                            │ created_at           │
                            │ updated_at           │
                            └──────────┬───────────┘
                                       │ 1:N
                            ┌──────────▼───────────┐
                            │   historial_avance    │
                            ├──────────────────────┤
                            │ id (PK)              │
                            │ requerimiento_id(FK) │
                            │ fecha                │
                            │ autor                │
                            │ descripcion          │
                            │ estado_anterior      │
                            │ estado_nuevo         │
                            │ porcentaje           │
                            │ evidencias (JSON)    │
                            └──────────────────────┘

Tabla intermedia: visita_colaboradores (visita_id, colaborador_id)
Tabla intermedia: requerimiento_centros (requerimiento_id, centro_gestor_id)
```

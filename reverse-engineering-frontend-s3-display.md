# Reverse Engineering: Frontend — Visualización de archivos S3

**Fuente:** `front-catatrack/frontend/src/`
**Stack:** Svelte 4 + TypeScript + Vite
**Propósito:** Replicar toda la lógica del frontend para mostrar imágenes, audios y documentos desde URLs presignadas de S3.

---

## 1. El problema que resuelve esta lógica

El GET `/obtener-requerimientos` devuelve `documentos_con_enlaces` con URLs presignadas de S3. Mostrarlas en el frontend parece trivial, pero hay tres problemas reales:

| Problema | Causa | Solución |
|----------|-------|----------|
| Los audios no hacen streaming correctamente | Vercel elimina `Range` headers en sus edge rewrites | Detectar presigned URL y usarla directa, sin pasar por proxy |
| Las URLs de audio `.gz` fallan en `<audio>` | S3 sirve `Content-Encoding: gzip` pero el browser espera audio decodificado | Proxy en dev (Vite) que descomprime gzip y devuelve audio raw |
| Las imágenes pueden fallar (URL expirada o región incorrecta) | Las presigned URLs expiran; el bucket puede estar en región diferente | Estado `brokenImages` + placeholder visual |

---

## 2. Tipos TypeScript de los documentos que llegan del GET

```typescript
// src/types/index.ts (parte relevante)
export interface DocumentoAdjunto {
  nombre: string;   // filename del S3
  url: string;      // url_visualizar del backend (presigned inline)
  tipo: string;     // content_type (ej: "image/jpeg", "application/gzip")
}

// Lo que devuelve ObtenerRequerimientosItem del GET legacy
export interface ObtenerRequerimientosItem {
  id: string;
  vid: string;
  rid: string;
  nota_voz_url: string | null;          // URL plana S3 del audio (puede ser stale)
  documentos_s3: Array<{
    filename?: string;
    s3_key?: string;
    content_type?: string;
    size?: number;
  }> | null;
  documentos_con_enlaces: Array<{       // URLs presignadas frescas
    filename?: string;
    s3_key?: string;
    s3_url?: string;
    content_type?: string;
    size?: number;
    url_visualizar?: string;            // presigned, Content-Disposition: inline ← USAR ESTO
    url_presigned?: string;             // alias de url_visualizar
    url_descarga?: string;              // presigned, Content-Disposition: attachment
  }> | null;
  // ... otros campos
}
```

---

## 3. Mapeo del GET al tipo `Requerimiento` del store

Este es el mapeo exacto que hace `seguimientoStore.loadRequerimientos()`:

```typescript
// src/stores/seguimientoStore.ts — dentro de loadRequerimientos()

const mapped: Requerimiento[] = data.map((item: ObtenerRequerimientosItem) => {

  // ── NOTA DE VOZ ──────────────────────────────────────────────────────────
  // Preferir la URL presignada de documentos_con_enlaces sobre nota_voz_url
  // porque nota_voz_url es la URL plana (puede requerir auth o estar expirada).
  const nota_voz_url = (() => {
    if (item.nota_voz_url) {
      const raw = item.documentos_con_enlaces || [];
      const arr = Array.isArray(raw) ? raw : [raw];
      // Buscar el doc cuyo filename empieza con 'nota_voz_'
      const notaVozDoc = arr.find((d: Record<string, string>) =>
        d?.filename?.startsWith('nota_voz_')
      );
      if (notaVozDoc) {
        // Preferir url_visualizar > url_presigned > url plana
        return notaVozDoc.url_visualizar || notaVozDoc.url_presigned || item.nota_voz_url;
      }
      return item.nota_voz_url;
    }
    return null;
  })();

  // ── DOCUMENTOS ADJUNTOS ──────────────────────────────────────────────────
  // Fuente: documentos_con_enlaces (presigned) > documentos_s3 (sin URL)
  // Excluir audios de notas de voz (se manejan por separado con nota_voz_url)
  const documentos_adjuntos = (() => {
    const raw = item.documentos_con_enlaces || item.documentos_s3 || [];
    const arr = Array.isArray(raw) ? raw : [raw];
    return arr
      .filter((d: Record<string, unknown>) =>
        d && typeof d === 'object' && Object.keys(d).length > 0
      )
      .filter((d: Record<string, string>) =>
        !d.filename?.startsWith('nota_voz_')  // excluir audio de la galería
      )
      .map((d: Record<string, string>) => ({
        nombre: d.filename || d.nombre || 'archivo',
        url: d.url_visualizar || d.url_presigned || d.s3_url || d.url || '',
        tipo: d.content_type || d.tipo || '',
      }));
  })();

  return {
    // ...otros campos...
    nota_voz_url,
    documentos_adjuntos,
    transcripciones: Array.isArray(item.transcripciones) ? item.transcripciones : [],
  };
});
```

**Invariante clave:** `nota_voz_url` nunca aparece en `documentos_adjuntos` — se filtra con `.filter(d => !d.filename?.startsWith('nota_voz_'))`. Los dos se renderizan por separado.

---

## 4. Función `audioSrc()` — la más crítica del frontend

```typescript
// Aparece idéntica en KanbanRequerimientos.svelte y ListaRequerimientosVisita.svelte
function audioSrc(url: string): string {
  // Las presigned URLs tienen autenticación en query params (X-Amz-Signature).
  // El elemento <audio> evita CORS por defecto, así que pueden usarse directamente.
  // PROBLEMA: Vercel edge rewrite elimina el header Range, rompiendo el streaming.
  // SOLUCIÓN: detectar presigned y no pasar por ningún proxy.
  if (url.includes('X-Amz-Signature') || url.includes('x-amz-signature')) {
    return url;  // ← presigned: usar directo, sin proxy
  }

  // URLs simples S3 (sin auth) necesitan proxy CORS en desarrollo.
  // En producción con Vercel, las imágenes pasan por rewrite normal;
  // para audio se usa esta ruta especial que llama al middleware de Vite.
  const s3Host = 'https://catatrack-photos.s3.amazonaws.com';
  if (url.startsWith(s3Host)) {
    return '/s3-audio' + url.slice(s3Host.length);
    // Ej: https://catatrack-photos.s3.amazonaws.com/requerimientos/VID-001/RID-042/nota_voz_abc.webm.gz
    //  → /s3-audio/requerimientos/VID-001/RID-042/nota_voz_abc.webm.gz
  }

  return url;
}
```

**Regla práctica:**
- Siempre que el backend devuelva `url_visualizar` o `url_presigned` → contiene `X-Amz-Signature` → usar `url` directo.
- Solo usar el proxy `/s3-audio` si la URL es plana y no presignada (raro en producción).

---

## 5. Clasificación de tipos de media

```typescript
// src/components/seguimiento/ListaRequerimientosVisita.svelte

function isImage(doc: DocumentoAdjunto): boolean {
  return doc.tipo.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp)/i.test(doc.nombre);
}

function isVideo(doc: DocumentoAdjunto): boolean {
  return doc.tipo.startsWith('video/') || /\.(mp4|webm|mov)/i.test(doc.nombre);
}

function isAudio(doc: DocumentoAdjunto): boolean {
  return (
    doc.tipo.startsWith('audio/') ||
    /\.(mp3|wav|ogg|m4a|webm)/i.test(doc.nombre) ||
    doc.nombre.startsWith('nota_voz_')   // convención del backend
  );
}

// Helpers derivados
function getImages(req: Requerimiento): DocumentoAdjunto[] {
  return req.documentos_adjuntos.filter(isImage);
}
function getVideos(req: Requerimiento): DocumentoAdjunto[] {
  return req.documentos_adjuntos.filter(isVideo);
}
function getAudios(req: Requerimiento): DocumentoAdjunto[] {
  return req.documentos_adjuntos.filter(isAudio);
}
function getFiles(req: Requerimiento): DocumentoAdjunto[] {
  return req.documentos_adjuntos.filter(d => !isImage(d) && !isVideo(d) && !isAudio(d));
}
```

**Nota sobre `.gz`:** Los audios subidos por el backend se guardan como `nota_voz_abc.webm.gz`. El `content_type` que devuelve `_listar_documentos_s3` para `.gz` es `application/gzip`, no `audio/webm`. Por eso la clasificación también chequea `doc.nombre.startsWith('nota_voz_')` — sin eso, los audios caerían en la categoría "files".

---

## 6. Renderizado de imágenes — Carrusel con lightbox

```svelte
<!-- Estado necesario -->
<script lang="ts">
  // índice actual del carrusel por requerimiento (varios carruseles en paralelo)
  let carouselIndices: Record<string, number> = {};
  // imágenes con URL rota (error de carga)
  let brokenImages: Record<string, boolean> = {};
  // lightbox
  let lightboxUrl = "";
  let lightboxName = "";

  function handleImgError(url: string) {
    brokenImages = { ...brokenImages, [url]: true };
  }

  function carouselNext(reqId: string, total: number) {
    const cur = carouselIndices[reqId] || 0;
    carouselIndices = { ...carouselIndices, [reqId]: (cur + 1) % total };
  }
  function carouselPrev(reqId: string, total: number) {
    const cur = carouselIndices[reqId] || 0;
    carouselIndices = { ...carouselIndices, [reqId]: (cur - 1 + total) % total };
  }
</script>

<!-- Template: carrusel de fotos de un requerimiento -->
{#if images.length > 0}
  {@const idx = carouselIndices[req.id] || 0}
  <div class="carousel-container">

    <!-- Imagen principal o placeholder si la URL falló -->
    {#if brokenImages[images[idx].url]}
      <div class="carousel-placeholder">
        Imagen no disponible (URL expirada o región S3 incorrecta)
      </div>
    {:else}
      <button
        on:click={() => { lightboxUrl = images[idx].url; lightboxName = images[idx].nombre; }}
        type="button"
      >
        <img
          src={images[idx].url}
          alt={images[idx].nombre}
          loading="lazy"
          on:error={() => handleImgError(images[idx].url)}
        />
      </button>
    {/if}

    <!-- Navegación (solo si hay más de 1 imagen) -->
    {#if images.length > 1}
      <button on:click|stopPropagation={() => carouselPrev(req.id, images.length)}>←</button>
      <button on:click|stopPropagation={() => carouselNext(req.id, images.length)}>→</button>
      <span class="counter">{idx + 1}/{images.length}</span>
    {/if}

  </div>

  <!-- Thumbnails strip -->
  {#if images.length > 1}
    <div class="thumbs">
      {#each images as img, i}
        <button
          class:active={i === idx}
          on:click={() => { carouselIndices = { ...carouselIndices, [req.id]: i }; }}
        >
          {#if brokenImages[img.url]}
            <div class="thumb-broken" />
          {:else}
            <img src={img.url} alt={img.nombre} loading="lazy"
                 on:error={() => handleImgError(img.url)} />
          {/if}
        </button>
      {/each}
    </div>
  {/if}
{/if}

<!-- Lightbox (overlay global) -->
{#if lightboxUrl}
  <div
    class="lightbox-overlay"
    on:click={() => { lightboxUrl = ''; }}
    on:keydown={(e) => { if (e.key === 'Escape') lightboxUrl = ''; }}
    role="dialog" aria-modal="true" tabindex="-1"
  >
    <div on:click|stopPropagation={() => {}}>
      <button on:click={() => { lightboxUrl = ''; }}>&times;</button>
      {#if brokenImages[lightboxUrl]}
        <p>Imagen no disponible</p>
      {:else}
        <img src={lightboxUrl} alt={lightboxName}
             on:error={() => handleImgError(lightboxUrl)} />
      {/if}
    </div>
  </div>
{/if}
```

---

## 7. Renderizado de audio + transcripción

```svelte
<script lang="ts">
  function getTranscripcion(req: Requerimiento): string | null {
    if (!req.transcripciones || req.transcripciones.length === 0) return null;
    // Devuelve la primera transcripción no vacía
    const t = req.transcripciones.find(t => t.transcripcion?.trim().length > 0);
    return t ? t.transcripcion : null;
  }
</script>

<!-- Audio principal (nota de voz) -->
{#if req.nota_voz_url}
  <div class="audio-item">
    <span>Nota de voz</span>
    <!-- audioSrc() decide si usar la URL directa o el proxy /s3-audio -->
    <audio src={audioSrc(req.nota_voz_url)} controls preload="metadata">
      <track kind="captions" />
    </audio>

    <!-- Transcripción del audio (generada por Whisper en el backend) -->
    {#if getTranscripcion(req)}
      <div class="transcripcion-box">
        <span>Transcripción</span>
        <p>{getTranscripcion(req)}</p>
      </div>
    {/if}
  </div>
{/if}

<!-- Otros audios adjuntos (clasificados como audio en documentos_adjuntos) -->
{#each audios as aud}
  <div class="audio-item">
    <span>{aud.nombre}</span>
    <audio src={audioSrc(aud.url)} controls preload="metadata">
      <track kind="captions" />
    </audio>
  </div>
{/each}
```

**Por qué `preload="metadata"` y no `preload="auto"`:** Con archivos `.gz` en S3, el browser necesita primero leer los headers para saber que puede reproducirlo. `preload="auto"` descargaría todo el archivo antes de saber si puede reproducirlo.

---

## 8. Renderizado de archivos genéricos (PDF, docs)

```svelte
{#each files as f}
  <a href={f.url} target="_blank" rel="noopener" class="media-file">
    <!-- Icono de documento -->
    <svg ...></svg>
    <span>{f.nombre}</span>
  </a>
{/each}
```

Para PDFs, el navegador los muestra inline porque la URL presignada tiene `ResponseContentDisposition: inline`. No se necesita un visor externo.

---

## 9. Proxy Vite para audio S3 (desarrollo local)

```typescript
// vite.config.ts — plugin personalizado

function s3AudioProxy() {
  return {
    name: 's3-audio-proxy',
    configureServer(server: any) {
      server.middlewares.use('/s3-audio', (req: any, res: any) => {
        // Traduce /s3-audio/requerimientos/VID-001/RID-042/nota_voz_abc.webm.gz
        // → https://catatrack-photos.s3.amazonaws.com/requerimientos/VID-001/RID-042/nota_voz_abc.webm.gz
        const targetUrl = 'https://catatrack-photos.s3.amazonaws.com' + req.url;

        https.get(targetUrl, (s3Res) => {
          const chunks: Buffer[] = [];
          let stream: NodeJS.ReadableStream = s3Res;

          // Si S3 sirve el archivo con Content-Encoding: gzip
          // (audios subidos con ContentEncoding='gzip' en el backend),
          // el proxy los descomprime para que <audio> los pueda reproducir
          if (s3Res.headers['content-encoding'] === 'gzip') {
            stream = s3Res.pipe(zlib.createGunzip());
          }

          stream.on('data', (chunk: Buffer) => chunks.push(chunk));
          stream.on('end', () => {
            const buffer = Buffer.concat(chunks);
            // Estos headers son críticos para que <audio> detecte la duración:
            res.setHeader('Content-Type', 'audio/webm');      // tipo del audio descomprimido
            res.setHeader('Content-Length', buffer.length);   // necesario para scrubbing
            res.setHeader('Accept-Ranges', 'bytes');           // habilita seeking en el audio
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Cache-Control', 'public, max-age=3600');
            res.end(buffer);
          });
        });
      });
    }
  };
}
```

**En producción (Vercel/Railway):** El proxy Vite no existe. Si las URLs son presignadas (contienen `X-Amz-Signature`), `audioSrc()` las devuelve directas y funcionan sin proxy. Si por algún motivo tienes URLs planas, necesitas implementar este middleware en tu servidor de producción también (ej: un endpoint FastAPI que actúe de proxy para el audio).

---

## 10. Panel de detalle en KanbanRequerimientos — galería de fotos

El panel de detalle usa una galería tipo grid en vez de carrusel:

```svelte
<!-- Grid de thumbnails con lightbox -->
<div class="media-gallery">
  {#each selectedReq.documentos_adjuntos as doc}
    {#if doc.tipo.startsWith('image/') || doc.nombre.match(/\.(jpg|jpeg|png|gif|webp)/i)}
      <!-- Imagen: click abre lightbox -->
      <button
        class="media-thumb"
        on:click={() => { lightboxUrl = doc.url; lightboxName = doc.nombre; }}
        type="button"
      >
        <img src={doc.url} alt={doc.nombre} loading="lazy" />
      </button>

    {:else if doc.tipo.startsWith('video/') || doc.nombre.match(/\.(mp4|webm|mov)/i)}
      <!-- Video inline -->
      <div class="media-video-card">
        <video src={doc.url} controls preload="metadata" style="max-height:160px">
          <track kind="captions" />
        </video>
        <span>{doc.nombre}</span>
      </div>

    {:else}
      <!-- Cualquier otro archivo: link de descarga -->
      <a href={doc.url} target="_blank" rel="noopener" class="media-file-card">
        <svg><!-- icono documento --></svg>
        <span>{doc.nombre}</span>
      </a>
    {/if}
  {/each}
</div>
```

---

## 11. API client: cómo se obtienen los datos

```typescript
// src/lib/api-client.ts — cliente HTTP genérico

class ApiClient {
  private baseUrl: string;
  private token: string | null = null;

  setToken(token: string | null) { this.token = token; }

  private getHeaders(isJson = true): HeadersInit {
    const headers: Record<string, string> = {};
    if (this.token) headers['Authorization'] = `Bearer ${this.token}`;
    if (isJson) headers['Content-Type'] = 'application/json';
    return headers;
  }

  async get<T>(path: string, params?: Record<string, string>): Promise<T> {
    let url = `${this.baseUrl}${path}`;
    if (params) url += `?${new URLSearchParams(params)}`;
    const response = await fetch(url, { headers: this.getHeaders() });
    if (!response.ok) throw new Error(`GET ${path} failed (${response.status})`);
    return response.json();
  }
}

// Tres instancias para tres backends distintos
export const apiClient = new ApiClient(import.meta.env.VITE_AUTH_API_URL || '/api/auth');
export const projectApiClient = new ApiClient(import.meta.env.VITE_API_URL || '/api/project');
// uploadApiClient bypasses Vercel proxy — uploads multipart directamente al backend
export const uploadApiClient = new ApiClient(import.meta.env.VITE_UPLOAD_API_URL || import.meta.env.VITE_AUTH_API_URL);
```

```typescript
// src/api/visitas.ts — función que llama al GET

export async function obtenerRequerimientos(): Promise<ObtenerRequerimientosItem[]> {
  const res = await apiClient.get<{ success: boolean; total: number; requerimientos: ObtenerRequerimientosItem[] }>(
    '/obtener-requerimientos'
  );
  return res.requerimientos || [];
}
```

El token se inyecta en `apiClient` al hacer login:
```typescript
// Después del login exitoso:
apiClient.setToken(accessToken);
```

---

## 12. Variables de entorno frontend

```bash
# .env.development
VITE_AUTH_API_URL=http://localhost:8000   # o /api/auth con proxy Vite

# .env.production (Vercel)
VITE_AUTH_API_URL=https://web-production-79739.up.railway.app
VITE_UPLOAD_API_URL=https://web-production-79739.up.railway.app  # directo, sin proxy Vercel
```

**Por qué `VITE_UPLOAD_API_URL` es diferente:** El proxy de Vercel puede corromper bodies multipart/form-data binarios. Los uploads de fotos y audios se hacen directamente al backend en Railway, sin pasar por Vercel.

---

## 13. Proxy Vite en desarrollo (no-S3 audio)

```typescript
// vite.config.ts — proxy estándar para rutas de API
server: {
  proxy: {
    '/api/auth': {
      target: 'https://web-production-79739.up.railway.app',
      changeOrigin: true,
      rewrite: (path) => path.replace(/^\/api\/auth/, ''),
    },
    '/api/project': {
      target: 'https://gestorproyectoapi-production.up.railway.app',
      changeOrigin: true,
      rewrite: (path) => path.replace(/^\/api\/project/, ''),
    },
    '/s3-proxy': {
      // Proxy genérico para imágenes S3 en dev (no para audio — ese usa el plugin custom)
      target: 'https://catatrack-photos.s3.amazonaws.com',
      changeOrigin: true,
      rewrite: (path) => path.replace(/^\/s3-proxy/, ''),
    }
  }
}
```

---

## 14. Guía de replicación

### Para mostrar imágenes de S3 desde un GET
1. El GET debe devolver `url_visualizar` (presigned con `ResponseContentDisposition: inline`)
2. Úsala directamente en `<img src={doc.url_visualizar} />`
3. Agrega `on:error` → marca la URL como rota → muestra placeholder
4. Para lightbox: guarda la URL en variable y muestra en modal/overlay con fondo oscuro

### Para reproducir audio de S3 desde un GET
1. Preferir `url_visualizar` o `url_presigned` de `documentos_con_enlaces` sobre `nota_voz_url`
2. Implementar `audioSrc(url)`:
   - Si contiene `X-Amz-Signature` → devolver la URL tal cual
   - Si es URL plana → enrutar por proxy que descomprime gzip
3. Usar `<audio src={audioSrc(url)} controls preload="metadata">`
4. Para producción sin Vite: implementar un endpoint en el backend que actúe de proxy para audios planos

### Para descargar archivos de S3
1. Usar `url_descarga` (presigned con `ResponseContentDisposition: attachment; filename="..."`)
2. Renderizar como `<a href={url_descarga} target="_blank" download>`

### Tokens y autenticación
1. El cliente HTTP agrega `Authorization: Bearer {token}` en todos los GET al backend
2. El backend valida el token con Firebase y genera las presigned URLs
3. Las presigned URLs no necesitan el token del usuario — ya tienen las credenciales AWS embebidas en los query params

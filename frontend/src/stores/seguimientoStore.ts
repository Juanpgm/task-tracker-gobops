/**
 * Store de Seguimiento de Requerimientos
 * Gestiona visitas programadas, requerimientos y estado del Kanban
 * Conectado a endpoints reales /seguimiento/* con fallback a datos mock
 */

import { writable, derived } from 'svelte/store';
import type {
  VisitaProgramada,
  Requerimiento,
  EstadoRequerimiento,
  Colaborador,
  Solicitante,
  RegistroAvance,
} from '../types/seguimiento';
import {
  MOCK_COLABORADORES,
  generateVisitaId,
  generateRequerimientoId,
} from '../data/mock-seguimiento';
import {
  actualizarEstadoVisitaAPI,
  crearRequerimientoSeguimiento,
  cambiarEstadoRequerimientoAPI,
  obtenerVisitasProgramadas,
  getRequerimientosSeguimiento,
  getColaboradores,
  registrarVisita,
  registrarRequerimiento,
  obtenerRequerimientos,
  editarRequerimiento as editarRequerimientoAPI,
} from '../api/visitas';
import type { ObtenerVisitasProgramadasItem, ObtenerRequerimientosItem } from '../api/visitas';
import type { RegistrarVisitaPayload, RequerimientoPayload, RequerimientoOut, UnidadProyecto } from '../types';
import { offlineStore } from './offlineStore';
import {
  enqueueOperation,
  getQueue,
  dequeueOperation,
  updateQueueReqId,
  updateOperationError,
} from '../lib/offlineQueue';

function mapRequerimientoOutToRequerimiento(
  out: RequerimientoOut,
  legacyRid?: string,
  isOffline?: boolean
): Requerimiento {
  const estadoMap: Record<string, EstadoRequerimiento> = {
    'pendiente': 'nuevo',
    'nuevo': 'nuevo',
    'radicado': 'radicado',
    'en-gestion': 'en-gestion',
    'asignado': 'asignado',
    'en-proceso': 'en-proceso',
    'resuelto': 'resuelto',
    'cerrado': 'cerrado',
    'cancelado': 'cancelado',
  };
  const estadoNorm = (out.estado || 'Pendiente').toLowerCase().trim();
  const estado = estadoMap[estadoNorm] || 'nuevo';

  const prioridadMap: Record<string, Requerimiento['prioridad']> = {
    'baja': 'baja',
    'media': 'media',
    'alta': 'alta',
    'urgente': 'urgente',
  };
  const prioridadNorm = (out.prioridad || 'media').toLowerCase().trim();
  const prioridad = prioridadMap[prioridadNorm] || 'media';

  return {
    id: out.id,
    rid: legacyRid || undefined,
    visita_id: out.visita_id,
    solicitante: {
      id: out.solicitante?.id || out.id || '',
      nombre_completo: out.solicitante?.nombre_completo || 'Sin nombre',
      cedula: out.solicitante?.cedula || '',
      telefono: out.solicitante?.telefono || '',
      email: out.solicitante?.email || '',
      direccion: out.solicitante?.direccion || '',
      barrio_vereda: out.solicitante?.barrio_vereda || '',
      comuna_corregimiento: out.solicitante?.comuna_corregimiento || '',
    },
    centros_gestores: out.centros_gestores || [],
    descripcion: out.descripcion || '',
    observaciones: out.observaciones || '',
    direccion: out.direccion || '',
    latitud: out.latitud || '',
    longitud: out.longitud || '',
    evidencia_fotos: out.evidencia_fotos || [],
    nota_voz_url: null,
    transcripciones: [],
    documentos_adjuntos: (out.evidencia_fotos || []).map((url: string) => ({
      nombre: url.split('/').pop() || 'foto',
      url,
      tipo: 'image/jpeg',
      s3_key: '',
    })),
    estado,
    encargado: out.encargado || undefined,
    porcentaje_avance: out.porcentaje_avance || 0,
    historial: Array.isArray(out.historial)
      ? out.historial.map((h: any) => ({
          id: h.id || `hist-${Math.random()}`,
          fecha: h.fecha || new Date().toISOString(),
          autor: h.autor || 'Sistema',
          descripcion: h.descripcion || '',
          estado_anterior: h.estado_anterior || 'nuevo',
          estado_nuevo: h.estado_nuevo || 'nuevo',
          evidencias: h.evidencias || [],
          porcentaje_avance: h.porcentaje_avance || 0,
        }))
      : [],
    prioridad,
    numero_orfeo: out.numero_orfeo || undefined,
    fecha_radicado_orfeo: out.fecha_radicado_orfeo || undefined,
    documento_peticion_url: out.documento_peticion_url || undefined,
    documento_peticion_nombre: out.documento_peticion_nombre || undefined,
    motivo_cancelacion: out.motivo_cancelacion || undefined,
    documento_cancelacion_url: out.documento_cancelacion_url || undefined,
    documento_cancelacion_nombre: out.documento_cancelacion_nombre || undefined,
    created_at: out.created_at || new Date().toISOString(),
    updated_at: out.updated_at || new Date().toISOString(),
    isOffline: isOffline || false,
  };
}

/* ============================================================
 *  STATE
 * ============================================================ */
interface SeguimientoState {
  visitas: VisitaProgramada[];
  requerimientos: Requerimiento[];
  colaboradores: Colaborador[];
  loading: boolean;
  error: string | null;
}

const initialState: SeguimientoState = {
  visitas: [],
  requerimientos: [],
  colaboradores: [...MOCK_COLABORADORES],
  loading: false,
  error: null,
};

function createSeguimientoStore() {
  const { subscribe, update, set } = writable<SeguimientoState>(initialState);

  return {
    subscribe,

    /* ---- VISITAS ---- */

    /** Carga visitas programadas desde GET /obtener-visitas-programadas/ */
    loadVisitas: async () => {
      update((s) => ({ ...s, loading: true, error: null }));
      try {
        const data = await obtenerVisitasProgramadas();
        const mapped: VisitaProgramada[] = data.map((v: ObtenerVisitasProgramadasItem) => {
          // fecha viene dd/mm/yyyy → convertir a yyyy-mm-dd
          const [dd, mm, yyyy] = v.fecha_visita.split('/');
          const fechaISO = `${yyyy}-${mm}-${dd}`;

          // acompanantes puede ser un objeto, un array, o null
          const acompRaw = Array.isArray(v.acompanantes)
            ? v.acompanantes
            : v.acompanantes ? [v.acompanantes] : [];
          const acompList: Record<string, string>[] = acompRaw.filter(Boolean);

          const colaboradores: Colaborador[] = acompList.map((a, i) => ({
            id: `${v.vid}-acomp-${i}`,
            nombre: a.nombre_completo || '',
            email: a.email || '',
            telefono: a.telefono || '',
            cargo: '',
            centro_gestor: a.centro_gestor || '',
          }));

          return {
            id: v.vid,
            upid: '',
            direccion_manual: v.direccion_visita || undefined,
            barrio_vereda: v.barrio_vereda || undefined,
            comuna_corregimiento: v.comuna_corregimiento || undefined,
            latitud: v.coords?.coordinates?.[1] != null ? String(v.coords.coordinates[1]) : undefined,
            longitud: v.coords?.coordinates?.[0] != null ? String(v.coords.coordinates[0]) : undefined,
            geocoding_source: v.geocodificacion_fuente ? 'geocoded' as const : undefined,
            fecha_visita: fechaISO,
            hora_inicio: v.hora_visita || undefined,
            hora_fin: undefined,
            estado: 'programada' as const,
            colaboradores,
            observaciones: v.observaciones_visita || undefined,
            descripcion_visita: v.descripcion_visita,
            created_at: v.created_at,
            updated_at: v.timestamp || v.created_at,
          };
        });
        update((s) => ({ ...s, visitas: mapped, loading: false }));
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Error al cargar visitas';
        console.error('loadVisitas failed:', err);
        update((s) => ({ ...s, loading: false, error: msg }));
      }
    },

    /** Carga requerimientos desde GET /obtener-requerimientos */
    loadRequerimientos: async () => {
      update((s) => ({ ...s, loading: true, error: null }));
      try {
        const data = await obtenerRequerimientos();
        const mapped: Requerimiento[] = data.map((item: ObtenerRequerimientosItem) => {
          const persona = item.datos_solicitante?.personas?.[0];
          const solicitante: Solicitante = {
            id: item.id,
            nombre_completo: persona?.nombre || 'Sin nombre',
            cedula: '',
            telefono: persona?.telefono || '',
            email: persona?.email || '',
            direccion: `${item.barrio_vereda}, ${item.comuna_corregimiento}`,
            barrio_vereda: item.barrio_vereda || '',
            comuna_corregimiento: item.comuna_corregimiento || '',
          };

          // Mapear estado de la API al tipo local
          const estadoMap: Record<string, EstadoRequerimiento> = {
            'pendiente': 'nuevo',
            'nuevo': 'nuevo',
            'radicado': 'radicado',
            'en-gestion': 'en-gestion',
            'asignado': 'asignado',
            'en-proceso': 'en-proceso',
            'resuelto': 'resuelto',
            'cerrado': 'cerrado',
            'cancelado': 'cancelado',
          };
          const estadoNorm = (item.estado || 'Pendiente').toLowerCase().trim();
          const estado: EstadoRequerimiento = estadoMap[estadoNorm] || 'nuevo';

          const lng = item.coords?.coordinates?.[0] ?? 0;
          const lat = item.coords?.coordinates?.[1] ?? 0;

          return {
            id: item.id,
            visita_id: item.vid,
            solicitante,
            centros_gestores: item.organismos_encargados || [],
            descripcion: item.requerimiento || '',
            observaciones: item.observaciones || '',
            direccion: `${item.barrio_vereda}, ${item.comuna_corregimiento}`,
            latitud: String(lat),
            longitud: String(lng),
            evidencia_fotos: [],
            nota_voz_url: (() => {
              // Prefer presigned URL from documentos_con_enlaces over plain s3_url
              if (item.nota_voz_url) {
                const raw = item.documentos_con_enlaces || [];
                const arr = Array.isArray(raw) ? raw : [raw];
                const notaVozDoc = arr.find((d: any) =>
                  d?.filename?.startsWith('nota_voz_')
                );
                if (notaVozDoc) {
                  return notaVozDoc.url_visualizar || notaVozDoc.url_presigned || item.nota_voz_url;
                }
                return item.nota_voz_url;
              }
              return null;
            })() as string | null,
            transcripciones: Array.isArray(item.transcripciones) ? item.transcripciones : [],
            documentos_adjuntos: (() => {
              const raw = item.documentos_con_enlaces || item.documentos_s3 || [];
              const arr = Array.isArray(raw) ? raw : [raw];
              return arr
                .filter((d: any) => d && typeof d === 'object' && Object.keys(d).length > 0)
                .filter((d: any) => !d.filename?.startsWith('nota_voz_'))
                .map((d: any) => ({
                  nombre: d.filename || d.nombre || 'archivo',
                  url: d.url_visualizar || d.url_presigned || d.s3_url || d.url || '',
                  tipo: d.content_type || d.tipo || '',
                  s3_key: d.s3_key || '',
                }));
            })(),
            rid: item.rid,
            tipo_requerimiento: item.tipo_requerimiento,
            estado,
            encargado: undefined,
            porcentaje_avance: estado === 'resuelto' || estado === 'cerrado' ? 100 : 0,
            prioridad: 'media' as const,
            historial: [],
            created_at: item.created_at || item.fecha_registro,
            updated_at: item.timestamp || item.created_at,
          };
        });
        const offlineQueue = await getQueue();
        const queuedCreates = offlineQueue
          .filter((q) => q.type === 'create')
          .map((q) => {
            const p = q.payload;
            return {
              id: q.reqId,
              visita_id: p.visitaId,
              solicitante: p.solicitante,
              centros_gestores: p.centrosGestores,
              descripcion: p.descripcion,
              observaciones: p.observaciones,
              direccion: p.direccion,
              latitud: p.latitud,
              longitud: p.longitud,
              evidencia_fotos: p.fotosFiles ? p.fotosFiles.map((f: File) => typeof window !== 'undefined' ? URL.createObjectURL(f) : '') : [],
              nota_voz_url: p.notaVozFile ? (typeof window !== 'undefined' ? URL.createObjectURL(p.notaVozFile) : null) : null,
              documentos_adjuntos: [],
              estado: 'nuevo' as EstadoRequerimiento,
              porcentaje_avance: 0,
              prioridad: p.prioridad,
              historial: [
                {
                  id: `hist-${q.id}`,
                  fecha: new Date(q.timestamp).toISOString(),
                  autor: p.solicitante?.nombre_completo || 'Usuario actual',
                  descripcion: 'Requerimiento registrado en campo (Pendiente de sincronizar)',
                  estado_anterior: 'nuevo' as EstadoRequerimiento,
                  estado_nuevo: 'nuevo' as EstadoRequerimiento,
                  evidencias: [],
                  porcentaje_avance: 0,
                }
              ],
              created_at: new Date(q.timestamp).toISOString(),
              updated_at: new Date(q.timestamp).toISOString(),
              isOffline: true,
            };
          });

        update((s) => {
          let merged = [...queuedCreates, ...mapped];
          
          // Apply queued edits and status changes
          for (const q of offlineQueue) {
            if (q.type === 'status') {
              merged = merged.map((r) => {
                if (r.id !== q.reqId) return r;
                return {
                  ...r,
                  estado: q.payload.nuevoEstado,
                  porcentaje_avance: q.payload.porcentajeAvance,
                  isOffline: true,
                };
              });
            } else if (q.type === 'edit') {
              merged = merged.map((r) => {
                if (r.id !== q.reqId) return r;
                const p = q.payload;
                let editedDesc = r.descripcion;
                let editedObs = r.observaciones;
                let editedDir = r.direccion;
                if (p.requerimiento) editedDesc = p.requerimiento;
                if (p.observaciones) editedObs = p.observaciones;
                if (p.direccion) editedDir = p.direccion;
                
                return {
                  ...r,
                  descripcion: editedDesc,
                  observaciones: editedObs,
                  direccion: editedDir,
                  isOffline: true,
                };
              });
            }
          }
          return { ...s, loading: false, requerimientos: merged };
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Error al cargar requerimientos';
        console.error('loadRequerimientos failed:', err);
        update((s) => ({ ...s, loading: false, error: msg }));
      }
    },

    /** Programa una nueva visita — calls POST /registrar-visita/ then updates local state */
    programarVisita: async (
      firstArg: string | UnidadProyecto | null,
      secondArg: string,
      thirdArg: string,
      fourthArg: any,
      fifthArg: any,
      sixthArg?: any
    ) => {
      let up: UnidadProyecto | null = null;
      let fecha: string;
      let horaInicio: string;
      let horaFin: string;
      let colaboradoresIds: string[];
      let observaciones: string;
      let ubicacionManual: any = undefined;

      if (firstArg && typeof firstArg === 'object') {
        // UP-linked visit: firstArg is UnidadProyecto
        up = firstArg as UnidadProyecto;
        fecha = secondArg;
        horaInicio = thirdArg;
        horaFin = fourthArg;
        colaboradoresIds = fifthArg;
        observaciones = sixthArg || '';
      } else {
        // Free visit: firstArg is fecha
        fecha = firstArg as string;
        horaInicio = secondArg;
        horaFin = thirdArg;
        colaboradoresIds = fourthArg;
        observaciones = fifthArg || '';
        ubicacionManual = sixthArg;
      }

      // Build payload for POST /registrar-visita/
      let currentState: SeguimientoState | undefined;
      const unsub = seguimientoStore.subscribe((s) => { currentState = s; });
      unsub();

      const primerColab = currentState?.colaboradores.find((c) =>
        colaboradoresIds.includes(c.id)
      );
      const [y, m, d] = fecha.split('-');
      const payload: RegistrarVisitaPayload = {
        direccion_visita: up
          ? up.direccion || 'Sin dirección'
          : (ubicacionManual?.barrio_vereda
            ? `${ubicacionManual.barrio_vereda}, ${ubicacionManual.comuna_corregimiento || ''}`
            : 'Sin dirección'),
        descripcion_visita: observaciones || (up ? `Visita a UP: ${up.nombre_up}` : 'Visita programada'),
        observaciones_visita: observaciones || '',
        acompanantes: primerColab ? [{
          nombre_completo: primerColab.nombre || 'Sin acompañante',
          telefono: primerColab.telefono || '',
          email: primerColab.email || '',
          centro_gestor: primerColab.centro_gestor || '',
        }] : undefined,
        fecha_visita: `${d}/${m}/${y}`,
        hora_visita: horaInicio || '09:00',
      };

      let vid: string | undefined;
      try {
        const result = await registrarVisita(payload);
        vid = result.vid;
      } catch (err) {
        console.warn('POST /registrar-visita/ failed, using local fallback:', err);
      }

      // Update local state
      update((state) => {
        const colaboradoresSeleccionados = state.colaboradores.filter((c) =>
          colaboradoresIds.includes(c.id)
        );
        const nuevaVisita: VisitaProgramada = {
          id: vid || generateVisitaId(),
          upid: up ? up.upid : 'SIN-UP',
          unidad_proyecto: up || null,
          direccion_manual: up ? up.direccion : ubicacionManual?.direccion,
          barrio_vereda: up ? '' : ubicacionManual?.barrio_vereda,
          comuna_corregimiento: up ? '' : ubicacionManual?.comuna_corregimiento,
          referencia_ubicacion: up ? up.nombre_up_detalle : ubicacionManual?.referencia,
          latitud: up ? '' : ubicacionManual?.latitud,
          longitud: up ? '' : ubicacionManual?.longitud,
          geocoding_source: up ? 'geocoded' : ubicacionManual?.geocoding_source,
          fecha_visita: fecha,
          hora_inicio: horaInicio,
          hora_fin: horaFin,
          estado: 'programada',
          colaboradores: colaboradoresSeleccionados,
          observaciones,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        return {
          ...state,
          visitas: [nuevaVisita, ...state.visitas],
        };
      });
    },

    /** Actualiza el estado de una visita — calls PATCH /seguimiento/visitas/:id/estado
     *  Cuando se inicia (en-curso), también registra la visita vía POST /registrar-visita/
     */
    actualizarEstadoVisita: async (visitaId: string, estado: VisitaProgramada['estado']) => {
      // Try real API first
      try {
        await actualizarEstadoVisitaAPI(visitaId, estado);
      } catch (err) {
        console.warn('API PATCH estado failed, updating locally:', err);
      }

      // Si la visita se inicia, registrarla también en POST /registrar-visita/
      if (estado === 'en-curso') {
        let currentState: SeguimientoState | undefined;
        const unsub = seguimientoStore.subscribe((s) => { currentState = s; });
        unsub();
        const visita = currentState?.visitas.find((v) => v.id === visitaId);
        if (visita) {
          try {
            const [y, m, d] = visita.fecha_visita.split('-');
            const fechaFormatted = `${d}/${m}/${y}`;
            const primerColaborador = visita.colaboradores[0];
            const payload: RegistrarVisitaPayload = {
              direccion_visita: visita.direccion_manual || visita.barrio_vereda
                ? `${visita.barrio_vereda || ''}, ${visita.comuna_corregimiento || ''}`.replace(/^, |, $/g, '')
                : 'Sin dirección',
              descripcion_visita: visita.observaciones || 'Visita iniciada desde seguimiento',
              observaciones_visita: visita.observaciones || 'Visita iniciada desde seguimiento',
              acompanantes: primerColaborador ? [{
                nombre_completo: primerColaborador.nombre || 'Sin acompañante',
                telefono: primerColaborador.telefono || '',
                email: primerColaborador.email || '',
                centro_gestor: primerColaborador.centro_gestor || '',
              }] : undefined,
              fecha_visita: fechaFormatted,
              hora_visita: visita.hora_inicio || new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: false }),
            };
            const result = await registrarVisita(payload);
            console.log('Visita registrada en artefacto de captura:', result.vid);
          } catch (err) {
            console.warn('POST /registrar-visita/ failed (no-blocking):', err);
          }
        }
      }

      // Always update local state
      update((state) => ({
        ...state,
        visitas: state.visitas.map((v) =>
          v.id === visitaId
            ? { ...v, estado, updated_at: new Date().toISOString() }
            : v
        ),
      }));
    },

    /* ---- REQUERIMIENTOS ---- */

    agregarRequerimiento: async (
      visitaId: string,
      solicitante: Solicitante,
      centrosGestores: string[],
      descripcion: string,
      observaciones: string,
      direccion: string,
      latitud: string,
      longitud: string,
      fotosFiles: File[] | null,
      notaVozFile: File | null,
      prioridad: Requerimiento['prioridad']
    ) => {
      const tempId = generateRequerimientoId();

      const datosSolicitante = JSON.stringify({
        personas: [{
          nombre: solicitante.nombre_completo,
          email: solicitante.email || undefined,
          telefono: solicitante.telefono || undefined,
          direccion: solicitante.direccion || undefined,
        }],
      });
      const coordsJson = (latitud && longitud)
        ? JSON.stringify({ type: 'Point', coordinates: [parseFloat(longitud), parseFloat(latitud)] })
        : JSON.stringify({ type: 'Point', coordinates: [0, 0] });

      const queuePayload = {
        visitaId,
        solicitante,
        centrosGestores,
        descripcion,
        observaciones,
        direccion,
        latitud,
        longitud,
        fotosFiles,
        notaVozFile,
        prioridad,
        tempId,
      };

      const nuevoReqLocal: Requerimiento = {
        id: tempId,
        visita_id: visitaId,
        solicitante,
        centros_gestores: centrosGestores,
        descripcion,
        observaciones,
        direccion,
        latitud,
        longitud,
        evidencia_fotos: fotosFiles ? fotosFiles.map(f => typeof window !== 'undefined' ? URL.createObjectURL(f) : '') : [],
        nota_voz_url: notaVozFile ? (typeof window !== 'undefined' ? URL.createObjectURL(notaVozFile) : null) : null,
        documentos_adjuntos: [],
        estado: 'nuevo',
        porcentaje_avance: 0,
        prioridad,
        historial: [
          {
            id: `hist-${Date.now()}`,
            fecha: new Date().toISOString(),
            autor: solicitante.nombre_completo || 'Usuario actual',
            descripcion: 'Requerimiento registrado en campo (Pendiente de sincronizar)',
            estado_anterior: 'nuevo',
            estado_nuevo: 'nuevo',
            evidencias: [],
            porcentaje_avance: 0,
          },
        ],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        isOffline: true,
      };

      update((state) => ({
        ...state,
        requerimientos: [nuevoReqLocal, ...state.requerimientos],
      }));

      if (navigator.onLine) {
        try {
          let uploadedUrls: string[] = [];
          let legacyRid = '';
          const capturaPayload: RequerimientoPayload = {
            vid: visitaId,
            datos_solicitante: datosSolicitante,
            tipo_requerimiento: prioridad || 'media',
            requerimiento: descripcion,
            direccion_requerimiento: direccion || undefined,
            observaciones: observaciones || 'Sin observaciones',
            coords: coordsJson,
            organismos_encargados: JSON.stringify(centrosGestores),
            nota_voz: notaVozFile,
            evidencias: fotosFiles,
          };
          
          try {
            const legacyResult = await registrarRequerimiento(capturaPayload);
            legacyRid = legacyResult.rid;
            if (legacyResult.documentos_urls) {
              uploadedUrls = legacyResult.documentos_urls.map(doc => doc.url);
            }
          } catch (err) {
            console.warn('Immediate capture registration failed:', err);
            throw err;
          }

          const apiBody = {
            visita_id: visitaId,
            solicitante: {
              nombre_completo: solicitante.nombre_completo,
              cedula: solicitante.cedula,
              telefono: solicitante.telefono,
              email: solicitante.email,
              direccion: solicitante.direccion,
              barrio_vereda: solicitante.barrio_vereda,
              comuna_corregimiento: solicitante.comuna_corregimiento,
            },
            centros_gestores: centrosGestores,
            descripcion,
            observaciones,
            direccion,
            latitud,
            longitud,
            evidencia_fotos: uploadedUrls,
            prioridad,
          };
          const result = await crearRequerimientoSeguimiento(apiBody);
          const mappedReq = mapRequerimientoOutToRequerimiento(result, legacyRid, false);

          update((state) => ({
            ...state,
            requerimientos: state.requerimientos.map(r => r.id === tempId ? mappedReq : r),
          }));
          return mappedReq;
        } catch (err) {
          console.warn('Network call failed immediately, enqueuing for offline sync:', err);
        }
      }

      await enqueueOperation('create', tempId, queuePayload);
      await offlineStore.refreshPendingCount();
      return nuevoReqLocal;
    },

    cambiarEstadoRequerimiento: async (
      reqId: string,
      nuevoEstado: EstadoRequerimiento,
      descripcion: string,
      autor: string,
      porcentajeAvance: number
    ) => {
      const updateLocalState = () => {
        update((state) => ({
          ...state,
          requerimientos: state.requerimientos.map((r) => {
            if (r.id !== reqId) return r;
            const nuevoRegistro: RegistroAvance = {
              id: `hist-${Date.now()}`,
              fecha: new Date().toISOString(),
              autor,
              descripcion,
              estado_anterior: r.estado,
              estado_nuevo: nuevoEstado,
              evidencias: [],
              porcentaje_avance: porcentajeAvance,
            };
            return {
              ...r,
              estado: nuevoEstado,
              porcentaje_avance: porcentajeAvance,
              historial: [...r.historial, nuevoRegistro],
              updated_at: new Date().toISOString(),
              isOffline: true,
            };
          }),
        }));
      };

      if (navigator.onLine) {
        try {
          await cambiarEstadoRequerimientoAPI(reqId, {
            estado: nuevoEstado,
            descripcion,
            autor,
            porcentaje_avance: porcentajeAvance,
          });
          updateLocalState();
          update((state) => ({
            ...state,
            requerimientos: state.requerimientos.map(r => r.id === reqId ? { ...r, isOffline: false } : r)
          }));
          return;
        } catch (err) {
          console.warn('API PATCH estado failed immediately, enqueuing for offline sync:', err);
        }
      }

      updateLocalState();
      await enqueueOperation('status', reqId, { nuevoEstado, descripcion, autor, porcentajeAvance });
      await offlineStore.refreshPendingCount();
    },

    /** Asigna un encargado a un requerimiento */
    asignarEncargado: (reqId: string, encargado: string) => {
      update((state) => ({
        ...state,
        requerimientos: state.requerimientos.map((r) =>
          r.id === reqId
            ? { ...r, encargado, updated_at: new Date().toISOString() }
            : r
        ),
      }));
    },

    /** Guarda número de orfeo y datos de petición */
    actualizarOrfeo: (
      reqId: string,
      numeroOrfeo: string,
      fechaRadicado: string,
      docUrl?: string,
      docNombre?: string
    ) => {
      update((state) => ({
        ...state,
        requerimientos: state.requerimientos.map((r) =>
          r.id === reqId
            ? {
                ...r,
                numero_orfeo: numeroOrfeo,
                fecha_radicado_orfeo: fechaRadicado,
                documento_peticion_url: docUrl,
                documento_peticion_nombre: docNombre,
                updated_at: new Date().toISOString(),
              }
            : r
        ),
      }));
    },

    /** Cancela un requerimiento con documento oficial */
    cancelarRequerimiento: (
      reqId: string,
      motivo: string,
      autor: string,
      docUrl?: string,
      docNombre?: string
    ) => {
      update((state) => ({
        ...state,
        requerimientos: state.requerimientos.map((r) => {
          if (r.id !== reqId) return r;
          const registro = {
            id: `hist-${Date.now()}`,
            fecha: new Date().toISOString(),
            autor,
            descripcion: `Requerimiento cancelado: ${motivo}`,
            estado_anterior: r.estado,
            estado_nuevo: 'cancelado' as const,
            evidencias: docUrl
              ? [{ id: `ev-${Date.now()}`, tipo: 'documento' as const, url: docUrl, descripcion: docNombre || 'Doc. cancelación', fecha: new Date().toISOString() }]
              : [],
            porcentaje_avance: r.porcentaje_avance,
          };
          return {
            ...r,
            estado: 'cancelado' as const,
            motivo_cancelacion: motivo,
            documento_cancelacion_url: docUrl,
            documento_cancelacion_nombre: docNombre,
            historial: [...r.historial, registro],
            updated_at: new Date().toISOString(),
          };
        }),
      }));
    },

    editarRequerimiento: async (
      reqId: string,
      payload: {
        datos_solicitante?: string;
        tipo_requerimiento?: string;
        requerimiento?: string;
        observaciones?: string;
        coords?: string;
        direccion?: string;
        organismos_encargados?: string;
        eliminar_s3_keys?: string;
        eliminar_nota_voz?: boolean;
        nota_voz?: File | null;
        fotos?: File[] | null;
      }
    ) => {
      update((s) => ({ ...s, loading: true, error: null }));

      const updateLocalState = (reqId: string, pPayload: any) => {
        update((state) => ({
          ...state,
          loading: false,
          requerimientos: state.requerimientos.map((r) => {
            if (r.id !== reqId) return r;
            
            let updatedSolicitante = { ...r.solicitante };
            if (pPayload.datos_solicitante) {
              try {
                const parsed = JSON.parse(pPayload.datos_solicitante);
                const pObj = parsed?.personas?.[0];
                if (pObj) {
                  updatedSolicitante = {
                    ...updatedSolicitante,
                    nombre_completo: pObj.nombre ?? updatedSolicitante.nombre_completo,
                    telefono: pObj.telefono ?? updatedSolicitante.telefono,
                    email: pObj.email ?? updatedSolicitante.email,
                  };
                }
              } catch (e) {}
            }
            
            let updatedCgs = r.centros_gestores;
            if (pPayload.organismos_encargados) {
              try {
                updatedCgs = JSON.parse(pPayload.organismos_encargados);
              } catch {}
            }
            
            let updatedPhotos = [...r.documentos_adjuntos];
            if (pPayload.eliminar_s3_keys) {
              try {
                const keysToDelete = JSON.parse(pPayload.eliminar_s3_keys);
                updatedPhotos = updatedPhotos.filter(photo => !keysToDelete.includes(photo.s3_key || ''));
              } catch {}
            }
            
            if (pPayload.fotos && Array.isArray(pPayload.fotos)) {
              const localPhotos = pPayload.fotos.map((file: File) => ({
                nombre: file.name,
                url: typeof window !== 'undefined' ? URL.createObjectURL(file) : '',
                tipo: file.type,
                s3_key: `temp-${Date.now()}-${file.name}`
              }));
              updatedPhotos = [...updatedPhotos, ...localPhotos];
            }
            
            let updatedNotaVoz = r.nota_voz_url;
            if (pPayload.eliminar_nota_voz) {
              updatedNotaVoz = null;
            }
            if (pPayload.nota_voz) {
              updatedNotaVoz = typeof window !== 'undefined' ? URL.createObjectURL(pPayload.nota_voz) : null;
            }
            
            return {
              ...r,
              solicitante: updatedSolicitante,
              descripcion: pPayload.requerimiento ?? r.descripcion,
              observaciones: pPayload.observaciones ?? r.observaciones,
              direccion: pPayload.direccion ?? r.direccion,
              centros_gestores: updatedCgs,
              documentos_adjuntos: updatedPhotos,
              nota_voz_url: updatedNotaVoz,
              updated_at: new Date().toISOString(),
              isOffline: true,
            };
          }),
        }));
      };

      if (navigator.onLine) {
        try {
          const result = await editarRequerimientoAPI(reqId, payload);
          const item = result.requerimiento;
          const persona = item.datos_solicitante?.personas?.[0];
          const solicitante: Solicitante = {
            id: item.id,
            nombre_completo: persona?.nombre || 'Sin nombre',
            cedula: '',
            telefono: persona?.telefono || '',
            email: persona?.email || '',
            direccion: `${item.barrio_vereda}, ${item.comuna_corregimiento}`,
            barrio_vereda: item.barrio_vereda || '',
            comuna_corregimiento: item.comuna_corregimiento || '',
          };

          const estadoMap: Record<string, EstadoRequerimiento> = {
            'pendiente': 'nuevo',
            'nuevo': 'nuevo',
            'radicado': 'radicado',
            'en-gestion': 'en-gestion',
            'asignado': 'asignado',
            'en-proceso': 'en-proceso',
            'resuelto': 'resuelto',
            'cerrado': 'cerrado',
            'cancelado': 'cancelado',
          };
          const estadoNorm = (item.estado || 'Pendiente').toLowerCase().trim();
          const estado: EstadoRequerimiento = estadoMap[estadoNorm] || 'nuevo';

          const lng = item.coords?.coordinates?.[0] ?? 0;
          const lat = item.coords?.coordinates?.[1] ?? 0;

          const updatedReq: Requerimiento = {
            id: item.id,
            visita_id: item.vid,
            solicitante,
            centros_gestores: item.organismos_encargados || [],
            descripcion: item.requerimiento || '',
            observaciones: item.observaciones || '',
            direccion: `${item.barrio_vereda}, ${item.comuna_corregimiento}`,
            latitud: String(lat),
            longitud: String(lng),
            evidencia_fotos: [],
            nota_voz_url: (() => {
              if (item.nota_voz_url) {
                const raw = item.documentos_con_enlaces || [];
                const arr = Array.isArray(raw) ? raw : [raw];
                const notaVozDoc = arr.find((d: any) =>
                  d?.filename?.startsWith('nota_voz_')
                );
                if (notaVozDoc) {
                  return notaVozDoc.url_visualizar || notaVozDoc.url_presigned || item.nota_voz_url;
                }
                return item.nota_voz_url;
              }
              return null;
            })() as string | null,
            transcripciones: Array.isArray(item.transcripciones) ? item.transcripciones : [],
            documentos_adjuntos: (() => {
              const raw = item.documentos_con_enlaces || item.documentos_s3 || [];
              const arr = Array.isArray(raw) ? raw : [raw];
              return arr
                .filter((d: any) => d && typeof d === 'object' && Object.keys(d).length > 0)
                .filter((d: any) => !d.filename?.startsWith('nota_voz_'))
                .map((d: any) => ({
                  nombre: d.filename || d.nombre || 'archivo',
                  url: d.url_visualizar || d.url_presigned || d.s3_url || d.url || '',
                  tipo: d.content_type || d.tipo || '',
                  s3_key: d.s3_key || '',
                }));
            })(),
            rid: item.rid,
            tipo_requerimiento: item.tipo_requerimiento,
            estado,
            encargado: undefined,
            porcentaje_avance: estado === 'resuelto' || estado === 'cerrado' ? 100 : 0,
            prioridad: 'media' as const,
            historial: [],
            created_at: item.created_at || item.fecha_registro,
            updated_at: item.timestamp || item.created_at,
          };

          update((state) => ({
            ...state,
            loading: false,
            requerimientos: state.requerimientos.map((r) => r.id === reqId ? updatedReq : r)
          }));
          return;
        } catch (err) {
          console.warn('API edit failed immediately, enqueuing for offline sync:', err);
        }
      }

      updateLocalState(reqId, payload);
      await enqueueOperation('edit', reqId, payload);
      await offlineStore.refreshPendingCount();
    },

    /** Resetea error */
    clearError: () => {
      update((state) => ({ ...state, error: null }));
    },

    /** Sincroniza la cola offline de requerimientos con el backend */
    syncOfflineQueue: async () => {
      if (typeof navigator !== 'undefined' && !navigator.onLine) return;

      const queue = await getQueue();
      if (queue.length === 0) return;

      offlineStore.setSyncing(true);

      for (const item of queue) {
        try {
          if (item.type === 'create') {
            const p = item.payload;
            let uploadedUrls: string[] = [];
            let legacyRid = '';
            
            const datosSolicitante = JSON.stringify({
              personas: [{
                nombre: p.solicitante.nombre_completo,
                email: p.solicitante.email || undefined,
                telefono: p.solicitante.telefono || undefined,
                direccion: p.solicitante.direccion || undefined,
                centro_gestor: p.centrosGestores?.[0] || undefined,
              }],
            });
            const coordsJson = (p.latitud && p.longitud)
              ? JSON.stringify({ type: 'Point', coordinates: [parseFloat(p.longitud), parseFloat(p.latitud)] })
              : JSON.stringify({ type: 'Point', coordinates: [0, 0] });
            const organismosJson = JSON.stringify(p.centrosGestores);

            const capturaPayload: RequerimientoPayload = {
              vid: p.visitaId,
              datos_solicitante: datosSolicitante,
              tipo_requerimiento: p.prioridad || 'media',
              requerimiento: p.descripcion,
              direccion_requerimiento: p.direccion || undefined,
              observaciones: p.observaciones || 'Sin observaciones',
              coords: coordsJson,
              organismos_encargados: organismosJson,
              nota_voz: p.notaVozFile,
              evidencias: p.fotosFiles,
            };

            try {
              const legacyResult = await registrarRequerimiento(capturaPayload);
              legacyRid = legacyResult.rid;
              if (legacyResult.documentos_urls) {
                uploadedUrls = legacyResult.documentos_urls.map(doc => doc.url);
              }
            } catch (err) {
              console.warn('Sync capture API failed for item:', item.id, err);
              throw err;
            }

            const apiBody = {
              visita_id: p.visitaId,
              solicitante: {
                nombre_completo: p.solicitante.nombre_completo,
                cedula: p.solicitante.cedula,
                telefono: p.solicitante.telefono,
                email: p.solicitante.email,
                direccion: p.solicitante.direccion,
                barrio_vereda: p.solicitante.barrio_vereda,
                comuna_corregimiento: p.solicitante.comuna_corregimiento,
              },
              centros_gestores: p.centrosGestores,
              descripcion: p.descripcion,
              observaciones: p.observaciones,
              direccion: p.direccion,
              latitud: p.latitud,
              longitud: p.longitud,
              evidencia_fotos: uploadedUrls,
              prioridad: p.prioridad,
            };

            const result = await crearRequerimientoSeguimiento(apiBody);
            const realId = result.id;

            await updateQueueReqId(item.reqId, realId);

            update((s) => ({
              ...s,
              requerimientos: s.requerimientos.map(r => r.id === item.reqId ? mapRequerimientoOutToRequerimiento(result, legacyRid, false) : r)
            }));
            
            await dequeueOperation(item.id);

          } else if (item.type === 'edit') {
            const p = item.payload;
            await editarRequerimientoAPI(item.reqId, p);
            await dequeueOperation(item.id);

          } else if (item.type === 'status') {
            const p = item.payload;
            await cambiarEstadoRequerimientoAPI(item.reqId, {
              estado: p.nuevoEstado,
              descripcion: p.descripcion,
              autor: p.autor,
              porcentaje_avance: p.porcentajeAvance,
            });
            await dequeueOperation(item.id);
          }
        } catch (err: any) {
          console.error(`Sync error on queue item ${item.id} (${item.type}):`, err);
          await updateOperationError(item.id, err instanceof Error ? err.message : String(err));
          break;
        }
      }

      try {
        const { loadRequerimientos } = createSeguimientoStore();
        // Since we are inside createSeguimientoStore context, we can just loadRequerimientos directly!
      } catch (err) {}

      offlineStore.setSyncing(false);
      await offlineStore.refreshPendingCount();
    },
  };
}

export const seguimientoStore = createSeguimientoStore();

/* ============================================================
 *  DERIVED STORES
 * ============================================================ */

/** Visitas activas (programadas y en-curso) */
export const visitasActivas = derived(seguimientoStore, ($s) =>
  $s.visitas.filter((v) => v.estado === 'programada' || v.estado === 'en-curso')
);

/** Requerimientos agrupados por estado (para Kanban) */
export const requerimientosPorEstado = derived(seguimientoStore, ($s) => {
  const grouped: Record<EstadoRequerimiento, Requerimiento[]> = {
    'nuevo': [],
    'radicado': [],
    'en-gestion': [],
    'asignado': [],
    'en-proceso': [],
    'resuelto': [],
    'cerrado': [],
    'cancelado': [],
  };
  for (const req of $s.requerimientos) {
    grouped[req.estado].push(req);
  }
  return grouped;
});

/** Requerimientos agrupados por centro gestor */
export const requerimientosPorCentroGestor = derived(seguimientoStore, ($s) => {
  const grouped: Record<string, Requerimiento[]> = {};
  for (const req of $s.requerimientos) {
    const cgs = req.centros_gestores.length > 0 ? req.centros_gestores : ['Sin asignar'];
    for (const cg of cgs) {
      if (!grouped[cg]) grouped[cg] = [];
      grouped[cg].push(req);
    }
  }
  return grouped;
});

/** Conteo de requerimientos por estado */
export const conteoEstados = derived(requerimientosPorEstado, ($rpe) => {
  const conteo: Record<string, number> = {};
  for (const [estado, reqs] of Object.entries($rpe)) {
    conteo[estado] = reqs.length;
  }
  return conteo;
});

/** Requerimientos de una visita específica */
export function getRequerimientosByVisita(visitaId: string) {
  return derived(seguimientoStore, ($s) =>
    $s.requerimientos.filter((r) => r.visita_id === visitaId)
  );
}

<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { navigationStore } from "../../stores/navigationStore";
  import { avanzadasStore } from "../../stores/avanzadasStore";
  import { getCurrentPosition, formatCoordinates, reverseGeocodeWithFallback } from "../../lib/geolocation";
  import Button from "../ui/Button.svelte";
  import Alert from "../ui/Alert.svelte";
  import Card from "../ui/Card.svelte";
  import Icon from "../ui/Icon.svelte";
  import Input from "../ui/Input.svelte";
  import Select from "../ui/Select.svelte";
  import Textarea from "../ui/Textarea.svelte";
  import ViewHeader from "../ui/ViewHeader.svelte";
  import LocationPicker from "../shared/LocationPicker.svelte";
  import RequerimientoFormFields from "./RequerimientoFormFields.svelte";
  import { lookupComunaBarrio } from "../../lib/geoLookup";
  import type { Avanzada } from "../../types/avanzadas";

  const MAX_FOTOS_POR_REQUERIMIENTO = 5;

  /* ============================================================
   *  MODO EDICIÓN — presencia de client_id en los params de navegación
   *  (mismo patrón que DetalleAvanzada.svelte). Cuando está presente, este
   *  formulario deja de crear una avanzada nueva y pasa a precargar +
   *  actualizar la avanzada existente vía PATCH.
   * ============================================================ */
  $: params = $navigationStore.params;
  $: clientId = params.client_id || "";
  $: modoEdicion = !!clientId;

  /* ============================================================
   *  SECCIÓN 1 — Datos de la Avanzada
   * ============================================================ */
  let nombreAvanzada = "";
  let fecha = new Date().toISOString().slice(0, 10);
  let estrategia = "";
  let usandoEstrategiaPersonalizada = false;
  let estrategiaPersonalizada = "";
  let sector = "";
  let comuna = "";
  let barrio = "";
  let latitud = "";
  let longitud = "";
  let direccion = "";

  // "idle": no coordinates yet. "buscando": lookup in flight. "encontrado":
  // both comuna and barrio resolved. "no-encontrado": coordinates outside
  // every polygon (e.g. outside Cali). "error": the geojson couldn't be
  // fetched (offline before first cache).
  let geoLookupEstado: "idle" | "buscando" | "encontrado" | "no-encontrado" | "error" = "idle";
  let geoLookupToken = 0;

  /** Edit mode only: the coordinates + comuna/barrio the avanzada already
   * had when this screen opened (see prefillFormDesdeDetalle). Lets a
   * geo-lookup failure fall back to these known-good values instead of
   * blanking a comuna/barrio the backend already had confirmed -- but only
   * while the pin hasn't actually moved from that original spot (see the
   * catch branch in ejecutarGeoLookup). */
  let coordsOriginalesEdicion: { lat: string; lng: string; comuna: string; barrio: string } | null = null;

  $: if (latitud && longitud) {
    ejecutarGeoLookup(latitud, longitud);
  } else {
    comuna = "";
    barrio = "";
    geoLookupEstado = "idle";
  }

  // A token guards against a slower earlier lookup overwriting a faster
  // later one when the user moves the map marker again before the first
  // request resolves.
  async function ejecutarGeoLookup(latStr: string, lngStr: string) {
    const lat = parseFloat(latStr);
    const lng = parseFloat(lngStr);
    if (Number.isNaN(lat) || Number.isNaN(lng)) return;

    const token = ++geoLookupToken;
    geoLookupEstado = "buscando";
    try {
      const resultado = await lookupComunaBarrio(lat, lng);
      if (token !== geoLookupToken) return;
      comuna = resultado.comuna || "";
      barrio = resultado.barrio || "";
      geoLookupEstado = resultado.comuna && resultado.barrio ? "encontrado" : "no-encontrado";
    } catch {
      if (token !== geoLookupToken) return;
      // Edit mode + the pin is still exactly where the avanzada already had
      // it: a network/cache failure here is just "couldn't reverify", not
      // "location changed" -- fall back to the comuna/barrio the backend
      // already had confirmed instead of blanking data that was correct
      // before this screen even opened. Any other case (create mode, or
      // the user actually moved the pin) keeps the original behaviour.
      const esCoordOriginalDeEdicion =
        coordsOriginalesEdicion !== null &&
        latStr === coordsOriginalesEdicion.lat &&
        lngStr === coordsOriginalesEdicion.lng;
      if (esCoordOriginalDeEdicion) {
        comuna = coordsOriginalesEdicion!.comuna;
        barrio = coordsOriginalesEdicion!.barrio;
        geoLookupEstado = comuna && barrio ? "encontrado" : "error";
      } else {
        comuna = "";
        barrio = "";
        geoLookupEstado = "error";
      }
    }
  }

  /* ============================================================
   *  SECCIÓN 2 — Encargados
   * ============================================================ */
  let encargadosSeleccionados: string[] = [];
  let encargadoNuevo = "";
  let fotoEquipo: File | null = null;
  let fotoEquipoPreview: string | null = null;

  function toggleEncargado(nombre: string) {
    encargadosSeleccionados = encargadosSeleccionados.includes(nombre)
      ? encargadosSeleccionados.filter((e) => e !== nombre)
      : [...encargadosSeleccionados, nombre];
  }

  function agregarEncargadoLibre() {
    const val = encargadoNuevo.trim();
    if (!val) return;
    if (!encargadosSeleccionados.includes(val)) {
      encargadosSeleccionados = [...encargadosSeleccionados, val];
    }
    encargadoNuevo = "";
  }

  function quitarEncargado(nombre: string) {
    encargadosSeleccionados = encargadosSeleccionados.filter((e) => e !== nombre);
  }

  function handleFotoEquipo(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;
    fotoEquipo = input.files[0];
    if (fotoEquipoPreview) URL.revokeObjectURL(fotoEquipoPreview);
    fotoEquipoPreview = URL.createObjectURL(fotoEquipo);
    input.value = "";
  }

  function quitarFotoEquipo() {
    fotoEquipo = null;
    if (fotoEquipoPreview) {
      URL.revokeObjectURL(fotoEquipoPreview);
      fotoEquipoPreview = null;
    }
  }

  /* ============================================================
   *  SECCIÓN 3 — Asistencia
   * ============================================================ */
  interface AsistenteDraft {
    nombre: string;
    organismo: string;
    celular: string;
    correo: string;
    /** Edit mode only: existing photo URL to keep unless explicitly replaced/removed. */
    fotoUrlExistente?: string | null;
    /** Edit mode only: newly picked file pending upload on submit. */
    fotoNueva?: File | null;
    /** Object URL preview for fotoNueva. */
    fotoPreview?: string | null;
    /** Edit mode only: true when the user explicitly removed the existing photo without picking a new one. */
    fotoEliminada?: boolean;
  }

  function createEmptyAsistente(): AsistenteDraft {
    return {
      nombre: "",
      organismo: "",
      celular: "",
      correo: "",
      fotoUrlExistente: null,
      fotoNueva: null,
      fotoPreview: null,
      fotoEliminada: false,
    };
  }

  let asistentes: AsistenteDraft[] = [];

  function agregarAsistente() {
    asistentes = [...asistentes, createEmptyAsistente()];
  }

  function eliminarAsistente(idx: number) {
    if (asistentes[idx]?.fotoPreview) URL.revokeObjectURL(asistentes[idx].fotoPreview!);
    asistentes = asistentes.filter((_, i) => i !== idx);
  }

  /* ---- Foto por asistente (sólo edición — ver punto 4 del plan) ---- */
  function handleFotoAsistente(idx: number, event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;
    const file = input.files[0];
    if (asistentes[idx].fotoPreview) URL.revokeObjectURL(asistentes[idx].fotoPreview!);
    asistentes[idx].fotoNueva = file;
    asistentes[idx].fotoPreview = URL.createObjectURL(file);
    asistentes[idx].fotoEliminada = false;
    asistentes = [...asistentes];
    input.value = "";
  }

  function quitarFotoAsistente(idx: number) {
    if (asistentes[idx].fotoPreview) URL.revokeObjectURL(asistentes[idx].fotoPreview!);
    asistentes[idx].fotoNueva = null;
    asistentes[idx].fotoPreview = null;
    asistentes[idx].fotoEliminada = true;
    asistentes = [...asistentes];
  }

  /* ============================================================
   *  SECCIÓN 4 — Requerimientos
   * ============================================================ */
  interface RequerimientoDraft {
    entidades: string[];
    categoria: string;
    usandoCategoriaPersonalizada: boolean;
    categoriaPersonalizadaTexto: string;
    requerimiento: string;
    ubicacion: string;
    coordenadas: string;
    capturandoGps: boolean;
    fotos: File[];
  }

  function createEmptyRequerimiento(): RequerimientoDraft {
    return {
      entidades: [],
      categoria: "",
      usandoCategoriaPersonalizada: false,
      categoriaPersonalizadaTexto: "",
      requerimiento: "",
      ubicacion: "",
      coordenadas: "",
      capturandoGps: false,
      fotos: [],
    };
  }

  let requerimientos: RequerimientoDraft[] = [createEmptyRequerimiento()];

  async function capturarGpsRequerimiento(idx: number) {
    requerimientos[idx].capturandoGps = true;
    requerimientos = [...requerimientos];
    try {
      const pos = await getCurrentPosition();
      requerimientos[idx].coordenadas = formatCoordinates(pos);
      requerimientos = [...requerimientos];
      await intentarRellenarUbicacionDesdeCoordenadas(idx);
    } catch (err) {
      errorMsg = err instanceof Error ? err.message : "No se pudo obtener el GPS del dispositivo.";
    } finally {
      requerimientos[idx].capturandoGps = false;
      requerimientos = [...requerimientos];
    }
  }

  function handleCoordsBlur(idx: number) {
    intentarRellenarUbicacionDesdeCoordenadas(idx);
  }

  /**
   * Reference behaviour: blurring the "lat, lng" coordinates field (whether
   * filled by the GPS button or pasted manually) reverse-geocodes and fills
   * that card's Ubicación — but only when it's still empty, and it never
   * throws into the form: a failed/offline geocode just leaves Ubicación as
   * it was, same non-blocking spirit as the section-1 GPS autofill.
   */
  async function intentarRellenarUbicacionDesdeCoordenadas(idx: number) {
    const req = requerimientos[idx];
    if (!req || req.ubicacion.trim()) return;
    const partes = req.coordenadas.split(",").map((p) => p.trim());
    if (partes.length !== 2) return;
    const lat = parseFloat(partes[0]);
    const lng = parseFloat(partes[1]);
    if (Number.isNaN(lat) || Number.isNaN(lng)) return;
    try {
      const r = await reverseGeocodeWithFallback(lat, lng);
      if (r && r.direccion_formateada && !requerimientos[idx].ubicacion.trim()) {
        requerimientos[idx].ubicacion = r.direccion_formateada;
        requerimientos = [...requerimientos];
      }
    } catch {
      // Comodidad opcional: nunca bloquea el formulario.
    }
  }

  function handleFotosRequerimiento(idx: number, event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;
    const combined = [...requerimientos[idx].fotos, ...Array.from(input.files)];
    if (combined.length > MAX_FOTOS_POR_REQUERIMIENTO) {
      errorMsg = `Requerimiento #${idx + 1}: máximo ${MAX_FOTOS_POR_REQUERIMIENTO} fotos permitidas`;
      input.value = "";
      return;
    }
    requerimientos[idx].fotos = combined;
    requerimientos = [...requerimientos];
    input.value = "";
  }

  function quitarFotoRequerimiento(idx: number, fotoIdx: number) {
    requerimientos[idx].fotos = requerimientos[idx].fotos.filter((_, i) => i !== fotoIdx);
    requerimientos = [...requerimientos];
  }

  function getFilePreviewUrl(file: File): string {
    return URL.createObjectURL(file);
  }

  function agregarRequerimiento() {
    requerimientos = [...requerimientos, createEmptyRequerimiento()];
  }

  function eliminarRequerimiento(idx: number) {
    if (requerimientos.length <= 1) {
      errorMsg = "Debe haber al menos un requerimiento.";
      return;
    }
    // Filtering by index and re-rendering with the array's new positions is
    // what keeps "#N" contiguous afterwards — no separate renumbering step.
    requerimientos = requerimientos.filter((_, i) => i !== idx);
  }

  /* ============================================================
   *  SECCIONES COLAPSABLES
   * ============================================================ */
  let seccionAbierta: Record<string, boolean> = {
    datos: true,
    encargados: false,
    asistencia: false,
    requerimientos: false,
  };

  function toggleSeccion(nombre: string) {
    seccionAbierta = { ...seccionAbierta, [nombre]: !seccionAbierta[nombre] };
  }

  /* ============================================================
   *  DRAFT AUTOSAVE (localStorage)
   *
   *  offlineQueue.ts's IndexedDB store holds REAL PENDING SUBMISSIONS —
   *  adding a draft object store there would mean a DB version bump that
   *  must be proven not to disturb existing queued rows. A form draft is a
   *  much lower-stakes, purely local convenience, so it uses localStorage
   *  instead: zero risk to the offline queue, and simple enough that a
   *  version migration is never a concern.
   * ============================================================ */
  const DRAFT_KEY = "catatrack:draft:registrar-avanzada";
  const DRAFT_DEBOUNCE_MS = 600;
  let draftTimer: ReturnType<typeof setTimeout> | null = null;
  let draftRestaurado = false;

  interface DraftPayload {
    nombreAvanzada: string;
    fecha: string;
    estrategia: string;
    usandoEstrategiaPersonalizada: boolean;
    estrategiaPersonalizada: string;
    sector: string;
    comuna: string;
    barrio: string;
    latitud: string;
    longitud: string;
    direccion: string;
    encargadosSeleccionados: string[];
    asistentes: AsistenteDraft[];
    requerimientos: Array<Omit<RequerimientoDraft, "fotos" | "capturandoGps">>;
  }

  function serializarDraft(): DraftPayload {
    return {
      nombreAvanzada,
      fecha,
      estrategia,
      usandoEstrategiaPersonalizada,
      estrategiaPersonalizada,
      sector,
      comuna,
      barrio,
      latitud,
      longitud,
      direccion,
      encargadosSeleccionados,
      // Sólo los campos de texto: fotoNueva/fotoPreview no son serializables
      // (File, blob: URL efímera) y fotoUrlExistente/fotoEliminada son
      // exclusivos de modo edición, que nunca usa este autosave (ver onMount).
      asistentes: asistentes.map((a) => ({ nombre: a.nombre, organismo: a.organismo, celular: a.celular, correo: a.correo })),
      requerimientos: requerimientos.map((r) => ({
        entidades: r.entidades,
        categoria: r.categoria,
        usandoCategoriaPersonalizada: r.usandoCategoriaPersonalizada,
        categoriaPersonalizadaTexto: r.categoriaPersonalizadaTexto,
        requerimiento: r.requerimiento,
        ubicacion: r.ubicacion,
        coordenadas: r.coordenadas,
      })),
    };
  }

  function draftEstaVacio(d: DraftPayload): boolean {
    return (
      !d.nombreAvanzada.trim() &&
      !d.sector.trim() &&
      !d.comuna &&
      !d.barrio &&
      !d.latitud &&
      d.encargadosSeleccionados.length === 0 &&
      d.asistentes.length === 0 &&
      d.requerimientos.every((r) => r.entidades.length === 0 && !r.requerimiento.trim() && !r.ubicacion.trim())
    );
  }

  function guardarDraft() {
    try {
      const payload = serializarDraft();
      if (draftEstaVacio(payload)) {
        localStorage.removeItem(DRAFT_KEY);
        return;
      }
      localStorage.setItem(DRAFT_KEY, JSON.stringify(payload));
    } catch {
      // localStorage puede fallar (modo privado, cuota excedida). El
      // autoguardado es una comodidad, no algo crítico: se ignora en silencio.
    }
  }

  function programarAutosave() {
    if (draftTimer) clearTimeout(draftTimer);
    draftTimer = setTimeout(guardarDraft, DRAFT_DEBOUNCE_MS);
  }

  function limpiarDraft() {
    if (draftTimer) {
      clearTimeout(draftTimer);
      draftTimer = null;
    }
    try {
      localStorage.removeItem(DRAFT_KEY);
    } catch {
      // ignorar
    }
  }

  function restaurarDraft() {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      const d: Partial<DraftPayload> = JSON.parse(raw);

      if (typeof d.nombreAvanzada === "string") nombreAvanzada = d.nombreAvanzada;
      if (typeof d.fecha === "string" && d.fecha) fecha = d.fecha;
      if (typeof d.estrategia === "string") estrategia = d.estrategia;
      if (typeof d.usandoEstrategiaPersonalizada === "boolean") usandoEstrategiaPersonalizada = d.usandoEstrategiaPersonalizada;
      if (typeof d.estrategiaPersonalizada === "string") estrategiaPersonalizada = d.estrategiaPersonalizada;
      if (typeof d.sector === "string") sector = d.sector;
      if (typeof d.comuna === "string" && d.comuna) comuna = d.comuna;
      if (typeof d.barrio === "string" && d.barrio) barrio = d.barrio;
      if (typeof d.latitud === "string") latitud = d.latitud;
      if (typeof d.longitud === "string") longitud = d.longitud;
      if (typeof d.direccion === "string") direccion = d.direccion;
      if (Array.isArray(d.encargadosSeleccionados)) encargadosSeleccionados = d.encargadosSeleccionados;
      if (Array.isArray(d.asistentes)) {
        asistentes = d.asistentes.map((a) => ({
          nombre: a.nombre || "",
          organismo: a.organismo || "",
          celular: a.celular || "",
          correo: a.correo || "",
          fotoUrlExistente: null,
          fotoNueva: null,
          fotoPreview: null,
          fotoEliminada: false,
        }));
      }
      if (Array.isArray(d.requerimientos) && d.requerimientos.length > 0) {
        requerimientos = d.requerimientos.map((r) => {
          // Fallback para borradores previos que guardaron `entidad: string`
          // (forma legacy, antes de la multi-selección de organismos).
          const legacy = r as { entidad?: string; entidades?: string[] };
          const entidades = Array.isArray(legacy.entidades)
            ? legacy.entidades
            : legacy.entidad
              ? [legacy.entidad]
              : [];
          return {
          entidades,
          categoria: r.categoria || "",
          usandoCategoriaPersonalizada: !!r.usandoCategoriaPersonalizada,
          categoriaPersonalizadaTexto: r.categoriaPersonalizadaTexto || "",
          requerimiento: r.requerimiento || "",
          ubicacion: r.ubicacion || "",
          coordenadas: r.coordenadas || "",
          capturandoGps: false,
          fotos: [],
          };
        });
      }

      if (!draftEstaVacio(serializarDraft())) draftRestaurado = true;
    } catch {
      // Borrador corrupto: se ignora y el usuario empieza de cero.
    }
  }

  // `$:` dependencies are tracked ONLY by identifiers written textually in
  // this statement (Svelte 4) — every autosaved field must be named here, or
  // edits to it would silently stop triggering the autosave.
  $: {
    nombreAvanzada;
    fecha;
    estrategia;
    usandoEstrategiaPersonalizada;
    estrategiaPersonalizada;
    sector;
    comuna;
    barrio;
    latitud;
    longitud;
    direccion;
    encargadosSeleccionados;
    asistentes;
    requerimientos;
    // Edit mode never autosaves a draft: it's editing an already-persisted
    // record via loadAvanzadaDetalle()/prefillFormDesdeDetalle(), not
    // capturing a new one — a "draft" concept doesn't apply there, and would
    // otherwise fight with the prefill (or leak between avanzadas via the
    // shared DRAFT_KEY, since it isn't scoped by client_id).
    if (formularioListoParaAutosave && !modoEdicion) programarAutosave();
  }

  // Guards the very first reactive run (component init, before onMount has
  // restored a draft) so we don't immediately re-save whatever restoreDraft
  // just loaded, and so an unrelated field on an otherwise-empty fresh form
  // doesn't schedule pointless writes before the user has typed anything.
  let formularioListoParaAutosave = false;

  /* ============================================================
   *  VALIDACIÓN Y ENVÍO
   * ============================================================ */
  interface RequerimientoErrors {
    entidad?: string;
    requerimiento?: string;
    ubicacion?: string;
  }
  interface AsistenteErrors {
    nombre?: string;
  }
  interface FormErrors {
    nombreAvanzada?: string;
    fecha?: string;
    estrategia?: string;
    comuna?: string;
    barrio?: string;
    ubicacion?: string;
    encargados?: string;
    requerimientos: RequerimientoErrors[];
    asistentes: AsistenteErrors[];
  }

  let errors: FormErrors = { requerimientos: [], asistentes: [] };

  let errorMsg = "";
  let successMsg = "";
  let offlineMsg = "";
  let submitting = false;
  let showConfirm = false;

  /* ============================================================
   *  MODO EDICIÓN — carga y precarga
   * ============================================================ */
  // Guards prefillFormDesdeDetalle() to run exactly once per mount: the
  // detalle for clientId can be re-fetched later (e.g. a future manual
  // reload) and re-running the prefill then would clobber whatever the user
  // has since typed.
  let prefillHecho = false;

  $: detalleEdicion = modoEdicion ? $avanzadasStore.detalle[clientId] : null;
  $: detalleEdicionCargando = modoEdicion && ($avanzadasStore.detalleLoading[clientId] ?? false) && !prefillHecho;
  $: detalleEdicionError = modoEdicion ? $avanzadasStore.detalleError[clientId] || null : null;

  $: if (modoEdicion && detalleEdicion && !prefillHecho) {
    prefillFormDesdeDetalle(detalleEdicion);
    prefillHecho = true;
  }

  function prefillFormDesdeDetalle(d: Avanzada) {
    nombreAvanzada = d.nombre_avanzada;
    fecha = d.fecha;
    if ($avanzadasStore.catalogos.estrategias.includes(d.estrategia)) {
      estrategia = d.estrategia;
      usandoEstrategiaPersonalizada = false;
    } else {
      usandoEstrategiaPersonalizada = true;
      estrategiaPersonalizada = d.estrategia;
    }
    sector = d.sector || "";
    direccion = d.direccion || "";
    const partesCoords = (d.coordenadas || "").split(",").map((p) => p.trim());
    latitud = partesCoords[0] || "";
    longitud = partesCoords[1] || "";
    // comuna/barrio: se setean aquí como valor inicial, pero el efecto de
    // geo-lookup (más arriba) los recalcula apenas latitud/longitud cambian
    // — igual que al mover el marcador en el mapa, es la fuente de verdad.
    // Si ese lookup falla (sin red/caché) y el pin sigue en este mismo punto,
    // vuelve a caer acá (ver coordsOriginalesEdicion) en vez de quedar vacío.
    comuna = d.comuna || "";
    barrio = d.barrio || "";
    coordsOriginalesEdicion = { lat: latitud, lng: longitud, comuna, barrio };
    encargadosSeleccionados = [...(d.encargados || [])];
    asistentes = (d.asistentes || []).map((a) => ({
      nombre: a.nombre,
      organismo: a.organismo,
      celular: a.celular,
      correo: a.correo,
      fotoUrlExistente: a.foto_url ?? null,
      fotoNueva: null,
      fotoPreview: null,
      fotoEliminada: false,
    }));
  }

  onMount(() => {
    avanzadasStore.loadCatalogos();
    if (modoEdicion) {
      avanzadasStore.loadAvanzadaDetalle(clientId);
    } else {
      restaurarDraft();
    }
    formularioListoParaAutosave = true;
  });

  onDestroy(() => {
    if (fotoEquipoPreview) URL.revokeObjectURL(fotoEquipoPreview);
    asistentes.forEach((a) => {
      if (a.fotoPreview) URL.revokeObjectURL(a.fotoPreview);
    });
    if (draftTimer) clearTimeout(draftTimer);
  });

  function estrategiaFinal(): string {
    return usandoEstrategiaPersonalizada ? estrategiaPersonalizada.trim() : estrategia;
  }

  /** Collects every validation error at once instead of stopping at the first. */
  function validar(): FormErrors {
    const errs: FormErrors = {
      // Requerimientos section doesn't exist in edit mode (see markup: the
      // backend's PATCH/PUT deliberately excludes requerimientos, they're a
      // separate sub-resource) — so there's nothing to validate there.
      requerimientos: modoEdicion ? [] : requerimientos.map(() => ({})),
      asistentes: asistentes.map(() => ({})),
    };

    if (!nombreAvanzada.trim()) errs.nombreAvanzada = "Ingrese el nombre de la avanzada.";
    if (!fecha) errs.fecha = "Seleccione la fecha de la avanzada.";
    if (!estrategiaFinal()) errs.estrategia = "Seleccione o ingrese la estrategia.";
    if (!latitud || !longitud) {
      errs.ubicacion = "Defina la ubicación (espere al GPS o ajústela en el mapa).";
    } else if (!direccion.trim()) {
      errs.ubicacion = "La dirección es obligatoria";
    } else if (geoLookupEstado === "buscando") {
      errs.ubicacion = "Espere a que se determinen la comuna y el barrio para estas coordenadas.";
    } else {
      if (!comuna) errs.comuna = "No se pudo determinar la comuna para estas coordenadas. Verifique la ubicación en el mapa.";
      if (!barrio) errs.barrio = "No se pudo determinar el barrio para estas coordenadas. Verifique la ubicación en el mapa.";
    }
    if (encargadosSeleccionados.length === 0) {
      errs.encargados = "Seleccione al menos un encargado de la avanzada.";
    }

    // Every rendered asistente row carries a required-nombre asterisk, and
    // crearAvanzada's limpiarAsistentes() silently drops rows without a
    // nombre before they reach the backend — so this validates for real
    // instead of leaving the asterisk as a lie the user only discovers
    // after their data quietly disappears.
    asistentes.forEach((a, i) => {
      if (!a.nombre.trim()) errs.asistentes[i] = { nombre: "El nombre es obligatorio." };
    });

    if (!modoEdicion) {
      requerimientos.forEach((r, i) => {
        const rerr: RequerimientoErrors = {};
        if (r.entidades.length === 0) rerr.entidad = `Requerimiento #${i + 1}: la entidad es obligatoria.`;
        if (!r.requerimiento.trim()) rerr.requerimiento = `Requerimiento #${i + 1}: describa el requerimiento.`;
        if (!r.ubicacion.trim()) rerr.ubicacion = `Requerimiento #${i + 1}: indique la ubicación.`;
        errs.requerimientos[i] = rerr;
      });
    }

    return errs;
  }

  function hayErrores(e: FormErrors): boolean {
    return !!(
      e.nombreAvanzada ||
      e.fecha ||
      e.estrategia ||
      e.comuna ||
      e.barrio ||
      e.ubicacion ||
      e.encargados ||
      e.requerimientos.some((r) => r.entidad || r.requerimiento || r.ubicacion) ||
      e.asistentes.some((a) => a.nombre)
    );
  }

  function abrirConfirmacion() {
    errorMsg = "";
    successMsg = "";
    offlineMsg = "";

    const errs = validar();
    errors = errs;

    if (hayErrores(errs)) {
      // Surface every problem at once by opening every section that has
      // one — no more "submit, fix one field, submit again" loop.
      const abrirDatos = !!(errs.nombreAvanzada || errs.fecha || errs.estrategia || errs.comuna || errs.barrio || errs.ubicacion);
      const abrirEncargados = !!errs.encargados;
      const abrirAsistencia = errs.asistentes.some((a) => a.nombre);
      const abrirRequerimientos = errs.requerimientos.some((r) => r.entidad || r.requerimiento || r.ubicacion);
      seccionAbierta = {
        datos: seccionAbierta.datos || abrirDatos,
        encargados: seccionAbierta.encargados || abrirEncargados,
        asistencia: seccionAbierta.asistencia || abrirAsistencia,
        requerimientos: seccionAbierta.requerimientos || abrirRequerimientos,
      };
      return;
    }

    showConfirm = true;
  }

  function cancelarConfirmacion() {
    showConfirm = false;
  }

  function resetForm() {
    nombreAvanzada = "";
    fecha = new Date().toISOString().slice(0, 10);
    estrategia = "";
    usandoEstrategiaPersonalizada = false;
    estrategiaPersonalizada = "";
    sector = "";
    comuna = "";
    barrio = "";
    latitud = "";
    longitud = "";
    direccion = "";
    geoLookupEstado = "idle";
    geoLookupToken++;
    encargadosSeleccionados = [];
    encargadoNuevo = "";
    quitarFotoEquipo();
    asistentes = [];
    requerimientos = [createEmptyRequerimiento()];
    seccionAbierta = { datos: true, encargados: false, asistencia: false, requerimientos: false };
    errors = { requerimientos: [], asistentes: [] };
    limpiarDraft();
  }

  async function confirmarGuardado() {
    showConfirm = false;
    submitting = true;
    errorMsg = "";
    successMsg = "";
    offlineMsg = "";

    try {
      const datosBase = {
        nombre_avanzada: nombreAvanzada.trim(),
        fecha,
        estrategia: estrategiaFinal(),
        sector: sector.trim(),
        comuna,
        barrio,
        direccion: direccion.trim(),
        coordenadas: `${latitud}, ${longitud}`,
        encargados: encargadosSeleccionados,
      };

      if (modoEdicion) {
        const datos = {
          ...datosBase,
          asistentes: asistentes.map((a) => ({
            nombre: a.nombre,
            organismo: a.organismo,
            celular: a.celular,
            correo: a.correo,
            // A new file makes the existing foto_url moot (the server
            // replaces it from the upload); only send foto_url when we're
            // NOT uploading a replacement, to keep/clear the existing one.
            ...(a.fotoNueva ? {} : { foto_url: a.fotoEliminada ? null : (a.fotoUrlExistente ?? null) }),
          })),
        };
        const files = {
          fotosPorAsistente: asistentes.map((a) => a.fotoNueva ?? null),
        };

        await avanzadasStore.actualizarAvanzada(clientId, datos, files);
        successMsg = "Avanzada actualizada correctamente.";
        navigationStore.navigate("detalle-avanzada", { client_id: clientId });
        return;
      }

      const datos = {
        ...datosBase,
        asistentes: asistentes.map((a) => ({
          nombre: a.nombre,
          organismo: a.organismo,
          celular: a.celular,
          correo: a.correo,
        })),
        requerimientos: requerimientos.map((r) => ({
          // El backend deriva entidad = entidades[0]; enviamos ambos para
          // conservar el contrato legacy (entidad) además de la multi-selección.
          entidad: r.entidades[0],
          entidades: r.entidades,
          categoria: r.usandoCategoriaPersonalizada
            ? r.categoriaPersonalizadaTexto.trim()
            : r.categoria,
          categoria_personalizada: r.usandoCategoriaPersonalizada
            ? r.categoriaPersonalizadaTexto.trim() || null
            : null,
          requerimiento: r.requerimiento.trim(),
          ubicacion: r.ubicacion.trim(),
          coordenadas: r.coordenadas || null,
        })),
      };
      const files = {
        fotoEquipo,
        fotosPorRequerimiento: requerimientos.map((r) => r.fotos),
      };

      const result = await avanzadasStore.crearAvanzada(datos, files);

      if (result.isOffline) {
        offlineMsg = "Avanzada guardada localmente. Se sincronizará automáticamente cuando haya conexión.";
      } else {
        successMsg = "Avanzada registrada correctamente.";
      }
      resetForm();
      setTimeout(() => {
        successMsg = "";
        offlineMsg = "";
      }, 6000);
    } catch (err) {
      errorMsg =
        err instanceof Error ? err.message : modoEdicion ? "Error al actualizar la avanzada." : "Error al registrar la avanzada.";
      console.error("confirmarGuardado error:", err);
    } finally {
      submitting = false;
    }
  }
</script>

<div class="view">
  <ViewHeader
    title={modoEdicion ? "Editar Avanzada" : "Registrar Avanzada"}
    icon="flag"
    onBack={() =>
      modoEdicion
        ? navigationStore.navigate("detalle-avanzada", { client_id: clientId })
        : navigationStore.navigate("avanzadas")}
  />

  <main class="view-body container">
    {#if successMsg}
      <Alert type="success" message={successMsg} />
    {/if}
    {#if offlineMsg}
      <Alert type="warning" message={offlineMsg} />
    {/if}
    {#if errorMsg}
      <Alert type="error" message={errorMsg} />
    {/if}
    {#if draftRestaurado}
      <Alert type="info" message="Se restauró un borrador guardado automáticamente." />
    {/if}

    {#if detalleEdicionCargando}
      <p class="loading-hint">Cargando avanzada…</p>
    {:else if detalleEdicionError}
      <Alert type="error" message={detalleEdicionError} />
      <div class="submit-row">
        <Button type="button" variant="secondary" on:click={() => avanzadasStore.loadAvanzadaDetalle(clientId)}>
          Reintentar
        </Button>
      </div>
    {:else}
    <!-- ============ SECCIÓN 1: Datos de la Avanzada ============ -->
    <Card padding="lg">
      <button type="button" class="section-header" on:click={() => toggleSeccion("datos")}>
        <span class="section-title"><Icon name="flag" size={16} /> Datos de la Avanzada</span>
        <span class="section-toggle" class:open={seccionAbierta.datos}>
          <Icon name="chevron-right" size={16} />
        </span>
      </button>

      {#if seccionAbierta.datos}
        <div class="section-body">
          <Input
            id="av-nombre"
            label="Nombre de la avanzada"
            required
            bind:value={nombreAvanzada}
            placeholder="Ej: Avanzada Comuna 15 - Ciudad Jardín"
            error={errors.nombreAvanzada}
          />

          <div class="form-grid-2">
            <Input id="av-fecha" type="date" label="Fecha" required bind:value={fecha} error={errors.fecha} />

            <div class="field">
              <Select
                id="av-estrategia"
                label="Estrategia"
                required
                bind:value={estrategia}
                disabled={usandoEstrategiaPersonalizada}
                options={$avanzadasStore.catalogos.estrategias.map((est) => ({ value: est, label: est }))}
                error={errors.estrategia}
              />
              <label class="checkbox-inline">
                <input
                  type="checkbox"
                  bind:checked={usandoEstrategiaPersonalizada}
                  on:change={() => (estrategia = "")}
                />
                Otra estrategia...
              </label>
              {#if usandoEstrategiaPersonalizada}
                <Input type="text" bind:value={estrategiaPersonalizada} placeholder="Nombre de la estrategia" />
              {/if}
            </div>
          </div>

          <Input id="av-sector" label="Sector" bind:value={sector} placeholder="Referencia del sector (opcional)" />

          <LocationPicker bind:latitud bind:longitud bind:direccion error={errors.ubicacion} />

          <div class="form-grid-2">
            <Input
              id="av-comuna"
              label="Comuna"
              disabled
              value={geoLookupEstado === "buscando" ? "Determinando…" : comuna}
              placeholder="Se determina automáticamente según la ubicación"
              error={errors.comuna}
            />

            <Input
              id="av-barrio"
              label="Barrio"
              disabled
              value={geoLookupEstado === "buscando" ? "Determinando…" : barrio}
              placeholder="Se determina automáticamente según la ubicación"
              error={errors.barrio}
            />
          </div>
        </div>
      {/if}
    </Card>

    <!-- ============ SECCIÓN 2: Encargados ============ -->
    <Card padding="lg">
      <button type="button" class="section-header" on:click={() => toggleSeccion("encargados")}>
        <span class="section-title">
          <Icon name="users" size={16} /> Encargados
          {#if encargadosSeleccionados.length > 0}
            <span class="section-count">{encargadosSeleccionados.length}</span>
          {/if}
        </span>
        <span class="section-toggle" class:open={seccionAbierta.encargados}>
          <Icon name="chevron-right" size={16} />
        </span>
      </button>

      {#if seccionAbierta.encargados}
        <div class="section-body">
          <p class="form-hint">
            Seleccione al menos un encargado <span class="required">*</span>
          </p>
          <div class="chips-row">
            {#each $avanzadasStore.catalogos.equipo as miembro}
              <button
                type="button"
                class="chip"
                class:chip-active={encargadosSeleccionados.includes(miembro)}
                on:click={() => toggleEncargado(miembro)}
              >
                {miembro}
              </button>
            {/each}
          </div>

          <div class="free-add-row">
            <Input
              type="text"
              bind:value={encargadoNuevo}
              placeholder="Agregar otro encargado..."
              on:keydown={(e) => e.key === "Enter" && (e.preventDefault(), agregarEncargadoLibre())}
            />
            <Button type="button" variant="secondary" size="sm" on:click={agregarEncargadoLibre}>
              <Icon name="plus" size={14} /> Agregar
            </Button>
          </div>

          {#if errors.encargados}
            <span class="section-error">{errors.encargados}</span>
          {/if}

          {#each encargadosSeleccionados.filter((e) => !$avanzadasStore.catalogos.equipo.includes(e)) as extra}
            <div class="extra-chip-row">
              <span class="chip chip-active">{extra}</span>
              <button type="button" class="chip-remove" on:click={() => quitarEncargado(extra)}>
                <Icon name="x" size={12} />
              </button>
            </div>
          {/each}

          {#if !modoEdicion}
          <!-- El contrato de PATCH/PUT no acepta foto_equipo (sólo
               foto_asistente_{i}) — este control queda oculto en edición
               para no ofrecer una acción que no se enviaría al backend. -->
          <div class="field foto-equipo-field">
            <!-- svelte-ignore a11y-label-has-associated-control -->
            <label class="field-label-subtle">Foto del equipo <small>(opcional)</small></label>
            {#if fotoEquipoPreview}
              <div class="foto-equipo-preview">
                <img src={fotoEquipoPreview} alt="Equipo" />
                <button type="button" class="foto-remove-btn" on:click={quitarFotoEquipo}>
                  <Icon name="x" size={12} />
                </button>
              </div>
            {:else}
              <div class="media-actions">
                <label class="media-btn">
                  <Icon name="camera" size={16} />
                  <span>Cámara</span>
                  <input type="file" accept="image/*" capture="environment" on:change={handleFotoEquipo} hidden />
                </label>
                <label class="media-btn">
                  <Icon name="image" size={16} />
                  <span>Galería</span>
                  <input type="file" accept="image/*" on:change={handleFotoEquipo} hidden />
                </label>
              </div>
            {/if}
          </div>
          {/if}
        </div>
      {/if}
    </Card>

    <!-- ============ SECCIÓN 3: Asistencia ============ -->
    <Card padding="lg">
      <button type="button" class="section-header" on:click={() => toggleSeccion("asistencia")}>
        <span class="section-title">
          <Icon name="user" size={16} /> Asistencia
          {#if asistentes.length > 0}
            <span class="section-count">{asistentes.length}</span>
          {/if}
        </span>
        <span class="section-toggle" class:open={seccionAbierta.asistencia}>
          <Icon name="chevron-right" size={16} />
        </span>
      </button>

      {#if seccionAbierta.asistencia}
        <div class="section-body">
          <p class="form-hint">Personas que asistieron a la avanzada (opcional)</p>

          {#each asistentes as asistente, idx (idx)}
            <div class="asistente-row">
              <div class="asistente-row-header">
                <span class="asistente-num">Asistente #{idx + 1}</span>
                <button type="button" class="remove-row-btn" on:click={() => eliminarAsistente(idx)}>
                  <Icon name="trash" size={13} /> Quitar
                </button>
              </div>
              <div class="form-grid-2">
                <Input
                  id="asist-nombre-{idx}"
                  label="Nombre"
                  required
                  bind:value={asistente.nombre}
                  placeholder="Nombre completo"
                  error={errors.asistentes[idx]?.nombre}
                />
                <Input
                  id="asist-organismo-{idx}"
                  label="Organismo"
                  bind:value={asistente.organismo}
                  list="dependencias-list"
                  placeholder="Entidad u organismo"
                />
                <Input
                  id="asist-celular-{idx}"
                  type="tel"
                  label="Celular"
                  bind:value={asistente.celular}
                  placeholder="300 1234567"
                />
                <Input
                  id="asist-correo-{idx}"
                  type="email"
                  label="Correo"
                  bind:value={asistente.correo}
                  placeholder="correo@ejemplo.com"
                />
              </div>

              {#if modoEdicion}
                <div class="field foto-equipo-field">
                  <!-- svelte-ignore a11y-label-has-associated-control -->
                  <label class="field-label-subtle">Foto <small>(opcional)</small></label>
                  {#if asistente.fotoPreview}
                    <div class="foto-equipo-preview">
                      <img src={asistente.fotoPreview} alt={asistente.nombre || "Asistente"} />
                      <button type="button" class="foto-remove-btn" on:click={() => quitarFotoAsistente(idx)}>
                        <Icon name="x" size={12} />
                      </button>
                    </div>
                  {:else if asistente.fotoUrlExistente && !asistente.fotoEliminada}
                    <div class="foto-equipo-preview">
                      <img src={asistente.fotoUrlExistente} alt={asistente.nombre || "Asistente"} />
                      <button type="button" class="foto-remove-btn" on:click={() => quitarFotoAsistente(idx)}>
                        <Icon name="x" size={12} />
                      </button>
                    </div>
                  {:else}
                    <div class="media-actions">
                      <label class="media-btn">
                        <Icon name="camera" size={16} />
                        <span>Cámara</span>
                        <input
                          type="file"
                          accept="image/*"
                          capture="environment"
                          on:change={(e) => handleFotoAsistente(idx, e)}
                          hidden
                        />
                      </label>
                      <label class="media-btn">
                        <Icon name="image" size={16} />
                        <span>Galería</span>
                        <input type="file" accept="image/*" on:change={(e) => handleFotoAsistente(idx, e)} hidden />
                      </label>
                    </div>
                  {/if}
                </div>
              {/if}
            </div>
          {/each}

          <button type="button" class="add-row-btn" on:click={agregarAsistente}>
            <Icon name="plus" size={16} /> Agregar asistente
          </button>
        </div>
      {/if}
    </Card>

    <!-- ============ SECCIÓN 4: Requerimientos ============ -->
    <!-- Oculta en modo edición: el backend excluye requerimientos de
         PATCH/PUT a propósito (son un sub-recurso aparte, ver
         DetalleAvanzada.svelte "+ Agregar Requerimiento"). -->
    {#if !modoEdicion}
    <Card padding="lg">
      <button type="button" class="section-header" on:click={() => toggleSeccion("requerimientos")}>
        <span class="section-title">
          <Icon name="clipboard-list" size={16} /> Requerimientos
          <span class="section-count">{requerimientos.length}</span>
        </span>
        <span class="section-toggle" class:open={seccionAbierta.requerimientos}>
          <Icon name="chevron-right" size={16} />
        </span>
      </button>

      {#if seccionAbierta.requerimientos}
        <div class="section-body">
          {#each requerimientos as req, idx (idx)}
            <div class="req-card">
              <div class="req-card-header">
                <h3 class="req-title">Requerimiento #{idx + 1}</h3>
                <button type="button" class="btn-eliminar-req" on:click={() => eliminarRequerimiento(idx)}>
                  Eliminar
                </button>
              </div>

              <RequerimientoFormFields
                idPrefix={idx}
                bind:entidades={req.entidades}
                bind:categoria={req.categoria}
                bind:usandoCategoriaPersonalizada={req.usandoCategoriaPersonalizada}
                bind:categoriaPersonalizadaTexto={req.categoriaPersonalizadaTexto}
                bind:requerimiento={req.requerimiento}
                bind:ubicacion={req.ubicacion}
                bind:coordenadas={req.coordenadas}
                dependencias={$avanzadasStore.catalogos.dependencias}
                categoriasCatalogo={$avanzadasStore.catalogos.categorias}
                errors={errors.requerimientos[idx] || {}}
                on:coordsblur={() => handleCoordsBlur(idx)}
              >
                <Button
                  slot="gps"
                  type="button"
                  variant="primary"
                  size="sm"
                  loading={req.capturandoGps}
                  on:click={() => capturarGpsRequerimiento(idx)}
                >
                  GPS
                </Button>
              </RequerimientoFormFields>

              <div class="media-attachments">
                <!-- svelte-ignore a11y-label-has-associated-control -->
                <label class="field-label-subtle">
                  Evidencia fotográfica <small>(máx. {MAX_FOTOS_POR_REQUERIMIENTO})</small>
                </label>
                <div class="fotos-container">
                  {#each req.fotos as file, fIdx (fIdx)}
                    <div class="foto-thumb">
                      <img src={getFilePreviewUrl(file)} alt={file.name} />
                      <button
                        type="button"
                        class="foto-del"
                        aria-label="Eliminar foto"
                        on:click={() => quitarFotoRequerimiento(idx, fIdx)}
                      >
                        <Icon name="x" size={11} />
                      </button>
                    </div>
                  {/each}
                </div>
                <div class="media-actions">
                  <label class="media-btn">
                    <Icon name="camera" size={16} />
                    <span>Cámara</span>
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      on:change={(e) => handleFotosRequerimiento(idx, e)}
                      hidden
                    />
                  </label>
                  <label class="media-btn">
                    <Icon name="image" size={16} />
                    <span>Galería</span>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      on:change={(e) => handleFotosRequerimiento(idx, e)}
                      hidden
                    />
                  </label>
                </div>
              </div>
            </div>
          {/each}

          <button type="button" class="add-row-btn" on:click={agregarRequerimiento}>
            <Icon name="plus" size={16} /> Agregar otro requerimiento
          </button>
        </div>
      {/if}
    </Card>
    {/if}

    <div class="submit-row">
      <Button type="button" on:click={abrirConfirmacion} loading={submitting}>
        {modoEdicion ? "Guardar cambios" : "Guardar Avanzada"}
      </Button>
    </div>
    {/if}
  </main>

  <datalist id="dependencias-list">
    {#each $avanzadasStore.catalogos.dependencias as dep}
      <option value={dep}></option>
    {/each}
  </datalist>
</div>

{#if showConfirm}
  <div class="modal-backdrop" role="presentation" on:click={cancelarConfirmacion}>
    <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-noninteractive-element-interactions -->
    <div class="modal" role="dialog" aria-modal="true" on:click|stopPropagation>
      <h3 class="modal-title">
        <Icon name="check-circle" size={18} /> {modoEdicion ? "Confirmar actualización" : "Confirmar registro"}
      </h3>
      <p class="modal-text">
        {#if modoEdicion}
          Se actualizará la avanzada <strong>{nombreAvanzada}</strong>.
        {:else}
          Se registrará la avanzada <strong>{nombreAvanzada}</strong> con
          <strong>{requerimientos.length}</strong> requerimiento{requerimientos.length !== 1 ? "s" : ""}.
        {/if}
      </p>
      <ul class="modal-summary">
        <li><strong>Fecha:</strong> {fecha}</li>
        <li><strong>Estrategia:</strong> {estrategiaFinal()}</li>
        <li><strong>Ubicación:</strong> {barrio}, {comuna}</li>
        <li><strong>Encargados:</strong> {encargadosSeleccionados.join(", ")}</li>
      </ul>
      <div class="modal-actions">
        <Button type="button" variant="secondary" on:click={cancelarConfirmacion}>Cancelar</Button>
        <Button type="button" on:click={confirmarGuardado}>Confirmar y guardar</Button>
      </div>
    </div>
  </div>
{/if}

<style>
  .view {
    min-height: 100vh;
    min-height: -webkit-fill-available;
    min-height: 100dvh;
    background: var(--bg);
  }
  .container {
    max-width: 900px;
    margin: 0 auto;
    padding: 0.75rem;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .loading-hint {
    text-align: center;
    padding: 3rem 1rem;
    color: var(--text-secondary);
    font-size: var(--fs-md);
  }

  /* Collapsible section header */
  .section-header {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: space-between;
    background: none;
    border: none;
    padding: 0;
    cursor: pointer;
    font-family: inherit;
    text-align: left;
  }
  .section-title {
    display: inline-flex;
    align-items: center;
    gap: 0.45rem;
    font-size: var(--fs-lg);
    font-weight: 700;
    color: var(--text);
  }
  .section-count {
    background: var(--primary-light);
    color: var(--primary-darker);
    font-size: var(--fs-xs);
    font-weight: 700;
    padding: 0.05rem 0.45rem;
    border-radius: var(--radius-pill);
  }
  .section-toggle {
    display: inline-flex;
    color: var(--text-muted);
    transition: transform 0.15s ease;
  }
  .section-toggle.open {
    transform: rotate(90deg);
  }
  .section-body {
    margin-top: 0.85rem;
    display: flex;
    flex-direction: column;
    gap: 0.65rem;
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }
  .field-label-subtle {
    font-size: var(--fs-md);
    font-weight: 600;
    color: var(--text-body);
  }
  .field-label-subtle small {
    font-weight: 400;
    color: var(--text-muted);
  }
  .required {
    color: var(--error);
  }
  .form-grid-2 {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.6rem;
  }
  .form-hint {
    font-size: var(--fs-md);
    color: var(--text-secondary);
    margin: 0;
  }
  .checkbox-inline {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    font-size: var(--fs-md);
    font-weight: 500;
    color: var(--text-body);
    margin-top: 0.15rem;
    cursor: pointer;
  }
  .section-error {
    font-size: var(--fs-md);
    color: var(--error);
  }

  /* Chips (encargados) */
  .chips-row {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
  }
  .chip {
    padding: 0.4rem 0.75rem;
    border-radius: var(--radius-pill);
    border: 1.5px solid var(--border);
    background: var(--surface);
    color: var(--text-body);
    font-size: var(--fs-base);
    font-weight: 500;
    cursor: pointer;
    font-family: inherit;
  }
  .chip-active {
    background: var(--primary);
    border-color: var(--primary);
    color: var(--surface);
  }
  .free-add-row {
    display: flex;
    align-items: flex-start;
    gap: 0.4rem;
  }
  .free-add-row :global(.input-group) {
    flex: 1;
  }
  .extra-chip-row {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    width: fit-content;
  }
  .chip-remove {
    background: none;
    border: none;
    color: var(--error);
    cursor: pointer;
    display: inline-flex;
  }

  /* Foto equipo */
  .foto-equipo-field {
    margin-top: 0.4rem;
  }
  .foto-equipo-preview {
    position: relative;
    width: 120px;
  }
  .foto-equipo-preview img {
    width: 120px;
    height: 120px;
    object-fit: cover;
    border-radius: var(--radius-md);
    border: 1px solid var(--border);
  }
  .foto-remove-btn {
    position: absolute;
    top: 4px;
    right: 4px;
    width: 20px;
    height: 20px;
    background: rgba(0, 0, 0, 0.5);
    color: var(--surface);
    border: none;
    border-radius: 50%;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .media-actions {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
  }
  .media-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.5rem 0.85rem;
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    background: var(--surface);
    color: var(--text-body);
    font-size: var(--fs-base);
    font-weight: 500;
    cursor: pointer;
    font-family: inherit;
  }
  .media-btn:hover {
    background: var(--bg);
    border-color: var(--text-muted);
  }

  /* Asistentes rows */
  .asistente-row {
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    padding: 0.85rem;
    display: flex;
    flex-direction: column;
    gap: 0.55rem;
  }
  .asistente-row-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .asistente-num {
    font-size: var(--fs-md);
    font-weight: 700;
    color: var(--text-secondary);
  }
  .remove-row-btn {
    background: none;
    border: none;
    color: var(--error);
    font-size: var(--fs-sm);
    font-weight: 600;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
  }
  .add-row-btn {
    background: var(--bg);
    border: 1.5px dashed var(--border-strong);
    color: var(--text-secondary);
    padding: 0.7rem 1.25rem;
    border-radius: var(--radius-lg);
    font-size: var(--fs-base);
    font-weight: 600;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.4rem;
    width: 100%;
    font-family: inherit;
  }
  .add-row-btn:hover {
    background: var(--primary-light);
    border-color: var(--primary);
    color: var(--primary);
  }

  /* ============================================================
   *  Requerimientos — faithful replica of pc-avanzadas.netlify.app's
   *  req-card. Geometry/copy match the reference 1:1; colours are bound to
   *  this app's tokens by role (see spec's colour-mapping table): the
   *  reference's #1a4480 accent -> var(--primary), #ef4444 -> var(--error),
   *  #9ca3af hints -> var(--text-muted), #d1d5db borders -> var(--border-strong),
   *  #374151 labels -> var(--text-body), #f8fafc card bg -> var(--bg).
   * ============================================================ */
  .req-card {
    background: var(--bg);
    border-left: 4px solid var(--primary);
    padding: 0.875rem;
    margin-bottom: 0.75rem;
    border-radius: var(--radius-sm);
    display: flex;
    flex-direction: column;
    gap: 0.625rem;
  }
  .req-card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .req-title {
    margin: 0;
    font-size: var(--fs-lg);
    font-weight: 700;
    color: var(--text-body);
  }
  /* Small red pill, exactly like the reference's .btn-danger (6px/12px
     padding, 12px type) — the ::before pseudo-element grows the tappable
     area to --tap-min without inflating the visible pill. */
  .btn-eliminar-req {
    position: relative;
    background: var(--error);
    color: #fff;
    border: none;
    padding: 0.375rem 0.75rem;
    border-radius: var(--radius-sm);
    font-size: var(--fs-sm);
    font-weight: 600;
    cursor: pointer;
    font-family: inherit;
    flex-shrink: 0;
  }
  .btn-eliminar-req:hover {
    background: #b91c1c;
  }
  .btn-eliminar-req::before {
    content: "";
    position: absolute;
    inset: -10px;
  }
  .fotos-container {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    margin-top: 0.375rem;
  }
  .foto-thumb {
    position: relative;
    width: 90px;
    height: 90px;
    border-radius: var(--radius-sm);
    overflow: hidden;
    border: 1.5px solid var(--border-strong);
    flex-shrink: 0;
  }
  .foto-thumb img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }
  /* 22px red circle, exactly like the reference's .foto-del — hit area
     grown to --tap-min via ::before, same idiom as elsewhere in this app
     (see Home.svelte's .info-btn). */
  .foto-del {
    position: absolute;
    top: 2px;
    right: 2px;
    width: 22px;
    height: 22px;
    background: var(--error);
    color: #fff;
    border: none;
    border-radius: 50%;
    padding: 0;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .foto-del::before {
    content: "";
    position: absolute;
    inset: calc((22px - var(--tap-min)) / 2);
  }

  .submit-row {
    display: flex;
    justify-content: flex-end;
    padding: 0.5rem 0 2rem;
  }

  /* Confirmation modal */
  .modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(15, 23, 42, 0.55);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 9999;
    padding: 1rem;
  }
  .modal {
    background: var(--surface);
    border-radius: var(--radius-xl);
    padding: 1.5rem;
    width: 100%;
    max-width: 420px;
    box-shadow: var(--shadow-lg);
  }
  .modal-title {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    font-size: 1.05rem;
    font-weight: 700;
    color: var(--text-strong);
    margin: 0 0 0.6rem;
  }
  .modal-text {
    font-size: var(--fs-lg);
    color: var(--text);
    margin: 0 0 0.75rem;
    line-height: 1.5;
  }
  .modal-summary {
    list-style: none;
    padding: 0.6rem 0.75rem;
    margin: 0 0 1rem;
    background: var(--bg);
    border-radius: var(--radius-md);
    font-size: var(--fs-base);
    color: var(--text-body);
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
  }
  .modal-actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.6rem;
  }

  @media (max-width: 640px) {
    .form-grid-2 {
      grid-template-columns: 1fr;
    }
  }
</style>

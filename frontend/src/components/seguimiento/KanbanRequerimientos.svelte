<script lang="ts">
  import { onMount } from "svelte";
  import { navigationStore } from "../../stores/navigationStore";
  import { seguimientoStore } from "../../stores/seguimientoStore";
  import { KANBAN_COLUMNS } from "../../types/seguimiento";
  import type {
    Requerimiento,
    EstadoRequerimiento,
  } from "../../types/seguimiento";
  import { CENTROS_GESTORES } from "../../data/mock-seguimiento";
  import { getDirectorioContactos } from "../../api/visitas";
  import type { ContactoDirectorio } from "../../types";
  import Button from "../ui/Button.svelte";

  let directorio: ContactoDirectorio[] = [];
  let loadingDirectorio = false;

  onMount(async () => {
    seguimientoStore.loadRequerimientos();
    try {
      loadingDirectorio = true;
      const res = await getDirectorioContactos();
      directorio = res.contactos || [];
    } catch (e) {
      console.error('Error cargando directorio de contactos:', e);
    } finally {
      loadingDirectorio = false;
    }
  });

  let filterVisitaId = "";
  let selectedReq: Requerimiento | null = null;
  let showDetailPanel = false;
  let viewMode: "kanban" | "tabla" = "kanban";
  let groupBy: "estado" | "centro_gestor" = "estado";
  let enlaceSeleccionado = "";
  let showFilters = false;

  // Filters
  let filterCentroGestor = "";
  let filterComuna = "";
  let filterBarrio = "";
  let filterFechaInicio = "";
  let filterFechaFin = "";
  let filterEstado = "";
  let filterPrioridad = "";
  let filterConEnlace = ""; // 'con' | 'sin' | ''
  let filterConOrfeo = ""; // 'con' | 'sin' | ''
  let filterTexto = "";

  // Avance form
  let showAvanceForm = false;
  let avanceNuevoEstado: EstadoRequerimiento = "radicado";
  let avanceDescripcion = "";
  let avancePorcentaje = 0;
  let avanceEncargado = "";

  // Orfeo form
  let showOrfeoForm = false;
  let orfeoNumero = "";
  let orfeoFechaRadicado = "";
  let orfeoPeticionFile: FileList | null = null;

  // Propuesta solucion
  let fechaPropuestaSolucion = "";

  // Cancelar form
  let showCancelForm = false;
  let cancelMotivo = "";
  let cancelDocFile: FileList | null = null;

  // Lightbox for photos
  let lightboxUrl = "";
  let lightboxName = "";

  // Audio helper for proxy URL
  function audioSrc(url: string): string {
    const s3Host = 'https://catatrack-photos.s3.amazonaws.com';
    if (url.startsWith(s3Host)) {
      return '/s3-audio' + url.slice(s3Host.length);
    }
    return url;
  }

  function getTranscripcion(req: Requerimiento): string | null {
    if (!req.transcripciones || req.transcripciones.length === 0) return null;
    const t = req.transcripciones.find(t => t.transcripcion && t.transcripcion.trim().length > 0);
    return t ? t.transcripcion : null;
  }

  $: params = $navigationStore.params;
  $: filterVisitaId = params.visitaId || "";

  $: allReqs = $seguimientoStore.requerimientos;
  $: displayReqs = allReqs.filter((r) => {
    if (filterVisitaId && r.visita_id !== filterVisitaId) return false;
    if (filterCentroGestor && !r.centros_gestores.includes(filterCentroGestor))
      return false;
    if (filterComuna && r.solicitante.comuna_corregimiento !== filterComuna)
      return false;
    if (filterBarrio && r.solicitante.barrio_vereda !== filterBarrio)
      return false;
    if (filterFechaInicio && r.created_at < filterFechaInicio) return false;
    if (filterFechaFin && r.created_at > filterFechaFin + "T23:59:59Z")
      return false;
    if (filterEstado && r.estado !== filterEstado) return false;
    if (filterPrioridad && r.prioridad !== filterPrioridad) return false;
    if (filterConEnlace === "con" && !r.enlace_id) return false;
    if (filterConEnlace === "sin" && r.enlace_id) return false;
    if (filterConOrfeo === "con" && !r.numero_orfeo) return false;
    if (filterConOrfeo === "sin" && r.numero_orfeo) return false;
    if (filterTexto) {
      const q = filterTexto.toLowerCase();
      const match =
        r.descripcion.toLowerCase().includes(q) ||
        r.solicitante.nombre_completo.toLowerCase().includes(q) ||
        r.solicitante.cedula.includes(q) ||
        r.id.toLowerCase().includes(q) ||
        (r.numero_orfeo || "").toLowerCase().includes(q) ||
        r.centros_gestores.some((cg) => cg.toLowerCase().includes(q));
      if (!match) return false;
    }
    return true;
  });

  $: groupedByEstado = (() => {
    const grouped: Record<EstadoRequerimiento, Requerimiento[]> = {
      nuevo: [],
      radicado: [],
      "en-gestion": [],
      asignado: [],
      "en-proceso": [],
      resuelto: [],
      cerrado: [],
      cancelado: [],
    };
    for (const req of displayReqs) grouped[req.estado].push(req);
    return grouped;
  })();

  $: groupedByCentroGestor = (() => {
    const grouped: Record<string, Requerimiento[]> = {};
    for (const req of displayReqs) {
      const cgs =
        req.centros_gestores.length > 0
          ? req.centros_gestores
          : ["Sin centro gestor"];
      for (const cg of cgs) {
        if (!grouped[cg]) grouped[cg] = [];
        if (!grouped[cg].find((r) => r.id === req.id)) grouped[cg].push(req);
      }
    }
    return grouped;
  })();

  $: uniqueComunas = [
    ...new Set(
      allReqs.map((r) => r.solicitante.comuna_corregimiento).filter(Boolean),
    ),
  ].sort();
  $: uniqueBarrios = [
    ...new Set(
      allReqs
        .filter(
          (r) =>
            !filterComuna ||
            r.solicitante.comuna_corregimiento === filterComuna,
        )
        .map((r) => r.solicitante.barrio_vereda)
        .filter(Boolean),
    ),
  ].sort();
  $: uniqueCentros = CENTROS_GESTORES.map((c) => c.nombre);

  $: activeFiltersCount = [
    filterCentroGestor,
    filterComuna,
    filterBarrio,
    filterFechaInicio,
    filterFechaFin,
    filterEstado,
    filterPrioridad,
    filterConEnlace,
    filterConOrfeo,
    filterTexto,
  ].filter(Boolean).length;

  function clearFilters() {
    filterCentroGestor = "";
    filterComuna = "";
    filterBarrio = "";
    filterFechaInicio = "";
    filterFechaFin = "";
    filterEstado = "";
    filterPrioridad = "";
    filterConEnlace = "";
    filterConOrfeo = "";
    filterTexto = "";
  }

  function selectReq(req: Requerimiento) {
    selectedReq = req;
    showDetailPanel = true;
    showAvanceForm = false;
    showOrfeoForm = false;
    showCancelForm = false;
    enlaceSeleccionado = "";
    fechaPropuestaSolucion = req.fecha_propuesta_solucion || "";
  }

  function closeDetail() {
    showDetailPanel = false;
    selectedReq = null;
    lightboxUrl = "";
    lightboxName = "";
  }

  function openAvanceForm() {
    if (!selectedReq) return;
    avanceNuevoEstado = getNextEstado(selectedReq.estado);
    avanceDescripcion = "";
    avancePorcentaje = selectedReq.porcentaje_avance;
    avanceEncargado = selectedReq.encargado || "";
    showAvanceForm = true;
    showOrfeoForm = false;
    showCancelForm = false;
  }

  function getNextEstado(current: EstadoRequerimiento): EstadoRequerimiento {
    const order: EstadoRequerimiento[] = [
      "nuevo",
      "radicado",
      "en-gestion",
      "asignado",
      "en-proceso",
      "resuelto",
      "cerrado",
    ];
    const idx = order.indexOf(current);
    return idx < order.length - 1 ? order[idx + 1] : current;
  }

  function guardarAvance() {
    if (!selectedReq || !avanceDescripcion.trim()) return;

    seguimientoStore.cambiarEstadoRequerimiento(
      selectedReq.id,
      avanceNuevoEstado,
      avanceDescripcion,
      "Usuario actual",
      avancePorcentaje,
    );

    if (avanceEncargado && avanceEncargado !== selectedReq.encargado) {
      seguimientoStore.asignarEncargado(selectedReq.id, avanceEncargado);
    }

    const updated = $seguimientoStore.requerimientos.find(
      (r) => r.id === selectedReq!.id,
    );
    if (updated) selectedReq = updated;
    showAvanceForm = false;
  }

  function guardarOrfeo() {
    if (!selectedReq || !orfeoNumero.trim()) return;
    const docNombre = orfeoPeticionFile?.[0]?.name;
    const docUrl = docNombre ? `#local:${docNombre}` : undefined;
    seguimientoStore.actualizarOrfeo(
      selectedReq.id,
      orfeoNumero,
      orfeoFechaRadicado,
      docUrl,
      docNombre,
    );
    const updated = $seguimientoStore.requerimientos.find(
      (r) => r.id === selectedReq!.id,
    );
    if (updated) selectedReq = updated;
    showOrfeoForm = false;
  }

  function guardarFechaPropuestaSolucion() {
    if (!selectedReq || !fechaPropuestaSolucion) return;
    seguimientoStore.asignarFechaPropuestaSolucion(
      selectedReq.id,
      fechaPropuestaSolucion,
    );
    const updated = $seguimientoStore.requerimientos.find(
      (r) => r.id === selectedReq!.id,
    );
    if (updated) selectedReq = updated;
  }

  function confirmarCancelacion() {
    if (!selectedReq || !cancelMotivo.trim()) return;
    const docNombre = cancelDocFile?.[0]?.name;
    const docUrl = docNombre ? `#local:${docNombre}` : undefined;
    seguimientoStore.cancelarRequerimiento(
      selectedReq.id,
      cancelMotivo,
      "Usuario actual",
      docUrl,
      docNombre,
    );
    const updated = $seguimientoStore.requerimientos.find(
      (r) => r.id === selectedReq!.id,
    );
    if (updated) selectedReq = updated;
    showCancelForm = false;
  }

  // Keep selectedReq in sync
  $: if (selectedReq && $seguimientoStore.requerimientos) {
    const found = $seguimientoStore.requerimientos.find(
      (r) => r.id === selectedReq!.id,
    );
    if (found) selectedReq = found;
  }

  function getPrioridadStyle(p: string): string {
    switch (p) {
      case "urgente":
        return "background: #fee2e2; color: #991b1b;";
      case "alta":
        return "background: #fef3c7; color: #92400e;";
      case "media":
        return "background: #dbeafe; color: #1e40af;";
      case "baja":
        return "background: #f1f5f9; color: #475569;";
      default:
        return "";
    }
  }

  /** Subtle pastel backgrounds per estado — visually distinct, tenue */
  function getEstadoBg(estado: string): string {
    switch (estado) {
      case "nuevo":
        return "#f0f1f3"; // gray‑cool
      case "en-proceso":
        return "#fff3e0"; // warm peach
      case "resuelto":
        return "#e8f5e9"; // soft mint
      case "cerrado":
        return "#eceff1"; // blue‑gray
      case "cancelado":
        return "#fce4ec"; // pale rose
      default:
        return "transparent";
    }
  }

  function getEstadoBorder(estado: string): string {
    switch (estado) {
      case "nuevo":
        return "#d5d7db";
      case "en-proceso":
        return "#ffe0b2";
      case "resuelto":
        return "#c8e6c9";
      case "cerrado":
        return "#cfd8dc";
      case "cancelado":
        return "#f8bbd0";
      default:
        return "#e2e8f0";
    }
  }

  function getEstadoChipStyle(estado: string): string {
    switch (estado) {
      case "nuevo":
        return "background: #e0e2e6; color: #4b5563;";
      case "en-proceso":
        return "background: #ffe0b2; color: #e65100;";
      case "resuelto":
        return "background: #c8e6c9; color: #2e7d32;";
      case "cerrado":
        return "background: #cfd8dc; color: #37474f;";
      case "cancelado":
        return "background: #f8bbd0; color: #c62828;";
      default:
        return "background: #f1f5f9; color: #475569;";
    }
  }

  function formatDate(d: string): string {
    return new Date(d).toLocaleDateString("es-CO", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function getVisitaLabel(visitaId: string): string {
    const v = $seguimientoStore.visitas.find((v) => v.id === visitaId);
    return v ? `${v.barrio_vereda || "Visita"} — ${v.fecha_visita}` : visitaId;
  }

  // Contactos del directorio filtrados por centros gestores del requerimiento
  $: contactosForSelectedReq = selectedReq
    ? directorio.filter((c) =>
        selectedReq!.centros_gestores.includes(c.centro_gestor),
      )
    : [];

  $: contactosGrouped = (() => {
    const groups: Record<string, ContactoDirectorio[]> = {};
    for (const c of contactosForSelectedReq) {
      if (!groups[c.centro_gestor]) groups[c.centro_gestor] = [];
      groups[c.centro_gestor].push(c);
    }
    return groups;
  })();

  function handleAsignarEnlace() {
    if (!selectedReq || !enlaceSeleccionado) return;
    const contacto = directorio.find((c) => c.id === enlaceSeleccionado);
    if (contacto) {
      const nombreCompleto = `${contacto.nombres} ${contacto.apellidos}`;
      seguimientoStore.asignarEnlace(
        selectedReq.id,
        contacto.id,
        nombreCompleto,
      );
    }
    enlaceSeleccionado = "";
  }

  // Stats
  $: totalReqs = displayReqs.length;
  $: avgAvance =
    totalReqs > 0
      ? Math.round(
          displayReqs.reduce((sum, r) => sum + r.porcentaje_avance, 0) /
            totalReqs,
        )
      : 0;
</script>

<div class="view" class:has-panel={showDetailPanel}>
  <header class="view-header">
    <button
      class="back-btn"
      on:click={() =>
        navigationStore.navigate(
          filterVisitaId ? "visitas-programadas" : "home",
        )}>← Volver</button
    >
    <h2 class="view-title">Tablero de Requerimientos</h2>
    <div class="header-controls">
      <!-- View toggle -->
      <div class="view-toggle">
        <button
          class="toggle-btn"
          class:active={viewMode === "kanban"}
          on:click={() => (viewMode = "kanban")}>Kanban</button
        >
        <button
          class="toggle-btn"
          class:active={viewMode === "tabla"}
          on:click={() => (viewMode = "tabla")}>Tabla</button
        >
      </div>
      <!-- GroupBy toggle (kanban only) -->
      {#if viewMode === "kanban"}
        <div class="view-toggle">
          <button
            class="toggle-btn"
            class:active={groupBy === "estado"}
            on:click={() => (groupBy = "estado")}
            title="Agrupar por estado">Estado</button
          >
          <button
            class="toggle-btn"
            class:active={groupBy === "centro_gestor"}
            on:click={() => (groupBy = "centro_gestor")}
            title="Agrupar por centro gestor">C.Gestor</button
          >
        </div>
      {/if}
      <!-- Filter toggle -->
      <button
        class="filter-toggle-btn"
        class:has-active={activeFiltersCount > 0}
        on:click={() => (showFilters = !showFilters)}
      >
        Filtros{activeFiltersCount > 0 ? ` (${activeFiltersCount})` : ""}
      </button>
      <span class="stat">{totalReqs} req.</span>
      <span class="stat">Prom. {avgAvance}%</span>
    </div>
  </header>

  <!-- Filter bar -->
  {#if showFilters}
    <div class="filter-bar">
      <!-- Row 1: text search -->
      <div class="filter-row">
        <div class="filter-group filter-group-wide">
          <label for="f-texto">Buscar</label>
          <input
            id="f-texto"
            type="text"
            bind:value={filterTexto}
            placeholder="Descripción, solicitante, ID, orfeo, centro gestor…"
            class="filter-search"
          />
        </div>
      </div>
      <!-- Row 2: dropdowns -->
      <div class="filter-row">
        <div class="filter-group">
          <label for="f-estado">Estado</label>
          <select id="f-estado" bind:value={filterEstado}>
            <option value="">Todos</option>
            <option value="nuevo">Nuevo</option>
            <option value="en-proceso">En Proceso</option>
            <option value="resuelto">Resuelto</option>
            <option value="cerrado">Cerrado</option>
            <option value="cancelado">Cancelado</option>
          </select>
        </div>
        <div class="filter-group">
          <label for="f-prio">Prioridad</label>
          <select id="f-prio" bind:value={filterPrioridad}>
            <option value="">Todas</option>
            <option value="urgente">Urgente</option>
            <option value="alta">Alta</option>
            <option value="media">Media</option>
            <option value="baja">Baja</option>
          </select>
        </div>
        <div class="filter-group">
          <label for="f-cg">Centro Gestor</label>
          <select id="f-cg" bind:value={filterCentroGestor}>
            <option value="">Todos</option>
            {#each uniqueCentros as cg}<option value={cg}>{cg}</option>{/each}
          </select>
        </div>
        <div class="filter-group">
          <label for="f-com">Comuna</label>
          <select
            id="f-com"
            bind:value={filterComuna}
            on:change={() => (filterBarrio = "")}
          >
            <option value="">Todas</option>
            {#each uniqueComunas as c}<option value={c}>{c}</option>{/each}
          </select>
        </div>
        <div class="filter-group">
          <label for="f-barrio">Barrio</label>
          <select id="f-barrio" bind:value={filterBarrio}>
            <option value="">Todos</option>
            {#each uniqueBarrios as b}<option value={b}>{b}</option>{/each}
          </select>
        </div>
        <div class="filter-group">
          <label for="f-enlace">Enlace</label>
          <select id="f-enlace" bind:value={filterConEnlace}>
            <option value="">Todos</option>
            <option value="con">Con enlace</option>
            <option value="sin">Sin enlace</option>
          </select>
        </div>
        <div class="filter-group">
          <label for="f-orfeo">Orfeo</label>
          <select id="f-orfeo" bind:value={filterConOrfeo}>
            <option value="">Todos</option>
            <option value="con">Con orfeo</option>
            <option value="sin">Sin orfeo</option>
          </select>
        </div>
        <div class="filter-group">
          <label for="f-desde">Desde</label>
          <input id="f-desde" type="date" bind:value={filterFechaInicio} />
        </div>
        <div class="filter-group">
          <label for="f-hasta">Hasta</label>
          <input id="f-hasta" type="date" bind:value={filterFechaFin} />
        </div>
        {#if activeFiltersCount > 0}
          <button class="clear-filter-btn" on:click={clearFilters}
            >Limpiar ({activeFiltersCount})</button
          >
        {/if}
      </div>
    </div>
  {/if}

  {#if filterVisitaId}
    <div class="filter-banner">
      Mostrando requerimientos de: <strong
        >{getVisitaLabel(filterVisitaId)}</strong
      >
      <button
        class="clear-filter"
        on:click={() => {
          filterVisitaId = "";
          navigationStore.navigate("kanban");
        }}>Ver todos</button
      >
    </div>
  {/if}

  {#if viewMode === "kanban"}
    <div class="kanban-container">
      <div class="kanban-board">
        {#if groupBy === "estado"}
          {#each KANBAN_COLUMNS as col (col.id)}
            {@const colReqs = groupedByEstado[col.id] || []}
            <div class="kanban-column">
              <div class="column-header" style="border-color: {col.color}">
                <span class="column-title">{col.title}</span>
                <span class="column-count" style="background: {col.color}"
                  >{colReqs.length}</span
                >
              </div>
              <div class="column-body">
                {#each colReqs as req (req.id)}
                  <button
                    class="kanban-card"
                    class:selected={selectedReq?.id === req.id}
                    on:click={() => selectReq(req)}
                  >
                    <div class="kcard-top">
                      <span
                        class="kcard-prioridad"
                        style={getPrioridadStyle(req.prioridad)}
                        >{req.prioridad}</span
                      >
                      <span class="kcard-id">{req.id}</span>
                    </div>
                    <p class="kcard-desc">
                      {req.descripcion.slice(0, 80)}{req.descripcion.length > 80
                        ? "..."
                        : ""}
                    </p>
                    <div class="kcard-footer">
                      <span class="kcard-solicitante"
                        >{req.solicitante.nombre_completo.split(" ")[0]}</span
                      >
                      <div class="kcard-avance">
                        <div class="mini-bar">
                          <div
                            class="mini-fill"
                            style="width: {req.porcentaje_avance}%"
                          ></div>
                        </div>
                        <span>{req.porcentaje_avance}%</span>
                      </div>
                    </div>
                    <div class="kcard-tags">
                      {#each req.centros_gestores as cg}
                        <span class="kcard-tag">{cg}</span>
                      {/each}
                    </div>
                    {#if req.enlace_nombre}<div class="kcard-enlace">
                        {req.enlace_nombre}
                      </div>{/if}
                    {#if req.numero_orfeo}<div class="kcard-orfeo">
                        Orfeo: {req.numero_orfeo}
                      </div>{/if}
                  </button>
                {:else}
                  <div class="empty-column">Sin requerimientos</div>
                {/each}
              </div>
            </div>
          {/each}
        {:else}
          {#each Object.entries(groupedByCentroGestor) as [cg, cgReqs] (cg)}
            <div class="kanban-column">
              <div
                class="column-header cg-header"
                style="border-color: #6366f1"
              >
                <span class="column-title" title={cg}>{cg}</span>
                <span class="column-count" style="background: #6366f1"
                  >{cgReqs.length}</span
                >
              </div>
              <div class="column-body">
                {#each cgReqs as req (req.id + cg)}
                  <button
                    class="kanban-card"
                    class:selected={selectedReq?.id === req.id}
                    on:click={() => selectReq(req)}
                    style="background: {getEstadoBg(
                      req.estado,
                    )}; border-color: {getEstadoBorder(req.estado)};"
                  >
                    <div class="kcard-top">
                      <span
                        class="kcard-prioridad"
                        style={getPrioridadStyle(req.prioridad)}
                        >{req.prioridad}</span
                      >
                      <span class="kcard-id">{req.id}</span>
                    </div>
                    <p class="kcard-desc">
                      {req.descripcion}
                    </p>
                    <div class="kcard-footer">
                      <span class="kcard-solicitante"
                        >{req.solicitante.nombre_completo}</span
                      >
                      <div class="kcard-avance">
                        <div class="mini-bar">
                          <div
                            class="mini-fill"
                            style="width: {req.porcentaje_avance}%"
                          ></div>
                        </div>
                        <span>{req.porcentaje_avance}%</span>
                      </div>
                    </div>
                    <div class="kcard-meta-row">
                      <span
                        class="kcard-estado-chip"
                        style={getEstadoChipStyle(req.estado)}
                        >{req.estado}</span
                      >
                    </div>
                    {#if req.enlace_nombre}<div class="kcard-enlace">
                        {req.enlace_nombre}
                      </div>{/if}
                    {#if req.numero_orfeo}<div class="kcard-orfeo">
                        Orfeo: {req.numero_orfeo}
                      </div>{/if}
                  </button>
                {:else}
                  <div class="empty-column">Sin requerimientos</div>
                {/each}
              </div>
            </div>
          {:else}
            <div class="empty-board">
              No hay requerimientos con los filtros actuales
            </div>
          {/each}
        {/if}
      </div>
    </div>
  {:else}
    <!-- TABLA VIEW -->
    <div class="tabla-container">
      <div class="tabla-wrapper">
        <table class="req-table">
          <colgroup>
            <col style="width: 7%" />
            <col style="width: 7%" />
            <col style="width: 6%" />
            <col style="width: 12%" />
            <col style="width: 13%" />
            <col style="width: 28%" />
            <col style="width: 6%" />
            <col style="width: 8%" />
            <col style="width: 8%" />
            <col style="width: 5%" />
          </colgroup>
          <thead>
            <tr>
              <th>ID</th>
              <th>Estado</th>
              <th>Prior.</th>
              <th>Solicitante</th>
              <th>Centro(s) Gestor</th>
              <th>Descripción</th>
              <th>Avance</th>
              <th>Enlace</th>
              <th>Encargado</th>
              <th>Fecha</th>
            </tr>
          </thead>
          <tbody>
            {#each displayReqs as req (req.id)}
              <tr
                class="tabla-row"
                class:selected-row={selectedReq?.id === req.id}
                on:click={() => selectReq(req)}
                style="background: {getEstadoBg(req.estado)};"
              >
                <td class="td-id">{req.id}</td>
                <td>
                  <span
                    class="tabla-estado"
                    style="background: {KANBAN_COLUMNS.find(
                      (c) => c.id === req.estado,
                    )?.color || '#94a3b8'}"
                  >
                    {req.estado}
                  </span>
                </td>
                <td
                  ><span
                    class="tabla-prioridad"
                    style={getPrioridadStyle(req.prioridad)}
                    >{req.prioridad}</span
                  ></td
                >
                <td class="td-solicitante">{req.solicitante.nombre_completo}</td
                >
                <td class="td-centros">
                  {#each req.centros_gestores as cg}
                    <span class="tabla-cg-chip">{cg}</span>
                  {/each}
                </td>
                <td class="td-desc">{req.descripcion}</td>
                <td>
                  <div class="tabla-avance">
                    <div class="mini-bar" style="width: 50px;">
                      <div
                        class="mini-fill"
                        style="width: {req.porcentaje_avance}%"
                      ></div>
                    </div>
                    <span class="tabla-pct">{req.porcentaje_avance}%</span>
                  </div>
                </td>
                <td class="td-enlace">{req.enlace_nombre || "—"}</td>
                <td class="td-encargado">{req.encargado || "—"}</td>
                <td class="td-fecha"
                  >{new Date(req.created_at).toLocaleDateString("es-CO", {
                    day: "2-digit",
                    month: "short",
                  })}</td
                >
              </tr>
            {:else}
              <tr
                ><td colspan="10" class="empty-table">No hay requerimientos</td
                ></tr
              >
            {/each}
          </tbody>
        </table>
      </div>
    </div>
  {/if}

  <!-- Detail Panel (slide-in) -->
  {#if showDetailPanel && selectedReq}
    <div
      class="detail-overlay"
      on:click={closeDetail}
      on:keydown={(e) => e.key === "Escape" && closeDetail()}
      role="button"
      tabindex="0"
    ></div>
    <aside class="detail-panel">
      <div class="panel-header">
        <h3>Detalle del Requerimiento</h3>
        <button class="close-panel" on:click={closeDetail}>&times;</button>
      </div>

      <div class="panel-body">
        <!-- ID & Tipo -->
        {#if selectedReq.rid}
          <div class="panel-row">
            <span class="panel-label">ID</span>
            <span class="panel-info" style="font-family:monospace">{selectedReq.rid}</span>
          </div>
        {/if}
        {#if selectedReq.tipo_requerimiento}
          <div class="panel-row">
            <span class="panel-label">Tipo</span>
            <span class="panel-info">{selectedReq.tipo_requerimiento}</span>
          </div>
        {/if}

        <!-- Status & Priority -->
        <div class="panel-row">
          <span class="panel-label">Estado</span>
          <span class="panel-estado">{selectedReq.estado}</span>
        </div>
        <div class="panel-row">
          <span class="panel-label">Prioridad</span>
          <span
            class="panel-prioridad"
            style={getPrioridadStyle(selectedReq.prioridad)}
            >{selectedReq.prioridad}</span
          >
        </div>
        <div class="panel-row">
          <span class="panel-label">Avance</span>
          <div class="panel-avance">
            <div class="panel-avance-bar">
              <div
                class="panel-avance-fill"
                style="width: {selectedReq.porcentaje_avance}%"
              ></div>
            </div>
            <strong>{selectedReq.porcentaje_avance}%</strong>
          </div>
        </div>
        {#if selectedReq.encargado}
          <div class="panel-row">
            <span class="panel-label">Encargado</span>
            <span>{selectedReq.encargado}</span>
          </div>
        {/if}

        <hr />

        <!-- Enlace del Organismo -->
        <h4>Enlace del Organismo</h4>
        {#if selectedReq.enlace_nombre}
          {@const contactoObj = directorio.find(
            (c) => c.id === selectedReq?.enlace_id,
          )}
          <div class="enlace-assigned">
            <div class="enlace-info">
              <span class="enlace-name">{selectedReq.enlace_nombre}</span>
              {#if contactoObj}
                <span class="enlace-meta"
                  >{contactoObj.funcion} — {contactoObj.centro_gestor}</span
                >
                {#if contactoObj.email}<span class="enlace-contact"
                    >{contactoObj.email}</span
                  >{/if}
                {#if contactoObj.telefono}<span class="enlace-contact"
                    >{contactoObj.telefono}</span
                  >{/if}
              {/if}
            </div>
          </div>
          <!-- Fecha propuesta de solución habilitada al tener enlace -->
          <div class="fecha-solucion-box">
            <label class="fecha-solucion-label"
              >Fecha propuesta de solución
              <div class="fecha-solucion-row">
                <input
                  type="date"
                  bind:value={fechaPropuestaSolucion}
                  class="fecha-solucion-input"
                />
                <button
                  class="fecha-solucion-btn"
                  on:click={guardarFechaPropuestaSolucion}
                  disabled={!fechaPropuestaSolucion ||
                    fechaPropuestaSolucion ===
                      (selectedReq.fecha_propuesta_solucion || "")}
                  >Guardar</button
                >
              </div>
              {#if selectedReq.fecha_propuesta_solucion}
                <span class="fecha-solucion-saved"
                  >Propuesta: {new Date(
                    selectedReq.fecha_propuesta_solucion,
                  ).toLocaleDateString("es-CO")}</span
                >
              {/if}
            </label>
          </div>
        {:else}
          <p class="panel-info-sm" style="margin-bottom: 0.4rem;">
            Sin enlace asignado
          </p>
        {/if}
        {#if loadingDirectorio}
          <p class="panel-info-sm" style="color: #94a3b8;">
            Cargando directorio de contactos...
          </p>
        {:else if contactosForSelectedReq.length > 0}
          <div class="enlace-assign-form">
            <select class="enlace-select" bind:value={enlaceSeleccionado}>
              <option value="">— Asignar enlace —</option>
              {#each Object.entries(contactosGrouped) as [cg, contactos]}
                <optgroup label={cg}>
                  {#each contactos as c}
                    <option value={c.id}
                      >{c.nombres} {c.apellidos} ({c.funcion})</option
                    >
                  {/each}
                </optgroup>
              {/each}
            </select>
            <button
              class="enlace-assign-btn"
              on:click={handleAsignarEnlace}
              disabled={!enlaceSeleccionado}>Asignar</button
            >
          </div>
        {:else}
          <p class="panel-info-sm" style="color: #94a3b8;">
            No hay contactos en el directorio para los organismos encargados de
            este requerimiento
          </p>
        {/if}

        <hr />

        <!-- Orfeo / Petición Oficial -->
        <h4>No. Orfeo / Petición Oficial</h4>
        {#if selectedReq.numero_orfeo}
          <div class="orfeo-box">
            <div class="orfeo-row">
              <span class="orfeo-label">Orfeo:</span>
              <strong>{selectedReq.numero_orfeo}</strong>
            </div>
            {#if selectedReq.fecha_radicado_orfeo}
              <div class="orfeo-row">
                <span class="orfeo-label">Radicado:</span>
                {new Date(selectedReq.fecha_radicado_orfeo).toLocaleDateString(
                  "es-CO",
                )}
              </div>
            {/if}
            {#if selectedReq.documento_peticion_nombre}
              <div class="orfeo-row">
                <span class="orfeo-doc"
                  >{selectedReq.documento_peticion_nombre}</span
                >
              </div>
            {/if}
          </div>
        {/if}
        {#if !showOrfeoForm}
          <button
            class="action-link"
            on:click={() => {
              showOrfeoForm = true;
              showAvanceForm = false;
              showCancelForm = false;
              orfeoNumero = selectedReq?.numero_orfeo || "";
              orfeoFechaRadicado = selectedReq?.fecha_radicado_orfeo || "";
            }}
          >
            {selectedReq.numero_orfeo ? "Editar Orfeo" : "Registrar Orfeo"}
          </button>
        {:else}
          <div class="avance-form">
            <h4>Registro Orfeo</h4>
            <div class="field">
              <label
                >Número Orfeo *
                <input
                  type="text"
                  bind:value={orfeoNumero}
                  placeholder="Ej: 202600123456"
                />
              </label>
            </div>
            <div class="field">
              <label
                >Fecha de Radicado
                <input type="date" bind:value={orfeoFechaRadicado} />
              </label>
            </div>
            <div class="field">
              <label
                >Documento Petición (PDF/imagen)
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  bind:files={orfeoPeticionFile}
                />
              </label>
            </div>
            <div class="avance-actions">
              <Button
                variant="secondary"
                size="sm"
                on:click={() => (showOrfeoForm = false)}>Cancelar</Button
              >
              <Button
                size="sm"
                on:click={guardarOrfeo}
                disabled={!orfeoNumero.trim()}>Guardar</Button
              >
            </div>
          </div>
        {/if}

        <hr />

        <!-- Solicitante -->
        <h4>Solicitante</h4>
        <div class="panel-info">{selectedReq.solicitante.nombre_completo}</div>
        <div class="panel-info-sm">
          CC: {selectedReq.solicitante.cedula} | Tel. {selectedReq.solicitante
            .telefono}
        </div>
        <div class="panel-info-sm">
          {selectedReq.solicitante.direccion}, {selectedReq.solicitante
            .barrio_vereda}
        </div>

        <hr />

        <!-- Centros Gestores -->
        <h4>Centros Gestores</h4>
        <div class="panel-tags">
          {#each selectedReq.centros_gestores as cg}
            <span class="panel-tag">{cg}</span>
          {/each}
        </div>

        <hr />

        <!-- Description -->
        <h4>Descripción</h4>
        <p class="panel-desc">{selectedReq.descripcion}</p>
        {#if selectedReq.observaciones}
          <p class="panel-obs">{selectedReq.observaciones}</p>
        {/if}

        <hr />

        <!-- Evidencias: Fotos/Documentos adjuntos -->
        {#if selectedReq.documentos_adjuntos.length > 0 || selectedReq.nota_voz_url}
          <h4>Evidencias ({selectedReq.documentos_adjuntos.length}{selectedReq.nota_voz_url ? ' + audio' : ''})</h4>

          <!-- Photo gallery -->
          {#if selectedReq.documentos_adjuntos.length > 0}
            <div class="media-gallery">
              {#each selectedReq.documentos_adjuntos as doc, i}
                {#if doc.tipo.startsWith('image/') || doc.nombre.match(/\.(jpg|jpeg|png|gif|webp)/i)}
                  <button
                    class="media-thumb"
                    on:click={() => { lightboxUrl = doc.url; lightboxName = doc.nombre; }}
                    type="button"
                  >
                    <img src={doc.url} alt={doc.nombre} loading="lazy" />
                  </button>
                {:else if doc.tipo.startsWith('video/') || doc.nombre.match(/\.(mp4|webm|mov)/i)}
                  <div class="media-video-card">
                    <video src={doc.url} controls preload="metadata" class="media-video">
                      <track kind="captions" />
                    </video>
                    <span class="media-name">{doc.nombre}</span>
                  </div>
                {:else}
                  <a href={doc.url} target="_blank" rel="noopener" class="media-file-card">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                    <span class="media-name">{doc.nombre}</span>
                  </a>
                {/if}
              {/each}
            </div>
          {/if}

          <!-- Audio player -->
          {#if selectedReq.nota_voz_url}
            <div class="media-audio-section">
              <span class="media-audio-label">Nota de voz</span>
              <audio src={audioSrc(selectedReq.nota_voz_url)} controls preload="metadata" class="media-audio-player">
                <track kind="captions" />
              </audio>
              {#if getTranscripcion(selectedReq)}
                <div class="transcripcion-box">
                  <span class="transcripcion-label">Transcripción</span>
                  <p class="transcripcion-text">{getTranscripcion(selectedReq)}</p>
                </div>
              {/if}
            </div>
          {/if}

          <hr />
        {/if}

        <!-- Lightbox modal -->
        {#if lightboxUrl}
          <div class="lightbox-overlay" on:click={() => { lightboxUrl = ''; }} on:keydown={(e) => { if (e.key === 'Escape') lightboxUrl = ''; }} role="dialog" aria-modal="true" tabindex="-1">
            <div class="lightbox-content" on:click|stopPropagation={() => {}}>
              <button class="lightbox-close" on:click={() => { lightboxUrl = ''; }} type="button">&times;</button>
              <img src={lightboxUrl} alt={lightboxName} class="lightbox-img" />
              {#if lightboxName}
                <span class="lightbox-caption">{lightboxName}</span>
              {/if}
            </div>
          </div>
        {/if}

        <!-- GPS -->
        {#if selectedReq.latitud && selectedReq.longitud}
          <div class="panel-row">
            <span class="panel-label">Coordenadas</span>
            <span class="panel-coords"
              >{selectedReq.latitud}, {selectedReq.longitud}</span
            >
          </div>
        {/if}

        <hr />

        <!-- Historial -->
        <h4>Historial de Gestión ({selectedReq.historial.length})</h4>
        <div class="timeline">
          {#each [...selectedReq.historial].reverse() as entry (entry.id)}
            <div class="timeline-item">
              <div class="timeline-dot"></div>
              <div class="timeline-content">
                <div class="timeline-head">
                  <strong>{entry.autor}</strong>
                  <span class="timeline-date">{formatDate(entry.fecha)}</span>
                </div>
                <p class="timeline-desc">{entry.descripcion}</p>
                {#if entry.estado_anterior !== entry.estado_nuevo}
                  <span class="timeline-transition">
                    {entry.estado_anterior} → {entry.estado_nuevo}
                  </span>
                {/if}
                {#if entry.evidencias.length > 0}
                  <div class="timeline-evidencias">
                    {#each entry.evidencias as ev}
                      <span class="evidence-chip"
                        >{ev.tipo === "foto" ? "Foto" : "Doc"}:
                        {ev.descripcion}</span
                      >
                    {/each}
                  </div>
                {/if}
              </div>
            </div>
          {/each}
        </div>

        <hr />

        <!-- Avance Form -->
        {#if !showAvanceForm && !showCancelForm}
          <div class="panel-actions-row">
            <Button on:click={openAvanceForm}>Registrar Avance / Estado</Button>
            {#if selectedReq.estado !== "cancelado" && selectedReq.estado !== "cerrado"}
              <button
                class="cancel-req-btn"
                on:click={() => {
                  showCancelForm = true;
                  showAvanceForm = false;
                  showOrfeoForm = false;
                  cancelMotivo = "";
                }}
              >
                Cancelar Requerimiento
              </button>
            {/if}
          </div>
        {:else if showCancelForm}
          <div class="avance-form cancel-form">
            <h4>Cancelar Requerimiento</h4>
            <p class="cancel-warning">
              Esta acción cancela el requerimiento. Se requiere argumento y
              documento oficial del organismo responsable.
            </p>
            <div class="field">
              <label
                >Motivo de Cancelación *
                <textarea
                  bind:value={cancelMotivo}
                  rows="3"
                  placeholder="Argumente el motivo oficial de la cancelación..."
                ></textarea>
              </label>
            </div>
            <div class="field">
              <label
                >Documento Oficial (PDF/imagen) *
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  bind:files={cancelDocFile}
                />
                <span class="field-hint"
                  >Adjunte el documento oficial del organismo que sustenta la
                  cancelación</span
                >
              </label>
            </div>
            <div class="avance-actions">
              <Button
                variant="secondary"
                size="sm"
                on:click={() => (showCancelForm = false)}>Cancelar</Button
              >
              <button
                class="confirm-cancel-btn"
                on:click={confirmarCancelacion}
                disabled={!cancelMotivo.trim() || !cancelDocFile?.length}
                >Confirmar Cancelación</button
              >
            </div>
          </div>
        {:else}
          <div class="avance-form">
            <h4>Nuevo Registro de Avance</h4>
            <div class="field">
              <label
                >Nuevo Estado
                <select bind:value={avanceNuevoEstado}>
                  <option value="nuevo">Nuevo</option>
                  <option value="en-proceso">En Proceso</option>
                  <option value="resuelto">Resuelto</option>
                  <option value="cerrado">Cerrado</option>
                </select>
              </label>
            </div>
            <div class="field">
              <label
                >Descripción de la Gestión *
                <textarea
                  bind:value={avanceDescripcion}
                  rows="3"
                  placeholder="¿Qué se hizo? ¿Con quién se comunicó?"
                ></textarea>
              </label>
            </div>
            <div class="field">
              <label
                >Encargado del Centro Gestor
                <input
                  type="text"
                  bind:value={avanceEncargado}
                  placeholder="Nombre del funcionario responsable"
                />
              </label>
            </div>
            <div class="field">
              <label
                >% Avance: {avancePorcentaje}%
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  bind:value={avancePorcentaje}
                />
              </label>
            </div>
            <div class="avance-actions">
              <Button
                variant="secondary"
                size="sm"
                on:click={() => (showAvanceForm = false)}>Cancelar</Button
              >
              <Button
                size="sm"
                on:click={guardarAvance}
                disabled={!avanceDescripcion.trim()}>Guardar</Button
              >
            </div>
          </div>
        {/if}
      </div>
    </aside>
  {/if}
</div>

<style>
  .view {
    min-height: 100vh;
    background: #f8f9fb;
    display: flex;
    flex-direction: column;
  }
  .view-header {
    background: white;
    border-bottom: 1px solid #e5e7eb;
    padding: 0.75rem 1.25rem;
    display: flex;
    align-items: center;
    gap: 0.75rem;
    position: sticky;
    top: 0;
    z-index: 200;
  }
  .back-btn {
    background: none;
    border: none;
    color: #475569;
    font-size: 0.85rem;
    font-weight: 500;
    cursor: pointer;
    padding: 0.25rem 0;
  }
  .back-btn:hover {
    color: #1e293b;
  }
  .view-title {
    font-size: 1.05rem;
    font-weight: 600;
    color: #1e293b;
    flex: 1;
    letter-spacing: -0.01em;
  }
  .stat {
    background: #f1f5f9;
    padding: 0.25rem 0.6rem;
    border-radius: 4px;
    font-size: 0.72rem;
    font-weight: 500;
    color: #64748b;
  }
  .header-controls {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  .view-toggle {
    display: flex;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    overflow: hidden;
  }
  .toggle-btn {
    background: white;
    border: none;
    padding: 0.3rem 0.7rem;
    font-size: 0.72rem;
    font-weight: 500;
    color: #64748b;
    cursor: pointer;
  }
  .toggle-btn.active {
    background: #1e293b;
    color: white;
  }
  .toggle-btn:not(.active):hover {
    background: #f1f5f9;
  }

  .filter-banner {
    background: #eff6ff;
    padding: 0.5rem 1rem;
    font-size: 0.8rem;
    color: #1e40af;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
  }
  .clear-filter {
    background: none;
    border: none;
    color: #ef4444;
    cursor: pointer;
    font-weight: 600;
    font-size: 0.8rem;
  }

  /* Kanban */
  .kanban-container {
    flex: 1;
    overflow-x: auto;
    padding: 0.75rem;
  }
  .kanban-board {
    display: flex;
    gap: 0.5rem;
    min-width: max-content;
    height: calc(100vh - 120px);
  }
  .kanban-column {
    width: 280px;
    min-width: 280px;
    display: flex;
    flex-direction: column;
    background: white;
    border-radius: 8px;
    border: 1px solid #e5e7eb;
  }
  .column-header {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.55rem 0.75rem;
    border-bottom: 2px solid;
    font-size: 0.76rem;
    font-weight: 600;
    color: #374151;
  }
  .column-title {
    flex: 1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .column-count {
    color: white;
    font-size: 0.65rem;
    padding: 0.1rem 0.45rem;
    border-radius: 99px;
    font-weight: 600;
  }
  .column-body {
    flex: 1;
    overflow-y: auto;
    padding: 0.35rem;
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }

  /* Kanban Card */
  .kanban-card {
    background: #fafbfc;
    border: 1px solid #e5e7eb;
    border-radius: 6px;
    padding: 0.5rem 0.6rem;
    text-align: left;
    cursor: pointer;
    width: 100%;
    border-left: 3px solid transparent;
  }
  .kanban-card:hover {
    background: white;
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.06);
  }
  .kanban-card.selected {
    border-left-color: #1e293b;
    background: white;
    box-shadow: 0 0 0 1px #cbd5e1;
  }
  .kcard-top {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.2rem;
  }
  .kcard-prioridad {
    padding: 0.08rem 0.3rem;
    border-radius: 3px;
    font-size: 0.58rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.03em;
  }
  .kcard-id {
    font-size: 0.58rem;
    color: #94a3b8;
    font-family: monospace;
  }
  .kcard-desc {
    font-size: 0.73rem;
    color: #374151;
    margin: 0 0 0.3rem;
    line-height: 1.35;
    display: -webkit-box;
    -webkit-line-clamp: 4;
    line-clamp: 4;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  .kcard-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .kcard-solicitante {
    font-size: 0.62rem;
    color: #64748b;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 60%;
  }
  .kcard-avance {
    display: flex;
    align-items: center;
    gap: 0.3rem;
  }
  .mini-bar {
    width: 36px;
    height: 3px;
    background: #e2e8f0;
    border-radius: 2px;
    overflow: hidden;
  }
  .mini-fill {
    height: 100%;
    background: #475569;
    border-radius: 2px;
  }
  .kcard-avance span {
    font-size: 0.58rem;
    font-weight: 600;
    color: #475569;
  }
  .kcard-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 0.15rem;
    margin-top: 0.2rem;
  }
  .kcard-tag {
    font-size: 0.56rem;
    background: #f1f5f9;
    color: #475569;
    padding: 0.08rem 0.25rem;
    border-radius: 2px;
  }
  .empty-column {
    text-align: center;
    padding: 2rem 0.5rem;
    color: #94a3b8;
    font-size: 0.75rem;
  }
  .kcard-enlace {
    font-size: 0.58rem;
    color: #475569;
    font-weight: 500;
    margin-top: 0.15rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  /* Detail Panel */
  .detail-overlay {
    position: fixed;
    inset: 0;
    background: rgba(15, 23, 42, 0.25);
    z-index: 300;
    backdrop-filter: blur(2px);
  }
  .detail-panel {
    position: fixed;
    right: 0;
    top: 0;
    bottom: 0;
    width: 440px;
    max-width: 90vw;
    background: white;
    z-index: 301;
    box-shadow: -2px 0 16px rgba(0, 0, 0, 0.08);
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  .panel-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1rem 1.25rem;
    border-bottom: 1px solid #e5e7eb;
    background: white;
  }
  .panel-header h3 {
    margin: 0;
    font-size: 0.95rem;
    font-weight: 600;
    color: #1e293b;
  }
  .close-panel {
    background: none;
    border: none;
    font-size: 1.2rem;
    cursor: pointer;
    color: #64748b;
  }
  .panel-body {
    flex: 1;
    overflow-y: auto;
    padding: 1.25rem;
  }
  .panel-body hr {
    border: none;
    border-top: 1px solid #f1f5f9;
    margin: 1rem 0;
  }
  .panel-body h4 {
    font-size: 0.8rem;
    font-weight: 600;
    margin: 0 0 0.4rem;
    color: #374151;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  .panel-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.4rem;
  }
  .panel-label {
    font-size: 0.75rem;
    color: #94a3b8;
    font-weight: 600;
  }
  .panel-estado {
    font-size: 0.8rem;
    font-weight: 600;
    color: #1e293b;
    text-transform: capitalize;
  }
  .panel-prioridad {
    padding: 0.15rem 0.5rem;
    border-radius: 4px;
    font-size: 0.72rem;
    font-weight: 700;
    text-transform: uppercase;
  }
  .panel-avance {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  .panel-avance-bar {
    width: 100px;
    height: 8px;
    background: #e2e8f0;
    border-radius: 4px;
    overflow: hidden;
  }
  .panel-avance-fill {
    height: 100%;
    background: #475569;
    border-radius: 4px;
  }
  .panel-info {
    font-size: 0.85rem;
    font-weight: 600;
    color: #1e293b;
  }
  .panel-info-sm {
    font-size: 0.75rem;
    color: #64748b;
  }
  .panel-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 0.3rem;
  }
  .panel-tag {
    background: #f1f5f9;
    color: #374151;
    padding: 0.2rem 0.5rem;
    border-radius: 4px;
    font-size: 0.72rem;
    font-weight: 500;
  }
  .panel-desc {
    font-size: 0.85rem;
    color: #334155;
    line-height: 1.5;
    margin: 0;
  }
  .panel-obs {
    font-size: 0.8rem;
    color: #64748b;
    font-style: italic;
    margin: 0.25rem 0 0;
  }
  .panel-coords {
    font-size: 0.75rem;
    font-family: monospace;
    color: #475569;
  }

  /* Media gallery */
  .media-gallery {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
    gap: 0.5rem;
    margin: 0.5rem 0;
  }
  .media-thumb {
    aspect-ratio: 1;
    border-radius: 6px;
    overflow: hidden;
    cursor: pointer;
    border: 1px solid #e2e8f0;
    padding: 0;
    background: #f8fafc;
  }
  .media-thumb img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }
  .media-video-card {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
  }
  .media-video {
    width: 100%;
    border-radius: 6px;
    border: 1px solid #e2e8f0;
    background: #000;
    max-height: 160px;
  }
  .media-file-card {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    padding: 0.5rem;
    text-decoration: none;
    color: #475569;
    font-size: 0.78rem;
  }
  .media-file-card:hover {
    background: #f1f5f9;
  }
  .media-name {
    font-size: 0.7rem;
    color: #64748b;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .media-audio-section {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
    margin: 0.5rem 0;
  }
  .media-audio-label {
    font-size: 0.75rem;
    font-weight: 600;
    color: #475569;
  }
  .media-audio-player {
    width: 100%;
    height: 36px;
    border-radius: 6px;
  }

  /* Transcripción */
  .transcripcion-box {
    padding: 0.4rem 0.55rem;
    background: #f1f5f9;
    border-radius: 6px;
    border-left: 3px solid #2563eb;
  }
  .transcripcion-label {
    display: block;
    font-size: 0.65rem;
    font-weight: 600;
    color: #64748b;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    margin-bottom: 0.15rem;
  }
  .transcripcion-text {
    font-size: 0.78rem;
    color: #334155;
    line-height: 1.45;
    margin: 0;
    font-style: italic;
    word-break: break-word;
  }
  .audio-play-btn {
    display: none;
  }
  .audio-loading-bar {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    height: 36px;
    font-size: 0.75rem;
    color: #64748b;
  }
  .audio-loading-pulse {
    width: 100%;
    max-width: 200px;
    height: 4px;
    border-radius: 2px;
    background: linear-gradient(90deg, #e2e8f0 25%, #cbd5e1 50%, #e2e8f0 75%);
    background-size: 200% 100%;
    animation: shimmer 1.5s infinite;
  }
  @keyframes shimmer {
    0% { background-position: 200% 0; }
    100% { background-position: -200% 0; }
  }
  .audio-loading {
    font-size: 0.75rem;
    color: #64748b;
    font-style: italic;
    padding: 0.3rem 0;
  }
  .audio-error {
    font-size: 0.75rem;
    color: #dc2626;
    padding: 0.3rem 0;
  }

  /* Lightbox */
  .lightbox-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.85);
    z-index: 9999;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1rem;
  }
  .lightbox-content {
    position: relative;
    max-width: 90vw;
    max-height: 90vh;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
  }
  .lightbox-close {
    position: absolute;
    top: -12px;
    right: -12px;
    background: white;
    border: none;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    font-size: 1.2rem;
    line-height: 1;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 2px 8px rgba(0,0,0,0.3);
    color: #1e293b;
    z-index: 1;
  }
  .lightbox-img {
    max-width: 90vw;
    max-height: 82vh;
    object-fit: contain;
    border-radius: 6px;
  }
  .lightbox-caption {
    font-size: 0.8rem;
    color: #e2e8f0;
    text-align: center;
  }

  /* Enlace section */
  .enlace-assigned {
    background: #f8fafb;
    border: 1px solid #e5e7eb;
    border-radius: 6px;
    padding: 0.6rem;
    margin-bottom: 0.5rem;
  }
  .enlace-info {
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
  }
  .enlace-name {
    font-size: 0.85rem;
    font-weight: 600;
    color: #1e293b;
  }
  .enlace-meta {
    font-size: 0.72rem;
    color: #475569;
  }
  .enlace-contact {
    font-size: 0.7rem;
    color: #64748b;
  }
  .enlace-assign-form {
    display: flex;
    gap: 0.4rem;
    align-items: center;
    margin-top: 0.4rem;
  }
  .enlace-select {
    flex: 1;
    padding: 0.4rem;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    font-size: 0.78rem;
    font-family: inherit;
    outline: none;
    background: white;
  }
  .enlace-select:focus {
    border-color: #0d9488;
    box-shadow: 0 0 0 2px rgba(13, 148, 136, 0.15);
  }
  .enlace-assign-btn {
    background: #1e293b;
    color: white;
    border: none;
    padding: 0.4rem 0.75rem;
    border-radius: 6px;
    font-size: 0.78rem;
    font-weight: 500;
    cursor: pointer;
    white-space: nowrap;
  }
  .enlace-assign-btn:hover:not(:disabled) {
    background: #0f172a;
  }
  .enlace-assign-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /* Timeline */
  .timeline {
    display: flex;
    flex-direction: column;
    gap: 0;
    margin-top: 0.5rem;
  }
  .timeline-item {
    display: flex;
    gap: 0.6rem;
    position: relative;
    padding-bottom: 0.75rem;
  }
  .timeline-item:not(:last-child)::before {
    content: "";
    position: absolute;
    left: 5px;
    top: 14px;
    bottom: 0;
    width: 2px;
    background: #e2e8f0;
  }
  .timeline-dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: #94a3b8;
    flex-shrink: 0;
    margin-top: 4px;
  }
  .timeline-content {
    flex: 1;
    min-width: 0;
  }
  .timeline-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .timeline-head strong {
    font-size: 0.75rem;
    color: #1e293b;
  }
  .timeline-date {
    font-size: 0.65rem;
    color: #94a3b8;
  }
  .timeline-desc {
    font-size: 0.78rem;
    color: #475569;
    margin: 0.15rem 0;
    line-height: 1.4;
  }
  .timeline-transition {
    display: inline-block;
    font-size: 0.65rem;
    background: #f1f5f9;
    color: #475569;
    padding: 0.1rem 0.4rem;
    border-radius: 3px;
    font-weight: 500;
    margin-top: 0.15rem;
  }
  .timeline-evidencias {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem;
    margin-top: 0.25rem;
  }
  .evidence-chip {
    font-size: 0.65rem;
    background: #f1f5f9;
    padding: 0.15rem 0.4rem;
    border-radius: 3px;
  }

  /* Avance form */
  .avance-form {
    background: #f8f9fb;
    border-radius: 6px;
    padding: 0.75rem;
    margin-top: 0.5rem;
    border: 1px solid #e5e7eb;
  }
  .avance-form h4 {
    margin-top: 0;
  }
  .field {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
    margin-bottom: 0.5rem;
  }
  .field label {
    font-size: 0.75rem;
    font-weight: 600;
    color: #475569;
  }
  .field input,
  .field textarea,
  .field select {
    padding: 0.5rem;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    font-size: 0.82rem;
    font-family: inherit;
    outline: none;
  }
  .field input[type="range"] {
    padding: 0;
  }
  .avance-actions {
    display: flex;
    gap: 0.5rem;
    justify-content: flex-end;
  }

  /* Table view */
  .tabla-container {
    flex: 1;
    overflow: auto;
    padding: 0.75rem;
  }
  .tabla-wrapper {
    overflow-x: auto;
  }
  .req-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.76rem;
    background: white;
    border-radius: 6px;
    overflow: hidden;
    border: 1px solid #e5e7eb;
    table-layout: fixed;
  }
  .req-table thead {
    background: #f8fafc;
  }
  .req-table th {
    padding: 0.5rem 0.45rem;
    text-align: left;
    font-weight: 600;
    color: #64748b;
    font-size: 0.65rem;
    border-bottom: 1px solid #e5e7eb;
    white-space: nowrap;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  .req-table td {
    padding: 0.45rem;
    border-bottom: 1px solid #f1f5f9;
    vertical-align: top;
    font-size: 0.74rem;
    line-height: 1.35;
  }
  .tabla-row {
    cursor: pointer;
  }
  .tabla-row:hover {
    filter: brightness(0.97);
  }
  .selected-row {
    background: #eff6ff !important;
  }
  .td-id {
    font-family: monospace;
    font-size: 0.6rem;
    color: #94a3b8;
    word-break: break-all;
  }
  .tabla-estado {
    color: white;
    padding: 0.12rem 0.35rem;
    border-radius: 3px;
    font-size: 0.62rem;
    font-weight: 600;
    text-transform: capitalize;
    white-space: nowrap;
    display: inline-block;
  }
  .tabla-prioridad {
    padding: 0.08rem 0.3rem;
    border-radius: 3px;
    font-size: 0.62rem;
    font-weight: 600;
    text-transform: uppercase;
    display: inline-block;
  }
  .td-solicitante {
    font-weight: 500;
    color: #1e293b;
    word-break: break-word;
  }
  .td-centros {
    line-height: 1.5;
  }
  .tabla-cg-chip {
    display: inline-block;
    font-size: 0.58rem;
    background: #f1f5f9;
    color: #475569;
    padding: 0.08rem 0.25rem;
    border-radius: 2px;
    margin: 0.06rem 0.06rem;
  }
  .td-desc {
    color: #374151;
    word-break: break-word;
    line-height: 1.4;
  }
  .tabla-avance {
    display: flex;
    align-items: center;
    gap: 0.3rem;
  }
  .tabla-pct {
    font-size: 0.62rem;
    font-weight: 600;
    color: #475569;
  }
  .td-enlace {
    font-size: 0.72rem;
    color: #475569;
    font-weight: 500;
    word-break: break-word;
  }
  .td-encargado {
    font-size: 0.72rem;
    color: #64748b;
    word-break: break-word;
  }
  .td-fecha {
    font-size: 0.68rem;
    color: #94a3b8;
    white-space: nowrap;
  }

  .empty-table {
    text-align: center;
    padding: 2rem;
    color: #94a3b8;
  }

  @media (max-width: 768px) {
    .kanban-column {
      width: 240px;
      min-width: 240px;
    }
    .detail-panel {
      width: 100vw;
      max-width: 100vw;
    }
  }

  /* Filter bar */
  .filter-bar {
    background: #fff;
    border-bottom: 1px solid #e5e7eb;
    padding: 0.6rem 1.25rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  .filter-row {
    display: flex;
    align-items: flex-end;
    gap: 0.75rem;
    flex-wrap: wrap;
  }
  .filter-group {
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
  }
  .filter-group-wide {
    flex: 1;
    min-width: 260px;
  }
  .filter-search {
    padding: 0.35rem 0.6rem;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    font-size: 0.8rem;
    font-family: inherit;
    outline: none;
    background: white;
    color: #334155;
    width: 100%;
  }
  .filter-search:focus {
    border-color: #2563eb;
  }
  .filter-group label {
    font-size: 0.65rem;
    font-weight: 700;
    color: #64748b;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  .filter-group select,
  .filter-group input[type="date"] {
    padding: 0.3rem 0.5rem;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    font-size: 0.78rem;
    font-family: inherit;
    outline: none;
    background: white;
    color: #334155;
  }
  .filter-group select:focus,
  .filter-group input[type="date"]:focus {
    border-color: #2563eb;
  }
  .clear-filter-btn {
    background: #f1f5f9;
    color: #dc2626;
    border: none;
    padding: 0.35rem 0.65rem;
    border-radius: 6px;
    font-size: 0.75rem;
    font-weight: 500;
    cursor: pointer;
    align-self: flex-end;
  }
  .filter-toggle-btn {
    background: white;
    border: 1px solid #e5e7eb;
    padding: 0.3rem 0.7rem;
    border-radius: 6px;
    font-size: 0.72rem;
    font-weight: 500;
    color: #475569;
    cursor: pointer;
  }
  .filter-toggle-btn:hover {
    background: #f8f9fb;
  }
  .filter-toggle-btn.has-active {
    background: #f1f5f9;
    color: #1e293b;
    border-color: #cbd5e1;
  }

  /* Empty board */
  .empty-board {
    padding: 3rem 2rem;
    color: #94a3b8;
    text-align: center;
    font-size: 0.85rem;
    width: 100%;
  }

  /* CG group header */
  .cg-header {
    background: #f8f9fb;
  }

  /* Kanban card extras */
  .kcard-meta-row {
    display: flex;
    gap: 0.25rem;
    margin-top: 0.25rem;
  }
  .kcard-estado-chip {
    font-size: 0.58rem;
    background: #f1f5f9;
    color: #475569;
    padding: 0.1rem 0.35rem;
    border-radius: 3px;
    font-weight: 600;
    text-transform: capitalize;
  }
  .kcard-orfeo {
    font-size: 0.6rem;
    color: #64748b;
    font-weight: 500;
    margin-top: 0.2rem;
  }

  /* Fecha propuesta solucion */
  .fecha-solucion-box {
    background: #f8f9fb;
    border: 1px solid #e5e7eb;
    border-radius: 6px;
    padding: 0.6rem;
    margin: 0.5rem 0;
  }
  .fecha-solucion-label {
    font-size: 0.72rem;
    font-weight: 600;
    color: #374151;
    display: block;
    margin-bottom: 0.35rem;
  }
  .fecha-solucion-row {
    display: flex;
    gap: 0.4rem;
    align-items: center;
  }
  .fecha-solucion-input {
    flex: 1;
    padding: 0.35rem 0.5rem;
    border: 1px solid #bbf7d0;
    border-radius: 6px;
    font-size: 0.78rem;
    font-family: inherit;
    outline: none;
  }
  .fecha-solucion-input:focus {
    border-color: #94a3b8;
  }
  .fecha-solucion-btn {
    background: #1e293b;
    color: white;
    border: none;
    padding: 0.35rem 0.65rem;
    border-radius: 6px;
    font-size: 0.75rem;
    font-weight: 500;
    cursor: pointer;
    white-space: nowrap;
  }
  .fecha-solucion-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
  .fecha-solucion-saved {
    font-size: 0.7rem;
    color: #475569;
    font-weight: 500;
    display: block;
    margin-top: 0.3rem;
  }

  /* Orfeo section */
  .orfeo-box {
    background: #f8f9fb;
    border: 1px solid #e5e7eb;
    border-radius: 6px;
    padding: 0.6rem;
    margin-bottom: 0.4rem;
  }
  .orfeo-row {
    font-size: 0.78rem;
    color: #374151;
    margin-bottom: 0.15rem;
    display: flex;
    gap: 0.4rem;
    align-items: center;
  }
  .orfeo-label {
    font-weight: 600;
    color: #475569;
    font-size: 0.7rem;
  }
  .orfeo-doc {
    font-size: 0.72rem;
    color: #475569;
    text-decoration: underline;
  }
  .action-link {
    background: none;
    border: none;
    color: #475569;
    font-size: 0.78rem;
    font-weight: 500;
    cursor: pointer;
    padding: 0.25rem 0;
    display: inline-block;
    margin-bottom: 0.25rem;
    text-decoration: underline;
    text-underline-offset: 2px;
  }
  .action-link:hover {
    color: #1e293b;
  }

  /* Cancel section */
  .panel-actions-row {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }
  .cancel-req-btn {
    background: none;
    border: 1px solid #e5e7eb;
    color: #dc2626;
    border-radius: 6px;
    padding: 0.4rem 0.75rem;
    font-size: 0.78rem;
    font-weight: 500;
    cursor: pointer;
    text-align: center;
  }
  .cancel-req-btn:hover {
    background: #fef2f2;
    border-color: #fca5a5;
  }
  .cancel-form {
    border-color: #e5e7eb;
    background: #fefbfb;
  }
  .cancel-warning {
    font-size: 0.75rem;
    color: #dc2626;
    background: #fee2e2;
    border-radius: 6px;
    padding: 0.5rem;
    margin-bottom: 0.5rem;
  }
  .confirm-cancel-btn {
    background: #dc2626;
    color: white;
    border: none;
    padding: 0.45rem 0.85rem;
    border-radius: 6px;
    font-size: 0.82rem;
    font-weight: 500;
    cursor: pointer;
  }
  .confirm-cancel-btn:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }
  .field-hint {
    font-size: 0.68rem;
    color: #94a3b8;
    margin-top: 0.15rem;
  }
</style>

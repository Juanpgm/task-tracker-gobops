<script lang="ts">
  import { onMount } from "svelte";
  import { navigationStore } from "../../stores/navigationStore";
  import { seguimientoStore } from "../../stores/seguimientoStore";
  import type { VisitaProgramada } from "../../types/seguimiento";
  import Button from "../ui/Button.svelte";
  import Icon from "../ui/Icon.svelte";

  $: visitas = $seguimientoStore.visitas;
  $: requerimientos = $seguimientoStore.requerimientos;
  $: loading = $seguimientoStore.loading && visitas.length === 0;
  $: error = $seguimientoStore.error;

  onMount(() => {
    seguimientoStore.loadVisitas();
  });

  function getReqCount(visitaId: string): number {
    return requerimientos.filter((r) => r.visita_id === visitaId).length;
  }

  function getEstadoStyle(estado: VisitaProgramada["estado"]): {
    bg: string;
    color: string;
    border: string;
  } {
    switch (estado) {
      case "programada":
        return { bg: "#dbeafe", color: "#1e40af", border: "#93c5fd" };
      case "en-curso":
        return { bg: "#fef3c7", color: "#92400e", border: "#fcd34d" };
      case "finalizada":
        return { bg: "#dcfce7", color: "#166534", border: "#86efac" };
      case "cancelada":
        return { bg: "#fee2e2", color: "#991b1b", border: "#fca5a5" };
      default:
        return { bg: "#f1f5f9", color: "#475569", border: "#cbd5e1" };
    }
  }

  function estadoLabel(estado: string): string {
    return estado.charAt(0).toUpperCase() + estado.slice(1).replace("-", " ");
  }

  function irARequerimientos(visita: VisitaProgramada) {
    navigationStore.navigate("registrar-requerimiento-visita", {
      visitaId: visita.id,
    });
  }

  function iniciarVisita(visitaId: string) {
    seguimientoStore.actualizarEstadoVisita(visitaId, "en-curso");
  }

  function finalizarVisita(visitaId: string) {
    seguimientoStore.actualizarEstadoVisita(visitaId, "finalizada");
  }

  function formatDate(d: string): string {
    return new Date(d + "T12:00:00").toLocaleDateString("es-CO", {
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }
</script>

<div class="view">
  <header class="view-header">
    <button class="back-btn" on:click={() => navigationStore.goHome()}
      >← Volver</button
    >
    <h2 class="view-title">Visitas Programadas</h2>
    <button
      class="add-btn"
      on:click={() => navigationStore.navigate("programar-visita")}
      >+ Nueva visita</button
    >
  </header>

  <main class="view-body container">
    {#if loading}
      <div class="status-state">
        <div class="spinner"></div>
        <p>Cargando visitas programadas…</p>
      </div>
    {:else if error}
      <div class="status-state error-state">
        <p class="error-msg">{error}</p>
        <Button on:click={() => seguimientoStore.loadVisitas()}
          >Reintentar</Button
        >
      </div>
    {:else if visitas.length === 0}
      <div class="status-state">
        <h3>Sin visitas programadas</h3>
        <p>Aún no hay visitas registradas. Crea una nueva para comenzar.</p>
        <Button on:click={() => navigationStore.navigate("programar-visita")}
          >Programar Visita</Button
        >
      </div>
    {:else}
      {#each visitas as visita (visita.id)}
        {@const estilo = getEstadoStyle(visita.estado)}
        {@const reqCount = getReqCount(visita.id)}
        <div class="visita-card">
          <!-- Top accent bar -->
          <div class="card-accent" style="background: {estilo.border};"></div>

          <div class="card-content">
            <!-- Header row: badge + date/time -->
            <div class="card-top-row">
              <span
                class="badge"
                style="background: {estilo.bg}; color: {estilo.color};"
              >
                {estadoLabel(visita.estado)}
              </span>
              <div class="card-datetime">
                <span class="date-chip">
                  <Icon name="calendar" size={13} />
                  {formatDate(visita.fecha_visita)}
                </span>
                {#if visita.hora_inicio}
                  <span class="time-chip">
                    <Icon name="clock" size={13} />
                    {visita.hora_inicio}{visita.hora_fin ? ` – ${visita.hora_fin}` : ""}
                  </span>
                {/if}
              </div>
            </div>

            <!-- Title + location -->
            <div class="card-title-section">
              <h3 class="card-title">{visita.id}</h3>
              <p class="card-location">
                <Icon name="map-pin" size={14} />
                {visita.direccion_manual || visita.barrio_vereda || "Sin dirección"}{#if visita.comuna_corregimiento}, {visita.comuna_corregimiento}{/if}
              </p>
            </div>

            <!-- Description -->
            {#if visita.descripcion_visita}
              <p class="card-description">{visita.descripcion_visita}</p>
            {/if}

            <!-- Stats row -->
            <div class="card-stats">
              <div class="stat-pill">
                <Icon name="users" size={14} />
                <span>{visita.colaboradores.length} acompañante{visita.colaboradores.length !== 1 ? "s" : ""}</span>
              </div>
              {#if reqCount > 0}
                <div class="stat-pill stat-pill--warning">
                  <Icon name="clipboard-list" size={14} />
                  <span>{reqCount} requerimiento{reqCount !== 1 ? "s" : ""}</span>
                </div>
              {/if}
            </div>

            <!-- Avatars -->
            {#if visita.colaboradores.length > 0}
              <div class="card-avatars">
                {#each visita.colaboradores.slice(0, 5) as col}
                  <div class="avatar" title={col.nombre}>
                    {col.nombre.charAt(0)}
                  </div>
                {/each}
                {#if visita.colaboradores.length > 5}
                  <div class="avatar avatar--extra">
                    +{visita.colaboradores.length - 5}
                  </div>
                {/if}
              </div>
            {/if}

            <!-- Observations -->
            {#if visita.observaciones}
              <div class="card-obs">
                <Icon name="message-circle" size={14} />
                <p>{visita.observaciones}</p>
              </div>
            {/if}

            <!-- Actions -->
            <div class="card-actions">
              {#if visita.estado === "programada"}
                <Button
                  variant="secondary"
                  size="sm"
                  on:click={() => iniciarVisita(visita.id)}
                >
                  <span class="action-content"><Icon name="play" size={14} /> Iniciar Visita</span>
                </Button>
              {/if}
              {#if visita.estado === "en-curso"}
                <Button
                  variant="secondary"
                  size="sm"
                  on:click={() => finalizarVisita(visita.id)}
                >
                  <span class="action-content"><Icon name="check-circle" size={14} /> Finalizar</span>
                </Button>
              {/if}
              <Button size="sm" on:click={() => irARequerimientos(visita)}>
                <span class="action-content"><Icon name="clipboard-list" size={14} /> Registrar Requerimientos</span>
              </Button>
              {#if reqCount > 0}
                <Button
                  variant="secondary"
                  size="sm"
                  on:click={() =>
                    navigationStore.navigate("kanban", { visitaId: visita.id })}
                >
                  <span class="action-content"><Icon name="eye" size={14} /> Ver Kanban</span>
                </Button>
              {/if}
            </div>
          </div>
        </div>
      {/each}
    {/if}
  </main>
</div>

<style>
  .view {
    min-height: 100vh;
    background: #f8fafc;
  }

  /* ---- Header ---- */
  .view-header {
    background: white;
    border-bottom: 1px solid #e2e8f0;
    padding: 0.75rem 1rem;
    display: flex;
    align-items: center;
    gap: 0.75rem;
    position: sticky;
    top: 0;
    z-index: 100;
  }
  .back-btn {
    background: none;
    border: none;
    color: #2563eb;
    font-size: 0.9rem;
    font-weight: 600;
    cursor: pointer;
  }
  .view-title {
    font-size: 1.1rem;
    font-weight: 700;
    flex: 1;
    color: #0f172a;
  }
  .add-btn {
    background: #2563eb;
    color: white;
    border: none;
    padding: 0.45rem 1rem;
    border-radius: 6px;
    font-size: 0.8rem;
    font-weight: 600;
    cursor: pointer;
  }
  .add-btn:hover {
    background: #1d4ed8;
  }

  /* ---- Body / Container ---- */
  .view-body {
    padding: 1rem;
    max-width: 900px;
    margin: 0 auto;
  }
  .container {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  /* ---- Status states ---- */
  .status-state {
    text-align: center;
    padding: 4rem 1rem;
    color: #64748b;
  }
  .status-state h3 {
    color: #1e293b;
    margin-bottom: 0.5rem;
  }
  .error-state .error-msg {
    color: #dc2626;
    background: #fef2f2;
    border: 1px solid #fecaca;
    border-radius: 8px;
    padding: 0.75rem 1rem;
    margin-bottom: 1rem;
    font-size: 0.85rem;
  }
  .spinner {
    width: 32px;
    height: 32px;
    border: 3px solid #e2e8f0;
    border-top-color: #2563eb;
    border-radius: 50%;
    animation: spin 0.7s linear infinite;
    margin: 0 auto 1rem;
  }
  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  /* ---- Card ---- */
  .visita-card {
    background: white;
    border-radius: 12px;
    border: 1px solid #e2e8f0;
    overflow: hidden;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
  }
  .card-accent {
    height: 4px;
    width: 100%;
  }
  .card-content {
    padding: 1rem 1.15rem 0.85rem;
    display: flex;
    flex-direction: column;
    gap: 0.7rem;
  }

  /* ---- Top row ---- */
  .card-top-row {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    flex-wrap: wrap;
  }
  .badge {
    padding: 0.18rem 0.55rem;
    border-radius: 5px;
    font-size: 0.7rem;
    font-weight: 700;
    letter-spacing: 0.02em;
    text-transform: capitalize;
    white-space: nowrap;
  }
  .card-datetime {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-left: auto;
  }
  .date-chip,
  .time-chip {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    font-size: 0.76rem;
    font-weight: 500;
    color: #475569;
    background: #f1f5f9;
    padding: 0.2rem 0.55rem;
    border-radius: 6px;
  }
  .time-chip {
    color: #64748b;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
  }

  /* ---- Title + location ---- */
  .card-title-section {
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
  }
  .card-title {
    font-size: 1.05rem;
    font-weight: 700;
    color: #0f172a;
    margin: 0;
    line-height: 1.3;
  }
  .card-location {
    display: flex;
    align-items: center;
    gap: 0.3rem;
    font-size: 0.8rem;
    color: #64748b;
    margin: 0;
  }

  /* ---- Description ---- */
  .card-description {
    font-size: 0.82rem;
    color: #334155;
    line-height: 1.45;
    margin: 0;
    padding: 0.45rem 0.65rem;
    background: #f8fafc;
    border-radius: 8px;
    border-left: 3px solid #e2e8f0;
  }

  /* ---- Stats ---- */
  .card-stats {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
  }
  .stat-pill {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    font-size: 0.73rem;
    font-weight: 500;
    color: #475569;
    background: #f1f5f9;
    padding: 0.22rem 0.6rem;
    border-radius: 20px;
  }
  .stat-pill--warning {
    background: #fef3c7;
    color: #92400e;
    font-weight: 600;
  }

  /* ---- Avatars ---- */
  .card-avatars {
    display: flex;
  }
  .avatar {
    width: 30px;
    height: 30px;
    border-radius: 50%;
    background: #3b82f6;
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.72rem;
    font-weight: 700;
    border: 2px solid white;
    margin-left: -7px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.1);
  }
  .avatar:first-child {
    margin-left: 0;
  }
  .avatar--extra {
    background: #94a3b8;
    font-size: 0.65rem;
  }

  /* ---- Observations ---- */
  .card-obs {
    display: flex;
    align-items: flex-start;
    gap: 0.4rem;
    padding: 0.4rem 0.6rem;
    background: #fffbeb;
    border: 1px solid #fef3c7;
    border-radius: 8px;
    color: #92400e;
  }
  .card-obs p {
    font-size: 0.78rem;
    font-style: italic;
    line-height: 1.4;
    margin: 0;
  }

  /* ---- Actions ---- */
  .card-actions {
    display: flex;
    gap: 0.45rem;
    flex-wrap: wrap;
    padding-top: 0.5rem;
    border-top: 1px solid #f1f5f9;
  }
  .action-content {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
  }
</style>

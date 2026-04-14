<script lang="ts">
  import { onMount } from "svelte";
  import { navigationStore } from "../../stores/navigationStore";
  import { seguimientoStore } from "../../stores/seguimientoStore";
  import type { VisitaProgramada } from "../../types/seguimiento";
  import Button from "../ui/Button.svelte";

  $: visitas = $seguimientoStore.visitas;
  $: requerimientos = $seguimientoStore.requerimientos;
  $: loading = $seguimientoStore.loading;
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
        <div
          class="visita-card"
          style="border-left: 4px solid {estilo.border};"
        >
          <!-- Header -->
          <div class="visita-header">
            <span
              class="badge"
              style="background: {estilo.bg}; color: {estilo.color};"
            >
              {estadoLabel(visita.estado)}
            </span>
            <span class="visita-fecha">{formatDate(visita.fecha_visita)}</span>
            {#if visita.hora_inicio}
              <span class="visita-hora"
                >{visita.hora_inicio}{visita.hora_fin
                  ? ` – ${visita.hora_fin}`
                  : ""}</span
              >
            {/if}
          </div>

          <!-- Body -->
          <div class="visita-body">
            <h3 class="visita-up-name">{visita.id}</h3>
            <p class="visita-up-detail">
              {visita.barrio_vereda || "Sin barrio"}{#if visita.comuna_corregimiento}, {visita.comuna_corregimiento}{/if}
            </p>

            {#if visita.descripcion_visita}
              <p class="visita-descripcion">{visita.descripcion_visita}</p>
            {/if}

            <div class="visita-meta">
              <span class="meta-tag">
                {visita.colaboradores.length} acompañante{visita.colaboradores.length !== 1 ? "s" : ""}
              </span>
              {#if reqCount > 0}
                <span class="meta-tag meta-tag--highlight">
                  {reqCount} requerimiento{reqCount !== 1 ? "s" : ""}
                </span>
              {/if}
            </div>

            {#if visita.colaboradores.length > 0}
              <div class="col-avatars">
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

            {#if visita.observaciones}
              <p class="visita-obs">{visita.observaciones}</p>
            {/if}
          </div>

          <!-- Actions -->
          <div class="visita-actions">
            {#if visita.estado === "programada"}
              <Button
                variant="secondary"
                size="sm"
                on:click={() => iniciarVisita(visita.id)}
              >
                Iniciar Visita
              </Button>
            {/if}
            {#if visita.estado === "en-curso"}
              <Button
                variant="secondary"
                size="sm"
                on:click={() => finalizarVisita(visita.id)}
              >
                Finalizar
              </Button>
            {/if}
            <Button size="sm" on:click={() => irARequerimientos(visita)}>
              Registrar Requerimientos
            </Button>
            {#if reqCount > 0}
              <Button
                variant="secondary"
                size="sm"
                on:click={() =>
                  navigationStore.navigate("kanban", { visitaId: visita.id })}
              >
                Ver Kanban
              </Button>
            {/if}
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
    transition: background 0.15s;
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
    gap: 0.85rem;
  }

  /* ---- Status states (loading / error / empty) ---- */
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
    border-radius: 10px;
    border: 1px solid #e2e8f0;
    border-left: 4px solid #93c5fd;
    overflow: hidden;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
    transition: box-shadow 0.2s;
  }
  .visita-card:hover {
    box-shadow: 0 4px 14px rgba(0, 0, 0, 0.08);
  }

  .visita-header {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    padding: 0.6rem 1rem;
    background: #f8fafc;
    border-bottom: 1px solid #f1f5f9;
  }
  .badge {
    padding: 0.2rem 0.6rem;
    border-radius: 5px;
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: 0.02em;
    text-transform: capitalize;
  }
  .visita-fecha {
    font-size: 0.8rem;
    font-weight: 600;
    color: #334155;
  }
  .visita-hora {
    font-size: 0.75rem;
    color: #94a3b8;
    margin-left: auto;
  }

  /* ---- Body ---- */
  .visita-body {
    padding: 0.85rem 1rem;
  }
  .visita-up-name {
    font-size: 1rem;
    font-weight: 700;
    color: #0f172a;
    margin: 0;
    line-height: 1.3;
  }
  .visita-up-detail {
    font-size: 0.8rem;
    color: #64748b;
    margin: 0.15rem 0 0.5rem;
  }
  .visita-descripcion {
    font-size: 0.8rem;
    color: #334155;
    margin: 0 0 0.6rem;
    line-height: 1.4;
  }

  /* ---- Meta tags ---- */
  .visita-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
    margin-bottom: 0.65rem;
  }
  .meta-tag {
    font-size: 0.72rem;
    color: #475569;
    background: #f1f5f9;
    padding: 0.2rem 0.55rem;
    border-radius: 4px;
    font-weight: 500;
  }
  .meta-tag--highlight {
    background: #fef3c7;
    color: #92400e;
    font-weight: 600;
  }

  /* ---- Avatars ---- */
  .col-avatars {
    display: flex;
    margin-bottom: 0.5rem;
  }
  .avatar {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    background: #3b82f6;
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.7rem;
    font-weight: 700;
    border: 2px solid white;
    margin-left: -6px;
  }
  .avatar:first-child {
    margin-left: 0;
  }
  .avatar--extra {
    background: #94a3b8;
    font-size: 0.65rem;
  }

  .visita-obs {
    font-size: 0.8rem;
    color: #64748b;
    font-style: italic;
    margin: 0.5rem 0 0;
    line-height: 1.45;
  }

  /* ---- Actions ---- */
  .visita-actions {
    display: flex;
    gap: 0.5rem;
    padding: 0.65rem 1rem;
    border-top: 1px solid #f1f5f9;
    flex-wrap: wrap;
  }
</style>

<script lang="ts">
  import { navigationStore } from "../../stores/navigationStore";
  import { registrarVisita } from "../../api/visitas";
  import type { RegistrarVisitaPayload } from "../../types";
  import { CALI_GEOPOLITICA } from "../../data/cali-geopolitica";
  import {
    getCurrentPosition,
    geocodeAddress,
    reverseGeocode,
    formatCoordinates,
  } from "../../lib/geolocation";
  import { MOCK_COLABORADORES } from "../../data/mock-seguimiento";
  import type { Colaborador } from "../../types/seguimiento";
  import Button from "../ui/Button.svelte";
  import Alert from "../ui/Alert.svelte";
  import Card from "../ui/Card.svelte";

  let errorMsg = "";
  let successMsg = "";
  let submitting = false;

  // Ubicación
  let direccion = "";
  let barrioVereda = "";
  let comunaCorregimiento = "";
  let referencia = "";
  let latitud = "";
  let longitud = "";
  let geocodingSource: "gps" | "manual" | "geocoded" = "manual";
  let geoLoading = false;
  let geoMsg = "";

  // Fecha y hora
  let fechaVisita = "";
  let horaInicio = "09:00";
  let horaFin = "12:00";
  let observaciones = "";

  // Colaboradores
  let selectedColaboradores: string[] = [];
  let colaboradores: Colaborador[] = MOCK_COLABORADORES;

  // Init default date
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  fechaVisita = tomorrow.toISOString().split("T")[0];

  // Geopolítica
  $: comunas = CALI_GEOPOLITICA;
  $: barriosDisponibles = comunaCorregimiento
    ? comunas.find((c) => c.nombre === comunaCorregimiento)?.barrios_veredas ||
      []
    : [];

  async function obtenerGPS() {
    geoLoading = true;
    geoMsg = "";
    errorMsg = "";
    try {
      const coords = await getCurrentPosition();
      latitud = coords.latitud.toFixed(6);
      longitud = coords.longitud.toFixed(6);
      geocodingSource = "gps";
      geoMsg = `📍 GPS obtenido: ${formatCoordinates(coords)} (precisión: ${coords.accuracy?.toFixed(0) || "?"}m)`;

      // Intentar geocodificación inversa
      const result = await reverseGeocode(coords.latitud, coords.longitud);
      if (result) {
        if (!direccion) direccion = result.direccion_formateada;
        if (result.barrio && !barrioVereda) barrioVereda = result.barrio;
        if (result.comuna && !comunaCorregimiento) {
          const match = comunas.find((c) =>
            c.nombre.toLowerCase().includes(result.comuna!.toLowerCase()),
          );
          if (match) comunaCorregimiento = match.nombre;
        }
        geoMsg += "\n✅ Dirección obtenida por geocodificación inversa.";
      }
    } catch (err) {
      errorMsg = err instanceof Error ? err.message : "Error al obtener GPS";
    } finally {
      geoLoading = false;
    }
  }

  async function geocodificarDireccion() {
    if (!direccion.trim()) {
      errorMsg = "Ingrese una dirección para geocodificar";
      return;
    }

    geoLoading = true;
    geoMsg = "";
    errorMsg = "";
    try {
      const parts = [direccion];
      if (barrioVereda) parts.push(barrioVereda);
      if (comunaCorregimiento) parts.push(comunaCorregimiento);
      if (referencia) parts.push(referencia);

      const result = await geocodeAddress(parts.join(", "));
      if (result) {
        latitud = result.latitud.toFixed(6);
        longitud = result.longitud.toFixed(6);
        geocodingSource = "geocoded";
        geoMsg = `✅ Ubicación encontrada: ${result.direccion_formateada}`;
      } else {
        geoMsg =
          "⚠️ No se encontró la ubicación. Intente ser más específico o use el GPS.";
      }
    } catch {
      errorMsg = "Error al geocodificar la dirección.";
    } finally {
      geoLoading = false;
    }
  }

  function ingresarCoordenadas() {
    geocodingSource = "manual";
  }

  function toggleColaborador(id: string) {
    if (selectedColaboradores.includes(id)) {
      selectedColaboradores = selectedColaboradores.filter((c) => c !== id);
    } else {
      selectedColaboradores = [...selectedColaboradores, id];
    }
  }

  async function handleProgramar() {
    errorMsg = "";

    if (!direccion.trim() && !latitud) {
      errorMsg =
        "Ingrese una dirección o use el GPS para obtener la ubicación.";
      return;
    }
    if (!fechaVisita) {
      errorMsg = "Seleccione una fecha de visita.";
      return;
    }
    if (selectedColaboradores.length === 0) {
      errorMsg = "Seleccione al menos un colaborador.";
      return;
    }

    submitting = true;

    try {
      const primerColab = colaboradores.find((c) =>
        selectedColaboradores.includes(c.id),
      );
      const [y, m, d] = fechaVisita.split("-");
      const payload: RegistrarVisitaPayload = {
        barrio_vereda: barrioVereda || direccion.trim(),
        comuna_corregimiento: comunaCorregimiento || "Sin comuna",
        descripcion_visita:
          observaciones || `Visita en ${direccion || "ubicación GPS"}`,
        observaciones_visita: observaciones || "",
        acompanantes: {
          nombre_completo: primerColab?.nombre || "Sin acompañante",
          telefono: primerColab?.telefono || "",
          email: primerColab?.email || "",
          centro_gestor: primerColab?.centro_gestor || "",
        },
        fecha_visita: `${d}/${m}/${y}`,
        hora_visita: horaInicio,
      };
      const result = await registrarVisita(payload);

      successMsg = `✅ Visita registrada para ${fechaVisita} en ${direccion || "ubicación GPS"}${result.vid ? ` (ID: ${result.vid})` : ""}`;
    } catch {
      errorMsg = "Error al programar la visita.";
    } finally {
      submitting = false;
    }
  }
</script>

<div class="view">
  <header class="view-header">
    <button
      class="back-btn"
      on:click={() => navigationStore.navigate("programar-visita")}
      >← Unidades</button
    >
    <h2 class="view-title">📍 Programar Visita sin UP</h2>
  </header>

  <main class="view-body container">
    {#if successMsg}
      <Alert type="success" message={successMsg} />
      <div class="success-actions">
        <Button on:click={() => navigationStore.navigate("visitas-programadas")}
          >Ver Visitas Programadas</Button
        >
        <Button
          variant="secondary"
          on:click={() => navigationStore.navigate("programar-visita")}
          >Volver a Unidades</Button
        >
      </div>
    {:else}
      {#if errorMsg}
        <Alert type="error" message={errorMsg} />
      {/if}

      <!-- Ubicación -->
      <Card padding="lg">
        <h3 class="section-title">📍 Ubicación del Punto de Intervención</h3>
        <p class="section-hint">
          Ingrese la dirección o use el GPS del dispositivo. Se intentará
          geocodificar automáticamente.
        </p>

        <!-- GPS button -->
        <div class="gps-actions">
          <Button
            variant="secondary"
            on:click={obtenerGPS}
            loading={geoLoading}
            disabled={geoLoading}
          >
            {geoLoading ? "Obteniendo..." : "📡 Usar GPS del dispositivo"}
          </Button>
        </div>

        {#if geoMsg}
          <div class="geo-msg">{geoMsg}</div>
        {/if}

        <div class="form-field">
          <label for="direccion">Dirección *</label>
          <input
            type="text"
            id="direccion"
            bind:value={direccion}
            placeholder="Ej: Calle 5 #38-40, Barrio San Fernando"
          />
        </div>

        <div class="form-grid-2">
          <div class="form-field">
            <label for="comuna">Comuna / Corregimiento</label>
            <select id="comuna" bind:value={comunaCorregimiento}>
              <option value="">— Seleccione —</option>
              {#each comunas as c}
                <option value={c.nombre}>{c.nombre} ({c.tipo})</option>
              {/each}
            </select>
          </div>
          <div class="form-field">
            <label for="barrio">Barrio / Vereda</label>
            {#if barriosDisponibles.length > 0}
              <select id="barrio" bind:value={barrioVereda}>
                <option value="">— Seleccione —</option>
                {#each barriosDisponibles as b}
                  <option value={b.nombre}>{b.nombre}</option>
                {/each}
              </select>
            {:else}
              <input
                type="text"
                id="barrio"
                bind:value={barrioVereda}
                placeholder="Nombre del barrio o vereda"
              />
            {/if}
          </div>
        </div>

        <div class="form-field">
          <label for="referencia">Referencia / Establecimiento cercano</label>
          <input
            type="text"
            id="referencia"
            bind:value={referencia}
            placeholder="Ej: Frente al CAI de San Fernando, junto al parque..."
          />
        </div>

        <!-- Geocodificar dirección o ingresar coordenadas manualmente -->
        <div class="coords-section">
          <div class="coords-actions">
            <Button
              variant="secondary"
              size="sm"
              on:click={geocodificarDireccion}
              loading={geoLoading}
              disabled={geoLoading || !direccion.trim()}
            >
              🔍 Geocodificar dirección
            </Button>
            <button class="link-btn" on:click={ingresarCoordenadas}>
              Ingresar coordenadas manualmente
            </button>
          </div>

          <div class="form-grid-2">
            <div class="form-field">
              <label for="lat">Latitud</label>
              <input
                type="text"
                id="lat"
                bind:value={latitud}
                placeholder="Ej: 3.4516"
              />
            </div>
            <div class="form-field">
              <label for="lng">Longitud</label>
              <input
                type="text"
                id="lng"
                bind:value={longitud}
                placeholder="Ej: -76.5320"
              />
            </div>
          </div>

          {#if latitud && longitud}
            <div class="coords-preview">
              📌 Coordenadas: {latitud}, {longitud}
              <span class="coords-source"
                >({geocodingSource === "gps"
                  ? "GPS"
                  : geocodingSource === "geocoded"
                    ? "Geocodificado"
                    : "Manual"})</span
              >
            </div>
          {/if}
        </div>
      </Card>

      <!-- Datos de la visita -->
      <Card padding="lg">
        <h3 class="section-title">📅 Datos de la Visita</h3>

        <div class="form-grid-3">
          <div class="form-field">
            <label for="fecha">Fecha de Visita *</label>
            <input type="date" id="fecha" bind:value={fechaVisita} required />
          </div>
          <div class="form-field">
            <label for="hora-inicio">Hora Inicio</label>
            <input type="time" id="hora-inicio" bind:value={horaInicio} />
          </div>
          <div class="form-field">
            <label for="hora-fin">Hora Fin</label>
            <input type="time" id="hora-fin" bind:value={horaFin} />
          </div>
        </div>

        <div class="form-field" style="margin-top: 0.75rem;">
          <label for="obs">Observaciones</label>
          <textarea
            id="obs"
            bind:value={observaciones}
            rows="3"
            placeholder="Notas adicionales sobre la visita..."
          ></textarea>
        </div>
      </Card>

      <!-- Colaboradores -->
      <Card padding="lg">
        <h3 class="section-title">👥 Asignar Colaboradores *</h3>
        <p class="section-hint">
          Seleccione las personas que participarán en la visita.
        </p>

        <div class="colaboradores-grid">
          {#each colaboradores as col (col.id)}
            <button
              class="col-card"
              class:selected={selectedColaboradores.includes(col.id)}
              on:click={() => toggleColaborador(col.id)}
            >
              <div class="col-avatar">{col.nombre.charAt(0)}</div>
              <div class="col-info">
                <strong>{col.nombre}</strong>
                <small>{col.cargo}</small>
                <small class="col-cg">{col.centro_gestor}</small>
              </div>
              <div class="col-check">
                {#if selectedColaboradores.includes(col.id)}✅{:else}◻️{/if}
              </div>
            </button>
          {/each}
        </div>

        {#if selectedColaboradores.length > 0}
          <p class="selected-count">
            {selectedColaboradores.length} colaborador{selectedColaboradores.length >
            1
              ? "es"
              : ""} seleccionado{selectedColaboradores.length > 1 ? "s" : ""}
          </p>
        {/if}
      </Card>

      <!-- Submit -->
      <div class="submit-area">
        <Button
          variant="secondary"
          on:click={() => navigationStore.navigate("programar-visita")}
          >Cancelar</Button
        >
        <Button
          on:click={handleProgramar}
          loading={submitting}
          disabled={submitting}
        >
          {submitting ? "Programando..." : "📅 Programar Visita"}
        </Button>
      </div>
    {/if}
  </main>
</div>

<style>
  .view {
    min-height: 100vh;
    background: #f8fafc;
  }
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
  }
  .view-body {
    padding: 1rem 0.75rem 2rem;
    max-width: 800px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }
  .container {
    width: 100%;
  }

  .section-title {
    font-size: 1rem;
    font-weight: 700;
    margin: 0 0 0.75rem;
    color: #1e293b;
  }
  .section-hint {
    font-size: 0.8rem;
    color: #64748b;
    margin: -0.5rem 0 0.75rem;
  }

  /* GPS */
  .gps-actions {
    margin-bottom: 1rem;
  }
  .geo-msg {
    background: #eff6ff;
    border: 1px solid #bfdbfe;
    border-radius: 6px;
    padding: 0.6rem 0.75rem;
    font-size: 0.8rem;
    color: #1e40af;
    margin-bottom: 1rem;
    white-space: pre-line;
  }

  /* Form */
  .form-field {
    margin-bottom: 0.75rem;
  }
  .form-field label {
    display: block;
    font-size: 0.75rem;
    font-weight: 600;
    color: #475569;
    margin-bottom: 0.25rem;
  }
  .form-field input,
  .form-field textarea,
  .form-field select {
    width: 100%;
    padding: 0.6rem;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    font-size: 0.875rem;
    font-family: inherit;
    outline: none;
  }
  .form-field input:focus,
  .form-field textarea:focus,
  .form-field select:focus {
    border-color: #2563eb;
  }

  .form-grid-2 {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.75rem;
  }
  .form-grid-3 {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 0.75rem;
  }

  /* Coords */
  .coords-section {
    margin-top: 0.5rem;
    border-top: 1px solid #e2e8f0;
    padding-top: 0.75rem;
  }
  .coords-actions {
    display: flex;
    align-items: center;
    gap: 1rem;
    margin-bottom: 0.75rem;
    flex-wrap: wrap;
  }
  .link-btn {
    background: none;
    border: none;
    color: #2563eb;
    font-size: 0.8rem;
    cursor: pointer;
    text-decoration: underline;
    padding: 0;
  }
  .coords-preview {
    background: #f0fdf4;
    border: 1px solid #bbf7d0;
    border-radius: 6px;
    padding: 0.5rem 0.75rem;
    font-size: 0.8rem;
    color: #166534;
    margin-top: 0.5rem;
  }
  .coords-source {
    color: #64748b;
    font-size: 0.72rem;
  }

  /* Colaboradores */
  .colaboradores-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
    gap: 0.5rem;
  }
  .col-card {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    padding: 0.65rem;
    border: 2px solid #e2e8f0;
    border-radius: 8px;
    background: white;
    cursor: pointer;
    transition: all 0.2s;
    text-align: left;
    width: 100%;
  }
  .col-card:hover {
    border-color: #93c5fd;
  }
  .col-card.selected {
    border-color: #2563eb;
    background: #eff6ff;
  }
  .col-avatar {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    background: #2563eb;
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 700;
    font-size: 0.875rem;
    flex-shrink: 0;
  }
  .col-info {
    flex: 1;
    min-width: 0;
  }
  .col-info strong {
    display: block;
    font-size: 0.8rem;
    color: #1e293b;
  }
  .col-info small {
    display: block;
    font-size: 0.7rem;
    color: #64748b;
  }
  .col-cg {
    color: #2563eb !important;
    font-weight: 600;
  }
  .col-check {
    font-size: 1.1rem;
    flex-shrink: 0;
  }
  .selected-count {
    font-size: 0.8rem;
    color: #2563eb;
    font-weight: 600;
    margin-top: 0.5rem;
  }

  /* Submit */
  .submit-area {
    display: flex;
    justify-content: flex-end;
    gap: 0.75rem;
    margin-top: 0.5rem;
  }
  .success-actions {
    display: flex;
    gap: 0.75rem;
    margin-top: 1rem;
  }

  @media (max-width: 640px) {
    .form-grid-2 {
      grid-template-columns: 1fr;
    }
    .form-grid-3 {
      grid-template-columns: 1fr;
    }
    .colaboradores-grid {
      grid-template-columns: 1fr;
    }
  }
</style>

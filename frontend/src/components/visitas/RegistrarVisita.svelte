<script lang="ts">
  import { onMount } from "svelte";
  import { navigationStore } from "../../stores/navigationStore";
  import { registrarVisita, getDirectorioContactos } from "../../api/visitas";
  import type {
    RegistrarVisitaPayload,
    ContactoDirectorio,
    AcompananteModel,
  } from "../../types";
  import Button from "../ui/Button.svelte";
  import Input from "../ui/Input.svelte";
  import Textarea from "../ui/Textarea.svelte";
  import Alert from "../ui/Alert.svelte";
  import Card from "../ui/Card.svelte";
  import GroupedMultiSelect from "../ui/GroupedMultiSelect.svelte";

  let submitting = false;
  let successMsg = "";
  let errorMsg = "";

  let direccion_visita = "";
  let descripcion_visita = "";
  let observaciones_visita = "";
  let fecha_visita = new Date().toISOString().split("T")[0];
  let hora_visita = "";

  // Directorio de contactos
  let contactos: ContactoDirectorio[] = [];
  let selectedContactIds: string[] = [];
  let loadingContactos = false;

  $: contactGroups = (() => {
    const map = new Map<
      string,
      { id: string; label: string; sublabel?: string }[]
    >();
    for (const c of contactos) {
      const key = c.centro_gestor || "Sin centro gestor";
      if (!map.has(key)) map.set(key, []);
      const nombre = `${c.nombres} ${c.apellidos}`.trim();
      map.get(key)!.push({
        id: c.id,
        label: nombre,
        sublabel: c.funcion || undefined,
      });
    }
    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([category, items]) => ({ category, items }));
  })();

  $: acompanantes = selectedContactIds
    .map((id) => contactos.find((c) => c.id === id))
    .filter((c): c is ContactoDirectorio => !!c)
    .map<AcompananteModel>((c) => ({
      nombre_completo: `${c.nombres} ${c.apellidos}`.trim(),
      telefono: c.telefono,
      email: c.email,
      centro_gestor: c.centro_gestor,
    }));

  onMount(async () => {
    loadingContactos = true;
    try {
      const res = await getDirectorioContactos();
      if (res.success) contactos = res.contactos;
    } catch (err) {
      console.error("Error cargando directorio de contactos:", err);
    } finally {
      loadingContactos = false;
    }
  });

  /** Convert YYYY-MM-DD to dd/mm/aaaa */
  function formatDateForAPI(isoDate: string): string {
    const [y, m, d] = isoDate.split("-");
    return `${d}/${m}/${y}`;
  }

  async function handleSubmit() {
    if (
      !direccion_visita ||
      !descripcion_visita ||
      !fecha_visita ||
      !hora_visita
    ) {
      errorMsg = "Por favor, complete todos los campos obligatorios.";
      return;
    }
    submitting = true;
    errorMsg = "";
    successMsg = "";
    try {
      const payload: RegistrarVisitaPayload = {
        direccion_visita,
        descripcion_visita,
        observaciones_visita: observaciones_visita.trim() || "Sin observaciones",
        acompanantes: acompanantes.length > 0 ? acompanantes : undefined,
        fecha_visita: formatDateForAPI(fecha_visita),
        hora_visita,
      };
      const result = await registrarVisita(payload);
      successMsg = `Visita registrada exitosamente. ${result.vid ? `ID: ${result.vid}` : ""}`;
      // Reset
      direccion_visita = "";
      descripcion_visita = "";
      observaciones_visita = "";
      fecha_visita = new Date().toISOString().split("T")[0];
      hora_visita = "";
      selectedContactIds = [];
      // Navegar a Visitas Programadas
      navigationStore.navigate("visitas-programadas");
    } catch (err) {
      errorMsg = "Error al registrar la visita. Intente de nuevo.";
      console.error(err);
    } finally {
      submitting = false;
    }
  }
</script>

<div class="view">
  <header class="view-header">
    <button class="back-btn" on:click={() => navigationStore.goHome()}
      >← Volver</button
    >
    <h2 class="view-title">Programar Visita</h2>
  </header>

  <main class="view-body container">
    {#if successMsg}
      <Alert type="success" message={successMsg} />
    {/if}
    {#if errorMsg}
      <Alert type="error" message={errorMsg} />
    {/if}

    <Card padding="lg">
      <form on:submit|preventDefault={handleSubmit} class="form">
        <Input
          id="direccion_visita"
          type="text"
          label="Dirección de la Visita"
          placeholder="Ej: Calle 5 # 38-20, Barrio Aguablanca"
          bind:value={direccion_visita}
          required
        />

        <Textarea
          id="descripcion_visita"
          label="Descripción de la Visita"
          placeholder="Describa el propósito de la visita..."
          bind:value={descripcion_visita}
          required
          rows={3}
        />

        <Textarea
          id="observaciones_visita"
          label="Observaciones"
          placeholder="Observaciones adicionales..."
          bind:value={observaciones_visita}
          rows={2}
        />

        <div class="row-2">
          <Input
            id="fecha_visita"
            type="date"
            label="Fecha de la Visita"
            bind:value={fecha_visita}
            required
          />
          <Input
            id="hora_visita"
            type="time"
            label="Hora de la Visita"
            bind:value={hora_visita}
            required
          />
        </div>

        <GroupedMultiSelect
          id="acompanantes"
          label="Delegados Acompañantes"
          placeholder={loadingContactos
            ? "Cargando contactos..."
            : "Buscar delegado por nombre o centro gestor..."}
          groups={contactGroups}
          bind:selected={selectedContactIds}
          disabled={loadingContactos}
        />

        <div class="form-actions">
          <Button variant="secondary" on:click={() => navigationStore.goHome()}>
            Cancelar
          </Button>
          <Button type="submit" loading={submitting} disabled={submitting}>
            {submitting ? "Registrando..." : "Registrar Visita"}
          </Button>
        </div>
      </form>
    </Card>
  </main>
</div>

<style>
  .view {
    min-height: 100vh;
    min-height: 100dvh;
    background: var(--bg);
  }
  .view-header {
    background: var(--surface);
    border-bottom: 1px solid var(--border);
    padding: var(--space-md);
    display: flex;
    align-items: center;
    gap: var(--space-md);
    position: sticky;
    top: 0;
    z-index: 100;
  }
  .back-btn {
    background: none;
    border: none;
    color: var(--primary);
    font-size: 0.9375rem;
    font-weight: 600;
    cursor: pointer;
    padding: 0;
    font-family: inherit;
  }
  .back-btn:hover {
    text-decoration: underline;
  }
  .view-title {
    font-size: 1.125rem;
    font-weight: 700;
    color: var(--text);
  }
  .view-body {
    padding-top: var(--space-lg);
    padding-bottom: var(--space-2xl);
  }
  .form {
    display: flex;
    flex-direction: column;
    gap: var(--space-md);
  }
  .form-actions {
    display: flex;
    justify-content: flex-end;
    gap: var(--space-sm);
    margin-top: var(--space-sm);
  }
  .row-2 {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--space-sm);
  }
</style>

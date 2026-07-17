import type { ComponentType } from 'svelte';
import type { AppView } from '../stores/navigationStore';
import Home from '../components/Home.svelte';
import RegistrarVisita from '../components/visitas/RegistrarVisita.svelte';
import KanbanRequerimientos from '../components/seguimiento/KanbanRequerimientos.svelte';
import ListaAvanzadas from '../components/avanzadas/ListaAvanzadas.svelte';
import RegistrarAvanzada from '../components/avanzadas/RegistrarAvanzada.svelte';
import DetalleAvanzada from '../components/avanzadas/DetalleAvanzada.svelte';
import Reportes from '../components/visitas/Reportes.svelte';

/**
 * Single source of truth for view -> component resolution, replacing
 * App.svelte's old {#if}/{:else if} chain. Keyed by AppView so it's a
 * compile-time error to leave a view unmapped; src/lib/viewRegistry.test.ts
 * additionally cross-checks this map against navigationStore's
 * ALL_APP_VIEWS at runtime, so an update to one without the other fails
 * the test suite instead of silently rotting.
 */
export const viewComponents: Record<AppView, ComponentType> = {
  home: Home,
  'programar-visita': RegistrarVisita,
  kanban: KanbanRequerimientos,
  avanzadas: ListaAvanzadas,
  'registrar-avanzada': RegistrarAvanzada,
  'detalle-avanzada': DetalleAvanzada,
  reportes: Reportes,
};

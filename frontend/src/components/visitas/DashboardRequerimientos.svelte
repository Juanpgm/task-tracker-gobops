<script lang="ts">
  import { seguimientoStore } from '../../stores/seguimientoStore';
  import { CENTROS_GESTORES } from '../../data/mock-seguimiento';
  import type { Requerimiento } from '../../types/seguimiento';

  type Periodo = 'semanal' | 'mensual' | 'trimestral' | 'semestral';

  let periodo: Periodo = 'mensual';
  let filterCentroGestor = '';
  let filterComuna = '';

  // ── Helpers ──────────────────────────────────────────────────────────────

  function startOfPeriod(p: Periodo): Date {
    const now = new Date();
    switch (p) {
      case 'semanal':    { const d = new Date(now); d.setDate(d.getDate() - 7); return d; }
      case 'mensual':    { const d = new Date(now); d.setMonth(d.getMonth() - 1); return d; }
      case 'trimestral': { const d = new Date(now); d.setMonth(d.getMonth() - 3); return d; }
      case 'semestral':  { const d = new Date(now); d.setMonth(d.getMonth() - 6); return d; }
    }
  }

  $: allReqs    = $seguimientoStore.requerimientos;
  $: allVisitas = $seguimientoStore.visitas;

  $: filteredReqs = allReqs.filter((r) => {
    const inPeriod = new Date(r.created_at) >= startOfPeriod(periodo);
    const byCG     = !filterCentroGestor || r.centros_gestores.includes(filterCentroGestor);
    const byCom    = !filterComuna || r.solicitante.comuna_corregimiento === filterComuna;
    return inPeriod && byCG && byCom;
  });

  $: filteredVisitas = allVisitas.filter((v) => new Date(v.created_at) >= startOfPeriod(periodo));

  // ── KPIs ─────────────────────────────────────────────────────────────────
  $: totalReqs       = filteredReqs.length;
  $: totalVisitas    = filteredVisitas.length;
  $: resueltos       = filteredReqs.filter(r => r.estado === 'resuelto' || r.estado === 'cerrado').length;
  $: cancelados      = filteredReqs.filter(r => r.estado === 'cancelado').length;
  $: avgAvance       = totalReqs > 0 ? Math.round(filteredReqs.reduce((s, r) => s + r.porcentaje_avance, 0) / totalReqs) : 0;
  $: tasaResolucion  = totalReqs > 0 ? Math.round((resueltos / totalReqs) * 100) : 0;
  $: conOrfeo        = filteredReqs.filter(r => r.numero_orfeo).length;
  $: urgentes        = filteredReqs.filter(r => r.prioridad === 'urgente').length;

  // ── Por Estado ───────────────────────────────────────────────────────────
  const ESTADOS = [
    { id: 'nuevo',      label: 'Nuevos',     color: '#6b7280' },
    { id: 'radicado',   label: 'Radicados',  color: '#3b82f6' },
    { id: 'en-gestion', label: 'En Gestión', color: '#f59e0b' },
    { id: 'asignado',   label: 'Asignados',  color: '#8b5cf6' },
    { id: 'en-proceso', label: 'En Proceso', color: '#f97316' },
    { id: 'resuelto',   label: 'Resueltos',  color: '#22c55e' },
    { id: 'cerrado',    label: 'Cerrados',   color: '#64748b' },
    { id: 'cancelado',  label: 'Cancelados', color: '#ef4444' },
  ];
  $: byEstado = ESTADOS.map(e => ({ ...e, count: filteredReqs.filter(r => r.estado === e.id).length }));
  $: maxEstado = Math.max(...byEstado.map(e => e.count), 1);

  // ── Por Prioridad ────────────────────────────────────────────────────────
  const PRIORIDADES = [
    { id: 'urgente', label: 'Urgente', color: '#dc2626' },
    { id: 'alta',    label: 'Alta',    color: '#f59e0b' },
    { id: 'media',   label: 'Media',   color: '#3b82f6' },
    { id: 'baja',    label: 'Baja',    color: '#94a3b8' },
  ];
  $: byPrioridad = PRIORIDADES.map(p => ({ ...p, count: filteredReqs.filter(r => r.prioridad === p.id).length }));

  // ── Por Centro Gestor ────────────────────────────────────────────────────
  $: byCentroGestor = (() => {
    const map: Record<string, number> = {};
    for (const r of filteredReqs) {
      for (const cg of r.centros_gestores) {
        map[cg] = (map[cg] || 0) + 1;
      }
    }
    return Object.entries(map).map(([cg, count]) => ({ cg, count })).sort((a, b) => b.count - a.count).slice(0, 10);
  })();
  $: maxCG = Math.max(...byCentroGestor.map(e => e.count), 1);

  // ── Tabla: Comunas ───────────────────────────────────────────────────────
  $: tablaComunas = (() => {
    const map: Record<string, { barrios: Set<string>; cgs: Set<string>; visitas: number; reqs: number }> = {};
    for (const r of filteredReqs) {
      const com = r.solicitante.comuna_corregimiento || 'Sin comuna';
      if (!map[com]) map[com] = { barrios: new Set(), cgs: new Set(), visitas: 0, reqs: 0 };
      if (r.solicitante.barrio_vereda) map[com].barrios.add(r.solicitante.barrio_vereda);
      for (const cg of r.centros_gestores) map[com].cgs.add(cg);
      map[com].reqs++;
    }
    // Add visitas per comune via visita-req mapping
    for (const v of filteredVisitas) {
      const reqs = allReqs.filter(r => r.visita_id === v.id);
      for (const r of reqs) {
        const com = r.solicitante.comuna_corregimiento || 'Sin comuna';
        if (map[com]) map[com].visitas++;
      }
    }
    return Object.entries(map).map(([com, d]) => ({
      comuna: com, barrios: d.barrios.size, centrosGestores: d.cgs.size,
      visitas: Math.min(d.visitas, filteredVisitas.length), reqs: d.reqs,
    })).sort((a, b) => b.reqs - a.reqs);
  })();

  // ── Tendencia mensual (últimos 6 meses siempre) ───────────────────────────
  $: trendData = (() => {
    const months: { label: string; reqs: number; visitas: number; resueltos: number }[] = [];
    const now = new Date();
    const meses = periodo === 'semanal' ? 4 : periodo === 'mensual' ? 6 : periodo === 'trimestral' ? 9 : 12;
    for (let i = meses - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const dEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59);
      const label = d.toLocaleDateString('es-CO', { month: 'short', year: '2-digit' });
      const reqs = allReqs.filter(r => {
        const cd = new Date(r.created_at);
        return cd >= d && cd <= dEnd;
      }).length;
      const res = allReqs.filter(r => {
        const cd = new Date(r.updated_at);
        return cd >= d && cd <= dEnd && (r.estado === 'resuelto' || r.estado === 'cerrado');
      }).length;
      const vis = allVisitas.filter(v => {
        const cd = new Date(v.created_at);
        return cd >= d && cd <= dEnd;
      }).length;
      months.push({ label, reqs, visitas: vis, resueltos: res });
    }
    return months;
  })();
  $: maxTrend = Math.max(...trendData.map(m => m.reqs + m.visitas), 1);

  // ── Options ───────────────────────────────────────────────────────────────
  $: uniqueComunas = [...new Set(allReqs.map(r => r.solicitante.comuna_corregimiento).filter(Boolean))].sort();
  $: cgOptions = CENTROS_GESTORES.map(c => c.nombre);

  const periodos: { id: Periodo; label: string }[] = [
    { id: 'semanal',    label: 'Semanal' },
    { id: 'mensual',    label: 'Mensual' },
    { id: 'trimestral', label: 'Trimestral' },
    { id: 'semestral',  label: 'Semestral' },
  ];

  function getCGColor(cg: string): string {
    const found = CENTROS_GESTORES.find(c => c.nombre === cg);
    return found?.color || '#6366f1';
  }
</script>

<!-- ══════════════════════════════════════════════════════════ DASHBOARD ═══ -->
<div class="db-root">

  <!-- Header -->
  <div class="db-header">
    <div class="db-header-left">
      <h2 class="db-title">📊 Dashboard de Gestión</h2>
      <span class="db-subtitle">Indicadores de visitas y requerimientos — Alcaldía de Cali</span>
    </div>
    <div class="db-header-right">
      <!-- Period selector -->
      <div class="period-pills">
        {#each periodos as p}
          <button class="period-pill" class:active={periodo === p.id} on:click={() => (periodo = p.id)}>{p.label}</button>
        {/each}
      </div>
      <!-- Filters -->
      <select class="db-select" bind:value={filterCentroGestor}>
        <option value="">Todos los centros</option>
        {#each cgOptions as cg}<option value={cg}>{cg}</option>{/each}
      </select>
      <select class="db-select" bind:value={filterComuna}>
        <option value="">Todas las comunas</option>
        {#each uniqueComunas as c}<option value={c}>{c}</option>{/each}
      </select>
    </div>
  </div>

  <!-- ── KPI Cards ── -->
  <div class="kpi-row">
    <div class="kpi-card kpi-blue">
      <span class="kpi-icon">📋</span>
      <div class="kpi-body">
        <span class="kpi-value">{totalReqs}</span>
        <span class="kpi-label">Requerimientos</span>
      </div>
    </div>
    <div class="kpi-card kpi-green">
      <span class="kpi-icon">🗺️</span>
      <div class="kpi-body">
        <span class="kpi-value">{totalVisitas}</span>
        <span class="kpi-label">Visitas realizadas</span>
      </div>
    </div>
    <div class="kpi-card kpi-teal">
      <span class="kpi-icon">✅</span>
      <div class="kpi-body">
        <span class="kpi-value">{tasaResolucion}%</span>
        <span class="kpi-label">Tasa de resolución</span>
      </div>
    </div>
    <div class="kpi-card kpi-purple">
      <span class="kpi-icon">📈</span>
      <div class="kpi-body">
        <span class="kpi-value">{avgAvance}%</span>
        <span class="kpi-label">Avance promedio</span>
      </div>
    </div>
    <div class="kpi-card kpi-orange">
      <span class="kpi-icon">🚨</span>
      <div class="kpi-body">
        <span class="kpi-value">{urgentes}</span>
        <span class="kpi-label">Urgentes</span>
      </div>
    </div>
    <div class="kpi-card kpi-violet">
      <span class="kpi-icon">📄</span>
      <div class="kpi-body">
        <span class="kpi-value">{conOrfeo}</span>
        <span class="kpi-label">Con No. Orfeo</span>
      </div>
    </div>
  </div>

  <!-- ── Charts row ── -->
  <div class="charts-row">

    <!-- Estado Chart -->
    <div class="chart-card">
      <h3 class="chart-title">📊 Requerimientos por Estado</h3>
      <div class="hbar-list">
        {#each byEstado as e}
          {#if e.count > 0 || totalReqs === 0}
            <div class="hbar-item">
              <span class="hbar-label">{e.label}</span>
              <div class="hbar-track">
                <div class="hbar-fill" style="width: {totalReqs > 0 ? Math.round((e.count / maxEstado) * 100) : 0}%; background: {e.color};"></div>
              </div>
              <span class="hbar-val">{e.count}</span>
            </div>
          {/if}
        {/each}
        {#if totalReqs === 0}
          <p class="chart-empty">Sin datos en el periodo seleccionado</p>
        {/if}
      </div>
    </div>

    <!-- Prioridad Chart -->
    <div class="chart-card">
      <h3 class="chart-title">🎯 Distribución por Prioridad</h3>
      <div class="prio-grid">
        {#each byPrioridad as p}
          <div class="prio-cell" style="border-color: {p.color}">
            <span class="prio-count" style="color: {p.color}">{p.count}</span>
            <span class="prio-label">{p.label}</span>
            {#if totalReqs > 0}
              <span class="prio-pct">{Math.round((p.count / totalReqs) * 100)}%</span>
            {/if}
          </div>
        {/each}
      </div>
      <!-- Mini donut via conic-gradient -->
      {#if totalReqs > 0}
        <div class="donut-wrap">
          <div class="donut" style="background: conic-gradient(
            {byPrioridad[0].color} 0% {byPrioridad[0].count / totalReqs * 100}%,
            {byPrioridad[1].color} {byPrioridad[0].count / totalReqs * 100}% {(byPrioridad[0].count + byPrioridad[1].count) / totalReqs * 100}%,
            {byPrioridad[2].color} {(byPrioridad[0].count + byPrioridad[1].count) / totalReqs * 100}% {(byPrioridad[0].count + byPrioridad[1].count + byPrioridad[2].count) / totalReqs * 100}%,
            {byPrioridad[3].color} {(byPrioridad[0].count + byPrioridad[1].count + byPrioridad[2].count) / totalReqs * 100}% 100%
          );">
            <div class="donut-hole">
              <span class="donut-total">{totalReqs}</span>
              <span class="donut-total-label">total</span>
            </div>
          </div>
        </div>
      {/if}
    </div>

  </div>

  <!-- ── Centro Gestor chart ── -->
  <div class="chart-card chart-card-wide">
    <h3 class="chart-title">🏢 Requerimientos por Centro Gestor</h3>
    {#if byCentroGestor.length === 0}
      <p class="chart-empty">Sin datos en el periodo seleccionado</p>
    {:else}
      <div class="hbar-list">
        {#each byCentroGestor as cg}
          <div class="hbar-item">
            <span class="hbar-label hbar-label-wide" title={cg.cg}>{cg.cg.length > 35 ? cg.cg.slice(0, 32) + '…' : cg.cg}</span>
            <div class="hbar-track hbar-track-wide">
              <div class="hbar-fill" style="width: {Math.round((cg.count / maxCG) * 100)}%; background: {getCGColor(cg.cg)};"></div>
            </div>
            <span class="hbar-val">{cg.count}</span>
          </div>
        {/each}
      </div>
    {/if}
  </div>

  <!-- ── Tendencia Histórica ── -->
  <div class="chart-card chart-card-wide">
    <h3 class="chart-title">📅 Tendencia Histórica — Mes a Mes</h3>
    <div class="legend-row">
      <span class="legend-item"><span class="legend-dot" style="background:#2563eb"></span>Requerimientos</span>
      <span class="legend-item"><span class="legend-dot" style="background:#22c55e"></span>Resueltos</span>
      <span class="legend-item"><span class="legend-dot" style="background:#f59e0b"></span>Visitas</span>
    </div>
    <div class="trend-chart">
      {#each trendData as m, i}
        <div class="trend-col">
          <div class="trend-bars">
            <div class="trend-bar trend-bar-req"
              style="height: {Math.round((m.reqs / maxTrend) * 120)}px"
              title="{m.reqs} requerimientos"
            ></div>
            <div class="trend-bar trend-bar-res"
              style="height: {Math.round((m.resueltos / maxTrend) * 120)}px"
              title="{m.resueltos} resueltos"
            ></div>
            <div class="trend-bar trend-bar-vis"
              style="height: {Math.round((m.visitas / maxTrend) * 120)}px"
              title="{m.visitas} visitas"
            ></div>
          </div>
          <span class="trend-label">{m.label}</span>
        </div>
      {/each}
    </div>
  </div>

  <!-- ── Tabla resumen ── -->
  <div class="chart-card chart-card-wide">
    <h3 class="chart-title">📋 Resumen por Comuna</h3>
    {#if tablaComunas.length === 0}
      <p class="chart-empty">Sin datos en el periodo seleccionado</p>
    {:else}
      <div class="summary-table-wrap">
        <table class="summary-table">
          <thead>
            <tr>
              <th>Comuna / Corregimiento</th>
              <th>Barrios</th>
              <th>Centros Gestores</th>
              <th>Visitas</th>
              <th>Requerimientos</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {#each tablaComunas as row}
              <tr>
                <td class="trw-comuna"><strong>{row.comuna}</strong></td>
                <td class="trw-num">{row.barrios}</td>
                <td class="trw-num">{row.centrosGestores}</td>
                <td class="trw-num">{row.visitas}</td>
                <td class="trw-num trw-reqs">{row.reqs}</td>
                <td>
                  <div class="mini-bar-table">
                    <div class="mini-bar-fill" style="width: {totalReqs > 0 ? Math.round((row.reqs / totalReqs) * 100) : 0}%"></div>
                  </div>
                  <span class="trw-pct">{totalReqs > 0 ? Math.round((row.reqs / totalReqs) * 100) : 0}%</span>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
  </div>

  <!-- Footer -->
  <div class="db-footer">
    <span>Alcaldía de Santiago de Cali — Sistema de Seguimiento de Requerimientos</span>
    <span>Generado: {new Date().toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' })}</span>
  </div>
</div>

<style>
  /* ── Root & Layout ─────────────────────────────────────────────────────── */
  .db-root {
    background: #f1f5f9;
    min-height: 100%;
    padding: 1.25rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
    font-family: system-ui, -apple-system, sans-serif;
  }

  /* ── Header ──────────────────────────────────────────────────────────────*/
  .db-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1rem;
    flex-wrap: wrap;
  }
  .db-header-left { display: flex; flex-direction: column; gap: 0.2rem; }
  .db-title { font-size: 1.4rem; font-weight: 800; color: #0f172a; margin: 0; letter-spacing: -0.01em; }
  .db-subtitle { font-size: 0.78rem; color: #64748b; font-weight: 500; }
  .db-header-right { display: flex; align-items: center; gap: 0.6rem; flex-wrap: wrap; }
  .period-pills { display: flex; background: white; border-radius: 8px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 1px 3px rgba(0,0,0,0.06); }
  .period-pill {
    background: none; border: none; padding: 0.35rem 0.75rem;
    font-size: 0.75rem; font-weight: 600; color: #64748b; cursor: pointer; transition: all 0.15s;
  }
  .period-pill.active { background: #2563eb; color: white; }
  .period-pill:hover:not(.active) { color: #1e293b; background: #f1f5f9; }
  .db-select {
    background: white; border: 1px solid #e2e8f0; color: #475569;
    padding: 0.35rem 0.65rem; border-radius: 8px; font-size: 0.75rem;
    font-family: inherit; outline: none; cursor: pointer;
    box-shadow: 0 1px 3px rgba(0,0,0,0.06);
  }
  .db-select:focus { border-color: #2563eb; }

  /* ── KPI Cards ───────────────────────────────────────────────────────────*/
  .kpi-row { display: grid; grid-template-columns: repeat(6, 1fr); gap: 0.75rem; }
  @media (max-width: 900px) { .kpi-row { grid-template-columns: repeat(3, 1fr); } }
  @media (max-width: 600px) { .kpi-row { grid-template-columns: repeat(2, 1fr); } }
  .kpi-card {
    background: white; border-radius: 12px; padding: 1rem;
    display: flex; align-items: center; gap: 0.75rem;
    border: 1px solid #e2e8f0; transition: transform 0.15s;
    box-shadow: 0 1px 4px rgba(0,0,0,0.06);
  }
  .kpi-card:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
  .kpi-icon { font-size: 1.6rem; }
  .kpi-body { display: flex; flex-direction: column; gap: 0.1rem; }
  .kpi-value { font-size: 1.6rem; font-weight: 800; color: #0f172a; line-height: 1; }
  .kpi-label { font-size: 0.68rem; color: #64748b; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; }
  .kpi-blue   { border-left: 4px solid #2563eb; }
  .kpi-green  { border-left: 4px solid #16a34a; }
  .kpi-teal   { border-left: 4px solid #0d9488; }
  .kpi-purple { border-left: 4px solid #9333ea; }
  .kpi-orange { border-left: 4px solid #ea580c; }
  .kpi-violet { border-left: 4px solid #7c3aed; }

  /* ── Charts row ─────────────────────────────────────────────────────────*/
  .charts-row { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
  @media (max-width: 768px) { .charts-row { grid-template-columns: 1fr; } }

  .chart-card {
    background: white; border: 1px solid #e2e8f0; border-radius: 14px;
    padding: 1.1rem; display: flex; flex-direction: column; gap: 0.75rem;
    box-shadow: 0 1px 4px rgba(0,0,0,0.05);
  }
  .chart-card-wide { grid-column: 1 / -1; }
  .chart-title { font-size: 0.88rem; font-weight: 700; color: #1e293b; margin: 0; }
  .chart-empty { font-size: 0.78rem; color: #94a3b8; text-align: center; padding: 1.5rem 0; }

  /* ── Horizontal Bar ─────────────────────────────────────────────────────*/
  .hbar-list { display: flex; flex-direction: column; gap: 0.45rem; }
  .hbar-item { display: flex; align-items: center; gap: 0.6rem; }
  .hbar-label { font-size: 0.72rem; color: #64748b; width: 90px; text-align: right; flex-shrink: 0; font-weight: 500; }
  .hbar-label-wide { width: 200px; text-align: left; }
  .hbar-track { flex: 1; height: 8px; background: #f1f5f9; border-radius: 4px; overflow: hidden; border: 1px solid #e2e8f0; }
  .hbar-track-wide { flex: 1; }
  .hbar-fill { height: 100%; border-radius: 4px; transition: width 0.5s ease; }
  .hbar-val { font-size: 0.72rem; font-weight: 700; color: #475569; width: 24px; text-align: right; }

  /* ── Prioridad ───────────────────────────────────────────────────────────*/
  .prio-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.5rem; }
  .prio-cell {
    background: #f8fafc; border: 2px solid; border-radius: 10px;
    padding: 0.6rem 0.4rem; text-align: center; display: flex; flex-direction: column; align-items: center; gap: 0.1rem;
  }
  .prio-count { font-size: 1.4rem; font-weight: 800; line-height: 1; }
  .prio-label { font-size: 0.65rem; color: #64748b; font-weight: 600; text-transform: uppercase; }
  .prio-pct { font-size: 0.65rem; color: #94a3b8; }

  /* Donut */
  .donut-wrap { display: flex; justify-content: center; margin-top: 0.5rem; }
  .donut {
    width: 90px; height: 90px; border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
  }
  .donut-hole {
    width: 60px; height: 60px; border-radius: 50%; background: white;
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    box-shadow: 0 0 0 2px #f1f5f9;
  }
  .donut-total { font-size: 1.1rem; font-weight: 800; color: #1e293b; line-height: 1; }
  .donut-total-label { font-size: 0.55rem; color: #94a3b8; font-weight: 600; }

  /* ── Trend Chart ─────────────────────────────────────────────────────────*/
  .legend-row { display: flex; gap: 1rem; }
  .legend-item { display: flex; align-items: center; gap: 0.3rem; font-size: 0.72rem; color: #64748b; }
  .legend-dot { width: 10px; height: 10px; border-radius: 2px; }

  .trend-chart {
    display: flex; align-items: flex-end; gap: 0.5rem;
    height: 160px; border-bottom: 1px solid #e2e8f0;
    padding-bottom: 0;
    overflow-x: auto;
  }
  .trend-col { display: flex; flex-direction: column; align-items: center; gap: 0.3rem; flex-shrink: 0; min-width: 48px; }
  .trend-bars { display: flex; align-items: flex-end; gap: 2px; }
  .trend-bar { width: 10px; border-radius: 3px 3px 0 0; min-height: 2px; transition: height 0.4s ease; }
  .trend-bar-req { background: #2563eb; }
  .trend-bar-res { background: #22c55e; }
  .trend-bar-vis { background: #f59e0b; }
  .trend-label { font-size: 0.62rem; color: #64748b; white-space: nowrap; }

  /* ── Summary Table ───────────────────────────────────────────────────────*/
  .summary-table-wrap { overflow-x: auto; }
  .summary-table { width: 100%; border-collapse: collapse; font-size: 0.78rem; }
  .summary-table thead { background: #f8fafc; }
  .summary-table th {
    padding: 0.55rem 0.75rem; text-align: left; font-weight: 700;
    color: #64748b; font-size: 0.68rem; text-transform: uppercase; letter-spacing: 0.04em;
    border-bottom: 2px solid #e2e8f0; white-space: nowrap;
  }
  .summary-table td { padding: 0.55rem 0.75rem; border-bottom: 1px solid #f1f5f9; color: #334155; vertical-align: middle; }
  .summary-table tr:hover td { background: #f8fafc; }
  .trw-comuna { color: #1e293b; }
  .trw-num { text-align: center; font-weight: 700; color: #64748b; }
  .trw-reqs { color: #2563eb !important; }
  .mini-bar-table { display: inline-block; width: 60px; height: 6px; background: #e2e8f0; border-radius: 3px; overflow: hidden; vertical-align: middle; margin-right: 0.3rem; }
  .mini-bar-fill { height: 100%; background: #2563eb; border-radius: 3px; }
  .trw-pct { font-size: 0.65rem; color: #94a3b8; vertical-align: middle; }

  /* ── Footer ─────────────────────────────────────────────────────────────*/
  .db-footer {
    display: flex; justify-content: space-between; align-items: center;
    padding: 0.5rem 0; border-top: 1px solid #e2e8f0;
    font-size: 0.65rem; color: #94a3b8; flex-wrap: wrap; gap: 0.3rem;
  }
</style>

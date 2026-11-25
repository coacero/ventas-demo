import { APP_CONFIG } from "./config.js";
import { GraphClient } from "./graph-client.mjs";
import {
  CLOSE_CONDITIONS,
  DOC_STATES,
  ORIGIN_REASONS,
  ROLES,
  buildPartialInvoicePlan,
  canAddProductLine,
  computeElapsedDays,
  computeLineMetrics,
  filterSalesReportDocs,
  getRoleCapabilities,
  mapDispatchDeliveryStatus,
  nextOrderCode,
  resolveCommercialRole,
  syncPaymentTerms,
  validateDiscardReason,
  validatePriceUpdate,
} from "./role-policy.mjs";

const DEMO_DATA = {
  clientes: [
    { id: "1", Title: "CONSTRUCTORA DEL SUR, S.A.", NIT: "4589123-4", Correo: "compras@consur.gt", Telefono: "2234-5500", DireccionEntrega: "Km 14.5 Carretera a El Salvador" },
    { id: "2", Title: "ACEROS DEL NORTE, S.A.", NIT: "8871204-1", Correo: "pagos@acerosnorte.gt", Telefono: "2410-8800", DireccionEntrega: "Zona 12, Calz. Aguilar Batres" },
    { id: "3", Title: "INGENIERIA CENTRAL", NIT: "6120934-9", Correo: "proyectos@ingcentral.gt", Telefono: "5512-3344", DireccionEntrega: "Zona 4, Mixco" },
    { id: "4", Title: "FERRETERIA LA ECONOMICA", NIT: "1948271-2", Correo: "pedidos@laeconomica.gt", Telefono: "7765-1122", DireccionEntrega: "Quetzaltenango, Zona 3" },
  ],
  productos: [
    { id: "10", CodigoInterno: "VAR-38-6M", CodigoExterno: "38001", Title: "Varilla Corrugada 3/8 x 6m", UnidadesPorAtado: 10, UnidadesPorQuintal: 36, TipoItem: "Producto", PrecioReferencia: 34.5, PrecioCredito: 36.0, PrecioMinimoGerencia: 32.5 },
    { id: "11", CodigoInterno: "VAR-12-6M", CodigoExterno: "12001", Title: "Varilla Corrugada 1/2 x 6m", UnidadesPorAtado: 6, UnidadesPorQuintal: 20, TipoItem: "Producto", PrecioReferencia: 61.0, PrecioCredito: 63.5, PrecioMinimoGerencia: 58.0 },
    { id: "12", CodigoInterno: "LAM-GALV-12", CodigoExterno: "LG012", Title: "Lámina Galvanizada C-26 12 pies", UnidadesPorAtado: 10, UnidadesPorQuintal: 12, TipoItem: "Producto", PrecioReferencia: 112.0, PrecioCredito: 116.0, PrecioMinimoGerencia: 106.0 },
    { id: "61", CodigoInterno: "FLETE", CodigoExterno: "SRV-FLT", Title: "Servicio de Flete / Transporte", UnidadesPorAtado: 0, UnidadesPorQuintal: 0, TipoItem: "Servicio", PrecioReferencia: 450.0, PrecioCredito: 450.0, PrecioMinimoGerencia: 350.0 },
  ],
  documentos: [
    { id: "101", Title: "CO-0143", CorrelativoBase: 143, Estado: "Borrador", ClienteNombre: "ACEROS DEL NORTE, S.A.", VendedorNombre: "Juan Pablo", VendedorEmail: "juanpablo@coacero.com.gt", FormaPago: "Contado", DiasCredito: 0, TotalDocumento: 11200, TotalQuintales: 95.5, AlertaPrecioMinimo: false, Created: "2026-11-23T14:00:00Z" },
    { id: "102", Title: "CO-0142", CorrelativoBase: 142, Estado: "Presentada", ClienteNombre: "CONSTRUCTORA DEL SUR, S.A.", VendedorNombre: "Juan Pablo", VendedorEmail: "juanpablo@coacero.com.gt", FormaPago: "Credito", DiasCredito: 30, TotalDocumento: 24800, TotalQuintales: 210.0, AlertaPrecioMinimo: false, FechaVencimiento: "2026-11-28", Created: "2026-11-22T10:30:00Z" },
    {
      id: "103",
      Title: "OC-0089",
      CorrelativoBase: 139,
      Estado: "Facturar",
      ClienteId: "3",
      ClienteNombre: "INGENIERIA CENTRAL",
      VendedorNombre: "Sergio",
      VendedorEmail: "sergio@coacero.com.gt",
      FormaPago: "Contado",
      DiasCredito: 0,
      TotalDocumento: 13800,
      TotalQuintales: 11.49,
      AlertaPrecioMinimo: true,
      FechaConversionOC: "2026-11-23T16:15:00Z",
      Created: "2026-11-20T09:00:00Z",
      lines: [
        { id: "103-1", ProductoId: "10", CodigoInterno: "VAR-38-6M", Title: "Varilla Corrugada 3/8 x 6m", TipoItem: "Producto", UnidadesPorAtado: 10, UnidadesPorQuintal: 36, CantidadUnidades: 200, CantidadAtados: 20, PesoQuintales: 5.56, PrecioUnitario: 34.5, SubtotalLinea: 6900 },
        { id: "103-2", ProductoId: "11", CodigoInterno: "VAR-12-6M", Title: "Varilla Corrugada 1/2 x 6m", TipoItem: "Producto", UnidadesPorAtado: 6, UnidadesPorQuintal: 20, CantidadUnidades: 100, CantidadAtados: 16.67, PesoQuintales: 5.0, PrecioUnitario: 60.0, SubtotalLinea: 6000 },
        { id: "103-3", ProductoId: "61", CodigoInterno: "FLETE", Title: "Servicio de Flete / Transporte", TipoItem: "Servicio", UnidadesPorAtado: 0, UnidadesPorQuintal: 0, CantidadUnidades: 1, CantidadAtados: 0, PesoQuintales: 0, PrecioUnitario: 900, SubtotalLinea: 900 },
      ],
    },
    {
      id: "107",
      Title: "OC-0090",
      CorrelativoBase: 144,
      Estado: "Facturar",
      DocumentoOrigenId: "106",
      CodigoOCOrigen: "OC-0079",
      MotivoOrigen: "ExistenciaInsuficiente",
      NotaFacturacion: "Pendiente reposición de lámina C-26 en bodega",
      ClienteId: "4",
      ClienteNombre: "FERRETERIA LA ECONOMICA",
      VendedorNombre: "Sergio",
      VendedorEmail: "sergio@coacero.com.gt",
      FormaPago: "Credito",
      DiasCredito: 30,
      TotalDocumento: 5600,
      TotalQuintales: 4.17,
      AlertaPrecioMinimo: false,
      FechaConversionOC: "2026-11-24T10:15:00Z",
      Created: "2026-11-24T10:15:00Z",
      lines: [
        { id: "107-1", ProductoId: "12", CodigoInterno: "LAM-GALV-12", Title: "Lámina Galvanizada C-26 12 pies", TipoItem: "Producto", UnidadesPorAtado: 10, UnidadesPorQuintal: 12, CantidadSolicitadaOriginal: 100, CantidadUnidades: 50, CantidadAtados: 5, PesoQuintales: 4.17, PrecioUnitario: 112.0, SubtotalLinea: 5600, MotivoOrigen: "ExistenciaInsuficiente" },
      ],
    },
    { id: "104", Title: "DE-0085", CorrelativoBase: 135, NumeroFactura: "14412", Estado: "Facturado", EstadoDespacho: "Enviado", ClienteNombre: "ACEROS DEL NORTE, S.A.", VendedorNombre: "Julio", VendedorEmail: "julio@coacero.com.gt", FormaPago: "Credito", DiasCredito: 30, FechaFacturacion: "2026-11-06T11:00:00Z", TotalDocumento: 32400, TotalQuintales: 280.0, AlertaPrecioMinimo: false, Pagada: false, UrlPdfEnvio: "https://coacerogt.sharepoint.com/sites/despachos/Documentos%20compartidos/ControlDespachos/Despachos_pdf/14412.pdf" },
    { id: "105", Title: "DE-0083", CorrelativoBase: 133, NumeroFactura: "14410", Estado: "Facturado", EstadoDespacho: "Entregado", ClienteNombre: "CONSTRUCTORA DEL SUR, S.A.", VendedorNombre: "Juan Pablo", VendedorEmail: "juanpablo@coacero.com.gt", FormaPago: "Contado", DiasCredito: 0, FechaFacturacion: "2026-11-19T15:20:00Z", TotalDocumento: 45100, TotalQuintales: 390.0, AlertaPrecioMinimo: false, Pagada: true, UrlPdfEnvio: "https://coacerogt.sharepoint.com/sites/despachos/Documentos%20compartidos/ControlDespachos/Despachos_pdf/14410.pdf" },
    { id: "106", Title: "DE-0079", CorrelativoBase: 129, NumeroFactura: "14392", Estado: "Facturado", EstadoDespacho: "Faltantes", CondicionCierre: "ExistenciaInsuficientePendiente", NotaFacturacion: "Se facturaron 50 láminas en existencia; 50 pasaron a OC-0090", ClienteNombre: "FERRETERIA LA ECONOMICA", VendedorNombre: "Sergio", VendedorEmail: "sergio@coacero.com.gt", FormaPago: "Credito", DiasCredito: 30, FechaFacturacion: "2026-10-20T09:40:00Z", TotalDocumento: 28600, TotalQuintales: 245.0, AlertaPrecioMinimo: true, Pagada: false, UrlPdfEnvio: "" },
  ],
};

const state = {
  isDemo: new URLSearchParams(window.location.search).get("demo") === "1" || APP_CONFIG.demoMode,
  msalApp: null,
  account: null,
  graph: null,
  role: ROLES.CONSULTA,
  caps: getRoleCapabilities(ROLES.CONSULTA),
  activeTab: "docs",
  stateFilter: "ALL",
  searchText: "",
  documentos: [],
  clientes: [],
  productos: [],
  precios: [],
  report: {
    mode: "sales",
    fromDate: "",
    toDate: "",
    selectedClients: [],
    clientSearch: "",
  },
  editingDocId: null,
  editingLines: [],
  invoicingDocId: null,
  invoicingLines: [],
  invoicingQtyMap: {},
};

const $ = (id) => document.getElementById(id);

function fmtQ(n) {
  return `Q ${(Number(n) || 0).toLocaleString("es-GT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("es-GT");
}

function showToast(msg) {
  const el = $("toast");
  el.textContent = msg;
  el.classList.remove("hidden");
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => el.classList.add("hidden"), 3200);
}

function updateOnlineBanner() {
  $("offlineBanner").classList.toggle("hidden", navigator.onLine);
}

function getTabsForRole(role) {
  if (role === ROLES.GERENCIA) {
    return [
      { id: "credit", label: "Facturas y Crédito" },
      { id: "docs", label: "Cotizaciones y Ventas" },
      { id: "report", label: "Reporte Cliente / Período" },
      { id: "catalog", label: "Precios" },
    ];
  }
  if (role === ROLES.FACTURACION) {
    return [
      { id: "inbox", label: "Bandeja Facturar (OC)" },
      { id: "credit", label: "Facturas y Crédito" },
      { id: "report", label: "Reporte Cliente / Período" },
      { id: "catalog", label: "Precios" },
    ];
  }
  return [
    { id: "docs", label: "Mis Cotizaciones" },
    { id: "report", label: "Mi Reporte" },
    { id: "clients", label: "Mis Clientes" },
    { id: "catalog", label: "Catálogo" },
  ];
}

function renderTabs() {
  const tabs = getTabsForRole(state.role);
  if (!tabs.some((t) => t.id === state.activeTab)) {
    state.activeTab = tabs[0].id;
  }

  $("desktopTabs").innerHTML = tabs
    .map((t) => `<button class="tab-btn ${t.id === state.activeTab ? "active" : ""}" data-tab="${t.id}">${t.label}</button>`)
    .join("");
  $("mobileBottomNav").innerHTML = tabs
    .map((t) => `<button class="${t.id === state.activeTab ? "active" : ""}" data-tab="${t.id}">${t.label}</button>`)
    .join("");
  $("mobileBottomNav").classList.remove("hidden");

  document.querySelectorAll("[data-tab]").forEach((btn) => {
    btn.onclick = () => {
      state.activeTab = btn.dataset.tab;
      state.stateFilter = "ALL";
      renderAll();
    };
  });
}

function renderKpis() {
  const docs = visibleDocsForUser();
  const borradores = docs.filter((d) => d.Estado === DOC_STATES.BORRADOR).length;
  const abiertas = docs.filter((d) => d.Estado === DOC_STATES.PRESENTADA).length;
  const porFacturar = docs.filter((d) => d.Estado === DOC_STATES.FACTURAR).length;
  const facturadas = docs.filter((d) => d.Estado === DOC_STATES.FACTURADO);
  const totalFacturado = facturadas.reduce((s, d) => s + (Number(d.TotalDocumento) || 0), 0);
  const pendCobro = facturadas.filter((d) => !d.Pagada).reduce((s, d) => s + (Number(d.TotalDocumento) || 0), 0);
  const vencidas = facturadas.filter((d) => !d.Pagada && (computeElapsedDays(d.FechaFacturacion) ?? 0) > (Number(d.DiasCredito) || 30)).length;

  let cards = [];
  if (state.role === ROLES.VENDEDOR) {
    const totalCot = docs.filter((d) => d.Estado === DOC_STATES.PRESENTADA || d.Estado === DOC_STATES.FACTURAR)
      .reduce((s, d) => s + (Number(d.TotalDocumento) || 0), 0);
    cards = [
      { label: "Borradores", value: borradores },
      { label: "Presentadas (CO)", value: abiertas },
      { label: "En Facturación (OC)", value: porFacturar },
      { label: "Total Activo", value: fmtQ(totalCot) },
    ];
  } else {
    cards = [
      { label: "Por Facturar (OC)", value: porFacturar },
      { label: "Facturado", value: fmtQ(totalFacturado) },
      { label: "Pendiente de Cobro", value: fmtQ(pendCobro) },
      { label: "Crédito Vencido", value: vencidas },
    ];
  }

  $("kpiGrid").innerHTML = cards
    .map((c) => `<div class="kpi-card"><div class="kpi-label">${c.label}</div><div class="kpi-value">${c.value}</div></div>`)
    .join("");
}

function visibleDocsForUser() {
  if (state.caps.canViewAllSellers) return state.documentos;
  const email = (state.account?.username || "juanpablo@coacero.com.gt").toLowerCase();
  return state.documentos.filter((d) => String(d.VendedorEmail || "").toLowerCase() === email);
}

function stateBadge(estado) {
  const map = {
    Borrador: "badge-neutral",
    Presentada: "badge-info",
    Facturar: "badge-warning",
    Facturado: "badge-success",
    Descartada: "badge-danger",
    Anulada: "badge-danger",
  };
  return `<span class="badge ${map[estado] || "badge-neutral"}">${estado || "—"}</span>`;
}

function dispatchBadge(doc) {
  if (doc.Estado !== DOC_STATES.FACTURADO) return "";
  const info = mapDispatchDeliveryStatus(doc.EstadoDespacho);
  return info ? `<span class="badge ${info.cls}" title="Estado en Despachos">${info.label}</span>` : "";
}

function shortageBadge(doc) {
  const badges = [];
  if (
    doc.Estado === DOC_STATES.FACTURADO &&
    (doc.CondicionCierre === CLOSE_CONDITIONS.EXISTENCIA_INSUFICIENTE_CERRADA ||
      doc.CondicionCierre === CLOSE_CONDITIONS.EXISTENCIA_INSUFICIENTE_PENDIENTE)
  ) {
    const title = doc.CondicionCierre === CLOSE_CONDITIONS.EXISTENCIA_INSUFICIENTE_PENDIENTE
      ? "Facturación parcial: saldo quedó pendiente en otra OC"
      : "Facturación parcial: saldo cerrado por falta de existencia";
    badges.push(`<span class="badge badge-warning" title="${title}">Existencia insuficiente</span>`);
  }
  if (doc.MotivoOrigen === ORIGIN_REASONS.EXISTENCIA_INSUFICIENTE) {
    const ref = doc.CodigoOCOrigen ? `Ref: ${doc.CodigoOCOrigen}` : "Saldo existencia";
    badges.push(`<span class="badge badge-info" title="OC generada por faltante de existencia">${ref}</span>`);
  }
  return badges.join(" ");
}

function elapsedBadge(doc) {
  const days = computeElapsedDays(doc.FechaFacturacion);
  if (days === null) return "—";
  const limit = Number(doc.DiasCredito) || 30;
  let cls = "badge-success";
  if (!doc.Pagada && days > limit) cls = "badge-danger";
  else if (!doc.Pagada && days >= Math.floor(limit * 0.6)) cls = "badge-warning";
  return `<span class="badge ${cls}">${days} días</span>`;
}

function renderDocumentsView() {
  const isCreditTab = state.activeTab === "credit";
  const isInboxTab = state.activeTab === "inbox";

  let docs = visibleDocsForUser();
  if (isCreditTab) docs = docs.filter((d) => d.Estado === DOC_STATES.FACTURADO);
  else if (isInboxTab) docs = docs.filter((d) => d.Estado === DOC_STATES.FACTURAR);

  // Chips
  const chips = isCreditTab
    ? [
        { id: "ALL", label: "Todas" },
        { id: "UNPAID", label: "Por Cobrar" },
        { id: "PAID", label: "Pagadas" },
      ]
    : isInboxTab
      ? [
          { id: "ALL", label: "Pendientes de Facturar" },
          { id: "SHORTAGE_PENDING", label: "Por Existencia" },
        ]
      : [
          { id: "ALL", label: "Todos" },
          { id: DOC_STATES.BORRADOR, label: "Borrador" },
          { id: DOC_STATES.PRESENTADA, label: "Presentada" },
          { id: DOC_STATES.FACTURAR, label: "Facturar" },
          { id: "SHORTAGE_PENDING", label: "Saldo Existencia" },
          { id: DOC_STATES.FACTURADO, label: "Facturado" },
          { id: DOC_STATES.DESCARTADA, label: "Descartada" },
        ];

  $("stateChips").innerHTML = chips
    .map((c) => `<button class="chip ${state.stateFilter === c.id ? "active" : ""}" data-chip="${c.id}">${c.label}</button>`)
    .join("");
  document.querySelectorAll("[data-chip]").forEach((btn) => {
    btn.onclick = () => {
      state.stateFilter = btn.dataset.chip;
      renderDocumentsView();
    };
  });

  if (state.stateFilter === "UNPAID") docs = docs.filter((d) => !d.Pagada);
  else if (state.stateFilter === "PAID") docs = docs.filter((d) => Boolean(d.Pagada));
  else if (state.stateFilter === "SHORTAGE_PENDING") {
    docs = docs.filter((d) => d.Estado === DOC_STATES.FACTURAR && d.MotivoOrigen === ORIGIN_REASONS.EXISTENCIA_INSUFICIENTE);
  }
  else if (state.stateFilter !== "ALL") docs = docs.filter((d) => d.Estado === state.stateFilter);

  const q = state.searchText.trim().toLowerCase();
  if (q) {
    docs = docs.filter((d) =>
      [d.Title, d.NumeroFactura, d.ClienteNombre, d.VendedorNombre, d.OCCliente, d.CodigoOCOrigen]
        .some((v) => String(v || "").toLowerCase().includes(q))
    );
  }

  $("btnExportDocs").classList.toggle("hidden", !state.caps.canExportExcel);
  $("btnExportDocs").onclick = () => exportCsv(docs, "ventas-documentos.csv");

  if (isCreditTab) {
    $("docsTableHead").innerHTML = `
      <tr>
        <th>Factura / Ref</th>
        <th>Cliente</th>
        <th>Vendedor</th>
        <th>Fecha Fact.</th>
        <th class="num">Total</th>
        <th>Días Transc.</th>
        <th>Pagada</th>
      </tr>`;
  } else {
    $("docsTableHead").innerHTML = `
      <tr>
        <th>Código</th>
        <th>Cliente</th>
        <th>Vendedor</th>
        <th>Pago</th>
        <th>Estado</th>
        <th class="num">Total</th>
      </tr>`;
  }

  $("docsTableBody").innerHTML = docs.length
    ? docs.map((d, idx) => renderDocRow(d, isCreditTab, idx)).join("")
    : `<tr><td colspan="${isCreditTab ? 7 : 6}" class="muted">No hay registros que coincidan con el filtro.</td></tr>`;

  $("docsMobileCards").innerHTML = docs.length
    ? docs.map((d) => renderDocMobileCard(d, isCreditTab)).join("")
    : `<p class="muted">No hay registros que coincidan con el filtro.</p>`;

  bindDocActions();
}

function buildDocActionButtons(d) {
  const btns = [];
  if (d.Estado === DOC_STATES.BORRADOR && state.caps.canEditOwnQuote) {
    btns.push(`<button class="btn btn-sm btn-secondary" data-edit="${d.id}">Editar</button>`);
    btns.push(`<button class="btn btn-sm btn-primary" data-send="${d.id}">Enviar</button>`);
    btns.push(`<button class="btn btn-sm btn-danger" data-discard="${d.id}">Descartar</button>`);
  }
  if (d.Estado === DOC_STATES.PRESENTADA && state.caps.canEditOwnQuote) {
    btns.push(`<button class="btn btn-sm btn-success" data-to-oc="${d.id}">Pasar a Facturar</button>`);
    btns.push(`<button class="btn btn-sm btn-primary" data-send="${d.id}">Reenviar</button>`);
    btns.push(`<button class="btn btn-sm btn-danger" data-discard="${d.id}">Descartar</button>`);
  }
  if (d.Estado === DOC_STATES.FACTURAR && state.caps.canInvoice) {
    btns.push(`<button class="btn btn-sm btn-success" data-invoice="${d.id}">Facturar</button>`);
  }
  if (
    d.Estado === DOC_STATES.FACTURAR &&
    d.MotivoOrigen === ORIGIN_REASONS.EXISTENCIA_INSUFICIENTE &&
    (state.caps.canInvoice || state.caps.canEditOwnQuote)
  ) {
    btns.push(`<button class="btn btn-sm btn-danger" data-discard="${d.id}">Descartar</button>`);
  }
  if (d.UrlPdfCotizacion && d.Estado !== DOC_STATES.FACTURADO) {
    btns.push(`<a class="btn btn-sm btn-secondary" href="${d.UrlPdfCotizacion}" target="_blank" rel="noopener">PDF</a>`);
  }
  // Regla explícita: Imprimir Envío solo visible para Facturación, nunca para Gerencia
  if (d.Estado === DOC_STATES.FACTURADO && state.caps.canPrintShippingOrder) {
    btns.push(`<button type="button" class="btn btn-sm btn-primary" data-print-envio="${d.id}">Imprimir Envío</button>`);
  }
  return btns.join(" ");
}

function renderPaidSwitch(d) {
  const cls = d.Pagada ? "paid" : "unpaid";
  const label = d.Pagada ? "Pagada" : "Pendiente";
  if (!state.caps.canTogglePaid) return `<span class="badge ${d.Pagada ? "badge-success" : "badge-warning"}">${label}</span>`;
  return `<button class="switch-btn ${cls}" data-toggle-paid="${d.id}">${label}</button>`;
}

function renderDocRow(d, isCreditTab, idx = 0) {
  const ref = d.NumeroFactura ? `#${d.NumeroFactura} (${d.Title || ""})` : d.Title || `BORR-${d.id}`;
  const refBtn = `<button type="button" class="doc-link-btn" data-view-doc="${d.id}">${ref}</button>`;
  const actionsHtml = buildDocActionButtons(d);
  const hasActions = Boolean(actionsHtml);
  const cols = isCreditTab ? 7 : 6;
  const bandCls = idx % 2 === 1 ? "doc-band-odd" : "doc-band-even";
  const actionsRow = hasActions
    ? `<tr class="doc-actions-row ${bandCls}"><td colspan="${cols}"><div class="doc-actions-bar">${actionsHtml}</div></td></tr>`
    : "";

  if (isCreditTab) {
    return `
      <tr class="${bandCls} ${hasActions ? "doc-main-row" : ""}">
        <td>${refBtn}</td>
        <td>${d.ClienteNombre || "—"}</td>
        <td>${d.VendedorNombre || "—"}</td>
        <td>${fmtDate(d.FechaFacturacion)}</td>
        <td class="num">${fmtQ(d.TotalDocumento)}</td>
        <td>${elapsedBadge(d)} ${dispatchBadge(d)} ${shortageBadge(d)}</td>
        <td>${renderPaidSwitch(d)}</td>
      </tr>${actionsRow}`;
  }
  return `
    <tr class="${bandCls} ${hasActions ? "doc-main-row" : ""}">
      <td>${refBtn}</td>
      <td>${d.ClienteNombre || "—"}</td>
      <td>${d.VendedorNombre || "—"}</td>
      <td>${d.FormaPago || "Contado"}${d.DiasCredito ? ` (${d.DiasCredito}d)` : ""}</td>
      <td>${stateBadge(d.Estado)} ${dispatchBadge(d)} ${shortageBadge(d)} ${d.AlertaPrecioMinimo && state.caps.canViewPricesAlert ? '<span class="badge badge-danger" title="Precio ofrecido menor al mínimo de Gerencia">Bajo mínimo</span>' : ""}</td>
      <td class="num">${fmtQ(d.TotalDocumento)}</td>
    </tr>${actionsRow}`;
}

function renderDocMobileCard(d, isCreditTab) {
  const ref = d.NumeroFactura ? `Factura #${d.NumeroFactura} · ${d.Title || ""}` : d.Title || `Borrador #${d.id}`;
  return `
    <div class="mobile-card">
      <div class="mobile-card-top">
        <div>
          <button type="button" class="doc-link-btn" data-view-doc="${d.id}">${ref}</button>
          <div class="mobile-card-meta">${d.ClienteNombre || "—"}</div>
        </div>
        <div>${isCreditTab ? elapsedBadge(d) : stateBadge(d.Estado)} ${dispatchBadge(d)} ${shortageBadge(d)}</div>
      </div>
      <div class="mobile-card-meta">
        Vendedor: ${d.VendedorNombre || "—"} · ${fmtQ(d.TotalDocumento)}
        ${isCreditTab ? ` · Facturada: ${fmtDate(d.FechaFacturacion)}` : ""}
      </div>
      <div class="mobile-card-actions">
        ${isCreditTab ? renderPaidSwitch(d) : ""}
        ${buildDocActionButtons(d)}
      </div>
    </div>`;
}

function bindDocActions() {
  document.querySelectorAll("[data-view-doc]").forEach((btn) => {
    btn.onclick = () => openDocDetailModal(btn.dataset.viewDoc);
  });
  document.querySelectorAll("[data-send]").forEach((btn) => {
    btn.onclick = () => openSendQuoteModal(btn.dataset.send);
  });
  document.querySelectorAll("[data-discard]").forEach((btn) => {
    btn.onclick = () => openDiscardModal(btn.dataset.discard);
  });
  document.querySelectorAll("[data-to-oc]").forEach((btn) => {
    btn.onclick = () => openToOcModal(btn.dataset.toOc);
  });
  document.querySelectorAll("[data-print-envio]").forEach((btn) => {
    btn.onclick = () => openPrintShippingModal(btn.dataset.printEnvio);
  });
  document.querySelectorAll("[data-edit]").forEach((btn) => {
    btn.onclick = () => openQuoteModal(btn.dataset.edit);
  });
  document.querySelectorAll("[data-invoice]").forEach((btn) => {
    btn.onclick = () => openInvoiceModal(btn.dataset.invoice);
  });
  document.querySelectorAll("[data-toggle-paid]").forEach((btn) => {
    btn.onclick = () => togglePaid(btn.dataset.togglePaid);
  });
}

async function openPrintShippingModal(docId) {
  if (!state.caps.canPrintShippingOrder) return;
  const doc = state.documentos.find((d) => String(d.id) === String(docId));
  if (!doc) return;
  const code = doc.NumeroFactura ? `Factura #${doc.NumeroFactura}` : doc.Title || `#${doc.id}`;
  $("docDetailTitle").textContent = `Orden de Envío · ${code}`;
  $("docDetailBody").innerHTML = `<p class="muted">Cargando materiales...</p>`;
  $("docDetailFooter").innerHTML = "";
  $("docDetailModal").classList.remove("hidden");

  let lines = doc.lines || [];
  if (!state.isDemo && state.graph && !lines.length) {
    try {
      lines = await state.graph.fetchLineas(doc.id);
    } catch {
      lines = [];
    }
  }
  if (state.isDemo && !lines.length) {
    lines = [
      { Title: "Varilla Corrugada 3/8 x 6m", TipoItem: "Producto", CantidadUnidades: 200, CantidadAtados: 20 },
      { Title: "Varilla Corrugada 1/2 x 6m", TipoItem: "Producto", CantidadUnidades: 120, CantidadAtados: 20 },
    ];
  }

  // Orden de Envío: estrictamente SIN precios, omitiendo servicios (ej. Flete)
  const prodLines = lines.filter((l) => (l.TipoItem || l.tipoItem || "Producto") !== "Servicio");
  const linesHtml = prodLines.length
    ? prodLines
        .map((l) => {
          const qty = Number(l.CantidadUnidades ?? l.cantidadUnidades ?? 0);
          const atados = Number(l.CantidadAtados ?? l.cantidadAtados ?? 0);
          return `
            <tr>
              <td>${l.Title || l.title || "Material"}</td>
              <td class="num"><strong>${qty}</strong></td>
              <td class="num">${atados > 0 ? atados.toFixed(2) : "—"}</td>
            </tr>`;
        })
        .join("")
    : `<tr><td colspan="3" class="muted">Sin materiales físicos registrados.</td></tr>`;

  $("docDetailBody").innerHTML = `
    <div class="doc-sheet">
      <div class="doc-sheet-head">
        <div>
          <img src="./assets/logo-coacero.png" alt="COACERO" style="height:30px;margin-bottom:4px;" />
          <div><strong style="font-size:1.05rem;">ORDEN DE ENVÍO DE MATERIALES · ${code}</strong></div>
          <div class="muted">Ref. Interna: ${doc.Title || "—"} · Fecha: ${fmtDate(doc.FechaFacturacion)}</div>
        </div>
      </div>
      <div class="doc-sheet-grid">
        <div><strong>Cliente</strong>${doc.ClienteNombre || "—"}</div>
        <div><strong>Vendedor</strong>${doc.VendedorNombre || "—"}</div>
        <div><strong>Dirección de Entrega</strong>${doc.DireccionEntrega || "—"}</div>
        <div><strong>Observaciones de Entrega</strong>${doc.ObservacionesEntrega || "—"}</div>
      </div>
      <div class="table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th>Material</th>
              <th class="num">Unidades</th>
              <th class="num">Atados / Manojos</th>
            </tr>
          </thead>
          <tbody>${linesHtml}</tbody>
        </table>
      </div>
      <div class="sign-grid">
        <div class="sign-box">Entregado por (Bodega / Piloto)</div>
        <div class="sign-box">Recibido conforme (Nombre, Firma y Fecha)</div>
      </div>
    </div>`;

  const btns = [`<button type="button" class="btn btn-primary" id="btnPrintEnvioNow">Imprimir Orden de Envío</button>`];
  if (!state.isDemo && doc.UrlPdfEnvio) {
    btns.push(`<a class="btn btn-secondary" href="${doc.UrlPdfEnvio}" target="_blank" rel="noopener">Abrir PDF SharePoint</a>`);
  }
  $("docDetailFooter").innerHTML = btns.join("");
  $("btnPrintEnvioNow").onclick = () => window.print();
}

async function openDocDetailModal(docId) {
  const doc = state.documentos.find((d) => String(d.id) === String(docId));
  if (!doc) return;
  const code = doc.NumeroFactura ? `Factura #${doc.NumeroFactura} (${doc.Title || ""})` : doc.Title || `Borrador #${doc.id}`;
  $("docDetailTitle").textContent = `Documento · ${code}`;
  $("docDetailBody").innerHTML = `<p class="muted">Cargando líneas...</p>`;
  $("docDetailFooter").innerHTML = "";
  $("docDetailModal").classList.remove("hidden");

  let lines = doc.lines || [];
  if (!state.isDemo && state.graph && !lines.length) {
    try {
      lines = await state.graph.fetchLineas(doc.id);
    } catch {
      lines = [];
    }
  }
  if (state.isDemo && !lines.length) {
    lines = [
      { Title: "Varilla Corrugada 3/8 x 6m", CantidadUnidades: 200, CantidadAtados: 20, PesoQuintales: 5.56, PrecioUnitario: 34.5, SubtotalLinea: 6900 },
      { Title: "Varilla Corrugada 1/2 x 6m", CantidadUnidades: 120, CantidadAtados: 20, PesoQuintales: 6.0, PrecioUnitario: 61.0, SubtotalLinea: 7320 },
    ];
  }

  const linesHtml = lines.length
    ? lines
        .map((l) => {
          const qty = Number(l.CantidadUnidades ?? l.cantidadUnidades ?? 0);
          const origQty = Number(l.CantidadSolicitadaOriginal ?? l.cantidadSolicitadaOriginal ?? 0);
          const qtyLabel = origQty > qty ? `${qty} <span class="muted">(de ${origQty})</span>` : `${qty}`;
          const atados = Number(l.CantidadAtados ?? l.cantidadAtados ?? 0);
          const qq = Number(l.PesoQuintales ?? l.pesoQuintales ?? 0);
          const unitPrice = Number(l.PrecioUnitario ?? l.precioUnitario ?? 0);
          const sub = Number(l.SubtotalLinea ?? qty * unitPrice);
          return `
            <tr>
              <td>${l.Title || l.title || "Material"}</td>
              <td class="num">${qtyLabel}</td>
              <td class="num">${atados.toFixed(2)}</td>
              <td class="num">${qq.toFixed(2)}</td>
              <td class="num">${fmtQ(unitPrice)}</td>
              <td class="num"><strong>${fmtQ(sub)}</strong></td>
            </tr>`;
        })
        .join("")
    : `<tr><td colspan="6" class="muted">Sin líneas registradas.</td></tr>`;

  $("docDetailBody").innerHTML = `
    <div class="doc-sheet">
      <div class="doc-sheet-head">
        <div>
          <img src="./assets/logo-coacero.png" alt="COACERO" style="height:32px;margin-bottom:4px;display:block;" />
          <strong style="font-size:1.05rem;">COACERO · ${code}</strong>
          <div class="muted">Emitido / Reg.: ${fmtDate(doc.FechaFacturacion || doc.FechaConversionOC || doc.Created)}</div>
        </div>
        <div>${stateBadge(doc.Estado)} ${dispatchBadge(doc)} ${shortageBadge(doc)}</div>
      </div>
      <div class="doc-sheet-grid">
        <div><strong>Cliente</strong>${doc.ClienteNombre || "—"} ${doc.ClienteNIT ? `(${doc.ClienteNIT})` : ""}</div>
        <div><strong>Vendedor</strong>${doc.VendedorNombre || "—"}</div>
        <div><strong>Forma de Pago</strong>${doc.FormaPago || "Contado"}${doc.DiasCredito ? ` (${doc.DiasCredito} días)` : ""}</div>
        <div><strong>OC Cliente</strong>${doc.OCCliente || "—"}</div>
        <div><strong>Dirección de Entrega</strong>${doc.DireccionEntrega || "—"}</div>
        <div><strong>Observaciones</strong>${doc.ObservacionesEntrega || "—"}</div>
        ${doc.CodigoOCOrigen ? `<div><strong>OC Origen (Existencia)</strong>${doc.CodigoOCOrigen}</div>` : ""}
        ${doc.NotaFacturacion ? `<div style="grid-column:1/-1;"><strong>Nota de Facturación</strong>${doc.NotaFacturacion}</div>` : ""}
        ${doc.MotivoDescarte ? `<div style="grid-column:1/-1;"><strong>Motivo de Descarte</strong><span style="color:var(--danger);">${doc.MotivoDescarte}</span></div>` : ""}
      </div>
      <div class="table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th>Material</th>
              <th class="num">Unid.</th>
              <th class="num">Atados</th>
              <th class="num">qq</th>
              <th class="num">P. Unit.</th>
              <th class="num">Subtotal</th>
            </tr>
          </thead>
          <tbody>${linesHtml}</tbody>
        </table>
      </div>
      <div class="doc-sheet-total">
        <span class="muted">Peso: ${(Number(doc.TotalQuintales) || 0).toFixed(2)} qq</span>
        <strong>Total: ${fmtQ(doc.TotalDocumento)}</strong>
      </div>
    </div>`;

  const footerBtns = [`<button type="button" class="btn btn-secondary" id="btnPrintDocDetail">Imprimir</button>`];
  if (doc.Estado === DOC_STATES.PRESENTADA && state.caps.canEditOwnQuote) {
    footerBtns.push(`<button type="button" class="btn btn-success" id="btnDetailToOc">Pasar a Facturar</button>`);
  }
  if (doc.Estado === DOC_STATES.FACTURAR && state.caps.canInvoice) {
    footerBtns.push(`<button type="button" class="btn btn-success" id="btnDetailToInvoice">Registrar Factura</button>`);
  }
  $("docDetailFooter").innerHTML = footerBtns.join("");
  $("btnPrintDocDetail").onclick = () => window.print();
  const toOcBtn = $("btnDetailToOc");
  if (toOcBtn) {
    toOcBtn.onclick = () => {
      $("docDetailModal").classList.add("hidden");
      openToOcModal(doc.id);
    };
  }
  const invBtn = $("btnDetailToInvoice");
  if (invBtn) {
    invBtn.onclick = () => {
      $("docDetailModal").classList.add("hidden");
      openInvoiceModal(doc.id);
    };
  }
}

async function togglePaid(docId) {
  const doc = state.documentos.find((d) => String(d.id) === String(docId));
  if (!doc) return;
  const nextPaid = !doc.Pagada;
  doc.Pagada = nextPaid;
  if (!state.isDemo && state.graph) {
    try {
      await state.graph.updateDocumento(doc.id, { Pagada: nextPaid });
      showToast(`Factura marcada como ${nextPaid ? "Pagada" : "Pendiente"}`);
    } catch (err) {
      doc.Pagada = !nextPaid;
      showToast(`No se pudo actualizar Pagada en SharePoint (${err.message}).`);
    }
  } else {
    showToast(`Vista demo: marcada como ${nextPaid ? "Pagada" : "Pendiente"}`);
  }
  renderAll();
}

function renderReportView() {
  const isShortageMode = state.report.mode === "shortages";
  $("btnReportSalesMode").classList.toggle("active", !isShortageMode);
  $("btnReportShortageMode").classList.toggle("active", isShortageMode);
  $("salesReportSection").classList.toggle("hidden", isShortageMode);
  $("shortageReportSection").classList.toggle("hidden", !isShortageMode);

  if (isShortageMode) {
    renderPendingShortageReport();
    return;
  }

  const docsPool = visibleDocsForUser().filter((d) => d.Estado === DOC_STATES.FACTURADO);
  const allClients = Array.from(new Set(docsPool.map((d) => d.ClienteNombre).filter(Boolean))).sort();
  const cFilter = state.report.clientSearch.trim().toLowerCase();
  const shownClients = cFilter ? allClients.filter((c) => c.toLowerCase().includes(cFilter)) : allClients;

  $("repClientsSummary").textContent =
    state.report.selectedClients.length === 0
      ? "Todos"
      : `${state.report.selectedClients.length} seleccionado(s)`;

  $("repClientChecklist").innerHTML = shownClients
    .map((c) => {
      const checked = state.report.selectedClients.includes(c) ? "checked" : "";
      return `<label class="client-check-item"><input type="checkbox" data-rep-client="${c}" ${checked} /><span>${c}</span></label>`;
    })
    .join("");

  document.querySelectorAll("[data-rep-client]").forEach((cb) => {
    cb.onchange = () => {
      const name = cb.dataset.repClient;
      if (cb.checked) {
        if (!state.report.selectedClients.includes(name)) state.report.selectedClients.push(name);
      } else {
        state.report.selectedClients = state.report.selectedClients.filter((x) => x !== name);
      }
      renderReportView();
    };
  });

  const filtered = filterSalesReportDocs(docsPool, {
    fromDate: state.report.fromDate,
    toDate: state.report.toDate,
    selectedClients: state.report.selectedClients,
    states: [DOC_STATES.FACTURADO],
  });

  const sumQ = filtered.reduce((s, d) => s + (Number(d.TotalDocumento) || 0), 0);
  const sumPend = filtered.filter((d) => !d.Pagada).reduce((s, d) => s + (Number(d.TotalDocumento) || 0), 0);
  $("reportSummaryBar").innerHTML = `
    <span><strong>Facturas:</strong> ${filtered.length}</span>
    <span><strong>Total vendido:</strong> ${fmtQ(sumQ)}</span>
    <span><strong>Pendiente cobro:</strong> ${fmtQ(sumPend)}</span>
  `;

  $("reportTableBody").innerHTML = filtered.length
    ? filtered
        .map((d) => {
          const days = computeElapsedDays(d.FechaFacturacion);
          return `
            <tr>
              <td><button type="button" class="doc-link-btn" data-view-doc="${d.id}">${d.NumeroFactura || d.Title || d.id}</button></td>
              <td>${fmtDate(d.FechaFacturacion)}</td>
              <td>${d.ClienteNombre || "—"}</td>
              <td>${d.VendedorNombre || "—"}</td>
              <td>${d.FormaPago || "Contado"}</td>
              <td>${days !== null ? `${days} d` : "—"}</td>
              <td>${d.Pagada ? "Pagada" : "Pendiente"}</td>
              <td class="num">${fmtQ(d.TotalDocumento)}</td>
            </tr>`;
        })
        .join("")
    : `<tr><td colspan="8" class="muted">Sin ventas en el período/clientes seleccionados.</td></tr>`;

  $("reportMobileCards").innerHTML = filtered.length
    ? filtered
        .map(
          (d) => `
          <div class="mobile-card">
            <div class="mobile-card-top">
              <strong>#${d.NumeroFactura || d.Title} · ${d.ClienteNombre}</strong>
              ${elapsedBadge(d)}
            </div>
            <div class="mobile-card-meta">${fmtDate(d.FechaFacturacion)} · ${d.VendedorNombre} · ${fmtQ(d.TotalDocumento)}</div>
          </div>`
        )
        .join("")
    : `<p class="muted">Sin ventas en el período/clientes seleccionados.</p>`;

  $("btnExportReport").onclick = () => exportCsv(filtered, "reporte-ventas-clientes.csv");
  bindDocActions();
}

async function renderPendingShortageReport() {
  const pendingDocs = visibleDocsForUser().filter(
    (d) => d.Estado === DOC_STATES.FACTURAR && d.MotivoOrigen === ORIGIN_REASONS.EXISTENCIA_INSUFICIENTE
  );

  // En modo SharePoint real, cargar líneas faltantes bajo demanda si aún no están en memoria
  if (!state.isDemo && state.graph) {
    await Promise.all(
      pendingDocs
        .filter((d) => !d.lines || !d.lines.length)
        .map(async (d) => {
          try {
            d.lines = await state.graph.fetchLineas(d.id);
          } catch {
            d.lines = [];
          }
        })
    );
  }

  const productMap = new Map();
  pendingDocs.forEach((doc) => {
    (doc.lines || []).forEach((l) => {
      const qty = Number(l.CantidadUnidades ?? 0);
      if (qty <= 0) return;
      const key = String(l.ProductoId || l.CodigoInterno || l.Title || "item");
      const current = productMap.get(key) || {
        Title: l.Title || "Material",
        Unidades: 0,
        Quintales: 0,
        Monto: 0,
        Ordenes: new Set(),
      };
      current.Unidades += qty;
      current.Quintales += Number(l.PesoQuintales ?? 0);
      current.Monto += Number(l.SubtotalLinea ?? qty * (Number(l.PrecioUnitario) || 0));
      current.Ordenes.add(doc.Title || doc.id);
      productMap.set(key, current);
    });
  });

  const productRows = [...productMap.values()].sort((a, b) => b.Unidades - a.Unidades);
  const totalPendQ = pendingDocs.reduce((s, d) => s + (Number(d.TotalDocumento) || 0), 0);
  const totalPendUnits = productRows.reduce((s, p) => s + p.Unidades, 0);

  $("shortageSummaryBar").innerHTML = `
    <span><strong>OC pendientes:</strong> ${pendingDocs.length}</span>
    <span><strong>Materiales distintos:</strong> ${productRows.length}</span>
    <span><strong>Unidades pendientes:</strong> ${totalPendUnits}</span>
    <span><strong>Monto pendiente:</strong> ${fmtQ(totalPendQ)}</span>
  `;

  $("shortageProductsBody").innerHTML = productRows.length
    ? productRows
        .map(
          (p) => `
          <tr>
            <td>${p.Title}</td>
            <td class="num"><strong>${p.Unidades}</strong></td>
            <td class="num">${p.Quintales.toFixed(2)}</td>
            <td class="num">${p.Ordenes.size}</td>
            <td class="num">${fmtQ(p.Monto)}</td>
          </tr>`
        )
        .join("")
    : `<tr><td colspan="5" class="muted">No hay materiales pendientes por existencia.</td></tr>`;

  $("shortageDocsBody").innerHTML = pendingDocs.length
    ? pendingDocs
        .map(
          (d) => `
          <tr>
            <td><button type="button" class="doc-link-btn" data-view-doc="${d.id}">${d.Title || d.id}</button></td>
            <td>${d.CodigoOCOrigen || "—"}</td>
            <td>${d.ClienteNombre || "—"}</td>
            <td>${d.VendedorNombre || "—"}</td>
            <td>${d.NotaFacturacion || "—"}</td>
            <td class="num">${fmtQ(d.TotalDocumento)}</td>
          </tr>`
        )
        .join("")
    : `<tr><td colspan="6" class="muted">No hay órdenes pendientes por existencia.</td></tr>`;

  $("shortageMobileCards").innerHTML = pendingDocs.length
    ? pendingDocs
        .map(
          (d) => `
          <div class="mobile-card">
            <div class="mobile-card-top">
              <button type="button" class="doc-link-btn" data-view-doc="${d.id}">${d.Title || d.id}</button>
              <span class="badge badge-info">Ref: ${d.CodigoOCOrigen || "—"}</span>
            </div>
            <div class="mobile-card-meta">${d.ClienteNombre || "—"} · ${d.VendedorNombre || "—"} · ${fmtQ(d.TotalDocumento)}</div>
            ${d.NotaFacturacion ? `<div class="mobile-card-meta">${d.NotaFacturacion}</div>` : ""}
          </div>`
        )
        .join("")
    : `<p class="muted">No hay órdenes pendientes por existencia.</p>`;

  $("btnExportShortageReport").onclick = () => {
    const csvRows = [
      ["OC_Pendiente", "OC_Origen", "Cliente", "Vendedor", "Nota", "Total_Q"],
      ...pendingDocs.map((d) => [
        d.Title || "",
        d.CodigoOCOrigen || "",
        d.ClienteNombre || "",
        d.VendedorNombre || "",
        d.NotaFacturacion || "",
        Number(d.TotalDocumento || 0).toFixed(2),
      ]),
    ];
    const csv = "\uFEFF" + csvRows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "pendientes-por-existencia.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  bindDocActions();
}

function renderClientsView() {
  const q = $("clientSearch").value.trim().toLowerCase();
  const list = state.clientes.filter((c) =>
    [c.Title, c.NIT, c.Correo].some((v) => String(v || "").toLowerCase().includes(q))
  );
  $("clientsList").innerHTML = list.length
    ? list
        .map(
          (c) => `
          <div class="mobile-card">
            <strong>${c.Title}</strong>
            <div class="mobile-card-meta">NIT: ${c.NIT || "CF"} · Tel: ${c.Telefono || "—"}</div>
            <div class="mobile-card-meta">${c.Correo || "—"}</div>
            <div class="mobile-card-meta">${c.DireccionEntrega || "—"}</div>
          </div>`
        )
        .join("")
    : `<p class="muted">No hay clientes registrados.</p>`;
}

function renderCatalogView() {
  const q = $("catalogSearch").value.trim().toLowerCase();
  const rows = state.productos.filter((p) =>
    [p.Title, p.CodigoInterno, p.CodigoExterno].some((v) => String(v || "").toLowerCase().includes(q))
  );

  const canEdit = Boolean(state.caps.canEditPrices);
  const inline = canEdit && Boolean(state.isEditingPricesInline);
  $("btnTogglePriceEdit").classList.toggle("hidden", !canEdit);
  $("btnTogglePriceEdit").textContent = inline ? "Cancelar" : "Editar Precios";
  $("btnSaveAllPrices").classList.toggle("hidden", !inline);

  $("catalogTableBody").innerHTML = rows
    .map((p) => {
      const std = Number(p.PrecioReferencia || 0).toFixed(2);
      const cred = Number(p.PrecioCredito || p.PrecioReferencia || 0).toFixed(2);
      const min = Number(p.PrecioMinimoGerencia || 0).toFixed(2);
      return `
      <tr>
        <td>${p.CodigoExterno || p.CodigoInterno || p.id}</td>
        <td>${
          canEdit && !inline
            ? `<button type="button" class="doc-link-btn" data-edit-price="${p.id}">${p.Title}</button>`
            : p.Title
        }</td>
        <td>${p.UnidadesPorAtado || 0}</td>
        <td class="num">${
          inline
            ? `<input type="number" min="0.01" step="0.01" class="inline-price-input" data-inline-std="${p.id}" value="${std}" />`
            : canEdit
              ? `<button type="button" class="price-cell-btn" data-inline-focus="std:${p.id}" title="Clic para editar precio">${fmtQ(p.PrecioReferencia)}</button>`
              : fmtQ(p.PrecioReferencia)
        }</td>
        <td class="num">${
          inline
            ? `<input type="number" min="0" step="0.01" class="inline-price-input" data-inline-cred="${p.id}" value="${cred}" />`
            : canEdit
              ? `<button type="button" class="price-cell-btn" data-inline-focus="cred:${p.id}" title="Clic para editar precio">${fmtQ(p.PrecioCredito || p.PrecioReferencia)}</button>`
              : fmtQ(p.PrecioCredito || p.PrecioReferencia)
        }</td>
        <td class="num">${
          inline
            ? `<input type="number" min="0" step="0.01" class="inline-price-input" data-inline-min="${p.id}" value="${min}" />`
            : canEdit
              ? `<button type="button" class="price-cell-btn" data-inline-focus="min:${p.id}" title="Clic para editar precio">${fmtQ(p.PrecioMinimoGerencia)}</button>`
              : fmtQ(p.PrecioMinimoGerencia)
        }</td>
      </tr>`;
    })
    .join("");

  if (canEdit && !inline) {
    document.querySelectorAll("[data-edit-price]").forEach((btn) => {
      btn.onclick = () => openPriceModal(btn.dataset.editPrice);
    });
    document.querySelectorAll("[data-inline-focus]").forEach((btn) => {
      btn.onclick = () => {
        const [field, id] = btn.dataset.inlineFocus.split(":");
        state.isEditingPricesInline = true;
        renderCatalogView();
        const target = document.querySelector(`[data-inline-${field}="${id}"]`);
        if (target) {
          target.focus();
          target.select();
        }
      };
    });
  }
}

async function saveAllInlinePrices() {
  if (!state.caps.canEditPrices) return;
  const stdInputs = Array.from(document.querySelectorAll("[data-inline-std]"));
  const updates = [];
  for (const inp of stdInputs) {
    const id = inp.dataset.inlineStd;
    const prod = state.productos.find((p) => String(p.id) === String(id));
    if (!prod) continue;
    const credInp = document.querySelector(`[data-inline-cred="${id}"]`);
    const minInp = document.querySelector(`[data-inline-min="${id}"]`);
    const res = validatePriceUpdate({
      precioReferencia: inp.value,
      precioCredito: credInp?.value,
      precioMinimoGerencia: minInp?.value,
    });
    if (!res.ok) {
      showToast(`${prod.Title}: ${res.error}`);
      return;
    }
    const changed =
      Number(prod.PrecioReferencia || 0) !== res.values.PrecioReferencia ||
      Number(prod.PrecioCredito || prod.PrecioReferencia || 0) !== res.values.PrecioCredito ||
      Number(prod.PrecioMinimoGerencia || 0) !== res.values.PrecioMinimoGerencia;
    if (changed) {
      updates.push({ prod, values: res.values });
    }
  }

  for (const { prod, values } of updates) {
    Object.assign(prod, values);
    if (!state.isDemo && state.graph) {
      if (prod.precioItemId) {
        await state.graph.updatePrecio(prod.precioItemId, values);
      } else {
        const created = await state.graph.createPrecio({
          Title: prod.Title,
          ProductoId: Number(prod.id),
          Moneda: "GTQ",
          ...values,
        });
        prod.precioItemId = created?.id || null;
      }
    }
  }

  state.isEditingPricesInline = false;
  renderCatalogView();
  showToast(state.isDemo ? "Precios actualizados en demo" : "Precios guardados en SharePoint");
}

function openPriceModal(prodId) {
  if (!state.caps.canEditPrices) return;
  const prod = state.productos.find((p) => String(p.id) === String(prodId));
  if (!prod) return;
  state.editingPriceProdId = prod.id;
  $("priceModalTitle").textContent = `Precios · ${prod.Title}`;
  $("pEstandar").value = Number(prod.PrecioReferencia || 0).toFixed(2);
  $("pCredito").value = Number(prod.PrecioCredito || prod.PrecioReferencia || 0).toFixed(2);
  $("pMinimo").value = Number(prod.PrecioMinimoGerencia || 0).toFixed(2);
  $("priceError").classList.add("hidden");
  $("priceModal").classList.remove("hidden");
}

async function savePrice() {
  const prod = state.productos.find((p) => String(p.id) === String(state.editingPriceProdId));
  if (!prod) return;
  const res = validatePriceUpdate({
    precioReferencia: $("pEstandar").value,
    precioCredito: $("pCredito").value,
    precioMinimoGerencia: $("pMinimo").value,
  });
  if (!res.ok) {
    $("priceError").textContent = res.error;
    $("priceError").classList.remove("hidden");
    return;
  }
  $("priceError").classList.add("hidden");
  Object.assign(prod, res.values);

  if (!state.isDemo && state.graph) {
    const fields = { Title: prod.Title, ProductoId: Number(prod.id), Moneda: "GTQ", ...res.values };
    if (prod.precioItemId) {
      await state.graph.updatePrecio(prod.precioItemId, res.values);
    } else {
      const created = await state.graph.createPrecio(fields);
      prod.precioItemId = created?.id || null;
    }
    showToast("Precios actualizados en SharePoint");
  } else {
    showToast("Precios actualizados en vista demo");
  }
  $("priceModal").classList.add("hidden");
  renderCatalogView();
}

function exportCsv(rows, filename) {
  const headers = ["Factura", "Codigo", "FechaFacturacion", "Cliente", "Vendedor", "FormaPago", "Dias", "Pagada", "Total"];
  const lines = [headers.join(",")];
  for (const r of rows) {
    const days = computeElapsedDays(r.FechaFacturacion);
    const vals = [
      r.NumeroFactura || "",
      r.Title || "",
      fmtDate(r.FechaFacturacion),
      `"${String(r.ClienteNombre || "").replace(/"/g, '""')}"`,
      `"${String(r.VendedorNombre || "").replace(/"/g, '""')}"`,
      r.FormaPago || "Contado",
      days ?? "",
      r.Pagada ? "Pagada" : "Pendiente",
      Number(r.TotalDocumento || 0).toFixed(2),
    ];
    lines.push(vals.join(","));
  }
  const blob = new Blob(["\uFEFF" + lines.join("\r\n")], { type: "text/csv;charset=utf-8;" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

function openQuoteModal(docId = null) {
  state.editingDocId = docId;
  const existing = docId ? state.documentos.find((d) => String(d.id) === String(docId)) : null;

  $("quoteModalTitle").textContent = existing ? `Editar ${existing.Title || `Borrador #${existing.id}`}` : "Nueva Cotización";
  $("qCliente").innerHTML = state.clientes
    .map((c) => `<option value="${c.id}">${c.Title} (${c.NIT || "CF"})</option>`)
    .join("");
  $("lineProductSelect").innerHTML = state.productos
    .map((p) => `<option value="${p.id}">${p.Title} (${fmtQ(p.PrecioReferencia)})</option>`)
    .join("");

  if (existing) {
    $("qFormaPago").value = existing.FormaPago || "Contado";
    $("qDiasCredito").value = existing.DiasCredito || 0;
    $("qOCCliente").value = existing.OCCliente || "";
    $("qDireccionEntrega").value = existing.DireccionEntrega || "";
    $("qObservaciones").value = existing.ObservacionesEntrega || "";
    state.editingLines = (existing.lines || []).map((l) => ({ ...l }));
    $("btnDiscardFromEditor").classList.remove("hidden");
  } else {
    $("qFormaPago").value = "Contado";
    $("qDiasCredito").value = 0;
    $("qOCCliente").value = "";
    $("qDireccionEntrega").value = state.clientes[0]?.DireccionEntrega || "";
    $("qObservaciones").value = "";
    state.editingLines = [];
    $("btnDiscardFromEditor").classList.add("hidden");
  }
  renderQuoteLines();
  $("quoteModal").classList.remove("hidden");
}

function renderQuoteLines() {
  let total = 0;
  let totalQq = 0;
  let hasAlert = false;

  $("quoteLinesList").innerHTML = state.editingLines
    .map((line, idx) => {
      const m = computeLineMetrics(line.cantidadUnidades, line.precioUnitario, line.unidadesPorAtado, line.unidadesPorQuintal);
      total += m.subtotal;
      totalQq += m.pesoQuintales;
      if (line.precioMinimoGerencia && line.precioUnitario < line.precioMinimoGerencia) hasAlert = true;
      return `
        <div class="quote-line-row">
          <div>
            <strong>${line.title}</strong>
            <div class="muted">${m.pesoQuintales.toFixed(2)} qq · Sub: ${fmtQ(m.subtotal)}</div>
          </div>
          <div>
            <small class="muted">Unidades</small>
            <input type="number" min="1" step="1" value="${line.cantidadUnidades}" data-line-qty="${idx}" />
          </div>
          <div>
            <small class="muted">Atados</small>
            <input type="number" min="0" step="0.5" value="${m.cantidadAtados}" data-line-atados="${idx}" ${line.unidadesPorAtado > 0 ? "" : "disabled"} />
          </div>
          <div>
            <small class="muted">Precio (Q)</small>
            <input type="number" min="0" step="0.01" value="${line.precioUnitario}" data-line-price="${idx}" />
          </div>
          <button type="button" class="btn btn-sm btn-danger" data-line-del="${idx}">✕</button>
        </div>`;
    })
    .join("");

  $("quoteTotalDisplay").textContent = fmtQ(total);
  $("quoteWeightDisplay").textContent = `${totalQq.toFixed(2)} qq`;
  $("quoteMinAlert").classList.toggle("hidden", !hasAlert);

  const selectedProd = $("lineProductSelect").value;
  $("lineProductSelect").innerHTML = state.productos
    .map((p) => {
      const added = !canAddProductLine(state.editingLines, p.id);
      return `<option value="${p.id}" ${added ? "disabled" : ""}>${p.Title} (${fmtQ(p.PrecioReferencia)})${added ? " — ya agregado" : ""}</option>`;
    })
    .join("");
  if (selectedProd && canAddProductLine(state.editingLines, selectedProd)) {
    $("lineProductSelect").value = selectedProd;
  } else {
    const firstAvail = state.productos.find((p) => canAddProductLine(state.editingLines, p.id));
    if (firstAvail) $("lineProductSelect").value = firstAvail.id;
  }
  $("btnAddLine").disabled = !state.productos.some((p) => canAddProductLine(state.editingLines, p.id));

  document.querySelectorAll("[data-line-qty]").forEach((inp) => {
    inp.onchange = () => {
      state.editingLines[inp.dataset.lineQty].cantidadUnidades = Math.max(1, Number(inp.value) || 1);
      renderQuoteLines();
    };
  });
  document.querySelectorAll("[data-line-atados]").forEach((inp) => {
    inp.onchange = () => {
      const line = state.editingLines[inp.dataset.lineAtados];
      if (line.unidadesPorAtado > 0) {
        line.cantidadUnidades = Math.max(1, Math.round((Number(inp.value) || 0) * line.unidadesPorAtado));
      }
      renderQuoteLines();
    };
  });
  document.querySelectorAll("[data-line-price]").forEach((inp) => {
    inp.onchange = () => {
      state.editingLines[inp.dataset.linePrice].precioUnitario = Math.max(0, Number(inp.value) || 0);
      renderQuoteLines();
    };
  });
  document.querySelectorAll("[data-line-del]").forEach((btn) => {
    btn.onclick = () => {
      state.editingLines.splice(Number(btn.dataset.lineDel), 1);
      renderQuoteLines();
    };
  });
}

async function saveQuote(targetAction) {
  const client = state.clientes.find((c) => String(c.id) === String($("qCliente").value));
  const total = state.editingLines.reduce((s, l) => s + l.cantidadUnidades * l.precioUnitario, 0);
  const totalQq = state.editingLines.reduce(
    (s, l) => s + computeLineMetrics(l.cantidadUnidades, l.precioUnitario, l.unidadesPorAtado, l.unidadesPorQuintal).pesoQuintales,
    0
  );
  const alertMin = state.editingLines.some((l) => l.precioMinimoGerencia && l.precioUnitario < l.precioMinimoGerencia);

  const estadoMap = {
    Ninguna: DOC_STATES.BORRADOR,
    EmitirCotizacion: DOC_STATES.BORRADOR, // Aparta número en Borrador hasta que se envíe
    ConvertirAOC: DOC_STATES.FACTURAR,
  };

  const syncedTerms = syncPaymentTerms({
    formaPago: $("qFormaPago").value,
    diasCredito: $("qDiasCredito").value,
    changedField: "diasCredito",
  });
  const payload = {
    ClienteId: Number(client?.id) || null,
    ClienteNombre: client?.Title || "CLIENTE GENERAL",
    ClienteNIT: client?.NIT || "CF",
    DireccionEntrega: $("qDireccionEntrega").value.trim(),
    ObservacionesEntrega: $("qObservaciones").value.trim(),
    FormaPago: syncedTerms.formaPago,
    DiasCredito: syncedTerms.diasCredito,
    OCCliente: $("qOCCliente").value.trim(),
    VendedorNombre: state.account?.name || "Vendedor COACERO",
    VendedorEmail: state.account?.username || "juanpablo@coacero.com.gt",
    Moneda: "GTQ",
    TotalDocumento: Number(total.toFixed(2)),
    TotalQuintales: Number(totalQq.toFixed(2)),
    AlertaPrecioMinimo: alertMin,
    Estado: estadoMap[targetAction],
    AccionPendiente: targetAction === "ConvertirAOC" ? "ConvertirAOC" : "EmitirCotizacion",
  };

  let savedId = state.editingDocId;
  if (state.isDemo || !state.graph) {
    const existingIdx = savedId ? state.documentos.findIndex((d) => String(d.id) === String(savedId)) : -1;
    const mappedLines = state.editingLines.map((l) => ({
      ...l,
      Title: l.title,
      CantidadUnidades: l.cantidadUnidades,
      CantidadAtados: computeLineMetrics(l.cantidadUnidades, l.precioUnitario, l.unidadesPorAtado, l.unidadesPorQuintal).cantidadAtados,
      PesoQuintales: computeLineMetrics(l.cantidadUnidades, l.precioUnitario, l.unidadesPorAtado, l.unidadesPorQuintal).pesoQuintales,
      PrecioUnitario: l.precioUnitario,
      SubtotalLinea: computeLineMetrics(l.cantidadUnidades, l.precioUnitario, l.unidadesPorAtado, l.unidadesPorQuintal).subtotal,
    }));
    if (existingIdx >= 0) {
      const prev = state.documentos[existingIdx];
      state.documentos[existingIdx] = {
        ...prev,
        ...payload,
        Title: targetAction === "ConvertirAOC" ? (prev.Title || "").replace(/^CO-/, "OC-") || `OC-${prev.CorrelativoBase || 144}` : prev.Title || `CO-${prev.CorrelativoBase || 144}`,
        lines: mappedLines,
      };
      savedId = prev.id;
    } else {
      const nextNum = 144 + state.documentos.length;
      savedId = String(Date.now());
      state.documentos.unshift({
        id: savedId,
        CorrelativoBase: nextNum,
        Title: targetAction === "ConvertirAOC" ? `OC-${nextNum}` : `CO-${nextNum}`,
        ...payload,
        lines: mappedLines,
        Created: new Date().toISOString(),
      });
    }
    showToast(`Guardado en vista demo (${payload.Estado})`);
  } else {
    let docId = savedId ? Number(savedId) : null;
    if (docId) {
      await state.graph.updateDocumento(docId, payload);
    } else {
      const created = await state.graph.createDocumento(payload);
      docId = Number(created?.id);
      savedId = String(docId);
      for (let i = 0; i < state.editingLines.length; i += 1) {
        const l = state.editingLines[i];
        const m = computeLineMetrics(l.cantidadUnidades, l.precioUnitario, l.unidadesPorAtado, l.unidadesPorQuintal);
        await state.graph.createLinea({
          Title: l.title,
          DocumentoId: docId,
          EstadoDocumento: payload.Estado,
          ClienteNombre: payload.ClienteNombre,
          VendedorEmail: payload.VendedorEmail,
          ProductoId: Number(l.productoId),
          TipoItem: l.tipoItem || "Producto",
          CodigoInterno: l.codigoInterno || "",
          CodigoExterno: l.codigoExterno || "",
          UnidadesPorAtado: l.unidadesPorAtado || 0,
          UnidadesPorQuintal: l.unidadesPorQuintal || 0,
          CantidadUnidades: m.cantidadUnidades,
          CantidadAtados: m.cantidadAtados,
          PesoQuintales: m.pesoQuintales,
          PrecioReferencia: l.precioReferencia,
          PrecioUnitario: l.precioUnitario,
          SubtotalLinea: m.subtotal,
          Orden: i + 1,
        });
      }
    }
    await loadSharePointData();
    showToast("Documento guardado en SharePoint");
  }
  $("quoteModal").classList.add("hidden");
  renderAll();
  return savedId;
}

function openSendQuoteModal(docId) {
  state.sendingDocId = docId;
  const doc = state.documentos.find((d) => String(d.id) === String(docId));
  if (!doc) return;
  $("sendQuoteTitle").textContent = `Enviar / Presentar · ${doc.Title || `Borrador #${doc.id}`}`;
  $("sendQuoteSubtitle").textContent = `${doc.ClienteNombre || "—"} · ${fmtQ(doc.TotalDocumento)}`;
  $("sendQuoteModal").classList.remove("hidden");
}

async function completePresentation(channel) {
  const doc = state.documentos.find((d) => String(d.id) === String(state.sendingDocId));
  if (!doc) return;
  const code = doc.Title || `CO-${doc.CorrelativoBase || doc.id}`;
  const summary = `Cotización ${code} - ${doc.ClienteNombre || ""} - Total ${fmtQ(doc.TotalDocumento)}`;

  if (channel === "email") {
    const client = state.clientes.find((c) => c.Title === doc.ClienteNombre);
    const to = encodeURIComponent(client?.Correo || "");
    window.open(`mailto:${to}?subject=${encodeURIComponent(`COACERO · ${code}`)}&body=${encodeURIComponent(summary)}`, "_blank");
  } else if (channel === "whatsapp") {
    window.open(`https://wa.me/?text=${encodeURIComponent(summary)}`, "_blank");
  } else if (channel === "extract") {
    const html = `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><title>${code}</title></head><body><h2>COACERO · ${code}</h2><p>Cliente: ${doc.ClienteNombre || ""}</p><p>Total: ${fmtQ(doc.TotalDocumento)}</p></body></html>`;
    const blob = new Blob([html], { type: "text/html;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${code}.html`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  doc.Estado = DOC_STATES.PRESENTADA;
  if (!state.isDemo && state.graph) {
    await state.graph.updateDocumento(doc.id, {
      Estado: DOC_STATES.PRESENTADA,
      AccionPendiente: channel === "email" ? "EnviarCorreoCliente" : "Ninguna",
    });
  }
  $("sendQuoteModal").classList.add("hidden");
  renderAll();
  if (channel === "print") {
    await openDocDetailModal(doc.id);
    setTimeout(() => window.print(), 250);
  }
  showToast(`${code} marcada como Presentada`);
}

function openDiscardModal(docId) {
  state.discardingDocId = docId;
  const doc = state.documentos.find((d) => String(d.id) === String(docId));
  if (!doc) return;
  $("discardModalTitle").textContent = `Descartar · ${doc.Title || `Borrador #${doc.id}`}`;
  $("discardModalSubtitle").textContent = `${doc.ClienteNombre || "—"} · ${fmtQ(doc.TotalDocumento)}`;
  $("discardReasonInput").value = "";
  $("discardError").classList.add("hidden");
  $("discardModal").classList.remove("hidden");
}

async function confirmDiscard() {
  const res = validateDiscardReason($("discardReasonInput").value);
  if (!res.ok) {
    $("discardError").textContent = res.error;
    $("discardError").classList.remove("hidden");
    return;
  }
  const doc = state.documentos.find((d) => String(d.id) === String(state.discardingDocId));
  if (!doc) return;
  doc.Estado = DOC_STATES.DESCARTADA;
  doc.MotivoDescarte = res.reason;
  if (!state.isDemo && state.graph) {
    await state.graph.updateDocumento(doc.id, {
      Estado: DOC_STATES.DESCARTADA,
      MotivoDescarte: res.reason,
      AccionPendiente: "Descartar",
    });
  }
  $("discardModal").classList.add("hidden");
  $("quoteModal").classList.add("hidden");
  renderAll();
  showToast("Cotización descartada con motivo guardado");
}

function openToOcModal(docId) {
  state.toOcDocId = docId;
  const doc = state.documentos.find((d) => String(d.id) === String(docId));
  if (!doc) return;
  $("toOcSubtitle").textContent = `${doc.Title || `CO-${doc.id}`} · ${doc.ClienteNombre || ""} · ${fmtQ(doc.TotalDocumento)}`;
  $("toOcCliente").value = doc.OCCliente || "";
  $("toOcModal").classList.remove("hidden");
}

async function confirmToOc() {
  const doc = state.documentos.find((d) => String(d.id) === String(state.toOcDocId));
  if (!doc) return;
  const ocCliente = $("toOcCliente").value.trim();
  const medio = $("toOcMedio").value;
  const nowIso = new Date().toISOString();

  doc.Estado = DOC_STATES.FACTURAR;
  doc.Title = (doc.Title || "").replace(/^CO-/, "OC-") || `OC-${doc.CorrelativoBase || doc.id}`;
  doc.OCCliente = ocCliente;
  doc.MedioAprobacion = medio;
  doc.FechaConversionOC = nowIso;

  if (!state.isDemo && state.graph) {
    await state.graph.updateDocumento(doc.id, {
      Title: doc.Title,
      Estado: DOC_STATES.FACTURAR,
      OCCliente: ocCliente,
      MedioAprobacion: medio,
      FechaConversionOC: nowIso,
      AccionPendiente: "ConvertirAOC",
    });
    await loadSharePointData();
  }
  $("toOcModal").classList.add("hidden");
  renderAll();
  showToast(`${doc.Title} enviada a Bandeja de Facturación`);
}

function renderInvoiceModalLines() {
  const lines = state.invoicingLines || [];
  let totalFactQ = 0;
  let totalPendUnits = 0;
  let hasShortage = false;

  $("invLinesBody").innerHTML = lines.length
    ? lines
        .map((l, idx) => {
          const key = l.id !== undefined && l.id !== null ? String(l.id) : String(idx);
          const orig = Math.max(0, Number(l.CantidadUnidades ?? 0));
          const val = state.invoicingQtyMap[key] !== undefined ? Number(state.invoicingQtyMap[key]) : orig;
          const safeVal = Number.isFinite(val) ? Math.min(orig, Math.max(0, val)) : orig;
          const pend = Math.max(0, Number((orig - safeVal).toFixed(2)));
          const unitPrice = Number(l.PrecioUnitario ?? 0);
          const sub = Number((safeVal * unitPrice).toFixed(2));
          totalFactQ += sub;
          totalPendUnits += pend;
          if (pend > 0) hasShortage = true;

          return `
            <tr>
              <td>${l.Title || "Material"}</td>
              <td class="num">${orig}</td>
              <td class="num">
                <input type="number" class="inv-qty-input" data-inv-qty="${key}" min="0" max="${orig}" step="any" value="${safeVal}" />
              </td>
              <td class="num">${pend > 0 ? `<strong style="color:var(--warning);">${pend}</strong>` : "0"}</td>
              <td class="num">${fmtQ(sub)}</td>
            </tr>`;
        })
        .join("")
    : `<tr><td colspan="5" class="muted">Sin líneas detalladas; se facturará el total del documento.</td></tr>`;

  $("invTotalsSummary").textContent = `A facturar: ${fmtQ(totalFactQ)}${hasShortage ? ` · Faltante: ${totalPendUnits} uds` : ""}`;
  $("invShortageSection").classList.toggle("hidden", !hasShortage);

  document.querySelectorAll("[data-inv-qty]").forEach((input) => {
    input.oninput = () => {
      const key = input.dataset.invQty;
      const max = Number(input.max || 0);
      const raw = Number(input.value);
      const clamped = Number.isFinite(raw) ? Math.min(max, Math.max(0, raw)) : 0;
      state.invoicingQtyMap[key] = clamped;
      renderInvoiceModalLines();
    };
  });
}

async function openInvoiceModal(docId) {
  state.invoicingDocId = docId;
  const doc = state.documentos.find((d) => String(d.id) === String(docId));
  if (!doc) return;
  $("invoiceModalSubtitle").textContent = `${doc.Title || ""} · ${doc.ClienteNombre || ""} · Pedido: ${fmtQ(doc.TotalDocumento)}`;
  $("invNumeroFactura").value = "";
  $("invShortageNote").value = "";
  const defaultRadio = document.querySelector('input[name="invRemainderAction"][value="pending"]');
  if (defaultRadio) defaultRadio.checked = true;

  let lines = doc.lines || [];
  if (!state.isDemo && state.graph && !lines.length) {
    try {
      lines = await state.graph.fetchLineas(doc.id);
      doc.lines = lines;
    } catch {
      lines = [];
    }
  }
  if (state.isDemo && !lines.length) {
    lines = [
      { id: `${doc.id}-1`, ProductoId: "10", Title: "Varilla Corrugada 3/8 x 6m", TipoItem: "Producto", UnidadesPorAtado: 10, UnidadesPorQuintal: 36, CantidadUnidades: 100, PrecioUnitario: Number(doc.TotalDocumento || 0) / 100 || 1 },
    ];
    doc.lines = lines;
  }

  state.invoicingLines = lines;
  state.invoicingQtyMap = {};
  lines.forEach((l, idx) => {
    const key = l.id !== undefined && l.id !== null ? String(l.id) : String(idx);
    state.invoicingQtyMap[key] = Number(l.CantidadUnidades ?? 0);
  });

  renderInvoiceModalLines();
  $("invoiceModal").classList.remove("hidden");
}

async function confirmInvoice() {
  const num = $("invNumeroFactura").value.trim();
  if (!num) {
    showToast("Ingresa el número de factura.");
    return;
  }
  const doc = state.documentos.find((d) => String(d.id) === String(state.invoicingDocId));
  if (!doc) return;

  const remainderRadio = document.querySelector('input[name="invRemainderAction"]:checked');
  const remainderAction = remainderRadio ? remainderRadio.value : "pending";
  const shortageNote = $("invShortageNote").value.trim();

  let plan = null;
  if ((state.invoicingLines || []).length > 0) {
    try {
      plan = buildPartialInvoicePlan(doc, state.invoicingLines, state.invoicingQtyMap, {
        remainderAction,
        note: shortageNote,
      });
    } catch (err) {
      showToast(err.message);
      return;
    }
  }

  const nowIso = new Date().toISOString();

  if (state.isDemo || !state.graph) {
    doc.NumeroFactura = num;
    doc.Estado = DOC_STATES.FACTURADO;
    doc.FechaFacturacion = nowIso;
    doc.Pagada = false;

    if (plan) {
      doc.lines = plan.invoicedLines;
      doc.TotalDocumento = plan.invoicedTotals.TotalDocumento;
      doc.TotalQuintales = plan.invoicedTotals.TotalQuintales;
      doc.TotalToneladas = plan.invoicedTotals.TotalToneladas;
      doc.CondicionCierre = plan.condicionCierre;
      if (plan.notaFacturacion) doc.NotaFacturacion = plan.notaFacturacion;

      if (plan.backorderDoc) {
        const nextOrder = nextOrderCode(state.documentos);
        const childDoc = {
          id: String(Date.now()),
          Title: nextOrder.code,
          CorrelativoBase: nextOrder.correlativoBase,
          FechaConversionOC: nowIso,
          Created: nowIso,
          ...plan.backorderDoc,
        };
        state.documentos.unshift(childDoc);
        showToast(`Factura #${num} registrada · Se creó ${childDoc.Title} pendiente por existencia`);
      } else if (plan.hasShortage) {
        showToast(`Factura #${num} registrada con cierre parcial (Existencia insuficiente)`);
      } else {
        showToast(`Factura #${num} registrada en demo`);
      }
    } else {
      showToast(`Factura #${num} registrada en demo`);
    }
  } else {
    const docPatch = {
      NumeroFactura: num,
      FacturadoPor: state.account?.username || "",
      FechaFacturacion: nowIso,
      AccionPendiente: "ConfirmarFacturado",
    };

    if (plan) {
      docPatch.TotalDocumento = plan.invoicedTotals.TotalDocumento;
      docPatch.TotalQuintales = plan.invoicedTotals.TotalQuintales;
      docPatch.TotalToneladas = plan.invoicedTotals.TotalToneladas;
      docPatch.CondicionCierre = plan.condicionCierre;
      if (plan.notaFacturacion) docPatch.NotaFacturacion = plan.notaFacturacion;

      // Actualizar líneas reales facturadas en CVF_Documentos_Lineas antes de confirmar factura
      for (const line of plan.invoicedLines) {
        if (line.id) {
          await state.graph.updateLinea(line.id, {
            CantidadSolicitadaOriginal: line.CantidadSolicitadaOriginal,
            CantidadUnidades: line.CantidadUnidades,
            CantidadAtados: line.CantidadAtados,
            PesoQuintales: line.PesoQuintales,
            SubtotalLinea: line.SubtotalLinea,
          });
        }
      }

      if (plan.backorderDoc) {
        const nextOrder = nextOrderCode(state.documentos);
        const createdBo = await state.graph.createDocumento({
          Title: nextOrder.code,
          CorrelativoBase: nextOrder.correlativoBase,
          Estado: DOC_STATES.FACTURAR,
          AccionPendiente: "Ninguna",
          AlertaPrecioMinimo: Boolean(plan.backorderDoc.AlertaPrecioMinimo),
          ClienteId: plan.backorderDoc.ClienteId,
          ClienteNombre: plan.backorderDoc.ClienteNombre,
          ClienteNIT: plan.backorderDoc.ClienteNIT,
          DireccionFiscal: plan.backorderDoc.DireccionFiscal,
          ContactoNombre: plan.backorderDoc.ContactoNombre,
          ClienteCorreo: plan.backorderDoc.ClienteCorreo,
          Telefono: plan.backorderDoc.Telefono,
          Celular: plan.backorderDoc.Celular,
          NombreProyecto: plan.backorderDoc.NombreProyecto,
          DireccionEntrega: plan.backorderDoc.DireccionEntrega,
          ContactoEntrega: plan.backorderDoc.ContactoEntrega,
          CelularEntrega: plan.backorderDoc.CelularEntrega,
          VendedorNombre: plan.backorderDoc.VendedorNombre,
          VendedorEmail: plan.backorderDoc.VendedorEmail,
          FormaPago: plan.backorderDoc.FormaPago,
          DiasCredito: plan.backorderDoc.DiasCredito,
          OrigenDespacho: plan.backorderDoc.OrigenDespacho,
          DocsFacturacion: plan.backorderDoc.DocsFacturacion,
          OCCliente: plan.backorderDoc.OCCliente,
          Moneda: plan.backorderDoc.Moneda,
          ObservacionesEntrega: plan.backorderDoc.ObservacionesEntrega,
          TotalDocumento: plan.backorderDoc.TotalDocumento,
          TotalQuintales: plan.backorderDoc.TotalQuintales,
          TotalToneladas: plan.backorderDoc.TotalToneladas,
          FechaConversionOC: nowIso,
          DocumentoOrigenId: Number(doc.id),
          CodigoOCOrigen: plan.backorderDoc.CodigoOCOrigen,
          MotivoOrigen: plan.backorderDoc.MotivoOrigen,
          NotaFacturacion: plan.backorderDoc.NotaFacturacion,
        });
        const boId = Number(createdBo?.id);
        if (boId) {
          for (let i = 0; i < plan.backorderDoc.lines.length; i += 1) {
            const bl = plan.backorderDoc.lines[i];
            await state.graph.createLinea({
              Title: bl.Title,
              DocumentoId: boId,
              CorrelativoBase: nextOrder.correlativoBase,
              EstadoDocumento: DOC_STATES.FACTURAR,
              ClienteNombre: plan.backorderDoc.ClienteNombre,
              VendedorEmail: plan.backorderDoc.VendedorEmail,
              ProductoId: Number(bl.ProductoId) || null,
              TipoItem: bl.TipoItem || "Producto",
              CodigoInterno: bl.CodigoInterno || "",
              CodigoExterno: bl.CodigoExterno || "",
              UnidadesPorAtado: Number(bl.UnidadesPorAtado) || 0,
              UnidadesPorQuintal: Number(bl.UnidadesPorQuintal) || 0,
              CantidadSolicitadaOriginal: bl.CantidadSolicitadaOriginal,
              CantidadUnidades: bl.CantidadUnidades,
              CantidadAtados: bl.CantidadAtados,
              PesoQuintales: bl.PesoQuintales,
              PrecioReferencia: Number(bl.PrecioReferencia ?? bl.PrecioUnitario) || 0,
              PrecioUnitario: Number(bl.PrecioUnitario) || 0,
              SubtotalLinea: bl.SubtotalLinea,
              MotivoOrigen: ORIGIN_REASONS.EXISTENCIA_INSUFICIENTE,
              Orden: i + 1,
            });
          }
        }
      }
    }

    await state.graph.updateDocumento(doc.id, docPatch);
    await loadSharePointData();
    showToast(`Factura #${num} enviada a Power Automate`);
  }
  $("invoiceModal").classList.add("hidden");
  renderAll();
}

function renderAll() {
  renderTabs();
  renderKpis();

  const showDocs = ["docs", "credit", "inbox"].includes(state.activeTab);
  $("viewDocuments").classList.toggle("hidden", !showDocs);
  $("viewReport").classList.toggle("hidden", state.activeTab !== "report");
  $("viewClients").classList.toggle("hidden", state.activeTab !== "clients");
  $("viewCatalog").classList.toggle("hidden", state.activeTab !== "catalog");

  $("btnNewQuote").classList.toggle("hidden", !state.caps.canCreateQuote);
  $("roleBadge").textContent = state.caps.label;
  $("roleBadge").classList.remove("hidden");

  if (showDocs) renderDocumentsView();
  if (state.activeTab === "report") renderReportView();
  if (state.activeTab === "clients") renderClientsView();
  if (state.activeTab === "catalog") renderCatalogView();
}

async function enterDemo(role = ROLES.GERENCIA) {
  state.isDemo = true;
  state.role = role;
  state.caps = getRoleCapabilities(role);
  const baseDocs = JSON.parse(JSON.stringify(DEMO_DATA.documentos));
  try {
    const resp = await fetch("./demo-despachos.json");
    if (resp.ok) {
      const realDespachos = await resp.json();
      if (Array.isArray(realDespachos) && realDespachos.length) {
        const nonFact = baseDocs.filter((d) => d.Estado !== DOC_STATES.FACTURADO);
        state.documentos = [...nonFact, ...realDespachos];
      } else {
        state.documentos = baseDocs;
      }
    } else {
      state.documentos = baseDocs;
    }
  } catch {
    state.documentos = baseDocs;
  }
  state.clientes = JSON.parse(JSON.stringify(DEMO_DATA.clientes));
  state.productos = JSON.parse(JSON.stringify(DEMO_DATA.productos));

  $("authGate").classList.add("hidden");
  $("mainWorkspace").classList.remove("hidden");
  $("demoRoleSelect").classList.remove("hidden");
  $("demoRoleSelect").value = role;
  $("btnRefresh").classList.remove("hidden");
  $("btnAuth").textContent = "Salir demo";
  $("connectionSub").textContent = "Modo demostración (datos locales)";
  renderAll();
}

async function getToken() {
  const req = { scopes: APP_CONFIG.scopes, account: state.account };
  try {
    const res = await state.msalApp.acquireTokenSilent(req);
    return res.accessToken;
  } catch {
    const res = await state.msalApp.acquireTokenPopup(req);
    state.account = res.account;
    return res.accessToken;
  }
}

async function loadSharePointData() {
  const [docs, clientes, productos, precios, despachos] = await Promise.all([
    state.graph.fetchDocumentos(),
    state.graph.fetchClientes(),
    state.graph.fetchProductos(),
    state.graph.fetchPrecios(),
    state.graph.fetchDespachosEstados().catch(() => []),
  ]);
  const dispatchById = new Map();
  const dispatchByNum = new Map();
  for (const d of despachos) {
    if (d.id) dispatchById.set(String(d.id), d.Estado);
    if (d.NumeroDespacho) dispatchByNum.set(String(d.NumeroDespacho).trim(), d.Estado);
    if (d.Title) dispatchByNum.set(String(d.Title).trim(), d.Estado);
  }
  const priceByProd = new Map(precios.map((p) => [String(p.ProductoId), p]));
  state.productos = productos.map((p) => {
    const pr = priceByProd.get(String(p.id)) || {};
    return { ...p, ...pr, precioItemId: pr.id || null, id: p.id, Title: p.Title };
  });
  state.documentos = docs.map((doc) => ({
    ...doc,
    EstadoDespacho:
      (doc.DespachoIdCreado && dispatchById.get(String(doc.DespachoIdCreado))) ||
      (doc.NumeroFactura && dispatchByNum.get(String(doc.NumeroFactura).trim())) ||
      doc.EstadoDespacho ||
      null,
  }));
  state.clientes = clientes;
  state.precios = precios;
}

async function startAuthenticatedSession(account) {
  state.isDemo = false;
  state.account = account;
  state.graph = new GraphClient(getToken, APP_CONFIG);
  const groupIds = await state.graph.fetchUserGroupIds();
  state.role = resolveCommercialRole(account.username, groupIds, APP_CONFIG.roles);
  state.caps = getRoleCapabilities(state.role);

  await loadSharePointData();

  $("authGate").classList.add("hidden");
  $("mainWorkspace").classList.remove("hidden");
  $("demoRoleSelect").classList.add("hidden");
  $("btnRefresh").classList.remove("hidden");
  $("btnAuth").textContent = "Cerrar sesión";
  $("connectionSub").textContent = `Conectado · ${account.name || account.username}`;
  renderAll();
}

async function initAuth() {
  if (typeof msal === "undefined") return;
  state.msalApp = new msal.PublicClientApplication({
    auth: {
      clientId: APP_CONFIG.clientId,
      authority: `https://login.microsoftonline.com/${APP_CONFIG.tenantId}`,
      redirectUri: window.location.origin + window.location.pathname,
    },
    cache: { cacheLocation: "sessionStorage" },
  });
  await state.msalApp.initialize();
  const redirectRes = await state.msalApp.handleRedirectPromise();
  const account = redirectRes?.account || state.msalApp.getAllAccounts()[0];
  if (account) {
    await startAuthenticatedSession(account);
  }
}

function bindEvents() {
  window.addEventListener("online", updateOnlineBanner);
  window.addEventListener("offline", updateOnlineBanner);
  updateOnlineBanner();

  $("btnDemoPreview").onclick = () => enterDemo(ROLES.GERENCIA);
  $("demoRoleSelect").onchange = (e) => enterDemo(e.target.value);

  const doLogin = async () => {
    try {
      const res = await state.msalApp.loginPopup({ scopes: APP_CONFIG.scopes });
      await startAuthenticatedSession(res.account);
    } catch (err) {
      $("authError").textContent = `Error al iniciar sesión: ${err.message}`;
      $("authError").classList.remove("hidden");
    }
  };
  $("btnLoginGate").onclick = doLogin;
  $("btnAuth").onclick = async () => {
    if (state.isDemo) {
      window.location.href = window.location.pathname;
      return;
    }
    if (state.account && state.msalApp) {
      await state.msalApp.logoutPopup({ account: state.account });
    } else {
      await doLogin();
    }
  };

  $("btnRefresh").onclick = async () => {
    if (state.isDemo) {
      renderAll();
      return;
    }
    await loadSharePointData();
    renderAll();
    showToast("Datos actualizados");
  };

  $("docSearch").oninput = (e) => { state.searchText = e.target.value; renderDocumentsView(); };
  $("repFrom").onchange = (e) => { state.report.fromDate = e.target.value; renderReportView(); };
  $("repTo").onchange = (e) => { state.report.toDate = e.target.value; renderReportView(); };
  $("repClientSearch").oninput = (e) => { state.report.clientSearch = e.target.value; renderReportView(); };
  $("btnRepSelectAll").onclick = () => { state.report.selectedClients = []; renderReportView(); };
  $("btnRepClearClients").onclick = () => { state.report.selectedClients = []; renderReportView(); };
  $("clientSearch").oninput = renderClientsView;
  $("catalogSearch").oninput = renderCatalogView;

  $("btnNewQuote").onclick = () => openQuoteModal(null);
  $("btnCloseQuoteModal").onclick = () => $("quoteModal").classList.add("hidden");
  $("btnCloseDocDetail").onclick = () => $("docDetailModal").classList.add("hidden");
  $("btnAddLine").onclick = () => {
    const prod = state.productos.find((p) => String(p.id) === String($("lineProductSelect").value));
    if (!prod) return;
    if (!canAddProductLine(state.editingLines, prod.id)) {
      showToast("Ese material ya fue agregado a la cotización.");
      return;
    }
    const isCredit = $("qFormaPago").value === "Credito";
    const refPrice = isCredit ? (prod.PrecioCredito || prod.PrecioReferencia || 0) : (prod.PrecioReferencia || 0);
    state.editingLines.push({
      productoId: prod.id,
      title: prod.Title,
      tipoItem: prod.TipoItem || "Producto",
      codigoInterno: prod.CodigoInterno || "",
      codigoExterno: prod.CodigoExterno || "",
      unidadesPorAtado: prod.UnidadesPorAtado || 0,
      unidadesPorQuintal: prod.UnidadesPorQuintal || 0,
      precioReferencia: refPrice,
      precioMinimoGerencia: prod.PrecioMinimoGerencia || 0,
      precioUnitario: refPrice,
      cantidadUnidades: Math.max(1, prod.UnidadesPorAtado || 1),
    });
    renderQuoteLines();
  };
  const syncTermsUI = (changedField) => {
    const synced = syncPaymentTerms({
      formaPago: $("qFormaPago").value,
      diasCredito: $("qDiasCredito").value,
      changedField,
    });
    $("qFormaPago").value = synced.formaPago;
    $("qDiasCredito").value = synced.diasCredito;
  };
  $("qFormaPago").onchange = () => syncTermsUI("formaPago");
  $("qDiasCredito").oninput = () => syncTermsUI("diasCredito");
  $("qDiasCredito").onchange = () => syncTermsUI("diasCredito");

  $("btnSaveDraft").onclick = () => saveQuote("Ninguna");
  $("btnEmitQuote").onclick = async () => {
    const savedId = await saveQuote("EmitirCotizacion");
    if (savedId) openSendQuoteModal(savedId);
  };
  $("btnConvertOC").onclick = () => saveQuote("ConvertirAOC");
  $("btnDiscardFromEditor").onclick = () => {
    if (state.editingDocId) openDiscardModal(state.editingDocId);
  };
  $("btnCloseSendModal").onclick = () => $("sendQuoteModal").classList.add("hidden");
  $("btnSendEmail").onclick = () => completePresentation("email");
  $("btnSendWhatsApp").onclick = () => completePresentation("whatsapp");
  $("btnSendExtract").onclick = () => completePresentation("extract");
  $("btnSendPrint").onclick = () => completePresentation("print");
  $("btnCloseDiscardModal").onclick = () => $("discardModal").classList.add("hidden");
  $("btnConfirmDiscard").onclick = confirmDiscard;

  $("btnNewClient").onclick = () => $("clientModal").classList.remove("hidden");
  $("btnCloseClientModal").onclick = () => $("clientModal").classList.add("hidden");
  $("btnSaveClient").onclick = async () => {
    const payload = {
      Title: $("cNombre").value.trim().toUpperCase(),
      NIT: $("cNit").value.trim().toUpperCase() || "CF",
      Telefono: $("cTelefono").value.trim(),
      Correo: $("cCorreo").value.trim(),
      DireccionEntrega: $("cDireccion").value.trim(),
      VendedorEmail: state.account?.username || "juanpablo@coacero.com.gt",
    };
    if (!payload.Title) return;
    if (state.isDemo || !state.graph) {
      state.clientes.unshift({ id: String(Date.now()), ...payload });
    } else {
      await state.graph.createCliente(payload);
      await loadSharePointData();
    }
    $("clientModal").classList.add("hidden");
    renderAll();
  };

  $("btnCloseInvoiceModal").onclick = () => $("invoiceModal").classList.add("hidden");
  $("btnConfirmInvoice").onclick = confirmInvoice;
  $("btnReportSalesMode").onclick = () => {
    state.report.mode = "sales";
    renderReportView();
  };
  $("btnReportShortageMode").onclick = () => {
    state.report.mode = "shortages";
    renderReportView();
  };
  $("btnCloseToOcModal").onclick = () => $("toOcModal").classList.add("hidden");
  $("btnConfirmToOc").onclick = confirmToOc;
  $("btnClosePriceModal").onclick = () => $("priceModal").classList.add("hidden");
  $("btnSavePrice").onclick = savePrice;
  $("btnTogglePriceEdit").onclick = () => {
    state.isEditingPricesInline = !state.isEditingPricesInline;
    renderCatalogView();
  };
  $("btnSaveAllPrices").onclick = saveAllInlinePrices;
}

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("./sw.js").catch(() => {});
}

const splashStartMs = Date.now();
function hideSplashScreen(statusText = "") {
  const el = $("splashScreen");
  if (!el) return;
  if (statusText && $("splashStatus")) $("splashStatus").textContent = statusText;
  const elapsed = Date.now() - splashStartMs;
  const waitMs = Math.max(0, 450 - elapsed);
  setTimeout(() => el.classList.add("is-done"), waitMs);
}

bindEvents();
if (state.isDemo) {
  enterDemo(ROLES.GERENCIA).finally(() => hideSplashScreen("Cargando vista demo..."));
} else {
  initAuth()
    .catch((err) => {
      $("connectionSub").textContent = "Listo para iniciar sesión";
      console.warn("MSAL init:", err);
    })
    .finally(() => hideSplashScreen());
}

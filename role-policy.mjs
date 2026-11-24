/**
 * Políticas de roles, estados comerciales, cálculo de crédito y filtros de reporte
 * para ShP-ventas-facturacion.
 */

export const DOC_STATES = Object.freeze({
  BORRADOR: "Borrador",
  PRESENTADA: "Presentada",
  FACTURAR: "Facturar",
  FACTURADO: "Facturado",
  DESCARTADA: "Descartada",
  VENCIDA: "Vencida",
  ANULADA: "Anulada",
});

export const ROLES = Object.freeze({
  GERENCIA: "gerencia",
  FACTURACION: "facturacion",
  VENDEDOR: "vendedor",
  CONSULTA: "consulta",
});

/**
 * Resuelve el rol operativo por correo corporativo o grupos Entra ID.
 * Precedencia: gerencia > facturacion > vendedor > consulta.
 */
export function resolveCommercialRole(email, groupIds = [], roleConfig = {}) {
  const normalizedEmail = String(email || "").trim().toLowerCase();
  const groups = new Set((groupIds || []).map((g) => String(g || "").toLowerCase()));

  const gerenciaEmails = new Set((roleConfig.gerenciaEmails || []).map((e) => e.toLowerCase()));
  const facturacionEmails = new Set((roleConfig.facturacionEmails || []).map((e) => e.toLowerCase()));
  const vendedorEmails = new Set((roleConfig.vendedorEmails || []).map((e) => e.toLowerCase()));

  if (
    gerenciaEmails.has(normalizedEmail) ||
    (roleConfig.entraGroups?.admin && groups.has(roleConfig.entraGroups.admin.toLowerCase()))
  ) {
    return ROLES.GERENCIA;
  }
  if (
    facturacionEmails.has(normalizedEmail) ||
    (roleConfig.entraGroups?.facturacion && groups.has(roleConfig.entraGroups.facturacion.toLowerCase()))
  ) {
    return ROLES.FACTURACION;
  }
  if (vendedorEmails.has(normalizedEmail)) {
    return ROLES.VENDEDOR;
  }
  return ROLES.CONSULTA;
}

export function getRoleCapabilities(role) {
  switch (role) {
    case ROLES.GERENCIA:
      return {
        label: "Gerencia",
        canCreateQuote: true,
        canEditOwnQuote: true,
        canInvoice: false,
        canPrintShippingOrder: false, // Regla explícita: Gerencia no imprime envíos
        canTogglePaid: true,
        canViewAllSellers: true,
        canExportExcel: true,
        canViewPricesAlert: true,
        canEditPrices: true,
      };
    case ROLES.FACTURACION:
      return {
        label: "Facturación",
        canCreateQuote: false,
        canEditOwnQuote: false,
        canInvoice: true,
        canPrintShippingOrder: true, // Exclusivo de Facturación
        canTogglePaid: true,
        canViewAllSellers: true,
        canExportExcel: true,
        canViewPricesAlert: true,
        canEditPrices: true,
      };
    case ROLES.VENDEDOR:
      return {
        label: "Vendedor",
        canCreateQuote: true,
        canEditOwnQuote: true,
        canInvoice: false,
        canPrintShippingOrder: false,
        canTogglePaid: false,
        canViewAllSellers: false,
        canExportExcel: true,
        canViewPricesAlert: false,
        canEditPrices: false,
      };
    default:
      return {
        label: "Solo lectura",
        canCreateQuote: false,
        canEditOwnQuote: false,
        canInvoice: false,
        canPrintShippingOrder: false,
        canTogglePaid: false,
        canViewAllSellers: false,
        canExportExcel: false,
        canViewPricesAlert: false,
        canEditPrices: false,
      };
  }
}

/**
 * Calcula días transcurridos enteros desde fechaFacturacion hasta referenceDate.
 * Devuelve null si fechaFacturacion no es válida.
 */
export function computeElapsedDays(fechaFacturacion, referenceDate = new Date()) {
  if (!fechaFacturacion) return null;
  const start = new Date(fechaFacturacion);
  const end = new Date(referenceDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
  const startUtc = Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate());
  const endUtc = Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate());
  return Math.max(0, Math.floor((endUtc - startUtc) / 86400000));
}

/**
 * Filtra documentos para el Reporte de Ventas por período (fromDate..toDate)
 * y selección múltiple de clientes (vacío = todos; array con 1 o varios = solo esos).
 */
export function filterSalesReportDocs(docs, { fromDate = "", toDate = "", selectedClients = [], states = [DOC_STATES.FACTURADO] } = {}) {
  const allowedStates = states && states.length ? new Set(states) : null;
  const clientSet = new Set(
    (selectedClients || [])
      .map((c) => String(c || "").trim().toUpperCase())
      .filter(Boolean)
  );

  const fromMs = fromDate ? Date.parse(`${fromDate}T00:00:00Z`) : null;
  const toMs = toDate ? Date.parse(`${toDate}T23:59:59Z`) : null;

  return (docs || []).filter((doc) => {
    if (allowedStates && !allowedStates.has(doc.Estado)) return false;

    if (clientSet.size > 0) {
      const name = String(doc.ClienteNombre || "").trim().toUpperCase();
      if (!clientSet.has(name)) return false;
    }

    const rawDate = doc.FechaFacturacion || doc.FechaConversionOC || doc.Created;
    if ((fromMs !== null || toMs !== null) && rawDate) {
      const docMs = Date.parse(rawDate);
      if (!Number.isNaN(docMs)) {
        if (fromMs !== null && docMs < fromMs) return false;
        if (toMs !== null && docMs > toMs) return false;
      }
    } else if ((fromMs !== null || toMs !== null) && !rawDate) {
      return false;
    }

    return true;
  });
}

/**
 * Sincroniza FormaPago ("Contado" | "Credito") y DiasCredito.
 * - Contado siempre tiene 0 días de crédito.
 * - Si DiasCredito > 0, FormaPago pasa a "Credito".
 * - Si cambia FormaPago a "Credito" con 0 días, asigna defaultCreditDays (30).
 */
export function syncPaymentTerms({ formaPago, diasCredito, changedField = "formaPago", defaultCreditDays = 30 } = {}) {
  const days = Math.max(0, Math.floor(Number(diasCredito) || 0));
  if (changedField === "diasCredito") {
    return days > 0
      ? { formaPago: "Credito", diasCredito: days }
      : { formaPago: "Contado", diasCredito: 0 };
  }
  if (formaPago === "Contado") {
    return { formaPago: "Contado", diasCredito: 0 };
  }
  return {
    formaPago: "Credito",
    diasCredito: days > 0 ? days : defaultCreditDays,
  };
}

export function canAddProductLine(existingLines, productoId) {
  const target = String(productoId || "").trim();
  if (!target) return false;
  return !(existingLines || []).some((l) => String(l.productoId) === target);
}

export function mapDispatchDeliveryStatus(despachoEstado) {
  const raw = String(despachoEstado || "").trim();
  if (!raw) return null;
  const map = {
    Pendiente: { label: "Despacho: Pendiente", cls: "badge-neutral" },
    Enviado: { label: "Enviada", cls: "badge-info" },
    Entregado: { label: "Entregada", cls: "badge-success" },
    Faltantes: { label: "Con faltantes", cls: "badge-danger" },
    Devuelto: { label: "Devuelto", cls: "badge-warning" },
    ANULADO: { label: "Despacho Anulado", cls: "badge-danger" },
  };
  return map[raw] || { label: `Despacho: ${raw}`, cls: "badge-neutral" };
}

export function validateDiscardReason(reason) {
  const clean = String(reason || "").trim();
  if (!clean) {
    return { ok: false, error: "Debes ingresar un motivo para descartar la cotización." };
  }
  return { ok: true, reason: clean };
}

export function validatePriceUpdate({ precioReferencia, precioCredito, precioMinimoGerencia } = {}) {
  const std = Number(precioReferencia);
  const cred = precioCredito === "" || precioCredito === null || precioCredito === undefined
    ? std
    : Number(precioCredito);
  const min = precioMinimoGerencia === "" || precioMinimoGerencia === null || precioMinimoGerencia === undefined
    ? 0
    : Number(precioMinimoGerencia);

  if (!Number.isFinite(std) || std <= 0) {
    return { ok: false, error: "El precio estándar (Contado) debe ser mayor a 0." };
  }
  if (!Number.isFinite(cred) || cred < 0) {
    return { ok: false, error: "El precio de crédito no puede ser negativo." };
  }
  if (!Number.isFinite(min) || min < 0) {
    return { ok: false, error: "El precio mínimo no puede ser negativo." };
  }
  if (min > std) {
    return { ok: false, error: "El precio mínimo de Gerencia no puede ser mayor al precio estándar." };
  }
  return {
    ok: true,
    values: {
      PrecioReferencia: Number(std.toFixed(2)),
      PrecioCredito: Number(cred.toFixed(2)),
      PrecioMinimoGerencia: Number(min.toFixed(2)),
    },
  };
}

/**
 * Calcula conversión dual Unidades <-> Atados y Quintales.
 */
export function computeLineMetrics(cantidadUnidades, precioUnitario, unidadesPorAtado = 0, unidadesPorQuintal = 0) {
  const qty = Math.max(0, Number(cantidadUnidades) || 0);
  const price = Math.max(0, Number(precioUnitario) || 0);
  const upa = Math.max(0, Number(unidadesPorAtado) || 0);
  const upq = Math.max(0, Number(unidadesPorQuintal) || 0);
  return {
    cantidadUnidades: qty,
    cantidadAtados: upa > 0 ? Number((qty / upa).toFixed(2)) : 0,
    pesoQuintales: upq > 0 ? Number((qty / upq).toFixed(2)) : 0,
    subtotal: Number((qty * price).toFixed(2)),
  };
}

// Configuración pública exclusiva para demostración interactiva (sin conexión a tenant ni SharePoint).
export const APP_CONFIG = {
  tenantId: "",
  clientId: "",
  scopes: [],
  demoMode: true,
  comercialSite: { url: "", siteId: "", lists: {} },
  despachosSite: { url: "", siteId: "", lists: {} },
  roles: {
    gerenciaEmails: [],
    facturacionEmails: [],
    vendedorEmails: [],
    entraGroups: {},
  },
};

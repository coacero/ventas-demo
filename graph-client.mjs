const GRAPH_BASE = "https://graph.microsoft.com/v1.0";

export class GraphClient {
  constructor(getAccessToken, config) {
    this.getAccessToken = getAccessToken;
    this.config = config;
  }

  async request(pathOrUrl, options = {}) {
    const token = await this.getAccessToken();
    const url = pathOrUrl.startsWith("http") ? pathOrUrl : `${GRAPH_BASE}${pathOrUrl}`;
    const headers = {
      Authorization: `Bearer ${token}`,
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.headers || {}),
    };
    const res = await fetch(url, { ...options, headers });
    if (!res.ok) {
      let detail = "";
      try {
        const err = await res.json();
        detail = err?.error?.message || JSON.stringify(err);
      } catch {
        detail = await res.text().catch(() => "");
      }
      const error = new Error(`Graph ${res.status}: ${detail || res.statusText}`);
      error.status = res.status;
      throw error;
    }
    if (res.status === 204) return null;
    return res.json();
  }

  async getAllListItems(siteId, listId, query = "$expand=fields&$top=200") {
    const items = [];
    let next = `/sites/${siteId}/lists/${listId}/items?${query}`;
    while (next) {
      const data = await this.request(next, {
        headers: { Prefer: "HonorNonIndexedQueriesWarningMayFailRandomly" },
      });
      if (Array.isArray(data?.value)) {
        for (const item of data.value) {
          items.push({
            id: item.id,
            createdDateTime: item.createdDateTime,
            lastModifiedDateTime: item.lastModifiedDateTime,
            ...(item.fields || {}),
          });
        }
      }
      next = data?.["@odata.nextLink"] || null;
    }
    return items;
  }

  async fetchUserGroupIds() {
    const data = await this.request("/me/transitiveMemberOf?$select=id");
    return (data?.value || []).map((g) => g.id).filter(Boolean);
  }

  async fetchDocumentos() {
    const { siteId, lists } = this.config.comercialSite;
    return this.getAllListItems(siteId, lists.documentos);
  }

  async fetchLineas(documentoId = null) {
    const { siteId, lists } = this.config.comercialSite;
    const filter = documentoId
      ? `$expand=fields&$filter=fields/DocumentoId eq ${Number(documentoId)}&$top=200`
      : "$expand=fields&$top=200";
    return this.getAllListItems(siteId, lists.lineas, filter);
  }

  async fetchClientes() {
    const { siteId, lists } = this.config.comercialSite;
    return this.getAllListItems(siteId, lists.clientes);
  }

  async fetchPrecios() {
    const { siteId, lists } = this.config.comercialSite;
    return this.getAllListItems(siteId, lists.precios);
  }

  async fetchProductos() {
    const { siteId, lists } = this.config.despachosSite;
    return this.getAllListItems(siteId, lists.productos);
  }

  async fetchDespachosEstados() {
    const { siteId, lists } = this.config.despachosSite;
    return this.getAllListItems(siteId, lists.despachos, "$expand=fields($select=Title,NumeroDespacho,Estado)&$top=200");
  }

  async createDocumento(fields) {
    const { siteId, lists } = this.config.comercialSite;
    return this.request(`/sites/${siteId}/lists/${lists.documentos}/items`, {
      method: "POST",
      body: JSON.stringify({ fields }),
    });
  }

  async updateDocumento(itemId, fields) {
    const { siteId, lists } = this.config.comercialSite;
    return this.request(`/sites/${siteId}/lists/${lists.documentos}/items/${itemId}/fields`, {
      method: "PATCH",
      body: JSON.stringify(fields),
    });
  }

  async createLinea(fields) {
    const { siteId, lists } = this.config.comercialSite;
    return this.request(`/sites/${siteId}/lists/${lists.lineas}/items`, {
      method: "POST",
      body: JSON.stringify({ fields }),
    });
  }

  async updateLinea(itemId, fields) {
    const { siteId, lists } = this.config.comercialSite;
    return this.request(`/sites/${siteId}/lists/${lists.lineas}/items/${itemId}/fields`, {
      method: "PATCH",
      body: JSON.stringify(fields),
    });
  }

  async deleteLinea(itemId) {
    const { siteId, lists } = this.config.comercialSite;
    return this.request(`/sites/${siteId}/lists/${lists.lineas}/items/${itemId}`, {
      method: "DELETE",
    });
  }

  async createCliente(fields) {
    const { siteId, lists } = this.config.comercialSite;
    return this.request(`/sites/${siteId}/lists/${lists.clientes}/items`, {
      method: "POST",
      body: JSON.stringify({ fields }),
    });
  }

  async updatePrecio(itemId, fields) {
    const { siteId, lists } = this.config.comercialSite;
    return this.request(`/sites/${siteId}/lists/${lists.precios}/items/${itemId}/fields`, {
      method: "PATCH",
      body: JSON.stringify(fields),
    });
  }

  async createPrecio(fields) {
    const { siteId, lists } = this.config.comercialSite;
    return this.request(`/sites/${siteId}/lists/${lists.precios}/items`, {
      method: "POST",
      body: JSON.stringify({ fields }),
    });
  }
}

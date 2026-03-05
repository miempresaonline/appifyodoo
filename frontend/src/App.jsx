import { useState, useEffect } from 'react';
import axios from 'axios';
import { Search, Loader2, Send, Download, Phone, Mail, Globe, Database, ListPlus } from 'lucide-react';
import Papa from 'papaparse';

const API_URL = window.location.origin + '/api';

function App() {
  const [query, setQuery] = useState('');
  const [maxResults, setMaxResults] = useState(10);
  const [isScraping, setIsScraping] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [leads, setLeads] = useState([]);
  const [message, setMessage] = useState('');
  const [mailingLists, setMailingLists] = useState([]);
  const [selectedListId, setSelectedListId] = useState('');

  // Cargar listas de correo al montar el componente
  useEffect(() => {
    const fetchMailingLists = async () => {
      try {
        const response = await axios.get(`${API_URL}/odoo/mailing-lists`);
        setMailingLists(response.data || []);
      } catch (error) {
        console.error('Error cargando listas de correo:', error);
      }
    };
    fetchMailingLists();
  }, []);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!query) return;

    setIsScraping(true);
    setMessage('🚀 Iniciando scraping en Apify... Esto puede tomar de 1 a 3 minutos.');
    try {
      const response = await axios.post(`${API_URL}/scrape`, { query, maxResults });
      setLeads(response.data.leads || []);
      setMessage(`✅ Scraping completado. Encontrados ${response.data.leads?.length} leads.`);
    } catch (error) {
      console.error(error);
      setMessage(`❌ Error al scrapear: ${error.response?.data?.error || error.message}`);
    } finally {
      setIsScraping(false);
    }
  };

  const handleExportOdoo = async () => {
    if (leads.length === 0) return;
    setIsExporting(true);
    setMessage(`⏳ Exportando ${leads.length} leads a Odoo...`);

    try {
      const response = await axios.post(`${API_URL}/export-odoo`, { leads, mailingListId: selectedListId });
      const results = response.data.results || [];
      const successCount = results.filter(r => r.status === 'success').length;

      // Actualizamos el estado de los leads localmente
      setLeads(results);
      setMessage(`✅ Exportación finalizada. ${successCount} exportados a Odoo de forma exitosa.`);
    } catch (error) {
      console.error(error);
      setMessage(`❌ Error al exportar a Odoo: ${error.response?.data?.error || error.message}`);
    } finally {
      setIsExporting(false);
    }
  };

  const exportCSV = () => {
    const csvData = leads.map(l => ({
      Nombre: l.nombre,
      Telefono: l.telefono,
      Email: l.email,
      Web: l.web,
      Odoo_Estado: l.status,
      Odoo_ID: l.odoo_id
    }));
    const csv = Papa.unparse(csvData);
    const stringRef = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(stringRef);
    link.href = url;
    link.setAttribute('download', 'leads_apify.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '40px 20px' }}>
      <header style={{ textAlign: 'center', marginBottom: '40px' }}>
        <h1 style={{ fontSize: '2.5rem', marginBottom: '12px', background: 'linear-gradient(to right, var(--accent-color), #8b5cf6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          Apify Lead Generator
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem' }}>Extracción premium de Google Maps & Emailing para Odoo</p>
      </header>

      <main>
        {/* Search Panel */}
        <div className="glass-panel" style={{ padding: '32px', marginBottom: '24px' }}>
          <form onSubmit={handleSearch} style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div style={{ flex: '1 1 300px' }}>
              <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Término de Búsqueda (Ej: Restaurantes en Valencia)</label>
              <input
                type="text"
                className="custom-input"
                placeholder="Ingresa negocio y ubicación..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                required
              />
            </div>
            <div style={{ width: '120px' }}>
              <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Límite</label>
              <input
                type="number"
                className="custom-input"
                min="1"
                max="100"
                value={maxResults}
                onChange={(e) => setMaxResults(e.target.value)}
              />
            </div>
            <button
              type="submit"
              className="custom-button"
              disabled={isScraping}
              style={{ height: '46px' }}
            >
              {isScraping ? <Loader2 className="animate-spin" size={20} /> : <Search size={20} />}
              {isScraping ? 'Extrayendo...' : 'Generar Leads'}
            </button>
          </form>

          {message && (
            <div style={{ marginTop: '20px', padding: '16px', background: 'rgba(255, 255, 255, 0.03)', borderRadius: '8px', borderLeft: '3px solid var(--accent-color)', fontSize: '0.95rem' }}>
              {message}
            </div>
          )}
        </div>

        {/* Results Panel */}
        {leads.length > 0 && (
          <div className="glass-panel" style={{ padding: '32px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
              <h2 style={{ fontSize: '1.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Database size={24} color="var(--accent-color)" /> Leads Encontrados ({leads.length})
              </h2>
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
                <button
                  onClick={exportCSV}
                  className="custom-button"
                  style={{ background: 'transparent', border: '1px solid var(--panel-border)', boxShadow: 'none' }}
                >
                  <Download size={18} /> CSV
                </button>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(0,0,0,0.2)', padding: '4px 8px 4px 12px', borderRadius: '8px' }}>
                  <ListPlus size={16} color="var(--text-secondary)" />
                  <select
                    className="custom-input"
                    style={{ padding: '6px 32px 6px 12px', height: 'auto', minWidth: '150px', border: 'none', background: 'transparent', fontSize: '0.9rem' }}
                    value={selectedListId}
                    onChange={(e) => setSelectedListId(e.target.value)}
                  >
                    <option value="">Añadir a lista...</option>
                    {mailingLists.map(list => (
                      <option key={list.id} value={list.id}>{list.name}</option>
                    ))}
                  </select>
                </div>

                <button
                  onClick={handleExportOdoo}
                  className="custom-button"
                  disabled={isExporting}
                >
                  {isExporting ? <Loader2 className="animate-spin" size={18} /> : <Send size={18} />}
                  {isExporting ? 'Enviando...' : 'Exportar a Odoo'}
                </button>
              </div>
            </div>

            <div className="custom-table-wrapper">
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>Empresa</th>
                    <th>Contacto</th>
                    <th>Presencia Digital</th>
                    <th>Estado Odoo</th>
                  </tr>
                </thead>
                <tbody>
                  {leads.map((lead) => (
                    <tr key={lead.id}>
                      <td style={{ fontWeight: '500' }}>{lead.nombre}</td>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          {lead.telefono && (
                            <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                              <Phone size={14} /> {lead.telefono}
                            </span>
                          )}
                          {lead.email && (
                            <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.9rem', color: 'var(--accent-color)' }}>
                              <Mail size={14} /> {lead.email}
                            </span>
                          )}
                        </div>
                      </td>
                      <td>
                        {lead.web ? (
                          <a href={lead.web} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.9rem', color: '#8b5cf6', textDecoration: 'none' }}>
                            <Globe size={14} /> Visitar Web
                          </a>
                        ) : <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>N/A</span>}
                      </td>
                      <td>
                        {!lead.status && <span className="badge badge-warning">Pendiente</span>}
                        {lead.status === 'success' && <span className="badge badge-success">Exportado (ID: {lead.odoo_id})</span>}
                        {lead.status === 'failed' && <span className="badge badge-error" title={lead.error}>Error</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

          </div>
        )}
      </main>
    </div>
  );
}

export default App;

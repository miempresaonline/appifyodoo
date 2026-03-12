const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const xmlrpc = require('xmlrpc');
const { ApifyClient } = require('apify-client');
const path = require('path');

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Servir la vista React compilada
app.use(express.static(path.join(__dirname, 'public'), {
    setHeaders: (res, filePath) => {
        if (filePath.endsWith('.js')) {
            res.setHeader('Content-Type', 'application/javascript');
        } else if (filePath.endsWith('.css')) {
            res.setHeader('Content-Type', 'text/css');
        }
    }
}));

const apifyClient = new ApifyClient({
    token: process.env.APIFY_API_TOKEN,
});

// Odoo Configuration
const odooUrl = new URL(process.env.ODOO_URL || 'http://localhost');
const odooDb = process.env.ODOO_DB;
const odooUsername = process.env.ODOO_USERNAME;
const odooPassword = process.env.ODOO_PASSWORD;

// Import OdooClient
const odooClient = require('./odooClient.js');

app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
});

// Memoria temporal para trabajos en segundo plano
const jobs = {};

app.post('/api/scrape', async (req, res) => {
    try {
        const { query, maxResults = 10 } = req.body;

        if (!process.env.APIFY_API_TOKEN || process.env.APIFY_API_TOKEN.includes('tu_token_aqui')) {
            return res.status(400).json({ error: 'Configura APIFY_API_TOKEN en el .env del backend' });
        }

        const jobId = Math.random().toString(36).substring(2, 15);
        jobs[jobId] = { status: 'processing', progress: 0, leads: [], error: null };

        // Devolvemos respuesta inmediatamente para no bloquear a Nginx
        res.json({ message: 'Scraping en segundo plano iniciado', jobId });

        console.log(`[Job ${jobId}] Iniciando scrape asincrónico para: ${query}`);

        // Función auto-ejecutable en background
        (async () => {
            try {
                // Usamos un actor genérico de Maps
                const actorId = 'compass/google-maps-extractor';

                let searchTerm = query;
                let locationQuery = '';

                // Intentar separar el término de búsqueda de la ubicación (ej: "Electricistas en Madrid")
                const enMatch = query.match(/(.+)\s+en\s+(.+)/i);
                if (enMatch) {
                    searchTerm = enMatch[1].trim();
                    locationQuery = enMatch[2].trim();
                }

                console.log(`[Job ${jobId}] Ejecutando actor con searchTerm: "${searchTerm}" y locationQuery: "${locationQuery}"`);

                const run = await apifyClient.actor(actorId).call({
                    searchStringsArray: [searchTerm],
                    locationQuery: locationQuery,
                    maxCrawledPlacesPerSearch: parseInt(maxResults),
                    language: 'es',
                    maxImages: 0,
                    maxReviews: 0,
                    scrapeContactDetails: true,
                    scrapeContacts: true
                });

                console.log(`[Job ${jobId}] Scrape finalizado. Descargando dataset... (Run ID: ${run.id})`);
                const { items } = await apifyClient.dataset(run.defaultDatasetId).listItems();

                // Limpiar y mapear la data. También realizamos un scraping súper rápido interno para cazar emails.
                const axios = require('axios');
                const cheerio = require('cheerio');

                let processed = 0;

                const leads = await Promise.all(items.map(async item => {
                    let email = item.email || item.emails?.[0] || '';
                    const web = item.website || item.url || '';

                    // Actualizar el progreso (aproximado, no bloquea)
                    processed++;
                    jobs[jobId].progress = Math.floor((processed / items.length) * 100);

                    if (!email && web) {
                        try {
                            const siteRes = await axios.get(web, { timeout: 3500, headers: { 'User-Agent': 'Mozilla/5.0' } });
                            const $ = cheerio.load(siteRes.data);
                            const text = $('body').text();
                            const mailto = $('a[href^="mailto:"]').first().attr('href');
                            if (mailto) {
                                email = mailto.replace('mailto:', '').split('?')[0].trim();
                            } else {
                                // Regex simple para emails
                                const emailMatches = text.match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)/gi);
                                if (emailMatches && emailMatches.length > 0) {
                                    // Coger el primero válido que no parezca archivo (ej. jpg@2x no)
                                    const validEmails = emailMatches.filter(e => !e.endsWith('.jpg') && !e.endsWith('.png'));
                                    if (validEmails.length > 0) email = validEmails[0];
                                }
                            }
                        } catch (e) {
                            // Ignorar errores de timeout o web caída
                        }
                    }

                    return {
                        id: item.placeId || Math.random().toString(36).substring(7),
                        nombre: item.title || item.name || '',
                        telefono: item.phone || item.phoneUnformatted || '',
                        email: email,
                        web: web
                    };
                }));

                // Filtrar solo los que tienen nombre
                const finalLeads = leads.filter(lead => lead.nombre);

                jobs[jobId].status = 'done';
                jobs[jobId].leads = finalLeads;
                console.log(`[Job ${jobId}] Búsqueda finalizada con ${finalLeads.length} leads validos`);
            } catch (error) {
                console.error(`[Job ${jobId}] Error:`, error);
                jobs[jobId].status = 'error';
                jobs[jobId].error = error.message || 'Error en segundo plano';
            }
        })();
    } catch (error) {
        console.error('Error starting /api/scrape:', error);
        res.status(500).json({ error: error.message || 'Failed to start scraping' });
    }
});

app.get('/api/scrape/status/:jobId', (req, res) => {
    const job = jobs[req.params.jobId];
    if (!job) return res.status(404).json({ error: 'Trabajo no encontrado' });

    // Devolver el estado actual
    res.json(job);

    // Limpiar memoria si ya terminó para no saturar el servidor
    if (job.status === 'done' || job.status === 'error') {
        // give frontend a couple minutes to fetch before deleting
        setTimeout(() => delete jobs[req.params.jobId], 5 * 60 * 1000);
    }
});

app.get('/api/odoo/mailing-lists', async (req, res) => {
    try {
        const lists = await odooClient.getMailingLists();
        res.json(lists);
    } catch (error) {
        console.error('Error in /api/odoo/mailing-lists:', error);
        res.status(500).json({ error: 'Failed to fetch mailing lists' });
    }
});

app.post('/api/export-odoo', async (req, res) => {
    try {
        const { leads, mailingListId } = req.body;
        if (!leads || !Array.isArray(leads)) {
            return res.status(400).json({ error: 'Formato de leads incorrecto' });
        }

        console.log(`Iniciando exportación de ${leads.length} leads a Odoo... (Lista: ${mailingListId || 'Ninguna'})`);
        const results = [];

        for (const lead of leads) {
            try {
                const partnerId = await odooClient.createPartner(lead, mailingListId);
                results.push({ ...lead, odoo_id: partnerId, status: 'success' });
            } catch (err) {
                results.push({ ...lead, error: err.message || 'Error en Odoo', status: 'failed' });
            }
        }

        res.json({ message: 'Exportación completada', results });
    } catch (error) {
        console.error('Error exporting to Odoo:', error);
        res.status(500).json({ error: 'Failed to export to Odoo' });
    }
});

const PORT = process.env.PORT || 3001;

// Fallback para React Router (cualquier ruta que no sea /api/ va al index.html de React)
app.use((req, res, next) => {
    if (req.path.startsWith('/api/')) return next();
    const indexPath = path.join(__dirname, 'public', 'index.html');
    res.sendFile(indexPath, err => {
        if (err) res.status(404).send('Not Found: ' + err.message + ' at ' + indexPath);
    });
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

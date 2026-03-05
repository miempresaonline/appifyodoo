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

// Todo: implement scraping logic
app.post('/api/scrape', async (req, res) => {
    try {
        const { query, maxResults = 10 } = req.body;

        if (!process.env.APIFY_API_TOKEN || process.env.APIFY_API_TOKEN.includes('tu_token_aqui')) {
            return res.status(400).json({ error: 'Configura APIFY_API_TOKEN en el .env del backend' });
        }

        console.log(`Iniciando scrape para: ${query}`);

        // Usamos un actor genérico de Maps que también suele buscar emails (ej: jupri/google-maps o similar, 
        // aquí ponemos uno oficial o popular. Vamos a usar compass/google-maps-extractor)
        const actorId = 'compass/google-maps-extractor';

        const run = await apifyClient.actor(actorId).call({
            searchStringsArray: [query],
            maxCrawledPlacesPerSearch: parseInt(maxResults),
            language: 'es',
            maxImages: 0,
            maxReviews: 0,
            scrapeContactDetails: true,
            scrapeContacts: true, // Esto enriquece los resultados con emails y redes de la web oficial
        });

        console.log(`Scrape finalizado. Descargando dataset... (Run ID: ${run.id})`);
        const { items } = await apifyClient.dataset(run.defaultDatasetId).listItems();

        // Limpiar y mapear la data. También realizamos un scraping súper rápido interno para cazar emails.
        const axios = require('axios');
        const cheerio = require('cheerio');

        const leads = await Promise.all(items.map(async item => {
            let email = item.email || item.emails?.[0] || '';
            const web = item.website || item.url || '';

            // Si el actor de Apify no devolvió email (muy común en Google Maps bots), lo scrapeamos nosotros mismos:
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


        res.json({ message: 'Scraping completado', leads: finalLeads });
    } catch (error) {
        console.error('Error in /api/scrape:', error);
        res.status(500).json({ error: error.message || 'Failed to start scraping' });
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

const xmlrpc = require('xmlrpc');
const dotenv = require('dotenv');
dotenv.config();

class OdooClient {
    constructor() {
        this.url = new URL(process.env.ODOO_URL || 'http://localhost');
        this.db = (process.env.ODOO_DB || '').trim();
        this.username = (process.env.ODOO_USERNAME || '').trim();
        this.password = (process.env.ODOO_PASSWORD || '').trim();
        this.uid = null;

        const hostConfig = {
            host: this.url.hostname,
            port: this.url.port || (this.url.protocol === 'https:' ? 443 : 80),
            path: '/xmlrpc/2/common',
            https: this.url.protocol === 'https:'
        };

        this.commonClient = this.url.protocol === 'https:'
            ? xmlrpc.createSecureClient(hostConfig)
            : xmlrpc.createClient(hostConfig);

        const objectConfig = {
            ...hostConfig,
            path: '/xmlrpc/2/object'
        };

        this.objectClient = this.url.protocol === 'https:'
            ? xmlrpc.createSecureClient(objectConfig)
            : xmlrpc.createClient(objectConfig);
    }

    async authenticate() {
        return new Promise((resolve, reject) => {
            if (!this.db || !this.username || !this.password) {
                return reject(new Error("Faltan credenciales de Odoo en .env"));
            }
            this.commonClient.methodCall('authenticate', [this.db, this.username, this.password, {}], (error, value) => {
                if (error) {
                    console.error("Error autenticando en Odoo:", error);
                    reject(error);
                } else if (value === false) {
                    const msg = "Credenciales inválidas (usuario o contraseña/API key incorrectos). Base de datos: " + this.db;
                    console.error("Error autenticando en Odoo:", msg);
                    reject(new Error(msg));
                } else {
                    this.uid = value;
                    console.log("Autenticado en Odoo con UID:", this.uid);
                    resolve(this.uid);
                }
            });
        });
    }

    async createPartner(leadData) {
        if (!this.uid) await this.authenticate();

        return new Promise((resolve, reject) => {
            // Mapping leadData to Odoo res.partner fields
            const partnerData = {
                name: leadData.nombre || 'Lead Desconocido',
                phone: leadData.telefono || '',
                email: leadData.email || '',
                website: leadData.web || '',
                is_company: true, // Assuming we are scraping businesses
                comment: 'Generado desde Apify Scraper App'
            };

            this.objectClient.methodCall('execute_kw', [
                this.db, this.uid, this.password,
                'res.partner', 'create',
                [partnerData]
            ], (error, value) => {
                if (error) {
                    console.error("Error creando lead en Odoo:", error);
                    reject(error);
                } else {
                    console.log("Lead creado en Odoo con ID:", value);
                    resolve(value);
                }
            });
        });
    }
}

module.exports = new OdooClient();

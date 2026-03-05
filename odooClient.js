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

    async getMailingLists() {
        if (!this.uid) await this.authenticate();

        return new Promise((resolve, reject) => {
            // Buscamos todas las listas de correo activas en el módulo de Email Marketing
            this.objectClient.methodCall('execute_kw', [
                this.db, this.uid, this.password,
                'mailing.list', 'search_read',
                [[['active', '=', true]]],
                { fields: ['id', 'name'], limit: 100 }
            ], (error, value) => {
                if (error) {
                    console.error("Error obteniendo listas de correo de Odoo:", error);
                    reject(error);
                } else {
                    console.log(`Obtenidas ${value.length} listas de correo de Odoo.`);
                    resolve(value);
                }
            });
        });
    }

    async createPartner(leadData, mailingListId = null) {
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
            ], (error, partnerId) => {
                if (error) {
                    console.error("Error creando lead en Odoo:", error);
                    return reject(error);
                }
                console.log("Lead creado en Odoo con ID:", partnerId);

                // Si no hay lista de correo, terminamos aquí
                if (!mailingListId) {
                    return resolve(partnerId);
                }

                // Buscamos si el contacto de mailing ya existe
                const mailingContactDomain = [];
                // Para listas de correo, Odoo suele requerir un email sí o sí en mailing.contact
                // Si no hay email, le asignaremos uno ficticio temporal para que pueda entrar en la lista 
                // o pasamos de largo si prefieres que solo entren con email real.
                const emailForMailing = leadData.email || `sin-email-${partnerId}@nodisponible.local`;

                if (leadData.email) {
                    mailingContactDomain.push(['email', '=', leadData.email]);
                } else {
                    // If no email, try to find by name, but it's less reliable for uniqueness
                    mailingContactDomain.push(['name', '=', leadData.nombre]);
                }

                // Buscar en mailing.contact
                this.objectClient.methodCall('execute_kw', [
                    this.db, this.uid, this.password,
                    'mailing.contact', 'search', [mailingContactDomain]
                ], (errContact, contactIds) => {
                    if (errContact) {
                        console.error("Error buscando contacto de mailing:", errContact);
                        return resolve(partnerId); // Continue even if mailing contact search fails
                    }

                    let contactId = contactIds && contactIds.length > 0 ? contactIds[0] : null;

                    // Función interna para añadir a la suscripción
                    const addToSubscription = (cid) => {
                        this.objectClient.methodCall('execute_kw', [
                            this.db, this.uid, this.password,
                            'mailing.contact.subscription', 'search',
                            [[['contact_id', '=', cid], ['list_id', '=', parseInt(mailingListId)]]]
                        ], (errSub, subIds) => {
                            if (errSub) {
                                console.error("Error buscando suscripción existente:", errSub);
                                return resolve(partnerId);
                            }

                            if (!subIds || subIds.length === 0) {
                                this.objectClient.methodCall('execute_kw', [
                                    this.db, this.uid, this.password,
                                    'mailing.contact.subscription', 'create',
                                    [{
                                        contact_id: cid,
                                        list_id: parseInt(mailingListId),
                                        opt_out: false
                                    }]
                                ], (errCreateSub, newSubId) => {
                                    if (errCreateSub) {
                                        console.error(`Error creando suscripción para contacto ${cid} en lista ${mailingListId}:`, errCreateSub);
                                    } else {
                                        console.log(`Contacto ${cid} suscrito a la lista ${mailingListId} con ID: ${newSubId}`);
                                    }
                                    resolve(partnerId);
                                });
                            } else {
                                console.log(`Contacto ${cid} ya suscrito a la lista ${mailingListId}.`);
                                resolve(partnerId);
                            }
                        });
                    };

                    if (!contactId) {
                        // Crear contacto de mailing
                        this.objectClient.methodCall('execute_kw', [
                            this.db, this.uid, this.password,
                            'mailing.contact', 'create',
                            [{
                                name: leadData.nombre,
                                email: emailForMailing
                            }]
                        ], (errCreate, newContactId) => {
                            if (errCreate) {
                                console.error("Error creando contacto de mailing:", errCreate);
                                return resolve(partnerId);
                            }
                            console.log("Contacto de mailing creado con ID:", newContactId);
                            addToSubscription(newContactId);
                        });
                    } else {
                        console.log("Contacto de mailing existente con ID:", contactId);
                        addToSubscription(contactId);
                    }
                });
            });
        });
    }
}

module.exports = new OdooClient();

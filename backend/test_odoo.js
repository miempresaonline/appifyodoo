import odooClient from './odooClient.js';
import dotenv from 'dotenv';

dotenv.config();

async function testConnection() {
    try {
        console.log(`Testing Odoo auth url: ${process.env.ODOO_URL} db: ${process.env.ODOO_DB} user: ${process.env.ODOO_USERNAME}`);
        const uid = await odooClient.authenticate();
        console.log("Authentication successful! UID:", uid);

        // Let's also try with lowercase db just in case
        console.log("\nTesting with lowercase db...");
        odooClient.db = process.env.ODOO_DB.toLowerCase();
        try {
            const uid2 = await odooClient.authenticate();
            console.log("Lowercase authentication successful! UID:", uid2);
        } catch (e) {
            console.log("Lowercase auth failed:", e.message);
        }

    } catch (e) {
        console.error("Authentication failed:", e.message || e);
    }
}

testConnection();

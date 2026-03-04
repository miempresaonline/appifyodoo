import xmlrpc from 'xmlrpc';
import dotenv from 'dotenv';
dotenv.config();

const url = new URL(process.env.ODOO_URL || 'http://localhost');
const hostConfig = {
    host: url.hostname,
    port: url.port || (url.protocol === 'https:' ? 443 : 80),
    path: '/xmlrpc/2/db',
    https: url.protocol === 'https:'
};

const dbClient = url.protocol === 'https:'
    ? xmlrpc.createSecureClient(hostConfig)
    : xmlrpc.createClient(hostConfig);

console.log(`Connecting to Odoo DB endpoint at ${hostConfig.host}...`);

dbClient.methodCall('list', [], (error, value) => {
    if (error) {
        console.error("Error listing databases:", error.faultString || error);
    } else {
        console.log("Available databases:", value);
    }
});

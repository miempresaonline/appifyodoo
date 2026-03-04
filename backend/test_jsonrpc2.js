
import dotenv from 'dotenv';
dotenv.config();

async function testJsonRpc(dbName) {
    const url = `${process.env.ODOO_URL}/jsonrpc`;
    const payload = {
        jsonrpc: "2.0",
        method: "call",
        params: {
            service: "common",
            method: "authenticate",
            args: [dbName, process.env.ODOO_USERNAME, process.env.ODOO_PASSWORD, {}]
        },
        id: 1
    };

    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        console.log(`JSON-RPC response for DB ${dbName}:`, JSON.stringify(data, null, 2));
    } catch (e) {
        console.error("Error:", e);
    }
}

async function run() {
    console.log("Testing with PRODUCCION:");
    await testJsonRpc(process.env.ODOO_DB);

    console.log("Testing with a fake DB:");
    await testJsonRpc('faketestdb123');
}

run();

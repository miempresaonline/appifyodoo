import dotenv from 'dotenv';
dotenv.config();

async function testJsonRpc() {
    const url = `${process.env.ODOO_URL}/jsonrpc`;
    const payload = {
        jsonrpc: "2.0",
        method: "call",
        params: {
            service: "common",
            method: "authenticate",
            args: [process.env.ODOO_DB, process.env.ODOO_USERNAME, process.env.ODOO_PASSWORD, {}]
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
        console.log("JSON-RPC response:", JSON.stringify(data, null, 2));
    } catch (e) {
        console.error("Error:", e);
    }
}

testJsonRpc();

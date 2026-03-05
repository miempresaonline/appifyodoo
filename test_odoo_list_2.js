require('dotenv').config();
const odooClient = require('./odooClient');

async function test() {
    try {
        await odooClient.authenticate();
        console.log("Connected to Odoo");

        const listId = "1";
        const email = "test-sin-email-2@nodisponible.local";
        const nombre = "TEST CONTACT 2";

        odooClient.objectClient.methodCall('execute_kw', [
            odooClient.db, odooClient.uid, odooClient.password,
            'mailing.contact', 'create',
            [{
                name: nombre,
                email: email,
                list_ids: [[4, parseInt(listId), 0]]
            }]
        ], (errC, nid) => {
            if (errC) return console.error("Error creating mailing contact:", errC);
            console.log("Created mailing contact with list:", nid);

            // test write
            odooClient.objectClient.methodCall('execute_kw', [
                odooClient.db, odooClient.uid, odooClient.password,
                'mailing.contact', 'write',
                [[nid], {
                    list_ids: [[4, parseInt(listId), 0]]
                }]
            ], (errW, r) => {
                if (errW) return console.error("Error writing list:", errW);
                console.log("Wrote list successfully:", r);
            });
        });

    } catch (e) {
        console.error(e);
    }
}
test();

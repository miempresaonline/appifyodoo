require('dotenv').config();
const odooClient = require('./odooClient');

async function test() {
    try {
        await odooClient.authenticate();

        console.log("Connected to Odoo");

        // The list ID user selected (usually 1 or 2)
        const listId = "1";
        const email = "test-sin-email@nodisponible.local";
        const nombre = "TEST CONTACT SINE MIAL";

        const partnerId = await new Promise((resolve, reject) => {
            odooClient.objectClient.methodCall('execute_kw', [
                odooClient.db, odooClient.uid, odooClient.password,
                'res.partner', 'create',
                [{
                    name: nombre,
                    email: email,
                    phone: "12345678"
                }]
            ], (err, id) => {
                if (err) return reject(err);
                resolve(id);
            });
        });
        console.log("Partner ID created:", partnerId);

        // Execute the exact mailing list code.
        const mailingContactDomain = [['email', '=', email]];
        odooClient.objectClient.methodCall('execute_kw', [
            odooClient.db, odooClient.uid, odooClient.password,
            'mailing.contact', 'search', [mailingContactDomain]
        ], (errContact, contactIds) => {
            if (errContact) {
                console.error("Error buscando contacto:", errContact);
                return;
            }
            let contactId = contactIds && contactIds.length > 0 ? contactIds[0] : null;

            const addToSub = (cid) => {
                odooClient.objectClient.methodCall('execute_kw', [
                    odooClient.db, odooClient.uid, odooClient.password,
                    'mailing.contact.subscription', 'create',
                    [{
                        contact_id: cid,
                        list_id: parseInt(listId),
                        opt_out: false
                    }]
                ], (errSub, subId) => {
                    if (errSub) console.error("Error subscribing:", errSub);
                    else console.log("Subscribed on ID", subId);
                });
            };

            if (!contactId) {
                odooClient.objectClient.methodCall('execute_kw', [
                    odooClient.db, odooClient.uid, odooClient.password,
                    'mailing.contact', 'create',
                    [{
                        name: nombre,
                        email: email
                    }]
                ], (errC, nid) => {
                    if (errC) return console.error("Error creating mailing contact:", errC);
                    console.log("Created mailing contact:", nid);
                    addToSub(nid);
                });
            } else {
                addToSub(contactId);
            }
        });

    } catch (e) {
        console.error(e);
    }
}
test();

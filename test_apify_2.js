require('dotenv').config();
const { ApifyClient } = require('apify-client');

const client = new ApifyClient({
    token: process.env.APIFY_API_TOKEN,
});

async function main() {
    // using the dataset ID from the previous run
    const { items } = await client.dataset('nStk0j0wN38bKqD3u').listItems();
    console.log(JSON.stringify(items[0], null, 2));
}
main().catch(console.error);

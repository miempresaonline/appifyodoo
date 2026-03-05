require('dotenv').config();
const { ApifyClient } = require('apify-client');

const client = new ApifyClient({
    token: process.env.APIFY_API_TOKEN,
});

async function main() {
    const actorId = 'compass/google-maps-extractor';
    console.log('Running Apify...');
    const run = await client.actor(actorId).call({
        searchStringsArray: ['E-AVE Instalación de Placas Solares en Alicante'],
        maxCrawledPlacesPerSearch: 1,
        language: 'es',
        maxImages: 0,
        maxReviews: 0,
        scrapeContactDetails: true,
        scrapeContacts: true
    });
    console.log('Fetching dataset...');
    const { items } = await client.dataset(run.defaultDatasetId).listItems();
    console.log(JSON.stringify(items[0], null, 2));
}

main().catch(console.error);

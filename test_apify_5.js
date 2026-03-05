require('dotenv').config();
const { ApifyClient } = require('apify-client');

const client = new ApifyClient({
    token: process.env.APIFY_API_TOKEN,
});

async function main() {
    const actorId = 'compass/crawler-google-places';
    console.log('Running Apify...');
    const run = await client.actor(actorId).call({
        searchStringsArray: ['Core Energia Alicante'],
        maxCrawledPlacesPerSearch: 1,
        language: 'es',
        maxImages: 0,
        maxReviews: 0,
        scrapeContactDetails: true,
        maxPagesPerWebsite: 3,
        websiteContactParams: {
            extractEmails: true,
            extractPhones: true
        }
    });
    console.log('Fetching dataset...');
    const { items } = await client.dataset(run.defaultDatasetId).listItems();
    console.log(JSON.stringify(items[0], null, 2));
}

main().catch(console.error);

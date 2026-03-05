require('dotenv').config();
const { ApifyClient } = require('apify-client');
const client = new ApifyClient({ token: process.env.APIFY_API_TOKEN });

async function run() {
    console.time("Apify50");
    const runReq = await client.actor('compass/google-maps-extractor').call({
        searchStringsArray: ['Placas solares castellon'],
        maxCrawledPlacesPerSearch: 10,
        language: 'es',
        maxImages: 0,
        maxReviews: 0,
        scrapeContactDetails: false,
        scrapeContacts: false
    });
    console.timeEnd("Apify50");
    console.log("Finished 10 results");
}
run();

require('dotenv').config();
const { ApifyClient } = require('apify-client');

const client = new ApifyClient({
    token: process.env.APIFY_API_TOKEN,
});

async function main() {
    const actorId = 'compass/google-maps-extractor';
    console.log('Running Apify...');
    const run = await client.actor(actorId).call({
        searchStringsArray: ['Restaurantes Madrid'],
        maxCrawledPlacesPerSearch: 2,
        language: 'es',
        maxImages: 0,
        maxReviews: 0,
        scrapeContactDetails: true,
        scrapeContacts: true
    });
    console.log('Fetching dataset...');
    const { items } = await client.dataset(run.defaultDatasetId).listItems();
    items.forEach((item, i) => {
        console.log(`Place ${i}: ${item.title}`);
        console.log(`Keys:`, Object.keys(item).filter(k => k.toLowerCase().includes('email')));
        console.log(`Emails directly:`, item.email, item.emails, item.emailAddresses, item.contacts);
        console.log(`ContactInfo:`, item.contactInfo, item.socials, item.webContacts);
    });
}

main().catch(console.error);

import { ApifyClient } from 'apify-client';
import dotenv from 'dotenv';
dotenv.config();

const client = new ApifyClient({ token: process.env.APIFY_API_TOKEN });
const actorId = 'compass/google-maps-extractor';

async function testRun() {
    try {
        console.log(`Testing actor: ${actorId}`);
        const run = await client.actor(actorId).call({
            searchStringsArray: ['CLINICAS DENTALES EN MADRID'],
            maxCrawledPlacesPerSearch: 2,
            language: 'es',
            maxImages: 0,
            maxReviews: 0,
            scrapeContactDetails: true
        });
        console.log(`Success, run id: ${run.id}`);
    } catch (e) {
        console.error('Error:', e.message);
    }
}
testRun();

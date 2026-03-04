import { ApifyClient } from 'apify-client';
import dotenv from 'dotenv';
dotenv.config();

const client = new ApifyClient({ token: process.env.APIFY_API_TOKEN });

async function testActor(name) {
    try {
        const actor = await client.actor(name).get();
        console.log(`FOUND: ${name}`);
    } catch (e) {
        console.log(`NOT FOUND: ${name} - ${e.message}`);
    }
}

async function run() {
    await testActor('compass/google-maps');
    await testActor('compass/google-maps-extractor');
    await testActor('apify/google-maps-scraper');
    await testActor('jupri/google-maps');
    await testActor('jupri/google-maps-scraper');
}

run();

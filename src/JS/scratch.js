import { PrismaClient } from '@prisma/client';
import axios from 'axios';

const prisma = new PrismaClient();

async function main() {
    console.log("Checking collaborations...");
    const collabs = await prisma.collaboration.findMany({
        include: { initiator: true, target: true }
    });
    console.log(`Found ${collabs.length} collaborations.`);
    
    for (const collab of collabs) {
        console.log(`\nCollab: ${collab.id}`);
        console.log(`Initiator: ${collab.initiator.username}, Token length: ${collab.initiator.accessToken?.length || 0}`);
        console.log(`Target: ${collab.target.username}, Token length: ${collab.target.accessToken?.length || 0}`);
        console.log(`Repo: ${collab.repoName}`);
        
        if (collab.initiator.accessToken) {
            try {
                // Check token scopes
                const res = await axios.get('https://api.github.com/user', {
                    headers: { Authorization: `Bearer ${collab.initiator.accessToken}` }
                });
                console.log(`Initiator scopes: ${res.headers['x-oauth-scopes']}`);
            } catch (e) {
                console.log(`Initiator token invalid: ${e.message}`);
            }
        }
    }
}

main().catch(e => console.error(e)).finally(() => prisma.$disconnect());

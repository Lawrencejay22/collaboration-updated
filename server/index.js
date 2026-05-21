import express from 'express';
import cors from 'cors';
import axios from 'axios';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from server/.env
dotenv.config({ path: path.resolve(__dirname, '.env') });

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// OAuth configuration
const CLIENT_ID = process.env.GITHUB_CLIENT_ID;
const CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET;

// Determine environment
const IS_PROD = process.env.NODE_ENV === 'production' || process.env.VERCEL;

// Vercel populates VERCEL_PROJECT_PRODUCTION_URL or VERCEL_URL. Fallback to localhost.
const host = process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL || 'localhost:3000';
const BASE_URL = IS_PROD ? `https://${host}` : 'http://localhost:3000';
const FRONTEND_BASE = IS_PROD ? `https://${host}` : 'http://localhost:5173';

const CALLBACK_URL = `${BASE_URL}/api/auth/github/callback`;
const FRONTEND_URL = `${FRONTEND_BASE}`;
// Debug: show callback URL on server start (helps verify Vercel env)
console.log('🔧 CALLBACK_URL:', CALLBACK_URL);

// 1. Redirect user to GitHub for authorization
app.get('/api/auth/github', (req, res) => {
    if (!CLIENT_ID || CLIENT_ID.includes('YOUR_GITHUB_CLIENT_ID_HERE')) {
        return res.status(500).send(`
            <h1>Backend Error: Missing GitHub Credentials</h1>
            <p>You must configure your GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET in the <code>server/.env</code> file.</p>
        `);
    }

    const githubAuthUrl = `https://github.com/login/oauth/authorize?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(CALLBACK_URL)}&scope=repo read:user user:follow`;
    res.redirect(githubAuthUrl);
});

// 2. Handle the callback from GitHub
app.get('/api/auth/github/callback', async (req, res) => {
    const code = req.query.code;
    if (!code) {
        return res.redirect(`${FRONTEND_URL}?error=missing_code`);
    }

    try {
        // Exchange the code for an access token
        const tokenResponse = await axios.post('https://github.com/login/oauth/access_token', {
            client_id: CLIENT_ID,
            client_secret: CLIENT_SECRET,
            code: code
        }, {
            headers: {
                Accept: 'application/json'
            }
        });

        console.log('🔑 Token response data:', tokenResponse.data);
        const accessToken = tokenResponse.data.access_token;

        if (!accessToken) {
            console.error('GitHub Token Error:', tokenResponse.data);
            return res.redirect(`${FRONTEND_URL}?error=oauth_failed`);
        }

        // Fetch the user's profile from GitHub
        const userResponse = await axios.get('https://api.github.com/user', {
            headers: {
                Authorization: `Bearer ${accessToken}`
            }
        });

        const userData = userResponse.data;

        // Upsert user into our database
        await prisma.user.upsert({
            where: { username: userData.login },
            update: {
                name: userData.name || userData.login,
                avatar: userData.avatar_url,
                bio: userData.bio || 'GitHub Developer',
                accessToken: accessToken
            },
            create: {
                id: userData.login, // using GitHub username as ID for simplicity
                username: userData.login,
                name: userData.name || userData.login,
                avatar: userData.avatar_url,
                bio: userData.bio || 'GitHub Developer',
                accessToken: accessToken
            }
        });

        const encodedData = encodeURIComponent(JSON.stringify(userData));
        res.redirect(`${FRONTEND_URL}?auth_success=true&user=${encodedData}`);

    } catch (error) {
        console.error('Authentication Error:', error.message);
        res.redirect(`${FRONTEND_URL}?error=auth_failed`);
    }
});

// 3. Find a user and ensure they exist in our DB
app.get('/api/users/:username', async (req, res) => {
    const { username } = req.params;
    try {
        // Fetch from GitHub
        const githubResponse = await axios.get(`https://api.github.com/users/${username}`);
        const userData = githubResponse.data;

        // Upsert into our database
        const dbUser = await prisma.user.upsert({
            where: { username: userData.login },
            update: {
                name: userData.name || userData.login,
                avatar: userData.avatar_url,
                bio: userData.bio || 'GitHub Developer',
            },
            create: {
                id: userData.login, // using GitHub username as ID for simplicity
                username: userData.login,
                name: userData.name || userData.login,
                avatar: userData.avatar_url,
                bio: userData.bio || 'GitHub Developer',
            }
        });

        // Send back full data combining GitHub stats and our DB
        res.json({
            ...userData,
            dbId: dbUser.id
        });
    } catch (error) {
        if (error.response && error.response.status === 404) {
            return res.status(404).json({ error: 'GitHub user not found' });
        }
        res.status(500).json({ error: 'Failed to fetch user' });
    }
});

// ==========================================
// FOLLOW REQUESTS API
// ==========================================

// Get all follow requests for a user (both sent and received)
app.get('/api/connections/:username', async (req, res) => {
    try {
        const { username } = req.params;
        const user = await prisma.user.findUnique({
            where: { username },
            include: {
                sentRequests: { include: { receiver: true } },
                receivedRequests: { include: { sender: true } }
            }
        });

        if (!user) return res.json({ sentRequests: [], receivedRequests: [] });
        res.json({
            sentRequests: user.sentRequests,
            receivedRequests: user.receivedRequests
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch connections' });
    }
});

// Send a follow request
app.post('/api/connections/request', async (req, res) => {
    try {
        const { senderId, receiverId } = req.body; // these are GitHub usernames

        if (senderId === receiverId) {
            return res.status(400).json({ error: "Cannot follow yourself" });
        }

        const request = await prisma.followRequest.create({
            data: {
                senderId,
                receiverId,
                status: 'pending'
            },
            include: { receiver: true }
        });
        res.json(request);
    } catch (error) {
        if (error.code === 'P2002') {
            return res.status(400).json({ error: 'Follow request already exists' });
        }
        res.status(500).json({ error: 'Failed to send request' });
    }
});

// Update follow request status (accept/reject)
app.put('/api/connections/request/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body; // 'accepted', 'rejected'

        const request = await prisma.followRequest.update({
            where: { id },
            data: { status },
            include: { sender: true, receiver: true }
        });

        if (status === 'accepted') {
            // Attempt to establish mutual follow on GitHub in the background to prevent blocking
            (async () => {
                try {
                    // 1. Make the Sender follow the Receiver
                    if (request.sender.accessToken) {
                        await axios.put(
                            `https://api.github.com/user/following/${request.receiver.username}`,
                            {},
                            {
                                headers: {
                                    Authorization: `Bearer ${request.sender.accessToken}`,
                                    Accept: 'application/vnd.github.v3+json'
                                }
                            }
                        );
                    }

                    // 2. Make the Receiver follow the Sender
                    if (request.receiver.accessToken) {
                        await axios.put(
                            `https://api.github.com/user/following/${request.sender.username}`,
                            {},
                            {
                                headers: {
                                    Authorization: `Bearer ${request.receiver.accessToken}`,
                                    Accept: 'application/vnd.github.v3+json'
                                }
                            }
                        );
                    }
                } catch (githubError) {
                    console.error("Failed to sync follow with GitHub API:", githubError?.response?.data || githubError.message);
                }
            })();
        }

        res.json(request);
    } catch (error) {
        res.status(500).json({ error: 'Failed to update request' });
    }
});

// Remove a follow connection
app.delete('/api/connections/request/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await prisma.followRequest.delete({ where: { id } });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete connection' });
    }
});

// ==========================================
// COLLABORATIONS API
// ==========================================

// Get collaborations for a user
app.get('/api/collaborations/:username', async (req, res) => {
    try {
        const { username } = req.params;
        const user = await prisma.user.findUnique({
            where: { username },
            include: {
                initiatedCollabs: { include: { target: true } },
                targetCollabs: { include: { initiator: true } }
            }
        });

        if (!user) return res.json({ initiatedCollabs: [], targetCollabs: [] });
        res.json({
            initiatedCollabs: user.initiatedCollabs,
            targetCollabs: user.targetCollabs
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch collaborations' });
    }
});

// Send collaboration request
app.post('/api/collaborations/request', async (req, res) => {
    try {
        const { initiatorId, targetId, repoName } = req.body;

        const collab = await prisma.collaboration.create({
            data: {
                initiatorId,
                targetId,
                repoName,
                status: 'pending'
            },
            include: { initiator: true, target: true }
        });

        // Try to automatically invite the user on GitHub using initiator's accessToken
        try {
            if (!collab.initiator.accessToken) {
                // Delete the collaboration we just created so we don't have a broken state
                await prisma.collaboration.delete({ where: { id: collab.id } });
                return res.status(403).json({ error: 'You must log in using the "Connect with GitHub" button to invite collaborators. Manual login does not grant repository permissions.' });
            }

            await axios.put(
                `https://api.github.com/repos/${collab.initiator.username}/${encodeURIComponent(repoName)}/collaborators/${collab.target.username}`,
                {},
                {
                    headers: {
                        Authorization: `Bearer ${collab.initiator.accessToken}`,
                        Accept: 'application/vnd.github+json',
                        'X-GitHub-Api-Version': '2022-11-28'
                    }
                }
            );
            console.log(`Sent GitHub collaboration invite to @${collab.target.username} for ${collab.initiator.username}/${repoName}`);
        } catch (githubError) {
            console.error("Failed to invite collaborator on GitHub:", githubError?.response?.data || githubError.message);
        }

        res.json(collab);
    } catch (error) {
        console.error("Failed to send collaboration request:", error);
        res.status(500).json({ error: 'Failed to send collaboration request' });
    }
});

// Update collaboration status
app.put('/api/collaborations/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        const collab = await prisma.collaboration.update({
            where: { id },
            data: { status },
            include: { initiator: true, target: true }
        });

        if (status === 'accepted') {
            // Perform the slow GitHub API handshakes in the background to prevent client timeouts
            (async () => {
                // 1. Ensure the collaboration invite is sent on GitHub
                try {
                    if (collab.initiator.accessToken) {
                        await axios.put(
                            `https://api.github.com/repos/${collab.initiator.username}/${collab.repoName}/collaborators/${collab.target.username}`,
                            {},
                            {
                                headers: {
                                    Authorization: `Bearer ${collab.initiator.accessToken}`,
                                    Accept: 'application/vnd.github+json'
                                }
                            }
                        );
                    }
                } catch (githubError) {
                    console.error("Failed to ensure collaborator invite is sent on GitHub:", githubError?.response?.data || githubError.message);
                }

                // 2. Attempt to automatically accept the repository invitation on behalf of the target user
                try {
                    if (collab.target.accessToken) {
                        // Fetch pending repository invitations for the target user
                        const inviteListRes = await axios.get(
                            'https://api.github.com/user/repository_invitations',
                            {
                                headers: {
                                    Authorization: `Bearer ${collab.target.accessToken}`,
                                    Accept: 'application/vnd.github+json'
                                }
                            }
                        );

                        const invitations = inviteListRes.data;
                        const matchingInvite = invitations.find(
                            invite => invite.repository.full_name.toLowerCase() === `${collab.initiator.username}/${collab.repoName}`.toLowerCase()
                        );

                        if (matchingInvite) {
                            // Accept invitation
                            await axios.patch(
                                `https://api.github.com/user/repository_invitations/${matchingInvite.id}`,
                                {},
                                {
                                    headers: {
                                        Authorization: `Bearer ${collab.target.accessToken}`,
                                        Accept: 'application/vnd.github+json'
                                    }
                                }
                            );
                            console.log(`Auto-accepted GitHub repository invitation for @${collab.target.username}`);
                        }
                    }
                } catch (acceptError) {
                    console.error("Failed to auto-accept repository invitation on GitHub:", acceptError?.response?.data || acceptError.message);
                }
            })();
        }

        res.json(collab);
    } catch (error) {
        console.error("Failed to update collaboration:", error);
        res.status(500).json({ error: 'Failed to update collaboration' });
    }
});

// End collaboration session
app.delete('/api/collaborations/:id', async (req, res) => {
    try {
        const { id } = req.params;

        // Fetch collaboration details to get repository owner (initiator) and collaborator username (target)
        const collab = await prisma.collaboration.findUnique({
            where: { id },
            include: { initiator: true, target: true }
        });

        let removedOnGithub = false;
        let githubErrorMessage = "";

        if (collab) {
            const owner = collab.initiator.username;
            const repo = encodeURIComponent(collab.repoName);
            const collaborator = collab.target.username;
            const githubUrl = `https://api.github.com/repos/${owner}/${repo}/collaborators/${collaborator}`;

            // Diagnostic file logging
            try {
                const fs = await import('fs');
                fs.writeFileSync('debug.log', JSON.stringify({
                    timestamp: new Date().toISOString(),
                    collabId: id,
                    repoName: collab.repoName,
                    initiator: {
                        username: collab.initiator.username,
                        hasToken: !!collab.initiator.accessToken,
                        tokenLength: collab.initiator.accessToken?.length || 0
                    },
                    target: {
                        username: collab.target.username,
                        hasToken: !!collab.target.accessToken,
                        tokenLength: collab.target.accessToken?.length || 0
                    }
                }, null, 2));
                console.log("Wrote token diagnostics to debug.log");
            } catch (fsErr) {
                console.error("Failed to write debug.log:", fsErr.message);
            }

            console.log(`Attempting to remove GitHub collaborator @${collaborator} from ${owner}/${collab.repoName}...`);

            // 1. Try initiator's accessToken (the repository owner)
            if (collab.initiator.accessToken) {
                try {
                    // First, check if they are still just a "pending" invite
                    try {
                        const invitesRes = await axios.get(`https://api.github.com/repos/${owner}/${repo}/invitations`, {
                            headers: {
                                Authorization: `Bearer ${collab.initiator.accessToken}`,
                                Accept: 'application/vnd.github+json',
                                'X-GitHub-Api-Version': '2022-11-28'
                            }
                        });
                        const targetInvite = invitesRes.data.find(inv => inv.invitee.login.toLowerCase() === collaborator.toLowerCase());
                        if (targetInvite) {
                            await axios.delete(`https://api.github.com/repos/${owner}/${repo}/invitations/${targetInvite.id}`, {
                                headers: {
                                    Authorization: `Bearer ${collab.initiator.accessToken}`,
                                    Accept: 'application/vnd.github+json',
                                    'X-GitHub-Api-Version': '2022-11-28'
                                }
                            });
                            console.log(`Successfully canceled pending invitation for @${collaborator}.`);
                            removedOnGithub = true;
                        }
                    } catch (inviteErr) {
                        console.error("Failed to check/cancel pending invitations:", inviteErr.message);
                    }

                    // Then attempt to remove them if they were already a full collaborator
                    if (!removedOnGithub) {
                        await axios.delete(githubUrl, {
                            headers: {
                                Authorization: `Bearer ${collab.initiator.accessToken}`,
                                Accept: 'application/vnd.github+json',
                                'X-GitHub-Api-Version': '2022-11-28'
                            }
                        });
                        console.log(`Successfully removed full collaborator @${collaborator} using initiator's token.`);
                        removedOnGithub = true;
                    }
                } catch (githubError) {
                    const status = githubError?.response?.status;
                    const errorData = githubError?.response?.data;
                    console.error(`Failed to remove collaborator using initiator's token. Status: ${status}`, errorData || githubError.message);

                    // If collaborator was already removed or repository/collaborator was not found (404), treat as success
                    if (status === 404) {
                        console.log("GitHub returned 404. Repository or collaborator might already be removed. Marking as success.");
                        removedOnGithub = true;
                    } else {
                        githubErrorMessage = errorData?.message || githubError.message;
                    }
                }
            }

            // 2. Try target's accessToken (the collaborator removing themselves)
            if (!removedOnGithub && collab.target.accessToken) {
                try {
                    console.log(`Attempting removal using target's token (self-removal) @${collaborator}...`);
                    await axios.delete(githubUrl, {
                        headers: {
                            Authorization: `Bearer ${collab.target.accessToken}`,
                            Accept: 'application/vnd.github+json',
                            'X-GitHub-Api-Version': '2022-11-28'
                        }
                    });
                    console.log(`Successfully removed collaborator @${collaborator} using target's token.`);
                    removedOnGithub = true;
                } catch (githubError) {
                    const status = githubError?.response?.status;
                    const errorData = githubError?.response?.data;
                    console.error(`Failed to remove collaborator using target's token. Status: ${status}`, errorData || githubError.message);

                    if (status === 404) {
                        console.log("GitHub returned 404. Repository or collaborator might already be removed. Marking as success.");
                        removedOnGithub = true;
                    } else {
                        githubErrorMessage = errorData?.message || githubError.message;
                    }
                }
            }
        }

        if (collab && !removedOnGithub) {
            return res.status(400).json({
                error: `Failed to remove @${collab.target.username} from GitHub repository. Error: ${githubErrorMessage || 'Unauthorized or expired token'}. Please log out and click 'Connect with GitHub' to refresh your token, or manually remove them on GitHub.`
            });
        }

        // First delete all messages in this collaboration to prevent foreign key violation
        await prisma.message.deleteMany({
            where: { collaborationId: id }
        });
        await prisma.collaboration.delete({ where: { id } });

        res.json({ success: true, removedFromGithub: true });
    } catch (error) {
        console.error("Failed to delete collaboration:", error);
        res.status(500).json({ error: 'Failed to end collaboration' });
    }
});

// ==========================================
// CHAT MESSAGES API
// ==========================================

// Get messages for a collaboration
app.get('/api/collaborations/:id/messages', async (req, res) => {
    try {
        const { id } = req.params;
        const messages = await prisma.message.findMany({
            where: { collaborationId: id },
            orderBy: { createdAt: 'asc' },
            include: { sender: true }
        });
        res.json(messages);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch messages' });
    }
});

// Send a message in a collaboration
app.post('/api/collaborations/:id/messages', async (req, res) => {
    try {
        const { id } = req.params;
        const { senderId, text } = req.body;

        const message = await prisma.message.create({
            data: {
                collaborationId: id,
                senderId,
                text
            },
            include: { sender: true }
        });
        res.json(message);
    } catch (error) {
        res.status(500).json({ error: 'Failed to send message' });
    }
});

if (!IS_PROD) {
    app.listen(PORT, () => {
        console.log(`Backend API Server running at http://localhost:${PORT}`);
    });
}

export default app;

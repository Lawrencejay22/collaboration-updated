import express from 'express';
import cors from 'cors';
import axios from 'axios';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

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

// 1. Redirect user to GitHub for authorization
app.get('/api/auth/github', (req, res) => {
    if (!CLIENT_ID || CLIENT_ID.includes('YOUR_GITHUB_CLIENT_ID_HERE')) {
        return res.status(500).send(`
            <h1>Backend Error: Missing GitHub Credentials</h1>
            <p>You must configure your GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET in the <code>server/.env</code> file.</p>
        `);
    }

    const githubAuthUrl = `https://github.com/login/oauth/authorize?client_id=${CLIENT_ID}&scope=read:user&prompt=consent`;
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

        const encodedData = encodeURIComponent(JSON.stringify(userData));
        res.redirect(`${FRONTEND_URL}?auth_success=true&user=${encodedData}`);

    } catch (error) {
        console.error('Authentication Error:', error.message);
        res.redirect(`${FRONTEND_URL}?error=auth_failed`);
    }
});

if (!IS_PROD) {
    app.listen(PORT, () => {
        console.log(`Backend API Server running at http://localhost:${PORT}`);
    });
}

// Export the app for Vercel Serverless Functions
export default app;

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
const CALLBACK_URL = 'http://localhost:3000/api/auth/github/callback';
const FRONTEND_URL = 'http://localhost:5173';

// 1. Redirect user to GitHub for authorization
app.get('/api/auth/github', (req, res) => {
    if (!CLIENT_ID || CLIENT_ID.includes('YOUR_GITHUB_CLIENT_ID_HERE')) {
        return res.status(500).send(`
            <h1>Backend Error: Missing GitHub Credentials</h1>
            <p>You must configure your GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET in the <code>server/.env</code> file.</p>
        `);
    }

    const githubAuthUrl = `https://github.com/login/oauth/authorize?client_id=${CLIENT_ID}&redirect_uri=${CALLBACK_URL}&scope=read:user`;
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
            code: code,
            redirect_uri: CALLBACK_URL
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

app.listen(PORT, () => {
    console.log(`Backend API Server running at http://localhost:${PORT}`);
});

import React, { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import '../main.css';

export default function Login({ onLoginSuccess, isLoggedIn, onNavigate }) {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [isConnecting, setIsConnecting] = useState(false);

    const handleLogin = async (e) => {
        e.preventDefault();
        const trimmedUser = username.trim();
        const trimmedPassword = password.trim();

        if (!trimmedUser || !trimmedPassword) {
            alert('Please enter both your GitHub username and password.');
            return;
        }
        setIsConnecting(true);
        try {
            const response = await fetch(`/api/users/${trimmedUser}`);
            if (response.ok) {
                const data = await response.json();
                onLoginSuccess({
                    username: data.login || data.username,
                    name: data.name || data.login,
                    avatar: data.avatar_url,
                    bio: data.bio || 'GitHub Developer',
                    repos: data.public_repos,
                    followers: data.followers,
                    following: data.following
                });
            } else {
                alert('GitHub account not found. Please check your username.');
            }
        } catch (error) {
            alert('Error connecting to GitHub. Please try again.');
        } finally {
            setIsConnecting(false);
        }
    };
    const mockGithubLogin = (e) => {
        if (e && e.preventDefault) e.preventDefault();
        window.location.href = '/api/auth/github';
    };

    return (
        <section className="login-container" id="loginForm">
            <div className="login-card">
                <img src="/logo.png" alt="GitHub-User-Finder-Logo" style={{ height: '180px', width: '180px', borderRadius: '50%', objectFit: 'cover', marginBottom: '1%', marginLeft: '28%', alignItems: 'center' }} />
                <h1 style={{ marginBottom: '3%', color: '#ffffff', fontFamily: 'inherit', fontWeight: 'bold', fontSize: '25px', textAlign: 'center' }}>Login to GitHub Account</h1>
                <p style={{ color: '#ffffff', textAlign: 'center', fontFamily: 'inherit', fontSize: '25px' }}>Enter your details to access the application</p>

                <form onSubmit={handleLogin} className="login-form">
                    <div className="input-group">
                        <label htmlFor="usernameInput">GitHub Username</label>
                        <input
                            type="text"
                            id="usernameInput"
                            placeholder="Enter GitHub username (octocat)"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                        />
                    </div>

                    <div className="input-group">
                        <label htmlFor="passwordInput">Password</label>
                        <input
                            type="password"
                            id="passwordInput"
                            placeholder="Enter password (password)"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                        />
                    </div>

                    <button type="submit" className="login-button">
                        Login
                    </button>
                </form>

                <div className="divider">
                    <span>or connect with</span>
                </div>

                <div className="social-login">
                    <button
                        onClick={mockGithubLogin}
                        className={`github-social-btn ${isConnecting ? 'connecting' : ''}`}
                        disabled={isConnecting}
                    >
                        {isConnecting ? (
                            <><div className="spinner-small"></div> Connecting...</>
                        ) : (
                            <><FontAwesomeIcon icon={["fab", "github"]} style={{ marginRight: '8px' }} /> GitHub</>
                        )}
                    </button>
                </div>

                {isLoggedIn && (
                    <button onClick={() => onNavigate('home')} className="back-link">
                        Back to Search
                    </button>
                )}
            </div>
        </section >
    );
}

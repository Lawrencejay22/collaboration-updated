import React from 'react';
import '../main.css';

export default function Footer() {
    return (
        <footer className="footer">
            <div className="footer-content">
                <p>&copy; {new Date().getFullYear()} GitHub User Finder. All rights reserved.</p>
                <p className="footer-text" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '14px', color: '#94a3b8', marginTop: '10px' }}>If there are bugs or issues on my website, please let me know, thank you.</p>
                <div className="footer-links">
                    <a href="https://github.com" target="_blank" rel="noopener noreferrer">GitHub</a>
                    <a href="#">Privacy Policy</a>
                    <a href="#">Terms of Service</a>
                    <a href='mailto:[EMAIL_ADDRESS]'>Contact Me</a>
                </div>
            </div>
        </footer>
    );
}

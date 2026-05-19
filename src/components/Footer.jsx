import React from 'react';
import '../main.css';

export default function Footer() {
    return (
        <footer className="footer">
            <div className="footer-content">
                <p>&copy; {new Date().getFullYear()} GitHub User Finder. All rights reserved.</p>
                <div className="footer-links">
                    <a href="https://github.com" target="_blank" rel="noopener noreferrer">GitHub</a>
                    <a href="#">Privacy Policy</a>
                    <a href="#">Terms of Service</a>
                </div>
            </div>
        </footer>
    );
}

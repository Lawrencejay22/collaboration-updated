import React from 'react';
import '../main.css';

export default function Header({ onNavigate, currentPage, isLoggedIn, onLogout, notificationsCount }) {
    return (
        <header className="header">
            <div className="logo-container" onClick={() => isLoggedIn && onNavigate('home')}>
                <h1 className="logo">GitHub User Finder</h1>
            </div>

            {isLoggedIn && (
                <nav className="nav">
                    <ul className="nav-list">
                        <li className={currentPage === 'home' ? 'active' : ''}>
                            <button onClick={() => onNavigate('home')}>Home</button>
                        </li>
                        <li className={currentPage === 'collaboration' ? 'active' : ''}>
                            <button onClick={() => onNavigate('collaboration')}>Collaboration</button>
                        </li>
                        <li className={currentPage === 'notifications' ? 'active' : ''}>
                            <button onClick={() => onNavigate('notifications')} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                Notifications
                                {notificationsCount > 0 && (
                                    <span style={{
                                        background: '#f43f5e', color: '#fff', fontSize: '0.72rem', padding: '2px 7px',
                                        borderRadius: '10px', fontWeight: 'bold', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                        height: '18px', minWidth: '18px'
                                    }}>
                                        {notificationsCount}
                                    </span>
                                )}
                            </button>
                        </li>
                        <li className={currentPage === 'profile' ? 'active' : ''}>
                            <button onClick={() => onNavigate('profile')}>Profile</button>
                        </li>
                        <li className={currentPage === 'friends' ? 'active' : ''}>
                            <button onClick={() => onNavigate('friends')}>Following</button>
                        </li>
                        <li className="logout-nav">
                            <button onClick={onLogout} className="logout-btn">Logout</button>
                        </li>
                    </ul>
                </nav>
            )}
        </header>
    );
}

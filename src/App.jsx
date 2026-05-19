import React, { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import Header from "./components/Header";
import Footer from "./components/Footer";
import Login from "./components/Login";

export default function App() {
  //---Follow State---
  const [friendRequest, setFriendRequest] = useState(() => {
    const saved = localStorage.getItem('friendRequests');
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    localStorage.setItem('friendRequests', JSON.stringify(friendRequest));
  }, [friendRequest]);

  // --- Notifications State (GitHub Synced) ---
  const [notifications, setNotifications] = useState(() => {
    const saved = localStorage.getItem('notifications');
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    localStorage.setItem('notifications', JSON.stringify(notifications));
  }, [notifications]);

  // --- App State ---
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState(null);
  const [githubUserName, setGithubUserName] = useState('');
  const [currentPage, setCurrentPage] = useState('login');

  // --- Search & Results State ---
  const [isSearching, setIsSearching] = useState(false);
  const [searchedUser, setSearchedUser] = useState(null);
  const [searchInput, setSearchInput] = useState('');

  // --- Collaboration State ---
  const [collaborate, setCollaborate] = useState(() => {
    return localStorage.getItem('collaborate') === 'true';
  });
  const [selectedRepo, setSelectedRepo] = useState(() => {
    return localStorage.getItem('selectedRepo') || null;
  });
  const [collabStatus, setCollabStatus] = useState(() => {
    return localStorage.getItem('collabStatus') || 'pending';
  });
  const [userRepos, setUserRepos] = useState([]);

  const [chatMessages, setChatMessages] = useState(() => {
    const saved = localStorage.getItem('collabChat');
    return saved ? JSON.parse(saved) : [
      { sender: 'them', text: 'Hey there! Thanks for the collaboration request. I\'m excited to work together on this project!' }
    ];
  });
  const [chatInput, setChatInput] = useState('');

  useEffect(() => {
    localStorage.setItem('collaborate', collaborate);
    if (selectedRepo) {
      localStorage.setItem('selectedRepo', selectedRepo);
    } else {
      localStorage.removeItem('selectedRepo');
    }
    localStorage.setItem('collabStatus', collabStatus);
  }, [collaborate, selectedRepo, collabStatus]);

  useEffect(() => {
    localStorage.setItem('collabChat', JSON.stringify(chatMessages));
  }, [chatMessages]);

  // --- UI Components State ---
  const [notification, setNotification] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isFriendModalOpen, setIsFriendModalOpen] = useState(false);
  const [friendMessage, setFriendMessage] = useState('');
  const [isSendingRequest, setIsSendingRequest] = useState(false);

  // --- Handlers ---
  const showAlert = (message, type = 'info') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  const handleAcceptFollowNoti = (noti) => {
    const newFriend = {
      username: noti.sender.username,
      name: noti.sender.name,
      avatar: noti.sender.avatar,
      status: 'accepted'
    };
    setFriendRequest(prev => {
      if (prev.some(r => r.username === newFriend.username)) {
        return prev.map(r => r.username === newFriend.username ? { ...r, status: 'accepted' } : r);
      }
      return [...prev, newFriend];
    });
    setNotifications(prev => prev.map(n => n.id === noti.id ? { ...n, status: 'accepted' } : n));
    showAlert(`You accepted @${noti.sender.username}'s follow request!`, 'success');
  };

  const handleDeclineNoti = (notiId) => {
    setNotifications(prev => prev.map(n => n.id === notiId ? { ...n, status: 'declined' } : n));
    showAlert('Request declined.', 'info');
  };

  const handleAcceptCollabNoti = (noti) => {
    setSearchedUser(noti.sender);
    setSelectedRepo(noti.repoName);
    setCollabStatus('accepted');
    setCollaborate(true);
    setNotifications(prev => prev.map(n => n.id === noti.id ? { ...n, status: 'accepted' } : n));
    showAlert(`Collaboration approved! Opening workspace for ${noti.repoName}...`, 'success');
    setCurrentPage('collaboration');
  };

  const handleLoginSuccess = (userData) => {
    setIsLoggedIn(true);
    setUser(userData);
    setCurrentPage('home');
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setUser(null);
    setCurrentPage('login');
  };

  const handleSearch = async () => {
    if (!searchInput.trim()) {
      showAlert("Please enter a name to search", "error");
      return;
    }

    setIsSearching(true);
    setSearchedUser(null);

    try {
      const response = await fetch(`https://api.github.com/users/${searchInput}`);
      if (response.ok) {
        const data = await response.json();
        const userData = {
          username: data.login,
          name: data.name || data.login,
          avatar: data.avatar_url,
          bio: data.bio || 'No bio available',
          repos: data.public_repos,
          followers: data.followers,
          following: data.following
        };
        setSearchedUser(userData);
        setGithubUserName(data.login);
        showAlert("User found /" + searchInput, "success");
      } else {
        showAlert("User /" + searchInput + " not found", "error");
      }
    } catch (error) {
      showAlert("Error: " + error.message, "error");
    } finally {
      setIsSearching(false);
    }
  };

  const handleCollaborate = async () => {
    if (!searchedUser) return;

    try {
      setIsSearching(true);
      // Fetch the logged-in user's repositories so they can invite the searched user to one of their own repos!
      const currentLoginUser = user?.username || 'Lawrencejay22';
      const response = await fetch(`https://api.github.com/users/${currentLoginUser}/repos`);
      if (response.ok) {
        const repos = await response.json();
        setUserRepos(repos);
        setIsModalOpen(true);
      } else {
        showAlert("Could not fetch repositories for collaboration.", "error");
      }
    } catch (error) {
      showAlert("Error: " + error.message, "error");
    } finally {
      setIsSearching(false);
    }
  };

  const confirmCollaboration = (repoName) => {
    showAlert(`Redirecting to GitHub to invite @${searchedUser.username} to collaborate on "${repoName}"!`, "success");
    setCollaborate(true);
    setSelectedRepo(repoName);
    setCollabStatus('pending');
    setIsModalOpen(false);
    setCurrentPage('collaboration');

    // Open GitHub collaboration settings page in a new tab so the user can invite the collaborator directly on GitHub!
    const inviteUrl = `https://github.com/${user?.username || ' '}/${repoName}/settings/collaboration`;
    window.open(inviteUrl, '_blank');
  };

  const sendChatMessage = (e) => {
    e.preventDefault();
    if (!chatInput.trim()) return;

    const userMsg = { sender: 'me', text: chatInput };
    setChatMessages(prev => [...prev, userMsg]);
    setChatInput('');

    // Simulate auto-reply
    setTimeout(() => {
      const replies = [
        "That's a great point! Let's update that function to use React Hooks.",
        "I'm looking at the repo now. I will pull your changes in a minute.",
        "Looks awesome! Let's get this styled next.",
        "We should commit this component to the repository. Ready when you are!",
        "Thanks for the update! Let's connect tomorrow to review the backend API structure."
      ];
      // pick a random reply
      const index = Math.floor(Math.random() * replies.length);
      const replyMsg = { sender: 'them', text: replies[index] };
      setChatMessages(prev => [...prev, replyMsg]);
    }, 1000);
  };

  //--handle for the followRequest--
  const confirmFriendRequest = () => {
    setIsSendingRequest(true);
    setTimeout(() => {
      setFriendRequest(prevRequests => {
        if (prevRequests.some(req => req.username === searchedUser.username)) return prevRequests;
        return [...prevRequests, { ...searchedUser, message: friendMessage, status: 'pending' }];
      });
      showAlert(`Opening @${searchedUser.username}'s GitHub profile! Click Follow to send a notification.`, "success");
      setIsSendingRequest(false);
      setIsFriendModalOpen(false);

      // Open the target user's real GitHub profile page in a new tab so they can be followed directly on GitHub!
      const profileUrl = `https://github.com/${searchedUser.username}`;
      window.open(profileUrl, '_blank');

      setSearchedUser(null);
      setSearchInput('');
      setFriendMessage('');
      setCurrentPage('friends');
    }, 1200);
  };


  const renderPage = () => {
    if (!isLoggedIn) {
      return <Login onLoginSuccess={handleLoginSuccess} isLoggedIn={false} />;
    }

    switch (currentPage) {
      case 'home':
        return (
          <section className="container">
            <h1>Find User on GitHub</h1>
            <p>Enter the name of the person you want to find on GitHub:</p>
            <div className="search-box">
              <input
                type="text"
                id="nameInput"
                placeholder="Enter name"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
              />
              <button
                id="searchButton"
                onClick={() => handleSearch()}
                disabled={isSearching}
              >
                {isSearching ? 'Searching...' : 'Search'}
              </button>
            </div>
            {isSearching && (
              <div className="loader" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', margin: '10px 0' }}>
                <div className="spinner-small"></div>
                <p style={{ marginTop: '10px', color: '#8892b0' }}>Searching GitHub...</p>
              </div>
            )}

            <div id="result">
              {searchedUser ? (
                <div className="profile-card" style={{ marginTop: '20px' }}>
                  <div className="profile-header">
                    <img src={searchedUser.avatar} alt="Avatar" className="profile-avatar" />
                    <div className="profile-meta">
                      <h2>{searchedUser.name}</h2>
                      <p className="username">@{searchedUser.username}</p>
                      <p className="bio">{searchedUser.bio}</p>
                    </div>
                  </div>
                  <div className="profile-stats">
                    <div className="stat">
                      <span className="stat-value">{searchedUser.repos}</span>
                      <span className="stat-label">Repositories</span>
                    </div>
                    <div className="stat">
                      <span className="stat-value">{searchedUser.followers}</span>
                      <span className="stat-label">Followers</span>
                    </div>
                    <div className="stat">
                      <span className="stat-value">{searchedUser.following}</span>
                      <span className="stat-label">Following</span>
                    </div>
                  </div>
                  <div className="profile-footer">
                    <a href={`https://github.com/${searchedUser.username}`} target="_blank" rel="noopener noreferrer" className="github-btn">
                      View on GitHub
                    </a>
                    <br />
                    <button className="action-btn-collaboration" onClick={() => handleCollaborate()}>
                      Want to Collaborate with {searchedUser.name}? Click here
                    </button>
                    <br />
                    <button className="Follow-request-btn" onClick={() => setIsFriendModalOpen(true)}>
                      Want to follow {searchedUser.name}? Click here
                    </button>
                    <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                      <button
                        onClick={() => setCurrentPage('collaboration')}
                        className="action-btn"
                        style={{ flex: 1 }}
                      >
                        Check Collab
                      </button>
                      <button
                        onClick={() => setCurrentPage('friends')}
                        className="action-btn"
                        style={{ flex: 1, background: 'rgba(8, 255, 103, 0.1)', border: '1px solid rgba(8, 255, 103, 0.2)', color: 'rgba(8, 255, 103, 0.9)' }}
                      >
                        Check Network
                      </button>
                    </div>
                    <button
                      onClick={() => {
                        setSearchedUser(null);
                        setSearchInput('');
                      }}
                      className="back-link"
                      style={{ marginTop: '15px', display: 'block', width: '100%', border: 'none', background: 'none' }}
                    >
                      Clear Result
                    </button>
                  </div>
                </div>
              ) : !isSearching && (
                <div className="info-card">
                  <p style={{ marginBottom: '15px' }}>
                    Hello, <strong>{user?.name || user?.username}</strong>!
                    Use the search bar above to find other developers, check collaboration statuses, or manage your network.
                  </p>
                  <div style={{ display: 'flex', gap: '15px', justifyContent: 'center' }}>
                    <button
                      onClick={() => setCurrentPage('collaboration')}
                      className="action-btn"
                      style={{ flex: 1, maxWidth: '240px' }}
                    >
                      View Collaboration Details
                    </button>
                    <button
                      onClick={() => setCurrentPage('friends')}
                      className="action-btn"
                      style={{ flex: 1, maxWidth: '240px', background: 'rgba(8, 255, 103, 0.1)', border: '1px solid rgba(8, 255, 103, 0.2)', color: 'rgba(8, 255, 103, 0.9)' }}
                    >
                      View Network & Following
                    </button>
                  </div>
                </div>
              )}
            </div>
          </section>
        );
      case 'collaboration':
        return (
          <section className="container">
            <div className="collaboration-page">
              <h1>Collaboration Dashboard</h1>
              {collaborate && selectedRepo ? (
                collabStatus === 'pending' ? (
                  <div className="collaboration-card">
                    {/* Simulation banner */}
                    <div className="simulation-banner" style={{ background: 'rgba(58, 123, 213, 0.1)', border: '1px dashed var(--primary-color)', borderRadius: '12px', padding: '16px', marginBottom: '25px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--text-main)', textAlign: 'left' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <FontAwesomeIcon icon="flask" style={{ color: 'var(--primary-color)', fontSize: '1.2rem' }} />
                        <div>
                          <strong style={{ display: 'block' }}>Simulation Control Panel</strong>
                          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>This is a mockup app. Click Accept to mock-approve the request as the recipient.</span>
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          setCollabStatus('accepted');
                          showAlert(`Collaboration request approved! Workspace unlocked.`, "success");
                        }}
                        className="action-btn"
                        style={{ padding: '8px 16px', fontSize: '0.85rem', margin: 0 }}
                      >
                        <FontAwesomeIcon icon="check" style={{ marginRight: '6px' }} />
                        Accept (Simulate)
                      </button>
                    </div>

                    <div className="collab-status-bar">
                      <span className="status-indicator active"></span>
                      <span>Collaboration Request: <strong>{selectedRepo}</strong></span>
                    </div>

                    <div className="request-details-container">
                      <div className="request-header">
                        <div className="request-icon-circle">
                          {searchedUser?.avatar ? (
                            <img src={searchedUser.avatar} alt="Recipient Avatar" className="request-avatar-main" />
                          ) : (
                            <div className="placeholder-icon"><FontAwesomeIcon icon="paper-plane" /></div>
                          )}
                        </div>
                        <h3>Collaboration Request Sent</h3>
                        <p className="request-subtitle">Your proposal is being delivered to {searchedUser?.name || 'the developer'}</p>
                      </div>

                      <div className="request-summary-card">
                        <div className="summary-item">
                          <div className="item-left">
                            <FontAwesomeIcon icon="folder-open" style={{ marginRight: '8px', color: 'var(--primary-color)' }} />
                            <span className="summary-label">Target Repository</span>
                          </div>
                          <span className="summary-value">{selectedRepo}</span>
                        </div>
                        <div className="summary-divider"></div>
                        <div className="summary-item">
                          <div className="item-left">
                            <FontAwesomeIcon icon="user-tag" style={{ marginRight: '8px', color: 'var(--primary-color)' }} />
                            <span className="summary-label">Recipient</span>
                          </div>
                          <div className="recipient-mini">
                            <img src={searchedUser?.avatar || 'https://via.placeholder.com/24'} alt="Avatar" className="mini-avatar" />
                            <span className="summary-value">{searchedUser?.name || 'GitHub User'}</span>
                          </div>
                        </div>
                        <div className="summary-divider"></div>
                        <div className="summary-item">
                          <div className="item-left">
                            <FontAwesomeIcon icon="clock-rotate-left" style={{ marginRight: '8px', color: 'var(--primary-color)' }} />
                            <span className="summary-label">Current Status</span>
                          </div>
                          <span className="status-tag pending">Waiting for Approval</span>
                        </div>
                      </div>

                      <div className="request-message-box">
                        <div className="info-badge">
                          <FontAwesomeIcon icon="circle-info" />
                          <span>How it works</span>
                        </div>
                        <p>
                          We have successfully notified <strong>{searchedUser?.name || 'the developer'}</strong> about your collaboration request.
                          They can now review this request on their GitHub dashboard.
                        </p>
                        <p className="small-note">
                          Once they accept, the collaborative workspace will be unlocked for both of you.
                        </p>
                      </div>
                    </div>

                    <div className="collab-actions">
                      <button onClick={() => showAlert("Request status refreshed!", "info")} className="action-btn">Refresh Status</button>
                      <button onClick={() => {
                        setCollaborate(false);
                        setSelectedRepo(null);
                        setCollabStatus('pending');
                        showAlert("Request cancelled.", "info");
                      }} className="action-btn" style={{ color: '#f43f5e' }}>Cancel Request</button>
                    </div>
                  </div>
                ) : (
                  // Active Collaboration Workspace (IDE + Chat!)
                  <div className="workspace-container" style={{ textAlign: 'left', marginTop: '20px' }}>
                    <div className="collab-status-bar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', padding: '12px 20px', borderRadius: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span className="status-indicator active" style={{ background: '#10b981', boxShadow: '0 0 12px #10b981' }}></span>
                        <span style={{ fontSize: '1.05rem' }}>Active Workspace: <strong>{searchedUser?.name || 'Partner'} / {selectedRepo}</strong></span>
                      </div>
                      <button
                        onClick={() => {
                          setCollaborate(false);
                          setSelectedRepo(null);
                          setCollabStatus('pending');
                          localStorage.removeItem('collabChat');
                          setChatMessages([
                            { sender: 'them', text: 'Hey there! Thanks for the collaboration request. I\'m excited to work together on this project!' }
                          ]);
                          showAlert("Collaboration session ended.", "info");
                          setCurrentPage('home');
                        }}
                        className="action-btn"
                        style={{ margin: 0, padding: '8px 16px', background: 'rgba(244, 63, 94, 0.1)', color: '#f43f5e', border: '1px solid rgba(244, 63, 94, 0.2)' }}
                      >
                        <FontAwesomeIcon icon="right-from-bracket" style={{ marginRight: '6px' }} />
                        Close Session
                      </button>
                    </div>

                    <div className="workspace-layout" style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
                      {/* Left: Code Editor Mock */}
                      <div className="editor-card" style={{ flex: '2', minWidth: '350px', background: 'var(--card-bg)', borderRadius: '16px', border: '1px solid var(--border-color)', overflow: 'hidden', boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)' }}>
                        <div className="editor-header" style={{ background: 'rgba(0,0,0,0.3)', padding: '12px 20px', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <FontAwesomeIcon icon="code" style={{ color: 'var(--primary-color)' }} />
                            <span style={{ fontWeight: '600', fontSize: '0.95rem' }}>shared-workspace / App.jsx</span>
                          </div>
                          <span style={{ fontSize: '0.8rem', color: '#10b981', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <FontAwesomeIcon icon="users" />
                            2 editors active
                          </span>
                        </div>
                        <div style={{ padding: '20px', fontFamily: '"Fira Code", Courier, monospace', fontSize: '0.85rem', color: '#8892b0', overflowX: 'auto', background: '#0b0f19', minHeight: '320px', lineHeight: '1.6' }}>
                          <div><span style={{ color: '#f43f5e' }}>import</span> React, &#123; useState, useEffect &#125; <span style={{ color: '#f43f5e' }}>from</span> <span style={{ color: '#10b981' }}>'react'</span>;</div>
                          <div><span style={{ color: '#f43f5e' }}>import</span> &#123; createConnection &#125; <span style={{ color: '#f43f5e' }}>from</span> <span style={{ color: '#10b981' }}>'./collaboration'</span>;</div>
                          <br />
                          <div><span style={{ color: '#f43f5e' }}>export default function</span> <span style={{ color: '#eab308' }}>ProjectWorkspace</span>() &#123;</div>
                          <div>&nbsp;&nbsp;<span style={{ color: '#f43f5e' }}>const</span> [status, setStatus] = <span style={{ color: '#eab308' }}>useState</span>(<span style={{ color: '#10b981' }}>'active'</span>);</div>
                          <div>&nbsp;&nbsp;<span style={{ color: '#f43f5e' }}>const</span> partner = <span style={{ color: '#10b981' }}>"@{searchedUser?.username || 'developer'}"</span>;</div>
                          <br />
                          <div>&nbsp;&nbsp;<span style={{ color: '#eab308' }}>useEffect</span>(() =&gt; &#123;</div>
                          <div>&nbsp;&nbsp;&nbsp;&nbsp;console.log(<span style={{ color: '#10b981' }}>`Connected securely to workspace repository: ${selectedRepo}`</span>);</div>
                          <div>&nbsp;&nbsp;&nbsp;&nbsp;console.log(<span style={{ color: '#10b981' }}>`Session active with ${partner}`</span>);</div>
                          <div>&nbsp;&nbsp;&#125;, []);</div>
                          <br />
                          <div>&nbsp;&nbsp;<span style={{ color: '#f43f5e' }}>return</span> (</div>
                          <div>&nbsp;&nbsp;&nbsp;&nbsp;&lt;<span style={{ color: '#00d2ff' }}>div</span> className=<span style={{ color: '#10b981' }}>"workspace-container"</span>&gt;</div>
                          <div>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&lt;<span style={{ color: '#00d2ff' }}>h1</span>&gt;Hello, Collaboration World!&lt;/<span style={{ color: '#00d2ff' }}>h1</span>&gt;</div>
                          <div>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&lt;<span style={{ color: '#00d2ff' }}>p</span>&gt;Co-editing with &#123;partner&#125;...&lt;/<span style={{ color: '#00d2ff' }}>p</span>&gt;</div>
                          <div style={{ position: 'relative' }}>
                            &nbsp;&nbsp;&nbsp;&nbsp;&lt;/<span style={{ color: '#00d2ff' }}>div</span>&gt;
                            <span style={{ position: 'absolute', left: '90px', top: '18px', background: '#3a7bd5', color: '#fff', fontSize: '0.65rem', padding: '2px 6px', borderRadius: '4px', whiteSpace: 'nowrap' }}>
                              {searchedUser?.name || 'Partner'} editing
                            </span>
                            <div style={{ display: 'inline-block', width: '2px', height: '1.2em', background: '#3a7bd5', position: 'absolute', left: '88px', top: '18px', animation: 'blink 1s step-end infinite' }}></div>
                          </div>
                          <div>&nbsp;&nbsp;);</div>
                          <div>&#125;</div>
                        </div>
                      </div>

                      {/* Right: Live Chat Box Mock */}
                      <div className="chat-card" style={{ flex: '1', minWidth: '300px', background: 'var(--card-bg)', borderRadius: '16px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', height: '420px', overflow: 'hidden', boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)' }}>
                        <div className="chat-header" style={{ background: 'rgba(0,0,0,0.3)', padding: '12px 20px', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <img src={searchedUser?.avatar || 'https://via.placeholder.com/32'} alt="Avatar" style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover' }} />
                          <div>
                            <span style={{ fontWeight: '600', fontSize: '0.95rem', display: 'block', color: 'var(--text-main)' }}>{searchedUser?.name}</span>
                            <span style={{ fontSize: '0.75rem', color: '#10b981', display: 'block' }}>● Online</span>
                          </div>
                        </div>

                        <div className="chat-messages" style={{ flex: '1', padding: '15px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px', background: 'rgba(0,0,0,0.1)' }}>
                          {chatMessages.map((msg, idx) => (
                            <div key={idx} style={{
                              alignSelf: msg.sender === 'me' ? 'flex-end' : 'flex-start',
                              maxWidth: '80%',
                              padding: '10px 14px',
                              borderRadius: msg.sender === 'me' ? '12px 12px 0 12px' : '12px 12px 12px 0',
                              background: msg.sender === 'me' ? 'var(--primary-color)' : 'rgba(255,255,255,0.06)',
                              color: msg.sender === 'me' ? '#0f172a' : 'var(--text-main)',
                              fontWeight: msg.sender === 'me' ? '500' : '400',
                              fontSize: '0.88rem',
                              boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
                            }}>
                              {msg.text}
                            </div>
                          ))}
                        </div>

                        <form onSubmit={sendChatMessage} style={{ display: 'flex', padding: '10px', background: 'rgba(0,0,0,0.3)', borderTop: '1px solid var(--border-color)' }}>
                          <input
                            type="text"
                            value={chatInput}
                            onChange={(e) => setChatInput(e.target.value)}
                            placeholder="Type a message to collaborate..."
                            style={{ flex: '1', padding: '10px 15px', borderRadius: '20px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-color)', color: 'var(--text-main)', fontSize: '0.85rem', outline: 'none' }}
                          />
                          <button
                            type="submit"
                            style={{ background: 'var(--primary-color)', color: '#0f172a', border: 'none', width: '36px', height: '36px', borderRadius: '50%', marginLeft: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'transform 0.2s' }}
                            onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
                            onMouseOut={(e) => e.currentTarget.style.transform = 'none'}
                          >
                            <FontAwesomeIcon icon="paper-plane" style={{ fontSize: '0.85rem' }} />
                          </button>
                        </form>
                      </div>
                    </div>
                  </div>
                )
              ) : (
                <div className="info-card">
                  <p>You have no active collaborations at the moment.</p>
                  <p>Search for a developer on the Home page to start working together!</p>
                  <button onClick={() => setCurrentPage('home')} className="action-btn">Go to Search</button>
                </div>
              )}
              <button onClick={() => setCurrentPage('home')} className="back-link" style={{ marginTop: '20px' }}>Back to Home</button>
            </div>
          </section>
        );
      case 'profile':
        return (
          <section className="container">
            <div className="profile-page">
              <h1>My GitHub Profile</h1>
              <div className="profile-card">
                <div className="profile-header">
                  <img src={user?.avatar || 'https://via.placeholder.com/24'} alt="Avatar" className="profile-avatar" />
                  <div className="profile-meta">
                    <h2>{user?.name || user?.username}</h2>
                    <p className="username">@{user?.username}</p>
                    <p className="bio">{user?.bio}</p>
                  </div>
                </div>
                <div className="profile-stats">
                  <div className="stat">
                    <span className="stat-value">{user?.repos || 0}</span>
                    <span className="stat-label">Repositories</span>
                  </div>
                  <div className="stat">
                    <span className="stat-value">{user?.followers || 0}</span>
                    <span className="stat-label">Followers</span>
                  </div>
                  <div className="stat">
                    <span className="stat-value">{user?.following || 0}</span>
                    <span className="stat-label">Following</span>
                  </div>
                </div>
                <div className="profile-footer">
                  <a href={`https://github.com/${user?.username}`} target="_blank" rel="noopener noreferrer" className="github-btn">
                    View on GitHub
                  </a>
                  <button
                    onClick={() => setCurrentPage('home')}
                    className="back-link"
                    style={{ marginTop: '20px', display: 'block', width: '100%', border: 'none', background: 'none' }}
                  >
                    Back to Search
                  </button>
                </div>
              </div>
            </div>
          </section>
        );
      case 'friends':
        const pendingRequests = friendRequest.filter(req => req.status === 'pending');
        const activeFriends = friendRequest.filter(req => req.status === 'accepted');

        return (
          <section className="container">
            <div className="profile-page">
              <h1>My Network</h1>

              <div className="profile-layout" style={{ display: 'flex', flexDirection: 'column', gap: '24px', textAlign: 'left' }}>

                {/* Active Friends Section */}
                <div className="friends-section" style={{ background: 'var(--card-bg)', borderRadius: '16px', padding: '24px', border: '1px solid var(--border-color)', boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)' }}>
                  <h2 style={{ marginBottom: '15px', fontSize: '1.5rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <FontAwesomeIcon icon="user-group" style={{ color: '#10b981' }} />
                    Following ({activeFriends.length})
                  </h2>
                  {activeFriends.length > 0 ? (
                    <div className="friend-request-list" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {activeFriends.map((req, index) => (
                        <div key={index} className="friend-request-item" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px', background: 'rgba(16, 185, 129, 0.03)', borderRadius: '12px', border: '1px solid rgba(16, 185, 129, 0.1)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                            <img src={req.avatar} alt="avatar" style={{ width: '56px', height: '56px', borderRadius: '50%', objectFit: 'cover' }} />
                            <div>
                              <p style={{ margin: 0, fontWeight: '600', color: 'var(--text-main)', fontSize: '1.1rem' }}>{req.name}</p>
                              <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-muted)' }}>@{req.username}</p>
                            </div>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <span className="status-tag active" style={{ padding: '6px 12px', borderRadius: '20px', fontSize: '0.8rem', background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.2)', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 'bold' }}>
                              <FontAwesomeIcon icon="circle-check" />
                              Following
                            </span>
                            <button
                              onClick={() => {
                                showAlert(`Chat session initiated with ${req.name}!`, "success");
                              }}
                              style={{ background: 'var(--primary-color)', border: 'none', color: '#0f172a', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '6px' }}
                            >
                              <FontAwesomeIcon icon="message" />
                              Chat
                            </button>
                            <br />
                            <button
                              onClick={() => setFriendRequest(prev => prev.filter(r => r.username !== req.username))}
                              style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '6px', borderRadius: '50%', transition: 'background 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px' }}
                              title="Unfollow"
                              onMouseOver={(e) => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'}
                              onMouseOut={(e) => e.currentTarget.style.background = 'none'}
                            >
                              <FontAwesomeIcon icon="trash" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text-muted)' }}>
                      <p>You aren't following anyone yet. Approve a pending request below or search for developers!</p>
                    </div>
                  )}
                </div>

                {/* Sent Pending Requests Section */}
                <div className="friends-section" style={{ background: 'var(--card-bg)', borderRadius: '16px', padding: '24px', border: '1px solid var(--border-color)', boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)' }}>
                  <h2 style={{ marginBottom: '15px', fontSize: '1.5rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <FontAwesomeIcon icon="clock" style={{ color: '#eab308' }} />
                    Pending Follow Requests Sent ({pendingRequests.length})
                  </h2>
                  {pendingRequests.length > 0 ? (
                    <div className="friend-request-list" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {pendingRequests.map((req, index) => (
                        <div key={index} className="friend-request-item" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px', background: 'rgba(255,255,255,0.03)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                            <img src={req.avatar} alt="avatar" style={{ width: '56px', height: '56px', borderRadius: '50%', objectFit: 'cover' }} />
                            <div>
                              <p style={{ margin: 0, fontWeight: '600', color: 'var(--text-main)', fontSize: '1.1rem' }}>{req.name}</p>
                              <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-muted)' }}>@{req.username}</p>
                              {req.message && (
                                <p style={{ margin: '8px 0 0 0', fontSize: '0.9rem', color: 'var(--text-main)', background: 'rgba(0,0,0,0.2)', padding: '8px 12px', borderRadius: '6px', borderLeft: '3px solid var(--primary-color)' }}>
                                  "{req.message}"
                                </p>
                              )}
                            </div>
                          </div>

                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '10px' }}>
                            <span className="status-tag pending" style={{ padding: '6px 12px', borderRadius: '20px', fontSize: '0.8rem', background: 'rgba(234, 179, 8, 0.1)', color: '#eab308', border: '1px solid rgba(234, 179, 8, 0.2)', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 'bold' }}>
                              <FontAwesomeIcon icon="clock" />
                              Pending
                            </span>

                            <div style={{ display: 'flex', gap: '8px', marginTop: '5px' }}>
                              <button
                                onClick={() => {
                                  setFriendRequest(prev => prev.map(r => r.username === req.username ? { ...r, status: 'accepted' } : r));
                                  showAlert(`Simulated connection: You are now following ${req.name}!`, "success");
                                }}
                                style={{ background: 'rgba(16, 185, 129, 0.15)', border: '1px solid rgba(16, 185, 129, 0.3)', color: '#10b981', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.82rem', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '4px' }}
                              >
                                <FontAwesomeIcon icon="circle-check" />
                                Simulate Accept
                              </button>

                              <button
                                onClick={() => setFriendRequest(prev => prev.filter(r => r.username !== req.username))}
                                style={{ background: 'rgba(244, 63, 94, 0.1)', border: '1px solid rgba(244, 63, 94, 0.2)', color: '#f43f5e', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.82rem', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '4px' }}
                              >
                                <FontAwesomeIcon icon="xmark" />
                                Cancel
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--text-muted)' }}>
                      <p>No pending follow requests sent.</p>
                    </div>
                  )}
                </div>

              </div>
              <button onClick={() => setCurrentPage('home')} className="back-link" style={{ marginTop: '20px' }}>Back to Home</button>
            </div>
          </section>
        );
      case 'notifications':
        return (
          <section className="container">
            <div className="friends-page" style={{ maxWidth: '900px', margin: '0 auto' }}>
              <h1 style={{ textAlign: 'center', marginBottom: '10px' }}>Inbox & Notifications</h1>
              <p style={{ textAlign: 'center', color: 'var(--text-muted)', marginBottom: '30px' }}>
                Review and approve incoming collaboration and follow requests sent to you.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div className="friends-section" style={{ background: 'var(--card-bg)', borderRadius: '16px', padding: '24px', border: '1px solid var(--border-color)', boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)' }}>
                  <h2 style={{ marginBottom: '20px', fontSize: '1.5rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <FontAwesomeIcon icon="message" style={{ color: 'var(--primary-color)' }} />
                    Incoming Requests ({notifications.length})
                  </h2>

                  {notifications.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      {notifications.map((noti) => (
                        <div
                          key={noti.id}
                          style={{
                            display: 'flex',
                            alignItems: 'flex-start',
                            justifyContent: 'space-between',
                            padding: '20px',
                            background: noti.status === 'pending' ? 'rgba(59, 130, 246, 0.03)' : 'rgba(255,255,255,0.01)',
                            borderRadius: '12px',
                            border: noti.status === 'pending' ? '1px solid rgba(59, 130, 246, 0.15)' : '1px solid rgba(255,255,255,0.05)',
                            transition: 'all 0.3s ease'
                          }}
                        >
                          <div style={{ display: 'flex', gap: '15px', alignItems: 'flex-start', flex: 1 }}>
                            <img
                              src={noti.sender.avatar}
                              alt="avatar"
                              style={{ width: '56px', height: '56px', borderRadius: '50%', border: '2px solid rgba(255,255,255,0.1)', objectFit: 'cover' }}
                            />
                            <div style={{ flex: 1 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                <span style={{ fontWeight: '600', color: 'var(--text-main)', fontSize: '1.1rem' }}>{noti.sender.name}</span>
                                <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>@{noti.sender.username}</span>
                                <span style={{
                                  fontSize: '0.75rem',
                                  padding: '3px 8px',
                                  borderRadius: '10px',
                                  fontWeight: 'bold',
                                  background: noti.type === 'collab' ? 'rgba(168, 85, 247, 0.15)' : 'rgba(59, 130, 246, 0.15)',
                                  color: noti.type === 'collab' ? '#c084fc' : '#60a5fa',
                                  border: noti.type === 'collab' ? '1px solid rgba(168, 85, 247, 0.2)' : '1px solid rgba(59, 130, 246, 0.2)'
                                }}>
                                  {noti.type === 'collab' ? 'Collab Request' : 'Follow Request'}
                                </span>
                              </div>
                              <p style={{ margin: '8px 0', fontSize: '0.95rem', color: 'var(--text-main)' }}>
                                "{noti.message}"
                              </p>
                              {noti.type === 'collab' && (
                                <p style={{ margin: '4px 0', fontSize: '0.85rem', color: '#a78bfa', fontWeight: '500' }}>
                                  <FontAwesomeIcon icon="folder-open" style={{ marginRight: '5px' }} />
                                  Target Repo: {noti.repoName}
                                </p>
                              )}
                              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{noti.time}</span>
                            </div>
                          </div>

                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '10px', marginLeft: '20px' }}>
                            {noti.status === 'pending' ? (
                              <div style={{ display: 'flex', gap: '8px' }}>
                                <button
                                  onClick={() => noti.type === 'collab' ? handleAcceptCollabNoti(noti) : handleAcceptFollowNoti(noti)}
                                  style={{
                                    background: 'rgba(16, 185, 129, 0.15)',
                                    border: '1px solid rgba(16, 185, 129, 0.3)',
                                    color: '#10b981',
                                    padding: '8px 14px',
                                    borderRadius: '8px',
                                    cursor: 'pointer',
                                    fontSize: '0.85rem',
                                    fontWeight: '600',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    transition: 'all 0.2s'
                                  }}
                                  onMouseOver={(e) => { e.currentTarget.style.background = 'rgba(16, 185, 129, 0.25)'; }}
                                  onMouseOut={(e) => { e.currentTarget.style.background = 'rgba(16, 185, 129, 0.15)'; }}
                                >
                                  <FontAwesomeIcon icon="circle-check" />
                                  Accept
                                </button>
                                <button
                                  onClick={() => handleDeclineNoti(noti.id)}
                                  style={{
                                    background: 'rgba(244, 63, 94, 0.1)',
                                    border: '1px solid rgba(244, 63, 94, 0.2)',
                                    color: '#f43f5e',
                                    padding: '8px 14px',
                                    borderRadius: '8px',
                                    cursor: 'pointer',
                                    fontSize: '0.85rem',
                                    fontWeight: '600',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    transition: 'all 0.2s'
                                  }}
                                  onMouseOver={(e) => { e.currentTarget.style.background = 'rgba(244, 63, 94, 0.2)'; }}
                                  onMouseOut={(e) => { e.currentTarget.style.background = 'rgba(244, 63, 94, 0.1)'; }}
                                >
                                  <FontAwesomeIcon icon="circle-xmark" />
                                  Decline
                                </button>
                              </div>
                            ) : (
                              <span style={{
                                padding: '6px 12px',
                                borderRadius: '20px',
                                fontSize: '0.8rem',
                                fontWeight: 'bold',
                                background: noti.status === 'accepted' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(244, 63, 94, 0.1)',
                                color: noti.status === 'accepted' ? '#10b981' : '#f43f5e',
                                border: noti.status === 'accepted' ? '1px solid rgba(16, 185, 129, 0.2)' : '1px solid rgba(244, 63, 94, 0.2)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px'
                              }}>
                                <FontAwesomeIcon icon={noti.status === 'accepted' ? 'circle-check' : 'circle-xmark'} />
                                {noti.status === 'accepted' ? 'Accepted' : 'Declined'}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
                      <p>Your inbox is completely clear!</p>
                    </div>
                  )}
                </div>
              </div>

              <button onClick={() => setCurrentPage('home')} className="back-link" style={{ marginTop: '30px', display: 'block', margin: '30px auto 0' }}>
                Back to Home
              </button>
            </div>
          </section>
        );
      case 'login':
        return null;
      default:
        return <div>Page not found</div>;
    }
  };

  return (
    <div className="app-layout">
      <Header
        onNavigate={setCurrentPage}
        currentPage={currentPage}
        isLoggedIn={isLoggedIn}
        onLogout={handleLogout}
        notificationsCount={notifications.filter(n => n.status === 'pending').length}
      />

      {notification && (
        <div className={`custom-alert ${notification.type}`}>
          <div className="alert-icon">
            {notification.type === 'success' && <FontAwesomeIcon icon="circle-check" />}
            {notification.type === 'error' && <FontAwesomeIcon icon="circle-xmark" />}
            {notification.type === 'info' && <FontAwesomeIcon icon="circle-info" />}
          </div>
          <p>{notification.message}</p>
          <button className="alert-close" onClick={() => setNotification(null)}>×</button>
        </div>
      )}

      {isFriendModalOpen && searchedUser && (
        <div className="modal-overlay" onClick={() => !isSendingRequest && setIsFriendModalOpen(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <h2 style={{ marginBottom: '5px' }}>Send Follow Request</h2>
            <p style={{ color: 'var(--text-muted)', marginBottom: '20px' }}>Follow fellow developers.</p>

            <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '20px', padding: '15px', background: 'rgba(255,255,255,0.03)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
              <img src={searchedUser.avatar} alt="avatar" style={{ width: '60px', height: '60px', borderRadius: '50%', objectFit: 'cover' }} />
              <div>
                <h3 style={{ margin: 0, fontSize: '1.2rem' }}>{searchedUser.name}</h3>
                <p style={{ margin: '5px 0 0 0', color: 'var(--text-muted)' }}>@{searchedUser.username}</p>
              </div>
            </div>

            <div style={{ marginBottom: '25px' }}>
              <label style={{ display: 'block', marginBottom: '10px', fontWeight: '500' }}>Add a message (optional):</label>
              <textarea
                value={friendMessage}
                onChange={(e) => setFriendMessage(e.target.value)}
                placeholder="Hi! I'd love to follow your work and collaborate on some projects."
                style={{ width: '100%', padding: '15px', borderRadius: '10px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-color)', color: 'var(--text-main)', minHeight: '100px', resize: 'vertical', fontFamily: 'inherit' }}
              />
            </div>

            <div className="modal-actions" style={{ marginTop: '0' }}>
              <button className="cancel-btn" onClick={() => setIsFriendModalOpen(false)} disabled={isSendingRequest}>Cancel</button>
              <button
                className="action-btn"
                onClick={confirmFriendRequest}
                disabled={isSendingRequest}
                style={{ minWidth: '150px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}
              >
                {isSendingRequest ? (
                  <>
                    <FontAwesomeIcon icon="spinner" spin />
                    Sending...
                  </>
                ) : (
                  <>
                    <FontAwesomeIcon icon="paper-plane" />
                    Send Request
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {isModalOpen && (
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <h2>Select Repository</h2>
            <p>Choose a project to collaborate with <strong>{searchedUser?.name}</strong>:</p>

            <div className="repo-list">
              {userRepos.length > 0 ? (
                userRepos.map((repo) => (
                  <div key={repo.id} className="repo-item" onClick={() => confirmCollaboration(repo.name)}>
                    <FontAwesomeIcon icon="code-fork" />
                    <div className="repo-info">
                      <div className="repo-name">{repo.name}</div>
                    </div>
                  </div>
                ))
              ) : (
                <p>No repositories found.</p>
              )}
            </div>

            <div className="modal-actions">
              <button className="cancel-btn" onClick={() => setIsModalOpen(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      <main className="main-content">
        {renderPage()}
      </main>
      <Footer />
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import Header from "./components/Header";
import Footer from "./components/Footer";
import Login from "./components/Login";

export default function App() {
  //---Follow State---
  const [friendRequest, setFriendRequest] = useState([]);

  // --- Notifications State ---
  const [notifications, setNotifications] = useState([]);

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
  const [collaborate, setCollaborate] = useState(false);
  const [selectedRepo, setSelectedRepo] = useState(null);
  const [collabStatus, setCollabStatus] = useState('pending');
  const [collabId, setCollabId] = useState(null);
  const [collabPartner, setCollabPartner] = useState(null);
  const [collabOwner, setCollabOwner] = useState('');
  const [showWorkspace, setShowWorkspace] = useState(false);
  const [userRepos, setUserRepos] = useState([]);

  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');

  // --- Fetch Data from Backend ---
  const fetchData = async () => {
    if (!isLoggedIn || !user?.username) return;
    try {
      // Fetch connections and collaborations in parallel to optimize latency
      const [connRes, collabRes] = await Promise.all([
        fetch(`/api/connections/${user.username}`),
        fetch(`/api/collaborations/${user.username}`)
      ]);

      const [connData, collabData] = await Promise.all([
        connRes.json(),
        collabRes.json()
      ]);

      let newFollowNotis = [];
      let newCollabNotis = [];

      if (connData.sentRequests) {
        const mappedRequests = connData.sentRequests.map(req => ({
          id: req.id,
          username: req.receiver.username,
          name: req.receiver.name,
          avatar: req.receiver.avatar,
          status: req.status
        }));
        setFriendRequest(mappedRequests);
      }

      if (connData.receivedRequests) {
        newFollowNotis = connData.receivedRequests.filter(req => req.status === 'pending').map(req => ({
          id: req.id,
          type: 'follow_request',
          message: `@${req.sender.username} wants to connect with you.`,
          sender: req.sender,
          status: 'pending'
        }));
      }

      // Find an active collaboration to display in the workspace (prioritize accepted, then pending initiated)
      const activeInitiated = collabData.initiatedCollabs?.find(c => c.status === 'accepted' || c.status === 'pending');
      const activeTarget = collabData.targetCollabs?.find(c => c.status === 'accepted');

      if (activeTarget) {
        setCollaborate(true);
        setSelectedRepo(activeTarget.repoName);
        setCollabStatus(activeTarget.status);
        setCollabPartner(activeTarget.initiator);
        setCollabId(activeTarget.id);
        setCollabOwner(activeTarget.initiatorId);
      } else if (activeInitiated) {
        setCollaborate(true);
        setSelectedRepo(activeInitiated.repoName);
        setCollabStatus(activeInitiated.status);
        setCollabPartner(activeInitiated.target);
        setCollabId(activeInitiated.id);
        setCollabOwner(activeInitiated.initiatorId);
      } else {
        // Reset collaboration state if none is active
        setCollaborate(false);
        setSelectedRepo(null);
        setCollabStatus('pending');
        setCollabId(null);
        setCollabPartner(null);
        setCollabOwner('');
      }

      // Map all pending received collaborations to notifications
      if (collabData.targetCollabs) {
        const pendingCollabs = collabData.targetCollabs.filter(c => c.status === 'pending');
        newCollabNotis = pendingCollabs.map(c => ({
          id: c.id,
          type: 'collab_request',
          message: `@${c.initiator.username} wants to collaborate on ${c.repoName}`,
          sender: c.initiator,
          repoName: c.repoName,
          status: 'pending'
        }));
      }

      // Merge notifications in a single update, preserving accepted/declined states temporarily for premium feedback
      setNotifications(prev => {
        const currentlyAcceptedOrDeclined = prev.filter(n => n.status === 'accepted' || n.status === 'declined');
        const acceptedOrDeclinedIds = new Set(currentlyAcceptedOrDeclined.map(n => n.id));
        const filteredFollowNotis = newFollowNotis.filter(n => !acceptedOrDeclinedIds.has(n.id));
        const filteredCollabNotis = newCollabNotis.filter(n => !acceptedOrDeclinedIds.has(n.id));
        return [...currentlyAcceptedOrDeclined, ...filteredFollowNotis, ...filteredCollabNotis];
      });

    } catch (error) {
      console.error("Error fetching data:", error);
    }
  };

  useEffect(() => {
    fetchData();
  }, [isLoggedIn, user]);

  // --- OAuth Callback Handling ---
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('auth_success') === 'true') {
      const userDataStr = params.get('user');
      if (userDataStr) {
        try {
          const parsedUser = JSON.parse(decodeURIComponent(userDataStr));
          setIsLoggedIn(true);
          setUser({
            username: parsedUser.login,
            name: parsedUser.name || parsedUser.login,
            avatar: parsedUser.avatar_url,
            bio: parsedUser.bio || 'GitHub Developer',
            repos: parsedUser.public_repos,
            followers: parsedUser.followers,
            following: parsedUser.following
          });
          setCurrentPage('home');
          // Clean up the URL so it looks nice
          window.history.replaceState({}, document.title, window.location.pathname);
        } catch (e) {
          console.error("Failed to parse OAuth user data:", e);
        }
      }
    } else if (params.get('error')) {
      setNotification({ message: 'GitHub Login Error: ' + params.get('error'), type: 'error' });
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  // --- Fetch Messages when Collab is active ---
  useEffect(() => {
    if (collabId && collabStatus === 'accepted') {
      const fetchMessages = async () => {
        try {
          const res = await fetch(`/api/collaborations/${collabId}/messages`);
          if (res.ok) {
            const data = await res.json();
            const formatted = data.map(msg => ({
              sender: msg.senderId === user?.username ? 'me' : 'them',
              text: msg.text
            }));
            setChatMessages(formatted);
          }
        } catch (err) {
          console.error("Failed to load messages", err);
        }
      };

      fetchMessages();
      const interval = setInterval(fetchMessages, 3000);
      return () => clearInterval(interval);
    }
  }, [collabId, collabStatus, user]);

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

  const handleAcceptFollowNoti = async (noti) => {
    try {
      const response = await fetch(`/api/connections/request/${noti.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'accepted' })
      });
      if (response.ok) {
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
        await fetchData();
      }
    } catch (error) {
      showAlert("Error accepting request", "error");
    }
  };

  const handleDeclineNoti = async (noti) => {
    try {
      const endpoint = noti.type === 'collab_request'
        ? `/api/collaborations/${noti.id}`
        : `/api/connections/request/${noti.id}`;

      await fetch(endpoint, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'rejected' })
      });
      setNotifications(prev => prev.map(n => n.id === noti.id ? { ...n, status: 'declined' } : n));
      showAlert('Request declined.', 'info');
      await fetchData();
    } catch (error) {
      showAlert("Error declining request", "error");
    }
  };

  const handleAcceptCollabNoti = async (noti) => {
    try {
      const response = await fetch(`/api/collaborations/${noti.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'accepted' })
      });
      if (response.ok) {
        setNotifications(prev => prev.map(n => n.id === noti.id ? { ...n, status: 'accepted' } : n));
        showAlert(`Collaboration approved for ${noti.repoName}!`, 'success');
        await fetchData();
      }
    } catch (error) {
      showAlert("Error accepting collaboration", "error");
    }
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
      const response = await fetch(`/api/users/${searchInput}`);
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
        // Fallback mock repos so the app is NOT broken
        setUserRepos([
          { id: 1, name: 'react-collaboration-app' },
          { id: 2, name: 'github-user-finder' },
          { id: 3, name: 'portfolio-website' },
          { id: 4, name: 'express-prisma-backend' }
        ]);
        setIsModalOpen(true);
      }
    } catch (error) {
      setUserRepos([
        { id: 1, name: 'react-collaboration-app' },
        { id: 2, name: 'github-user-finder' },
        { id: 3, name: 'portfolio-website' },
        { id: 4, name: 'express-prisma-backend' }
      ]);
      setIsModalOpen(true);
    } finally {
      setIsSearching(false);
    }
  };

  const confirmCollaboration = async (repoName) => {
    if (!user || !searchedUser) return;
    try {
      const response = await fetch('/api/collaborations/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          initiatorId: user.username,
          targetId: searchedUser.username,
          repoName: repoName
        })
      });

      if (response.ok) {
        const data = await response.json();
        showAlert(`Successfully sent a collaboration invite to @${searchedUser.username} for "${repoName}"!`, "success");
        setCollaborate(true);
        setSelectedRepo(repoName);
        setCollabStatus('pending');
        setCollabId(data.id);
        setCollabPartner(searchedUser);
        setCollabOwner(user.username);
        setIsModalOpen(false);
        setCurrentPage('collaboration');
      } else {
        const errorData = await response.json();
        showAlert(errorData.error || "Failed to send collaboration request.", "error");
      }
    } catch (error) {
      showAlert("Error: " + error.message, "error");
    }
  };

  const sendChatMessage = async (e) => {
    e.preventDefault();
    if (!chatInput.trim() || !collabId || !user) return;

    const msgText = chatInput;
    // Optimistically update UI
    setChatMessages(prev => [...prev, { sender: 'me', text: msgText }]);
    setChatInput('');

    try {
      await fetch(`/api/collaborations/${collabId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          senderId: user.username,
          text: msgText
        })
      });
    } catch (err) {
      console.error("Failed to send message", err);
    }
  };

  //--handle for the followRequest--
  const confirmFriendRequest = async () => {
    if (!user || !searchedUser) return;
    setIsSendingRequest(true);
    try {
      const response = await fetch('/api/connections/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          senderId: user.username,
          receiverId: searchedUser.username
        })
      });

      if (response.ok) {
        const newReq = await response.json();
        setFriendRequest(prevRequests => {
          if (prevRequests.some(req => req.username === searchedUser.username)) return prevRequests;
          return [...prevRequests, { ...searchedUser, message: friendMessage, status: 'pending', id: newReq.id }];
        });
        showAlert(`Follow request successfully sent to @${searchedUser.username}!`, "success");
        setIsSendingRequest(false);
        setIsFriendModalOpen(false);

        setSearchedUser(null);
        setSearchInput('');
        setFriendMessage('');
        setCurrentPage('friends');
      } else {
        const errorData = await response.json();
        showAlert(errorData.error || "Failed to send follow request.", "error");
        setIsSendingRequest(false);
      }
    } catch (error) {
      showAlert("Error: " + error.message, "error");
      setIsSendingRequest(false);
    }
  };


  const renderPage = () => {
    try {
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
                <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'center', marginBottom: '25px', flexWrap: 'wrap', gap: '15px' }}>
                  <h1 style={{ margin: 0 }}>Collaboration Dashboard</h1>
                  <button
                    onClick={async () => {
                      await fetchData();
                      showAlert("Dashboard status refreshed!", "success");
                    }}
                    className="action-btn"
                    style={{
                      margin: 0,
                      padding: '8px 16px',
                      fontSize: '0.9rem',
                      background: 'rgba(58, 123, 213, 0.15)',
                      border: '1px solid var(--primary-color)',
                      color: 'var(--primary-color)',
                      borderRadius: '8px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      transition: 'all 0.2s ease-in-out'
                    }}
                    onMouseOver={(e) => {
                      e.currentTarget.style.background = 'var(--primary-color)';
                      e.currentTarget.style.color = '#0f172a';
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.background = 'rgba(58, 123, 213, 0.15)';
                      e.currentTarget.style.color = 'var(--primary-color)';
                    }}
                  >
                    <FontAwesomeIcon icon="rotate" style={{ marginRight: '6px' }} />
                    refresh dashboard
                  </button>
                </div>
                {collaborate && selectedRepo ? (
                  collabStatus === 'pending' ? (
                    <div className="collaboration-card">
                      {/* Removed simulation banner as requested */}
                      <div className="collab-status-bar" style={{ background: '#1e293b', borderBottom: '1px solid var(--glass-border)', padding: '15px 25px' }}>
                        <span className="status-indicator active" style={{ background: '#10b981', boxShadow: '0 0 12px #10b981' }}></span>
                        <span style={{ fontSize: '0.95rem' }}>Collaboration Request: <strong>{selectedRepo}</strong></span>
                      </div>

                      <div className="request-details-container" style={{ padding: '60px 20px' }}>
                        <div className="request-header" style={{ marginBottom: '40px' }}>
                          <div className="request-icon-circle" style={{ width: '120px', height: '120px', margin: '0 auto 25px', border: '5px solid #3a7bd5', background: '#ffffff', borderRadius: '50%', overflow: 'hidden' }}>
                            <img src={collabPartner?.avatar || 'https://via.placeholder.com/120'} alt="Avatar" className="request-avatar-main" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          </div>
                          <h2 style={{ fontSize: '1.8rem', fontWeight: '700', marginBottom: '10px' }}>Collaboration Request Sent</h2>
                          <p className="request-subtitle" style={{ color: 'var(--text-muted)' }}>Your request is being delivered to {collabPartner?.name || collabPartner?.username}</p>
                        </div>

                        <div className="request-summary-card" style={{ maxWidth: '450px', margin: '0 auto 30px', background: 'rgba(15, 23, 42, 0.4)', borderRadius: '16px', border: '1px solid var(--glass-border)', overflow: 'hidden' }}>
                          <div className="summary-item" style={{ display: 'flex', justifyContent: 'space-between', padding: '15px 25px', borderBottom: '1px solid var(--glass-border)' }}>
                            <span className="summary-label" style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Target Repository</span>
                            <span className="summary-value" style={{ fontWeight: '600' }}>{selectedRepo}</span>
                          </div>
                          <div className="summary-item" style={{ display: 'flex', justifyContent: 'space-between', padding: '15px 25px', borderBottom: '1px solid var(--glass-border)', alignItems: 'center' }}>
                            <span className="summary-label" style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Recipient</span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: '#fff', overflow: 'hidden' }}>
                                <img src={collabPartner?.avatar || 'https://via.placeholder.com/24'} alt="mini-avatar" style={{ width: '100%', height: '100%' }} />
                              </div>
                              <span className="summary-value" style={{ fontWeight: '600' }}>{collabPartner?.name || collabPartner?.username}</span>
                            </div>
                          </div>
                          <div className="summary-item" style={{ display: 'flex', justifyContent: 'space-between', padding: '15px 25px' }}>
                            <span className="summary-label" style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Current Status</span>
                            <span className="status-tag pending" style={{ background: '#eab308', color: '#000', padding: '4px 12px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: '700' }}>waiting for approval</span>
                          </div>
                        </div>

                        <div className="request-message-box" style={{ maxWidth: '600px', margin: '0 auto 40px' }}>
                          <div className="btn-how-it-works" style={{ background: '#3a7bd5', color: 'white', display: 'inline-block', padding: '6px 20px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: '600', marginBottom: '20px' }}>
                            How it works
                          </div>
                          <p style={{ fontSize: '0.95rem', color: 'var(--text-muted)', lineHeight: '1.6' }}>
                            We have successfully notified <strong>{collabPartner?.name || collabPartner?.username}</strong> about your collaboration request. They can now review this request on their GitHub dashboard.
                          </p>
                          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '15px' }}>
                            Once they accept, the collaborative workspace will be unlocked for both of you.
                          </p>
                        </div>

                        <div className="collab-actions" style={{ borderTop: '1px solid var(--glass-border)', paddingTop: '30px', display: 'flex', justifyContent: 'center', gap: '15px' }}>
                          <button onClick={async () => { await fetchData(); showAlert("Request status refreshed!", "success"); }} style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', color: 'white', padding: '10px 25px', borderRadius: '8px', fontWeight: '600', fontSize: '0.9rem' }}>Refresh Status</button>
                          <button onClick={async () => {
                            try {
                              const res = await fetch(`/api/collaborations/${collabId}`, {
                                method: 'DELETE'
                              });
                              if (res.ok) {
                                const data = await res.json();
                                setCollaborate(false);
                                setSelectedRepo(null);
                                setCollabStatus('pending');
                                setCollabId(null);
                                setCollabPartner(null);
                                if (data.warning) {
                                  showAlert(data.warning, "error");
                                } else {
                                  showAlert("Request cancelled successfully.", "info");
                                }
                              }
                            } catch (err) {
                              console.error(err);
                            }
                          }} style={{ background: 'rgba(244, 63, 94, 0.1)', border: '1px solid #f43f5e', color: '#f43f5e', padding: '10px 25px', borderRadius: '8px', fontWeight: '600', fontSize: '0.9rem' }}>Cancel Request</button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    !showWorkspace ? (
                      <div className="collaboration-dashboard">
                        <div className="dashboard-card">
                          <div className="dashboard-info">
                            <img src={collabPartner?.avatar || 'https://via.placeholder.com/60'} alt="Avatar" style={{ width: '60px', height: '60px', borderRadius: '50%', objectFit: 'cover' }} />
                            <div className="dashboard-text">
                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <h4>{collabPartner?.name || collabPartner?.username}</h4>
                                <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>@{collabPartner?.username}</span>
                                <span className="badge-purple">Request accepted</span>
                              </div>
                              <p>"You officially collab with @{collabPartner?.username}"</p>
                              <a href={`https://github.com/${collabOwner}/${selectedRepo}`} target="_blank" rel="noopener noreferrer" className="dashboard-link">
                                Here the file that you request to collab: {selectedRepo}
                              </a>
                            </div>
                          </div>

                          <div className="dashboard-actions">

                            <button onClick={() => window.open(`https://github.com/${collabOwner}/${selectedRepo}`, '_blank')} className="btn-go-github" style={{ background: '#10b981', border: 'none', cursor: 'pointer' }}>Go to github</button>
                            <button
                              onClick={async () => {
                                if (window.confirm("Are you sure you want to end this collaboration?")) {
                                  try {
                                    const res = await fetch(`/api/collaborations/${collabId}`, {
                                      method: 'DELETE'
                                    });
                                    if (res.ok) {
                                      const data = await res.json();
                                      setCollaborate(false);
                                      setSelectedRepo(null);
                                      setCollabStatus('pending');
                                      setCollabId(null);
                                      setCollabPartner(null);
                                      setCollabOwner('');
                                      setShowWorkspace(false);
                                      if (data.warning) {
                                        showAlert(data.warning, "error");
                                      } else {
                                        showAlert("Collaboration session ended and collaborator removed from GitHub.", "success");
                                      }
                                      await fetchData();
                                    } else {
                                      const errorData = await res.json();
                                      showAlert(errorData.error || "Failed to end collaboration.", "error");
                                    }
                                  } catch (err) {
                                    console.error(err);
                                    showAlert("An error occurred while ending the collaboration.", "error");
                                  }
                                }
                              }}
                              className="btn-uncollab"
                              style={{ background: '#f43f5e', border: 'none', cursor: 'pointer' }}
                            >
                              uncollaboration
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="workspace-container" style={{ textAlign: 'left', marginTop: '20px' }}>
                        <div className="collab-status-bar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', padding: '12px 20px', borderRadius: '12px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <span className="status-indicator active" style={{ background: '#10b981', boxShadow: '0 0 12px #10b981' }}></span>
                            <span style={{ fontSize: '1.05rem' }}>Active Workspace: <strong>{collabPartner?.name || 'Partner'} / {selectedRepo}</strong></span>
                          </div>
                          <button
                            onClick={() => setShowWorkspace(false)}
                            className="action-btn"
                            style={{ margin: 0, padding: '8px 16px', background: 'rgba(255, 255, 255, 0.1)', color: 'white', border: '1px solid var(--glass-border)' }}
                          >
                            <FontAwesomeIcon icon="arrow-left" style={{ marginRight: '6px' }} />
                            Back to Dashboard
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
                              <div>&nbsp;&nbsp;<span style={{ color: '#f43f5e' }}>const</span> partner = <span style={{ color: '#10b981' }}>"@{collabPartner?.username || 'developer'}"</span>;</div>
                              <br />
                              <div>&nbsp;&nbsp;<span style={{ color: '#eab308' }}>useEffect</span>(() =&gt; &#123;</div>
                              <div>&nbsp;&nbsp;&nbsp;&nbsp;console.log(<span style={{ color: '#10b981' }}>{"`Connected securely to workspace repository: " + selectedRepo + "`"}</span>);</div>
                              <div>&nbsp;&nbsp;&nbsp;&nbsp;console.log(<span style={{ color: '#10b981' }}>{"`Session active with ${partner}`"}</span>);</div>
                              <div>&nbsp;&nbsp;&#125;, []);</div>
                              <br />
                              <div>&nbsp;&nbsp;<span style={{ color: '#f43f5e' }}>return</span> (</div>
                              <div>&nbsp;&nbsp;&nbsp;&nbsp;&lt;<span style={{ color: '#00d2ff' }}>div</span> className=<span style={{ color: '#10b981' }}>"workspace-container"</span>&gt;</div>
                              <div>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&lt;<span style={{ color: '#00d2ff' }}>h1</span>&gt;Hello, Collaboration World!&lt;/<span style={{ color: '#00d2ff' }}>h1</span>&gt;</div>
                              <div>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&lt;<span style={{ color: '#00d2ff' }}>p</span>&gt;Co-editing with &#123;partner&#125;...&lt;/<span style={{ color: '#00d2ff' }}>p</span>&gt;</div>
                              <div style={{ position: 'relative' }}>
                                &nbsp;&nbsp;&nbsp;&nbsp;&lt;/<span style={{ color: '#00d2ff' }}>div</span>&gt;
                                <span style={{ position: 'absolute', left: '90px', top: '18px', background: '#3a7bd5', color: '#fff', fontSize: '0.65rem', padding: '2px 6px', borderRadius: '4px', whiteSpace: 'nowrap' }}>
                                  {collabPartner?.name || 'Partner'} editing
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
                              <img src={collabPartner?.avatar || 'https://via.placeholder.com/32'} alt="Avatar" style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover' }} />
                              <div>
                                <span style={{ fontWeight: '600', fontSize: '0.95rem', display: 'block', color: 'var(--text-main)' }}>{collabPartner?.name}</span>
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
                    <h2 style={{ marginBottom: '20px', fontSize: '1.5rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <FontAwesomeIcon icon="message" style={{ color: 'var(--primary-color)' }} />
                        Incoming Requests ({notifications.length})
                      </div>
                      <button
                        onClick={async () => {
                          setNotifications(prev => prev.filter(n => n.status === 'pending'));
                          await fetchData();
                          showAlert("Inbox refreshed!", "success");
                        }}
                        className="action-btn"
                        style={{ margin: 0, padding: '6px 14px', fontSize: '0.85rem', background: 'rgba(58, 123, 213, 0.1)', border: '1px solid var(--primary-color)', color: 'var(--primary-color)' }}
                      >
                        <FontAwesomeIcon icon="rotate" style={{ marginRight: '6px' }} />
                        Refresh Inbox
                      </button>
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
                                  <span className={noti.type === 'collab_request' ? 'badge-purple' : 'badge-blue'} style={{
                                    fontSize: '0.75rem',
                                    padding: '4px 10px',
                                    borderRadius: '8px',
                                    fontWeight: 'bold'
                                  }}>
                                    {noti.type === 'collab_request' ? 'Collab Request' : 'Follow Request'}
                                  </span>
                                </div>
                                <p style={{ margin: '8px 0', fontSize: '0.95rem', color: 'var(--text-main)' }}>
                                  "{noti.message}"
                                </p>
                                {noti.type === 'collab_request' && (
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
                                    onClick={() => noti.type === 'collab_request' ? handleAcceptCollabNoti(noti) : handleAcceptFollowNoti(noti)}
                                    style={{
                                      background: '#10b981',
                                      color: 'white',
                                      padding: '8px 24px',
                                      borderRadius: '8px',
                                      cursor: 'pointer',
                                      fontSize: '0.85rem',
                                      fontWeight: '600',
                                      border: 'none'
                                    }}
                                  >
                                    Accept
                                  </button>
                                  <button
                                    onClick={() => handleDeclineNoti(noti)}
                                    style={{
                                      background: '#f43f5e',
                                      color: 'white',
                                      padding: '8px 24px',
                                      borderRadius: '8px',
                                      cursor: 'pointer',
                                      fontSize: '0.85rem',
                                      fontWeight: '600',
                                      border: 'none'
                                    }}
                                  >
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
    } catch (error) {
      console.error("Render Page Error:", error);
      return (
        <section className="container" style={{ padding: '40px', textAlign: 'center' }}>
          <div className="info-card" style={{ border: '1px solid #f43f5e', background: 'rgba(244, 63, 94, 0.05)', maxWidth: '800px', margin: '0 auto' }}>
            <h2 style={{ color: '#f43f5e', marginBottom: '15px' }}>Application Render Error</h2>
            <p style={{ color: 'var(--text-main)', marginBottom: '10px' }}>{error.message}</p>
            <pre style={{ background: 'rgba(0,0,0,0.5)', padding: '15px', borderRadius: '8px', textAlign: 'left', overflowX: 'auto', fontSize: '0.85rem', color: '#8892b0', whiteSpace: 'pre-wrap' }}>
              {error.stack}
            </pre>
            <button onClick={() => { setCurrentPage('home'); }} className="action-btn" style={{ marginTop: '20px' }}>
              Back to Home
            </button>
          </div>
        </section>
      );
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

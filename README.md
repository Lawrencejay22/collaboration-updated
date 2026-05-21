# GitHub User Finder & Collaboration App 🚀

A modern, full-stack web application built with **React, Vite, Express, and Prisma** that allows developers to find GitHub profiles, send collaboration requests, and automatically manage repository access.

## ✨ Features

* **GitHub Integration:** Log in securely via GitHub OAuth to manage your repositories.
* **User Search & Profiles:** Search for any GitHub user and view their profile, stats, and repositories.
* **Collaboration Requests:** Invite other developers to collaborate on your specific GitHub repositories.
* **Automatic Access Management:** 
  * Accepting a request automatically sends a GitHub repository invitation.
  * Ending a collaboration session automatically revokes their access from the GitHub repository.
* **Real-time Dashboard:** Manage your active collaborations and pending notifications in a sleek, glassmorphic UI.
* **Responsive Design:** A beautiful, dark-themed UI built with custom CSS and FontAwesome icons.

## 🛠️ Technology Stack

<div align="center">
  <img src="https://img.shields.io/badge/react-%2320232a.svg?style=for-the-badge&logo=react&logoColor=%2361DAFB" alt="React" />
  <img src="https://img.shields.io/badge/vite-%23646CFF.svg?style=for-the-badge&logo=vite&logoColor=white" alt="Vite" />
  <img src="https://img.shields.io/badge/node.js-6DA55F?style=for-the-badge&logo=node.js&logoColor=white" alt="Node.js" />
  <img src="https://img.shields.io/badge/express.js-%23404d59.svg?style=for-the-badge&logo=express&logoColor=%2361DAFB" alt="Express.js" />
  <img src="https://img.shields.io/badge/Prisma-3982CE?style=for-the-badge&logo=Prisma&logoColor=white" alt="Prisma" />
  <img src="https://img.shields.io/badge/postgres-%23316192.svg?style=for-the-badge&logo=postgresql&logoColor=white" alt="PostgreSQL" />
  <img src="https://img.shields.io/badge/Supabase-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white" alt="Supabase" />
</div>

* **Frontend:** React 19, Vite, HTML5, Custom CSS Variables (Glassmorphism UI), FontAwesome Icons
* **Backend:** Node.js, Express.js REST API
* **Database & Deployment:** Prisma ORM connecting to a **PostgreSQL** database hosted on **Supabase**
* **External APIs:** Deep integration with the GitHub REST API (`api.github.com`) using Axios for OAuth, user fetching, and repository management.

## 🚀 Getting Started

### Prerequisites
* Node.js installed on your machine
* A GitHub account

### Installation

1. Clone the repository and install dependencies:
   ```bash
   npm install
   ```

2. Push the Prisma database schema to initialize the local database:
   ```bash
   npx prisma db push
   ```

3. Start the development server (runs both frontend and backend concurrently):
   ```bash
   npm run dev
   ```

4. Open `http://localhost:5173` in your browser.

## 🤝 How to use the Collaboration Feature

1. Click **"Connect with GitHub"** to securely log in and grant the app permission to manage your repositories.
2. Search for a fellow developer.
3. Click the **"Collaborate"** button on their profile and select one of your repositories.
4. They will receive a notification in their dashboard. Once they accept, they are automatically added to your GitHub repository!
5. When you are done working together, click **"uncollaboration"** to instantly revoke their GitHub access.

## ⚠️ Troubleshooting & Error Handling

The application includes built-in failsafes to keep your local dashboard and GitHub perfectly synchronized.

* **GitHub Token Expiration:** If your GitHub authorization token expires and you attempt to remove a collaborator, GitHub will reject the request. The application will detect this, cancel the local deletion, and display a specific error alert asking you to log out and log back in to refresh your token.
* **Pending Invitations:** If a user hasn't accepted your collaboration invitation yet, clicking "uncollaboration" will automatically detect the pending invitation and cancel it on GitHub.
* **Missing Repositories:** If a repository is deleted directly on GitHub while a collaboration is active, the app will safely mark the collaboration as successfully ended locally without crashing.

---
*Created by Lawrence Jay Gabionza.*
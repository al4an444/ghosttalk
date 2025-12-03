# GhostTalk 👻

**GhostTalk** is a secure, end-to-end encrypted (E2EE) chat application built with React, Supabase, and Web Crypto API. It prioritizes privacy, anonymity, and security.

## 🚀 Features

-   **End-to-End Encryption**: Messages and images are encrypted on the client-side using AES-GCM before reaching the server. Supabase never sees the content.
-   **Zero-Knowledge Auth**: Passwords never leave your device. Private keys are encrypted with your password.
-   **Perfect Forward Secrecy**: Uses ephemeral keys and double-ratchet-inspired architecture (simplified).
-   **Private Contacts**: No public user list. Add friends via unique "Friend Codes".
-   **Secure Image Sharing**: Encrypted image attachments with auto-expiration (TTL).
-   **Anti-MITM**: Identity verification via safety number fingerprints.
-   **Self-Destructing Messages**: Set TTL for messages to disappear automatically.

## 🛠️ Tech Stack

-   **Frontend**: React, Vite, TypeScript, Tailwind CSS
-   **Backend**: Supabase (PostgreSQL, Realtime, Storage, Auth)
-   **Cryptography**: Web Crypto API (Native), TweetNaCl.js

## 📦 Installation

1.  **Clone the repository**:
    ```bash
    git clone https://github.com/yourusername/ghosttalk.git
    cd ghosttalk
    ```

2.  **Install dependencies**:
    ```bash
    npm install
    ```

3.  **Environment Setup**:
    Copy `.env.example` to `.env` and add your Supabase credentials:
    ```bash
    cp .env.example .env
    ```
    ```env
    VITE_SUPABASE_URL=your_supabase_url
    VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
    ```

4.  **Database Setup**:
    -   Go to your Supabase Dashboard -> SQL Editor.
    -   Copy the content of `database_setup.sql` and run it.
    -   This will create all tables, RLS policies, and triggers.

5.  **Run Locally**:
    ```bash
    npm run dev
    ```

## 🔒 Security Model

-   **Identity**: Ed25519 (Signing) + X25519 (Encryption) key pairs generated on the client.
-   **Key Exchange**: ECDH to derive shared secrets.
-   **Encryption**: AES-GCM (256-bit) for messages and files.
-   **Storage**: Private keys are encrypted with PBKDF2 derived from the user's password and stored in Supabase.

## ⚠️ Disclaimer

This project is for educational purposes. While it uses standard cryptographic primitives, it has not been audited by a third party. Use at your own risk.

## 📄 License

MIT

# GhostTalk

GhostTalk is a secure, end-to-end encrypted (E2EE) chat application built with React, Supabase, and the Web Crypto API. Designed with a strict focus on privacy and zero-knowledge architecture, it ensures that all communication remains confidential and inaccessible to server operators.

---

## Technical Overview

GhostTalk implements a comprehensive client-side encryption model where sensitive data is encrypted before transmission. The architecture prevents man-in-the-middle attacks and ensures perfect forward secrecy through advanced cryptographic primitives.

### Core Features

* **End-to-End Encryption**: All messages and media attachments are encrypted locally using AES-GCM (256-bit). The Supabase backend only routes encrypted ciphertexts and never possesses the decryption keys.
* **Zero-Knowledge Authentication**: Passwords remain on the client device. User private keys are encrypted using a PBKDF2 derivative of the password before being stored in the database.
* **Secure Key Exchange**: Utilizes Elliptic-Curve Diffie-Hellman (ECDH) over Curve25519 to derive shared secrets between clients.
* **Identity Verification**: Implements Ed25519 signing keys to verify sender identity and provides safety number fingerprints to detect interception attempts.
* **Private Network Topology**: Avoids public user directories. Connections are established exclusively through out-of-band "Friend Codes".
* **Ephemeral Data**: Features self-destructing messages and auto-expiring media attachments with configurable Time-To-Live (TTL).

### System Requirements

* **Frontend Environment**: Node.js (v18 or higher) and npm.
* **Backend Infrastructure**: A Supabase project (providing PostgreSQL, Auth, Realtime, and Storage).

---

## Build and Installation

### 1. Repository Setup
Clone the repository and install the required dependencies:
```bash
git clone https://github.com/al4an444/ghosttalk.git
cd ghosttalk
npm install
```

### 2. Environment Configuration
Duplicate the example environment file and populate it with your Supabase project credentials:
```bash
cp .env.example .env
```
Ensure the following variables are correctly assigned in your `.env` file:
```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 3. Database Initialization
1. Access your Supabase Dashboard and navigate to the SQL Editor.
2. Execute the entire contents of the `database_setup.sql` file.
3. This process automatically provisions all necessary tables, Row Level Security (RLS) policies, and database triggers required for secure operation.

### 4. Local Execution
Start the Vite development server:
```bash
npm run dev
```

---

## Security Model

* **Cryptography Engine**: Native Web Crypto API combined with TweetNaCl.js.
* **Identity Management**: Ed25519 for signature generation and verification.
* **Encryption Standard**: X25519 for asymmetric key establishment and AES-GCM for symmetric payload encryption.

## Disclaimer

This software is developed for educational purposes to demonstrate the implementation of cryptographic protocols in web applications. It has not undergone formal security auditing by independent third parties. Deploy and use at your own discretion.

## License

Distributed under the MIT License.

export interface UserIdentity {
    username: string;
    publicKeySigning: string; // Base64 Ed25519 public key
    publicKeyEncryption: string; // Base64 X25519 public key
    encryptedPrivateKey: string; // Base64 encrypted JSON containing both private keys
    salt: string; // Base64 salt for PBKDF2
}

export interface KeyPair {
    publicKey: Uint8Array;
    secretKey: Uint8Array;
}

export interface FullIdentity {
    signing: KeyPair;
    encryption: KeyPair;
}

export interface Group {
    id: string;
    name: string;
    created_by: string;
    created_at: string;
}

export interface GroupMember {
    group_id: string;
    user_id: string;
}

export interface EncryptedMessage {
    id?: string;
    sender_id: string;
    recipient_id: string;
    group_id?: string | null; // Optional group ID
    encrypted_content: string; // Base64 AES-GCM ciphertext
    nonce: string; // Base64 IV
    created_at?: string;
    expires_at?: string | null;
}

export interface DecryptedMessage {
    id: string;
    senderId: string;
    recipientId: string; // Needed to distinguish group msgs
    groupId?: string | null;
    content: string;
    timestamp: Date;
    expiresAt?: Date | null;
    isOwn: boolean;
}

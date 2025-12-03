import nacl from 'tweetnacl';
import { encodeBase64, decodeBase64 } from 'tweetnacl-util';
import type { FullIdentity } from '../types';

// --- Helpers ---

export const toBase64 = (arr: Uint8Array): string => encodeBase64(arr);
export const fromBase64 = (str: string): Uint8Array => decodeBase64(str);

const strToUint8Array = (str: string): Uint8Array => new TextEncoder().encode(str);
const uint8ArrayToStr = (arr: Uint8Array): string => new TextDecoder().decode(arr);

// --- Key Generation ---

/**
 * Generates a new identity with Ed25519 (signing) and X25519 (encryption) keys.
 */
export const generateIdentity = (): FullIdentity => {
    const signing = nacl.sign.keyPair();
    const encryption = nacl.box.keyPair();
    return { signing, encryption };
};

// --- Password Based Key Derivation (PBKDF2) ---

/**
 * Derives a symmetric key from a password using PBKDF2.
 * This key is used to encrypt/decrypt the user's private keys.
 */
export const deriveKeyFromPassword = async (password: string, salt: Uint8Array): Promise<CryptoKey> => {
    const passwordBuffer = strToUint8Array(password);
    const keyMaterial = await window.crypto.subtle.importKey(
        'raw',
        passwordBuffer as unknown as BufferSource,
        { name: 'PBKDF2' },
        false,
        ['deriveKey']
    );

    return window.crypto.subtle.deriveKey(
        {
            name: 'PBKDF2',
            salt: salt as unknown as BufferSource,
            iterations: 100000, // High iteration count for security
            hash: 'SHA-256',
        },
        keyMaterial,
        { name: 'AES-GCM', length: 256 },
        false, // Key is not extractable
        ['encrypt', 'decrypt']
    );
};

export const createSalt = (): Uint8Array => window.crypto.getRandomValues(new Uint8Array(16));

// --- Private Key Protection ---

/**
 * Encrypts the private identity (both keys) using the password-derived key.
 */
export const encryptIdentity = async (identity: FullIdentity, passwordKey: CryptoKey): Promise<string> => {
    const data = JSON.stringify({
        signingSecret: toBase64(identity.signing.secretKey),
        encryptionSecret: toBase64(identity.encryption.secretKey),
    });
    const encodedData = strToUint8Array(data);
    const iv = window.crypto.getRandomValues(new Uint8Array(12)); // 96-bit IV for AES-GCM

    const encryptedBuffer = await window.crypto.subtle.encrypt(
        { name: 'AES-GCM', iv: iv as unknown as BufferSource },
        passwordKey,
        encodedData as unknown as BufferSource
    );

    // Combine IV and ciphertext for storage
    const combined = new Uint8Array(iv.length + encryptedBuffer.byteLength);
    combined.set(iv);
    combined.set(new Uint8Array(encryptedBuffer), iv.length);

    return toBase64(combined);
};

/**
 * Decrypts the private identity using the password-derived key.
 */
export const decryptIdentity = async (encryptedBlob: string, passwordKey: CryptoKey): Promise<FullIdentity> => {
    const combined = fromBase64(encryptedBlob);
    const iv = combined.slice(0, 12);
    const ciphertext = combined.slice(12);

    try {
        const decryptedBuffer = await window.crypto.subtle.decrypt(
            { name: 'AES-GCM', iv: iv as unknown as BufferSource },
            passwordKey,
            ciphertext
        );

        const data = JSON.parse(uint8ArrayToStr(new Uint8Array(decryptedBuffer)));

        return {
            signing: nacl.sign.keyPair.fromSecretKey(fromBase64(data.signingSecret)),
            encryption: nacl.box.keyPair.fromSecretKey(fromBase64(data.encryptionSecret)),
        };
    } catch (e) {
        throw new Error('Decryption failed. Wrong password?');
    }
};

// --- Message Encryption (E2EE) ---

/**
 * Derives a shared secret using ECDH (X25519).
 * My Private Key (Encryption) + Their Public Key (Encryption) = Shared Secret
 */
export const deriveSharedSecret = async (myPrivateKey: Uint8Array, theirPublicKey: Uint8Array): Promise<CryptoKey> => {
    // TweetNaCl scalarMult produces a 32-byte shared secret.
    // We import this as a raw AES-GCM key.
    const sharedSecret = nacl.scalarMult(myPrivateKey, theirPublicKey);

    return window.crypto.subtle.importKey(
        'raw',
        sharedSecret as unknown as BufferSource,
        { name: 'AES-GCM' },
        false,
        ['encrypt', 'decrypt']
    );
};

/**
 * Encrypts a message using the shared secret (AES-GCM).
 */
export const encryptMessage = async (text: string, sharedSecret: CryptoKey): Promise<{ ciphertext: string, nonce: string }> => {
    const encoded = strToUint8Array(text);
    const iv = window.crypto.getRandomValues(new Uint8Array(12));

    const encryptedBuffer = await window.crypto.subtle.encrypt(
        { name: 'AES-GCM', iv: iv as unknown as BufferSource },
        sharedSecret,
        encoded as unknown as BufferSource
    );

    return {
        ciphertext: toBase64(new Uint8Array(encryptedBuffer)),
        nonce: toBase64(iv),
    };
};

/**
 * Decrypts a message using the shared secret (AES-GCM).
 */
export const decryptMessage = async (ciphertext: string, nonce: string, sharedSecret: CryptoKey): Promise<string> => {
    const encryptedData = fromBase64(ciphertext);
    const iv = fromBase64(nonce);

    const decryptedBuffer = await window.crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: iv as unknown as BufferSource },
        sharedSecret,
        encryptedData as unknown as BufferSource
    );

    return uint8ArrayToStr(new Uint8Array(decryptedBuffer));
};

// --- Signing ---

export const signMessage = (message: string, secretKey: Uint8Array): string => {
    const msgBytes = strToUint8Array(message);
    const signature = nacl.sign.detached(msgBytes, secretKey);
    return toBase64(signature);
};

export const verifySignature = (message: string, signature: string, publicKey: Uint8Array): boolean => {
    const msgBytes = strToUint8Array(message);
    const sigBytes = fromBase64(signature);
    return nacl.sign.detached.verify(msgBytes, sigBytes, publicKey);
};

import { toBase64 } from './crypto';

export type VerificationStatus = 'verified' | 'unverified' | 'mismatch';

const STORAGE_KEY = 'ghosttalk_verified_users';

interface VerifiedUserStore {
    [userId: string]: {
        publicKey: string; // The key we verified
        timestamp: number;
    };
}

/**
 * Generates a "Safety Number" fingerprint from two public keys.
 * Sorts keys to ensure the same number is generated for both parties.
 */
export const generateSafetyNumber = async (myPublicKey: Uint8Array, theirPublicKey: Uint8Array): Promise<string> => {
    // 1. Convert to Base64 for consistent sorting/string manipulation
    const k1 = toBase64(myPublicKey);
    const k2 = toBase64(theirPublicKey);

    // 2. Sort to ensure A+B = B+A
    const [first, second] = [k1, k2].sort();

    // 3. Hash the combined string
    const data = new TextEncoder().encode(first + second);
    const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));

    // 4. Convert to a numeric format (e.g. 12 groups of 5 digits)
    // We'll take the first 30 bytes and convert to numbers
    // Simple visualization: Hex string split into chunks
    const hex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    // Format: XXXXX - XXXXX - XXXXX ...
    return hex.match(/.{1,5}/g)?.slice(0, 6).join(' - ').toUpperCase() || 'ERROR';
};

/**
 * Checks the verification status of a user.
 * Detects if the key has changed since last verification (Key Pinning).
 */
export const getVerificationStatus = (userId: string, currentKeyBase64: string): VerificationStatus => {
    try {
        const store: VerifiedUserStore = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
        const record = store[userId];

        if (!record) return 'unverified';

        if (record.publicKey !== currentKeyBase64) {
            return 'mismatch'; // DANGER: Key changed!
        }

        return 'verified';
    } catch (e) {
        console.error("Failed to read verification store", e);
        return 'unverified';
    }
};

/**
 * Marks a user as verified, pinning their current public key.
 */
export const setVerified = (userId: string, keyBase64: string) => {
    try {
        const store: VerifiedUserStore = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
        store[userId] = {
            publicKey: keyBase64,
            timestamp: Date.now()
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
    } catch (e) {
        console.error("Failed to save verification", e);
    }
};

/**
 * Removes verification for a user (e.g. if user accepts the new key).
 */
export const clearVerification = (userId: string) => {
    try {
        const store: VerifiedUserStore = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
        delete store[userId];
        localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
    } catch (e) {
        console.error("Failed to clear verification", e);
    }
};

import { toBase64 } from './crypto';
import type { FullIdentity } from '../types';

export interface RecoveryKit {
    version: number;
    username: string;
    created_at: string;
    keys: {
        signing: {
            public: string;
            secret: string;
        };
        encryption: {
            public: string;
            secret: string;
        };
    };
}

/**
 * Creates a JSON Recovery Kit containing the raw private keys.
 * WARNING: This data is sensitive and allows full account access.
 */
export const createRecoveryKit = (identity: FullIdentity, username: string): string => {
    const kit: RecoveryKit = {
        version: 1,
        username: username,
        created_at: new Date().toISOString(),
        keys: {
            signing: {
                public: toBase64(identity.signing.publicKey),
                secret: toBase64(identity.signing.secretKey)
            },
            encryption: {
                public: toBase64(identity.encryption.publicKey),
                secret: toBase64(identity.encryption.secretKey)
            }
        }
    };

    return JSON.stringify(kit, null, 2);
};

/**
 * Parses and validates a Recovery Kit JSON string.
 */
export const parseRecoveryKit = (jsonString: string): RecoveryKit | null => {
    try {
        const kit = JSON.parse(jsonString) as RecoveryKit;

        // Basic validation
        if (!kit.username || !kit.keys?.signing?.secret || !kit.keys?.encryption?.secret) {
            throw new Error("Invalid kit format");
        }

        return kit;
    } catch (e) {
        console.error("Failed to parse recovery kit", e);
        return null;
    }
};

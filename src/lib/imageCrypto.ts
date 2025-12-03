import { toBase64, fromBase64 } from './crypto';

// 1. Compression (Canvas)
export const compressImage = async (file: File): Promise<Blob> => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.src = URL.createObjectURL(file);
        img.onload = () => {
            const canvas = document.createElement('canvas');
            let width = img.width;
            let height = img.height;
            const MAX_SIZE = 1024;

            if (width > height) {
                if (width > MAX_SIZE) {
                    height *= MAX_SIZE / width;
                    width = MAX_SIZE;
                }
            } else {
                if (height > MAX_SIZE) {
                    width *= MAX_SIZE / height;
                    height = MAX_SIZE;
                }
            }

            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (!ctx) {
                reject(new Error("Canvas context not available"));
                return;
            }
            ctx.drawImage(img, 0, 0, width, height);

            canvas.toBlob((blob) => {
                if (blob) resolve(blob);
                else reject(new Error("Compression failed"));
            }, 'image/jpeg', 0.7); // Quality 0.7
        };
        img.onerror = (e) => reject(e);
    });
};

// 2. Key Generation
export const generateAttachmentKey = async (): Promise<CryptoKey> => {
    return await window.crypto.subtle.generateKey(
        {
            name: "AES-GCM",
            length: 256
        },
        true,
        ["encrypt", "decrypt"]
    );
};

export const exportKey = async (key: CryptoKey): Promise<string> => {
    const exported = await window.crypto.subtle.exportKey("raw", key);
    return toBase64(new Uint8Array(exported));
};

export const importKey = async (base64Key: string): Promise<CryptoKey> => {
    const raw = fromBase64(base64Key);
    return await window.crypto.subtle.importKey(
        "raw",
        raw as BufferSource,
        { name: "AES-GCM" },
        true,
        ["encrypt", "decrypt"]
    );
};

// 3. Encryption
export const encryptBlob = async (blob: Blob, key: CryptoKey): Promise<{ encryptedBlob: Blob; iv: Uint8Array }> => {
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const arrayBuffer = await blob.arrayBuffer();

    const encryptedBuffer = await window.crypto.subtle.encrypt(
        {
            name: "AES-GCM",
            iv: iv
        },
        key,
        arrayBuffer
    );

    // Append IV to the beginning of the blob for easier storage/retrieval
    // Format: [IV (12 bytes)] [Encrypted Data]
    const combinedBuffer = new Uint8Array(iv.length + encryptedBuffer.byteLength);
    combinedBuffer.set(iv);
    combinedBuffer.set(new Uint8Array(encryptedBuffer), iv.length);

    return {
        encryptedBlob: new Blob([combinedBuffer]),
        iv
    };
};

// 4. Decryption
export const decryptBlob = async (encryptedBlob: Blob, key: CryptoKey): Promise<Blob> => {
    const arrayBuffer = await encryptedBlob.arrayBuffer();
    const combinedArray = new Uint8Array(arrayBuffer);

    // Extract IV
    const iv = combinedArray.slice(0, 12);
    const data = combinedArray.slice(12);

    const decryptedBuffer = await window.crypto.subtle.decrypt(
        {
            name: "AES-GCM",
            iv: iv
        },
        key,
        data
    );

    return new Blob([decryptedBuffer], { type: 'image/jpeg' });
};

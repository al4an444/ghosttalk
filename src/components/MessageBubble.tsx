import React, { useState, useEffect } from 'react';
import { Clock, Image as ImageIcon, AlertTriangle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { importKey, decryptBlob } from '../lib/imageCrypto';
import type { DecryptedMessage } from '../types';

interface MessageBubbleProps {
    msg: DecryptedMessage;
    isGroup: boolean;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({ msg, isGroup }) => {
    const [imageUrl, setImageUrl] = useState<string | null>(null);
    const [imageError, setImageError] = useState(false);
    const [loadingImage, setLoadingImage] = useState(false);

    const isImage = msg.content.startsWith('📎IMAGE|');

    useEffect(() => {
        if (isImage) {
            const fetchImage = async () => {
                setLoadingImage(true);
                try {
                    // Format: 📎IMAGE|path|keyBase64
                    const parts = msg.content.split('|');
                    if (parts.length !== 3) throw new Error("Invalid image format");

                    const path = parts[1];
                    const keyBase64 = parts[2];

                    // 1. Download Encrypted Blob
                    const { data, error } = await supabase.storage
                        .from('secure-images')
                        .download(path);

                    if (error) throw error;
                    if (!data) throw new Error("No data received");

                    // 2. Decrypt
                    const key = await importKey(keyBase64);
                    const decryptedBlob = await decryptBlob(data, key);

                    // 3. Create URL
                    const url = URL.createObjectURL(decryptedBlob);
                    setImageUrl(url);
                } catch (e) {
                    console.error("Failed to load image", e);
                    setImageError(true);
                } finally {
                    setLoadingImage(false);
                }
            };
            fetchImage();
        }
    }, [msg.content, isImage]);

    return (
        <div className={`flex ${msg.isOwn ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[70%] p-3 rounded-lg break-words relative group ${msg.isOwn
                ? 'bg-neon-green/10 border border-neon-green/30 text-green-100 rounded-tr-none'
                : 'bg-dark-surface border border-dark-border text-gray-200 rounded-tl-none'
                }`}>

                {isGroup && !msg.isOwn && (
                    <div className="text-[10px] text-neon-purple mb-1 font-bold">
                        User {msg.senderId.substring(0, 4)}...
                    </div>
                )}

                {isImage ? (
                    <div className="mt-1 mb-2">
                        {loadingImage && (
                            <div className="flex items-center gap-2 text-gray-500 text-sm p-4 bg-black/20 rounded">
                                <div className="animate-spin w-4 h-4 border-2 border-neon-green border-t-transparent rounded-full" />
                                Decrypting image...
                            </div>
                        )}
                        {imageError && (
                            <div className="flex items-center gap-2 text-gray-500 text-sm p-4 bg-gray-800/50 rounded border border-gray-700">
                                <ImageIcon size={16} className="opacity-50" />
                                <span>Image expired or deleted</span>
                            </div>
                        )}
                        {imageUrl && (
                            <div className="relative">
                                <img
                                    src={imageUrl}
                                    alt="Encrypted attachment"
                                    className="rounded-lg max-w-full max-h-64 object-cover border border-dark-border"
                                />
                                <div className="mt-1 flex items-center gap-1 text-[10px] text-yellow-500/80">
                                    <AlertTriangle size={10} />
                                    <span>Self-destructs in 1h</span>
                                </div>
                            </div>
                        )}
                    </div>
                ) : (
                    <p>{msg.content}</p>
                )}

                <div className="flex items-center justify-end gap-2 mt-1 opacity-50 text-[10px]">
                    {msg.expiresAt && (
                        <span className="flex items-center gap-1 text-red-400" title={`Expires at ${msg.expiresAt.toLocaleTimeString()}`}>
                            <Clock size={10} /> TTL
                        </span>
                    )}
                    <span>{msg.timestamp.toLocaleTimeString()}</span>
                </div>
            </div>
        </div>
    );
};

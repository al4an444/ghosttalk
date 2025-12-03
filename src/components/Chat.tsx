import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useStore } from '../store/store';
import {
    deriveSharedSecret,
    encryptMessage,
    decryptMessage,
    fromBase64,
    toBase64
} from '../lib/crypto';
import { compressImage, generateAttachmentKey, encryptBlob, exportKey } from '../lib/imageCrypto';
import type { DecryptedMessage, EncryptedMessage } from '../types';
import { api } from '../lib/api';
import { CreateGroupModal } from './CreateGroupModal';
import { ChatHeader } from './ChatHeader';
import DOMPurify from 'dompurify';
import { Send, Shield, Clock, AlertCircle, Paperclip, X } from 'lucide-react';
import { BackupModal } from './BackupModal';
import { Sidebar } from './Sidebar';
import { MessageBubble } from './MessageBubble';

interface ChatItem {
    id: string;
    name: string;
    type: 'user' | 'group';
    // For users
    public_key_encryption?: string;
    public_key_signing?: string;
}

export const Chat: React.FC = () => {
    const { user, identity } = useStore();
    const [chats, setChats] = useState<ChatItem[]>([]);
    const [selectedChat, setSelectedChat] = useState<ChatItem | null>(null);
    const [messages, setMessages] = useState<DecryptedMessage[]>([]);
    const [inputText, setInputText] = useState('');
    const [showCreateGroup, setShowCreateGroup] = useState(false);
    const [showBackup, setShowBackup] = useState(false);

    // Image Upload State
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // TTL State
    const [ttlDuration, setTtlDuration] = useState<number | null>(null); // null = infinite, number = minutes

    // Rate Limiting
    const lastMessageTime = useRef<number>(0);
    const [rateLimitWarning, setRateLimitWarning] = useState(false);

    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Load Chats (Contacts + Groups)
    const loadChats = async () => {
        if (!user) return;
        try {
            const [contactsData, groupsData] = await Promise.all([
                api.getContacts(user.id),
                api.getMyGroups(user.id)
            ]);

            const contactChats: ChatItem[] = contactsData.map((u: any) => ({
                id: u.id,
                name: u.username,
                type: 'user',
                public_key_encryption: u.public_key_encryption,
                public_key_signing: u.public_key_signing
            }));

            const groupChats: ChatItem[] = groupsData.map((g: any) => ({
                id: g.id,
                name: g.name,
                type: 'group'
            }));

            setChats([...groupChats, ...contactChats]);
        } catch (e) {
            console.error("Failed to load chats", e);
        }
    };

    useEffect(() => {
        loadChats();
    }, [user?.id]);

    // Prune Expired Messages Interval
    useEffect(() => {
        const interval = setInterval(() => {
            setMessages(prev => prev.filter(msg => {
                if (!msg.expiresAt) return true;
                return msg.expiresAt.getTime() > Date.now();
            }));
        }, 5000); // Check every 5 seconds

        return () => clearInterval(interval);
    }, []);

    // Handle Chat Selection & Message Loading
    useEffect(() => {
        if (!selectedChat || !user || !identity) return;

        setMessages([]); // Clear previous
        setSelectedFile(null);
        setPreviewUrl(null);

        const decryptAndAddMessage = async (msg: EncryptedMessage) => {
            try {
                // Check Expiration
                if (msg.expires_at && new Date(msg.expires_at).getTime() < Date.now()) {
                    return; // Skip expired
                }

                let decryptedContent = '';
                let isOwn = msg.sender_id === user.id;

                if (selectedChat.type === 'user') {
                    // 1:1 Decryption
                    const otherUser = chats.find(c => c.id === selectedChat.id);
                    if (!otherUser?.public_key_encryption) return;

                    const otherPublicKey = fromBase64(otherUser.public_key_encryption);
                    const sharedSecret = await deriveSharedSecret(identity.encryption.secretKey, otherPublicKey);
                    decryptedContent = await decryptMessage(msg.encrypted_content, msg.nonce, sharedSecret);
                } else {
                    // Group Decryption (Fan-out)
                    let senderKeyStr = '';
                    const sender = chats.find(c => c.id === msg.sender_id);

                    if (sender?.public_key_encryption) {
                        senderKeyStr = sender.public_key_encryption;
                    } else if (isOwn) {
                        senderKeyStr = toBase64(identity.encryption.publicKey);
                    } else {
                        decryptedContent = "[Encrypted Message from Unknown Sender]";
                    }

                    if (senderKeyStr) {
                        const senderPublicKey = fromBase64(senderKeyStr);
                        const sharedSecret = await deriveSharedSecret(identity.encryption.secretKey, senderPublicKey);
                        decryptedContent = await decryptMessage(msg.encrypted_content, msg.nonce, sharedSecret);
                    }
                }

                if (decryptedContent && decryptedContent !== "[Encrypted Message from Unknown Sender]") {
                    setMessages(prev => {
                        if (prev.some(m => m.id === msg.id)) return prev;
                        const newMsg: DecryptedMessage = {
                            id: msg.id!,
                            content: DOMPurify.sanitize(decryptedContent),
                            senderId: msg.sender_id,
                            recipientId: msg.recipient_id,
                            groupId: msg.group_id,
                            timestamp: new Date(msg.created_at!),
                            isOwn,
                            expiresAt: msg.expires_at ? new Date(msg.expires_at) : undefined
                        };
                        return [...prev, newMsg].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
                    });
                }
            } catch (e) {
                console.error("Decryption error", e);
            }
        };

        // Subscribe to new messages
        const channel = supabase.channel(`chat:${selectedChat.id}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'messages',
                    filter: selectedChat.type === 'user'
                        ? `recipient_id=eq.${user.id}` // 1:1
                        : `group_id=eq.${selectedChat.id}` // Group
                },
                async (payload) => {
                    const newMsg = payload.new as EncryptedMessage;
                    // Filter for current chat
                    if (selectedChat.type === 'user') {
                        if (newMsg.sender_id === selectedChat.id || (newMsg.sender_id === user.id && newMsg.recipient_id === selectedChat.id)) {
                            await decryptAndAddMessage(newMsg);
                        }
                    } else {
                        if (newMsg.group_id === selectedChat.id) {
                            await decryptAndAddMessage(newMsg);
                        }
                    }
                }
            )
            .subscribe();

        // Initial Load
        const fetchMessages = async () => {
            let query = supabase
                .from('messages')
                .select('*')
                .order('created_at', { ascending: true });

            if (selectedChat.type === 'user') {
                // 1:1: Messages between me and them
                query = query.or(`and(sender_id.eq.${user.id},recipient_id.eq.${selectedChat.id}),and(sender_id.eq.${selectedChat.id},recipient_id.eq.${user.id})`);
            } else {
                // Group: Messages in group
                query = query.eq('group_id', selectedChat.id);
            }

            const { data, error } = await query;
            if (error) {
                console.error("Error fetching messages", error);
                return;
            }

            if (data) {
                data.forEach(msg => decryptAndAddMessage(msg as EncryptedMessage));
            }
        };

        fetchMessages();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [selectedChat, user?.id, identity]);

    // Handle File Selection
    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setSelectedFile(file);
            setPreviewUrl(URL.createObjectURL(file));
        }
    };

    const clearFile = () => {
        setSelectedFile(null);
        setPreviewUrl(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if ((!inputText.trim() && !selectedFile) || !selectedChat || !user || !identity) return;

        // Rate Limit Check
        const now = Date.now();
        if (now - lastMessageTime.current < 1000) {
            setRateLimitWarning(true);
            setTimeout(() => setRateLimitWarning(false), 2000);
            return;
        }
        lastMessageTime.current = now;

        let contentToSend = inputText.trim();
        setIsUploading(true);

        try {
            // 1. Handle Image Upload if present
            if (selectedFile) {
                // Compress
                const compressedBlob = await compressImage(selectedFile);

                // Generate Key
                const attachmentKey = await generateAttachmentKey();
                const keyBase64 = await exportKey(attachmentKey);

                // Encrypt
                const { encryptedBlob } = await encryptBlob(compressedBlob, attachmentKey);

                // Upload
                const fileName = `${user.id}/${Date.now()}_encrypted.bin`;
                const { error: uploadError } = await supabase.storage
                    .from('secure-images')
                    .upload(fileName, encryptedBlob);

                if (uploadError) throw uploadError;

                // Format Message: 📎IMAGE|path|key
                contentToSend = `📎IMAGE|${fileName}|${keyBase64}`;
            }

            // 2. Send Message (Encrypted Text or Image Link)
            // Calculate Expiration
            let expiresAt: string | null = null;
            if (ttlDuration) {
                const expiryDate = new Date(now + ttlDuration * 60000);
                expiresAt = expiryDate.toISOString();
            }

            if (selectedChat.type === 'user') {
                // 1:1 Encryption
                const otherUser = chats.find(c => c.id === selectedChat.id);
                if (!otherUser?.public_key_encryption) throw new Error("User key not found");

                const otherPublicKey = fromBase64(otherUser.public_key_encryption);
                const sharedSecret = await deriveSharedSecret(identity.encryption.secretKey, otherPublicKey);
                const { ciphertext, nonce } = await encryptMessage(contentToSend, sharedSecret);

                await supabase.from('messages').insert({
                    sender_id: user.id,
                    recipient_id: selectedChat.id,
                    encrypted_content: ciphertext,
                    nonce,
                    expires_at: expiresAt
                });

            } else {
                // Group Encryption (Fan-out)
                const members = await api.getGroupMembers(selectedChat.id);

                const promises = members.map(async (member: any) => {
                    const memberKey = fromBase64(member.public_key_encryption);
                    const sharedSecret = await deriveSharedSecret(identity.encryption.secretKey, memberKey);
                    const { ciphertext, nonce } = await encryptMessage(contentToSend, sharedSecret);

                    return {
                        sender_id: user.id,
                        recipient_id: member.id,
                        group_id: selectedChat.id,
                        encrypted_content: ciphertext,
                        nonce,
                        expires_at: expiresAt
                    };
                });

                const messagesPayload = await Promise.all(promises);
                await supabase.from('messages').insert(messagesPayload);
            }

            // Optimistic UI Update
            const newMsg: DecryptedMessage = {
                id: 'temp-' + Date.now(),
                content: DOMPurify.sanitize(contentToSend),
                senderId: user.id,
                recipientId: selectedChat.type === 'user' ? selectedChat.id : user.id,
                groupId: selectedChat.type === 'group' ? selectedChat.id : null,
                timestamp: new Date(),
                isOwn: true,
                expiresAt: expiresAt ? new Date(expiresAt) : undefined
            };
            setMessages(prev => [...prev, newMsg]);

            // Reset
            setInputText('');
            clearFile();

        } catch (e) {
            console.error("Send failed", e);
            alert("Failed to send message");
        } finally {
            setIsUploading(false);
        }
    };

    // Auto-scroll to bottom
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    return (
        <div className="flex h-screen bg-dark-bg text-gray-200 font-sans overflow-hidden">
            {/* Sidebar */}
            <Sidebar
                chats={chats}
                selectedChatId={selectedChat?.id}
                onSelectChat={setSelectedChat}
                onCreateGroup={() => setShowCreateGroup(true)}
                onExportBackup={() => setShowBackup(true)}
                onRefresh={loadChats}
            />

            {/* Chat Area */}
            <div className="flex-1 flex flex-col bg-dark-bg relative">
                {selectedChat ? (
                    <>
                        {/* Header */}
                        <ChatHeader
                            chatId={selectedChat.id}
                            chatName={selectedChat.name}
                            chatType={selectedChat.type}
                            publicKeySigning={selectedChat.public_key_signing}
                            myPublicKeySigning={identity?.signing.publicKey}
                        />

                        {/* Messages */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-4">
                            {messages.map(msg => (
                                <MessageBubble
                                    key={msg.id}
                                    msg={msg}
                                    isGroup={selectedChat.type === 'group'}
                                />
                            ))}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Input */}
                        <div className="p-4 border-t border-dark-border bg-dark-surface/50 backdrop-blur relative">
                            {rateLimitWarning && (
                                <div className="absolute -top-10 left-1/2 transform -translate-x-1/2 bg-red-500 text-white text-xs px-3 py-1 rounded-full flex items-center gap-1 animate-bounce">
                                    <AlertCircle size={12} /> Slow down!
                                </div>
                            )}

                            {/* Image Preview */}
                            {previewUrl && (
                                <div className="absolute bottom-full left-4 mb-2 bg-dark-surface p-2 rounded border border-dark-border flex items-start gap-2">
                                    <img src={previewUrl} alt="Preview" className="h-20 rounded" />
                                    <button onClick={clearFile} className="text-gray-500 hover:text-white">
                                        <X size={16} />
                                    </button>
                                </div>
                            )}

                            <form onSubmit={handleSendMessage} className="flex gap-2 items-end">
                                {/* Attachment Button */}
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    onChange={handleFileSelect}
                                    accept="image/*"
                                    className="hidden"
                                />
                                <button
                                    type="button"
                                    onClick={() => fileInputRef.current?.click()}
                                    className={`p-3 rounded border ${selectedFile ? 'border-neon-green text-neon-green bg-neon-green/10' : 'border-dark-border text-gray-500 hover:text-gray-300'}`}
                                    title="Attach Image"
                                >
                                    <Paperclip size={20} />
                                </button>

                                {/* TTL Selector */}
                                <div className="relative group">
                                    <button type="button" className={`p-3 rounded border ${ttlDuration ? 'border-neon-blue text-neon-blue bg-neon-blue/10' : 'border-dark-border text-gray-500 hover:text-gray-300'}`}>
                                        <Clock size={20} />
                                    </button>
                                    <div className="absolute bottom-full mb-2 left-0 w-32 bg-dark-surface border border-dark-border rounded shadow-xl hidden group-hover:block">
                                        <div className="p-1 space-y-1">
                                            <button type="button" onClick={() => setTtlDuration(null)} className={`w-full text-left px-2 py-1 text-xs rounded ${!ttlDuration ? 'bg-neon-green/20 text-neon-green' : 'hover:bg-dark-border'}`}>Off (Infinite)</button>
                                            <button type="button" onClick={() => setTtlDuration(1)} className={`w-full text-left px-2 py-1 text-xs rounded ${ttlDuration === 1 ? 'bg-neon-green/20 text-neon-green' : 'hover:bg-dark-border'}`}>1 Minute</button>
                                            <button type="button" onClick={() => setTtlDuration(60)} className={`w-full text-left px-2 py-1 text-xs rounded ${ttlDuration === 60 ? 'bg-neon-green/20 text-neon-green' : 'hover:bg-dark-border'}`}>1 Hour</button>
                                            <button type="button" onClick={() => setTtlDuration(1440)} className={`w-full text-left px-2 py-1 text-xs rounded ${ttlDuration === 1440 ? 'bg-neon-green/20 text-neon-green' : 'hover:bg-dark-border'}`}>24 Hours</button>
                                        </div>
                                    </div>
                                </div>

                                <input
                                    type="text"
                                    value={inputText}
                                    onChange={(e) => setInputText(e.target.value)}
                                    placeholder={selectedFile ? "Add a caption (optional)..." : `Message ${selectedChat.name}...`}
                                    className={`flex-1 bg-dark-bg border focus:ring-1 rounded p-3 outline-none transition-all ${rateLimitWarning ? 'border-red-500 ring-red-500' : 'border-dark-border focus:border-neon-green focus:ring-neon-green'}`}
                                    disabled={isUploading}
                                />
                                <button
                                    type="submit"
                                    disabled={(!inputText.trim() && !selectedFile) || isUploading}
                                    className="bg-neon-green text-black p-3 rounded hover:bg-green-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                                >
                                    {isUploading ? <div className="animate-spin w-5 h-5 border-2 border-black border-t-transparent rounded-full" /> : <Send size={20} />}
                                </button>
                            </form>
                        </div>
                    </>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-gray-500 opacity-50">
                        <Shield size={64} className="mb-4" />
                        <p className="text-xl">Select a chat to start messaging</p>
                    </div>
                )}
            </div>

            {showCreateGroup && (
                <CreateGroupModal
                    currentUserId={user!.id}
                    onClose={() => setShowCreateGroup(false)}
                    onGroupCreated={loadChats}
                />
            )}

            {showBackup && (
                <BackupModal onClose={() => setShowBackup(false)} />
            )}
        </div>
    );
};

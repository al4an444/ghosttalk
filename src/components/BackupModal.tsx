import React, { useState } from 'react';
import { X, Download, Copy, AlertTriangle, Lock } from 'lucide-react';
import { useStore } from '../store/store';
import { createRecoveryKit } from '../lib/backup';
import { deriveKeyFromPassword, decryptIdentity } from '../lib/crypto';
import { supabase } from '../lib/supabase';

interface BackupModalProps {
    onClose: () => void;
}

export const BackupModal: React.FC<BackupModalProps> = ({ onClose }) => {
    const { user, identity } = useStore();
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [recoveryKit, setRecoveryKit] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);

    const handleUnlock = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (!user || !identity) return;

        try {
            // Verify password by attempting to decrypt the stored key again
            // (Or just trust the current session? No, re-auth is safer for export)
            const { data } = await supabase.from('users').select('salt, encrypted_private_key').eq('id', user.id).single();

            if (!data) throw new Error("User not found");

            // This is a heavy operation, effectively checking the password
            const key = await deriveKeyFromPassword(password, data.salt);
            // Try to decrypt (if it fails, password is wrong)
            await decryptIdentity(data.encrypted_private_key, key);

            // If we got here, password is correct. Generate kit.
            const kit = createRecoveryKit(identity, user.username);
            setRecoveryKit(kit);
        } catch (e) {
            setError("Incorrect password");
        }
    };

    const handleCopy = () => {
        if (recoveryKit) {
            navigator.clipboard.writeText(recoveryKit);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    const handleDownload = () => {
        if (recoveryKit) {
            const blob = new Blob([recoveryKit], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `ghosttalk-recovery-${user?.username}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4">
            <div className="bg-dark-surface border border-red-500/30 rounded-lg w-full max-w-lg p-6 relative shadow-2xl shadow-red-900/20">
                <button onClick={onClose} className="absolute top-4 right-4 text-gray-500 hover:text-white">
                    <X size={20} />
                </button>

                <div className="text-center mb-6">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-500/10 text-red-500 mb-4 border border-red-500/50">
                        <AlertTriangle size={32} />
                    </div>
                    <h2 className="text-2xl font-bold text-white mb-2">Export Recovery Kit</h2>
                    <p className="text-sm text-gray-400">
                        Your Recovery Kit contains your <strong>Private Keys</strong>.
                        Anyone with this file can impersonate you and read your messages.
                    </p>
                </div>

                {!recoveryKit ? (
                    <form onSubmit={handleUnlock} className="space-y-4">
                        <div className="bg-dark-bg p-4 rounded border border-dark-border">
                            <label className="block text-xs text-gray-500 mb-1">Confirm Password to Export</label>
                            <div className="flex items-center gap-2 border-b border-dark-border pb-2">
                                <Lock size={16} className="text-gray-500" />
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="bg-transparent outline-none flex-1 text-white"
                                    placeholder="Enter your password"
                                    autoFocus
                                />
                            </div>
                        </div>
                        {error && <p className="text-red-500 text-sm text-center">{error}</p>}
                        <button
                            type="submit"
                            disabled={!password}
                            className="w-full bg-red-600 hover:bg-red-500 text-white font-bold py-3 rounded transition-colors disabled:opacity-50"
                        >
                            Unlock & Generate Kit
                        </button>
                    </form>
                ) : (
                    <div className="space-y-4 animate-in fade-in zoom-in duration-300">
                        <div className="bg-black p-4 rounded border border-dark-border font-mono text-xs text-green-400 overflow-x-auto max-h-40">
                            <pre>{recoveryKit}</pre>
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={handleDownload}
                                className="flex-1 bg-neon-blue hover:bg-blue-400 text-black font-bold py-3 rounded transition-colors flex items-center justify-center gap-2"
                            >
                                <Download size={18} /> Download JSON
                            </button>
                            <button
                                onClick={handleCopy}
                                className="flex-1 bg-dark-bg border border-dark-border hover:bg-dark-border text-white font-bold py-3 rounded transition-colors flex items-center justify-center gap-2"
                            >
                                <Copy size={18} /> {copied ? 'Copied!' : 'Copy to Clipboard'}
                            </button>
                        </div>

                        <div className="bg-red-500/10 border border-red-500/30 p-3 rounded text-xs text-red-200 text-center">
                            <strong>DO NOT SHARE THIS FILE.</strong> Store it in a secure password manager or offline.
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

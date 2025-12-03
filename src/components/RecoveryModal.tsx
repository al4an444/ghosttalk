import React, { useState } from 'react';
import { X, Lock, CheckCircle } from 'lucide-react';
import { parseRecoveryKit } from '../lib/backup';
import { createSalt, deriveKeyFromPassword, encryptIdentity, fromBase64, signMessage } from '../lib/crypto';
import { supabase } from '../lib/supabase';
import { useStore } from '../store/store';

interface RecoveryModalProps {
    onClose: () => void;
    onSuccess: () => void;
}

export const RecoveryModal: React.FC<RecoveryModalProps> = ({ onClose, onSuccess }) => {
    const { setAuth } = useStore();
    const [step, setStep] = useState<1 | 2>(1);
    const [jsonInput, setJsonInput] = useState('');
    const [parsedKit, setParsedKit] = useState<any>(null);
    const [newPassword, setNewPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleParse = () => {
        setError('');
        const kit = parseRecoveryKit(jsonInput);
        if (kit) {
            setParsedKit(kit);
            setStep(2);
        } else {
            setError("Invalid Recovery Kit JSON");
        }
    };

    const handleRestore = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!parsedKit || !newPassword) return;

        setLoading(true);
        setError('');

        try {
            // 1. Re-construct keys from kit
            const signingKey = {
                publicKey: fromBase64(parsedKit.keys.signing.public),
                secretKey: fromBase64(parsedKit.keys.signing.secret)
            };
            const encryptionKey = {
                publicKey: fromBase64(parsedKit.keys.encryption.public),
                secretKey: fromBase64(parsedKit.keys.encryption.secret)
            };

            const fullIdentity = {
                signing: signingKey,
                encryption: encryptionKey
            };

            // 2. Encrypt with NEW password
            const salt = createSalt();
            const key = await deriveKeyFromPassword(newPassword, salt);
            const encryptedPrivateKey = await encryptIdentity(fullIdentity, key);

            // 3. Update Supabase
            // We need to find the user by username first to get ID
            const { data: userData, error: fetchError } = await supabase
                .from('users')
                .select('id')
                .eq('username', parsedKit.username)
                .single();

            if (fetchError || !userData) throw new Error("User not found on server");

            // 3. Sign Recovery Payload
            // Payload: "RECOVERY:username:timestamp"
            const timestamp = Date.now().toString();
            const payload = `RECOVERY:${parsedKit.username}:${timestamp}`;
            const signature = await signMessage(payload, fullIdentity.signing.secretKey);

            // 4. Call Recovery RPC
            const { error: rpcError } = await supabase.rpc('recover_account', {
                p_username: parsedKit.username,
                p_new_salt: salt,
                p_new_encrypted_key: encryptedPrivateKey,
                p_timestamp: timestamp,
                p_signature: signature
            });

            if (rpcError) throw rpcError;

            // 5. Log in locally
            setAuth(userData.id, parsedKit.username, fullIdentity);
            onSuccess();
            onClose();

        } catch (e) {
            console.error(e);
            setError("Failed to restore account. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4">
            <div className="bg-dark-surface border border-neon-blue/30 rounded-lg w-full max-w-lg p-6 relative shadow-2xl shadow-blue-900/20">
                <button onClick={onClose} className="absolute top-4 right-4 text-gray-500 hover:text-white">
                    <X size={20} />
                </button>

                <div className="text-center mb-6">
                    <h2 className="text-2xl font-bold text-white mb-2">Restore Account</h2>
                    <p className="text-sm text-gray-400">
                        Recover access using your Emergency Kit.
                    </p>
                </div>

                {step === 1 ? (
                    <div className="space-y-4">
                        <textarea
                            value={jsonInput}
                            onChange={(e) => setJsonInput(e.target.value)}
                            placeholder="Paste your ghosttalk-recovery.json content here..."
                            className="w-full h-40 bg-dark-bg border border-dark-border rounded p-3 text-xs font-mono text-gray-300 focus:border-neon-blue outline-none"
                        />
                        {error && <p className="text-red-500 text-sm text-center">{error}</p>}
                        <button
                            onClick={handleParse}
                            disabled={!jsonInput.trim()}
                            className="w-full bg-neon-blue hover:bg-blue-400 text-black font-bold py-3 rounded transition-colors disabled:opacity-50"
                        >
                            Next: Set New Password
                        </button>
                    </div>
                ) : (
                    <form onSubmit={handleRestore} className="space-y-4 animate-in slide-in-from-right duration-300">
                        <div className="bg-neon-green/10 border border-neon-green/30 p-3 rounded flex items-center gap-3">
                            <CheckCircle className="text-neon-green" size={20} />
                            <div>
                                <p className="text-sm font-bold text-neon-green">Kit Validated</p>
                                <p className="text-xs text-gray-400">Restoring as <strong>{parsedKit.username}</strong></p>
                            </div>
                        </div>

                        <div className="bg-dark-bg p-4 rounded border border-dark-border">
                            <label className="block text-xs text-gray-500 mb-1">Set New Password</label>
                            <div className="flex items-center gap-2 border-b border-dark-border pb-2">
                                <Lock size={16} className="text-gray-500" />
                                <input
                                    type="password"
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    className="bg-transparent outline-none flex-1 text-white"
                                    placeholder="Enter new password"
                                    autoFocus
                                />
                            </div>
                        </div>

                        {error && <p className="text-red-500 text-sm text-center">{error}</p>}

                        <button
                            type="submit"
                            disabled={!newPassword || loading}
                            className="w-full bg-neon-green hover:bg-green-400 text-black font-bold py-3 rounded transition-colors disabled:opacity-50 flex justify-center"
                        >
                            {loading ? 'Restoring...' : 'Restore & Login'}
                        </button>
                    </form>
                )}
            </div>
        </div>
    );
};

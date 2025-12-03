import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import {
    generateIdentity,
    createSalt,
    deriveKeyFromPassword,
    encryptIdentity,
    decryptIdentity,
    toBase64,
    fromBase64
} from '../lib/crypto';
import { useStore } from '../store/store';
import { User, Shield, Key } from 'lucide-react';
import { RecoveryModal } from './RecoveryModal';
import { api } from '../lib/api';

export const Auth: React.FC = () => {
    const { setAuth } = useStore();
    const [isLogin, setIsLogin] = useState(true);
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [showRecovery, setShowRecovery] = useState(false);

    const handleAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const email = `${username}@ghosttalk.com`;

            if (isLogin) {
                // LOGIN
                // 1. Authenticate with Supabase Auth (for RLS)
                const { error: authError } = await supabase.auth.signInWithPassword({
                    email,
                    password
                });
                if (authError) throw authError;

                // 2. Fetch Encrypted Data (RLS now works)
                const user = await api.getAuthData(username);
                if (!user) throw new Error("User not found");

                // 3. Decrypt
                const key = await deriveKeyFromPassword(password, fromBase64(user.salt));
                const identity = await decryptIdentity(user.encrypted_private_key, key);

                setAuth(user.id, user.username, identity, user.friend_code);
            } else {
                // REGISTER
                // 1. Register with Supabase Auth (for RLS)
                const { data: authData, error: authError } = await supabase.auth.signUp({
                    email,
                    password,
                    options: {
                        data: { username }
                    }
                });
                if (authError) throw authError;
                if (!authData.user) throw new Error("Registration failed");

                const userId = authData.user.id;

                // 2. Generate Keys
                const identity = await generateIdentity();
                const salt = createSalt();
                const key = await deriveKeyFromPassword(password, salt);
                const encryptedPrivateKey = await encryptIdentity(identity, key);
                const friendCode = Math.random().toString(36).substring(2, 7);

                // 3. Store in public.users (RLS allows insert because auth.uid() matches)
                const { error: dbError } = await supabase
                    .from('users')
                    .insert({
                        id: userId,
                        username,
                        salt: toBase64(salt),
                        public_key_signing: toBase64(identity.signing.publicKey),
                        public_key_encryption: toBase64(identity.encryption.publicKey),
                        encrypted_private_key: encryptedPrivateKey,
                        friend_code: friendCode
                    });

                if (dbError) {
                    // Cleanup auth user if DB insert fails
                    // await supabase.auth.admin.deleteUser(userId); // Requires service role, can't do here.
                    throw dbError;
                }

                setAuth(userId, username, identity, friendCode);
            }
        } catch (e: any) {
            console.error(e);
            setError(e.message || "Authentication failed");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-dark-bg text-gray-200 p-4">
            <div className="w-full max-w-md bg-dark-surface p-8 rounded-lg border border-dark-border shadow-2xl">
                <div className="flex justify-center mb-6">
                    <Shield size={48} className="text-neon-green" />
                </div>
                <h2 className="text-2xl font-bold text-center mb-6 text-white">
                    {isLogin ? 'Access GhostTalk' : 'Create Identity'}
                </h2>

                <form onSubmit={handleAuth} className="space-y-4">
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-400">Username</label>
                        <div className="flex items-center bg-dark-bg border border-dark-border rounded px-3 py-2 focus-within:border-neon-green transition-colors">
                            <User size={18} className="text-gray-500 mr-2" />
                            <input
                                type="text"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                className="bg-transparent border-none outline-none w-full text-white"
                                placeholder="phantom_user"
                                required
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-400">Password</label>
                        <div className="flex items-center bg-dark-bg border border-dark-border rounded px-3 py-2 focus-within:border-neon-green transition-colors">
                            <Key size={18} className="text-gray-500 mr-2" />
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="bg-transparent border-none outline-none w-full text-white"
                                placeholder="••••••••"
                                required
                            />
                        </div>
                    </div>

                    {error && (
                        <div className="bg-red-500/10 border border-red-500/50 text-red-500 text-sm p-3 rounded">
                            {error}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-neon-green text-black font-bold py-3 rounded hover:bg-green-400 transition-colors disabled:opacity-50"
                    >
                        {loading ? 'Processing...' : (isLogin ? 'Unlock Identity' : 'Generate Keys & Register')}
                    </button>
                </form>

                <div className="mt-6 text-center space-y-2">
                    <p className="text-sm text-gray-500">
                        {isLogin ? "Don't have an identity? " : "Already have an identity? "}
                        <button
                            onClick={() => setIsLogin(!isLogin)}
                            className="text-neon-blue hover:underline font-medium"
                        >
                            {isLogin ? 'Create one' : 'Login'}
                        </button>
                    </p>

                    {isLogin && (
                        <p className="text-xs text-gray-600">
                            Forgot password?{' '}
                            <button
                                onClick={() => setShowRecovery(true)}
                                className="text-gray-400 hover:text-white hover:underline"
                            >
                                Restore with Kit
                            </button>
                        </p>
                    )}
                </div>
            </div>

            {showRecovery && (
                <RecoveryModal
                    onClose={() => setShowRecovery(false)}
                    onSuccess={() => setShowRecovery(false)}
                />
            )}
        </div>
    );
};

import React, { useState } from 'react';
import { X, UserPlus, Search, Check } from 'lucide-react';
import { api } from '../lib/api';
import { useStore } from '../store/store';

interface AddFriendModalProps {
    onClose: () => void;
    onFriendAdded: () => void;
}

export const AddFriendModal: React.FC<AddFriendModalProps> = ({ onClose, onFriendAdded }) => {
    const { user } = useStore();
    const [searchQuery, setSearchQuery] = useState('');
    const [foundUser, setFoundUser] = useState<any | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!searchQuery.includes('#')) {
            setError('Format must be username#code (e.g. alice#a1b2c)');
            return;
        }

        const [username, code] = searchQuery.split('#');
        if (!username || !code) {
            setError('Invalid format');
            return;
        }

        setLoading(true);
        setError('');
        setFoundUser(null);

        try {
            const result = await api.findUser(username.trim(), code.trim());
            if (result) {
                if (result.id === user?.id) {
                    setError("You cannot add yourself.");
                } else {
                    setFoundUser(result);
                }
            } else {
                setError('User not found. Check username and code.');
            }
        } catch (err) {
            console.error(err);
            setError('Search failed.');
        } finally {
            setLoading(false);
        }
    };

    const handleAddFriend = async () => {
        if (!user || !foundUser) return;
        setLoading(true);
        try {
            await api.addContact(user.id, foundUser.id);
            setSuccess(true);
            setTimeout(() => {
                onFriendAdded();
                onClose();
            }, 1000);
        } catch (err: any) {
            if (err.code === '23505') { // Unique violation
                setError('User is already in your contacts.');
            } else {
                setError('Failed to add friend.');
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-dark-surface border border-dark-border rounded-lg w-full max-w-md p-6 relative shadow-2xl">
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-gray-400 hover:text-white"
                >
                    <X size={20} />
                </button>

                <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                    <UserPlus className="text-neon-green" /> Add Friend
                </h2>

                <form onSubmit={handleSearch} className="mb-6">
                    <label className="block text-sm text-gray-400 mb-2">
                        Enter Username#Code
                    </label>
                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="username#12345"
                            className="flex-1 bg-dark-bg border border-dark-border rounded px-3 py-2 text-white focus:border-neon-green outline-none"
                        />
                        <button
                            type="submit"
                            disabled={loading}
                            className="bg-dark-border hover:bg-gray-700 text-white px-4 py-2 rounded transition-colors"
                        >
                            <Search size={20} />
                        </button>
                    </div>
                    {error && <p className="text-red-400 text-sm mt-2">{error}</p>}
                </form>

                {foundUser && (
                    <div className="bg-dark-bg p-4 rounded border border-neon-green/30 flex items-center justify-between">
                        <div>
                            <p className="text-white font-bold">{foundUser.username}</p>
                            <p className="text-xs text-gray-500">User found</p>
                        </div>
                        <button
                            onClick={handleAddFriend}
                            disabled={loading || success}
                            className={`px-4 py-2 rounded font-bold transition-colors flex items-center gap-2 ${success
                                    ? 'bg-green-500 text-black'
                                    : 'bg-neon-green text-black hover:bg-green-400'
                                }`}
                        >
                            {success ? <Check size={18} /> : <UserPlus size={18} />}
                            {success ? 'Added' : 'Add'}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

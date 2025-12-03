import React, { useState, useEffect } from 'react';
import { X, Users } from 'lucide-react';
import { api } from '../lib/api';

interface CreateGroupModalProps {
    currentUserId: string;
    onClose: () => void;
    onGroupCreated: () => void;
}

export const CreateGroupModal: React.FC<CreateGroupModalProps> = ({ currentUserId, onClose, onGroupCreated }) => {
    const [groupName, setGroupName] = useState('');
    const [contacts, setContacts] = useState<any[]>([]);
    const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const loadContacts = async () => {
            try {
                const data = await api.getContacts(currentUserId);
                setContacts(data);
            } catch (e) {
                console.error(e);
            }
        };
        loadContacts();
    }, [currentUserId]);

    const toggleMember = (userId: string) => {
        setSelectedMemberIds(prev =>
            prev.includes(userId)
                ? prev.filter(id => id !== userId)
                : [...prev, userId]
        );
    };

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!groupName.trim() || selectedMemberIds.length === 0) return;
        setLoading(true);

        try {
            await api.createGroup(groupName, currentUserId, selectedMemberIds);
            onGroupCreated();
            onClose();
        } catch (e) {
            console.error("Failed to create group", e);
            alert("Failed to create group");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
            <div className="bg-dark-surface border border-dark-border rounded-lg w-full max-w-md p-6 relative">
                <button onClick={onClose} className="absolute top-4 right-4 text-gray-500 hover:text-white">
                    <X size={20} />
                </button>

                <h2 className="text-xl font-bold text-neon-green mb-4 flex items-center gap-2">
                    <Users size={24} /> Create Group
                </h2>

                <form onSubmit={handleCreate} className="space-y-4">
                    <div>
                        <label className="block text-sm text-gray-400 mb-1">Group Name</label>
                        <input
                            type="text"
                            value={groupName}
                            onChange={e => setGroupName(e.target.value)}
                            className="w-full bg-dark-bg border border-dark-border rounded p-2 text-white focus:border-neon-green outline-none"
                            placeholder="e.g. Secret Squad"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-sm text-gray-400 mb-2">Select Members</label>
                        <div className="max-h-48 overflow-y-auto border border-dark-border rounded bg-dark-bg p-2 space-y-1">
                            {contacts.length === 0 ? (
                                <p className="text-gray-500 text-sm p-2">No contacts found. Add friends first!</p>
                            ) : (
                                contacts.map(contact => (
                                    <div
                                        key={contact.id}
                                        onClick={() => toggleMember(contact.id)}
                                        className={`flex items-center gap-3 p-2 rounded cursor-pointer transition-colors ${selectedMemberIds.includes(contact.id) ? 'bg-neon-green/20 text-neon-green' : 'hover:bg-dark-border'}`}
                                    >
                                        <div className={`w-4 h-4 border rounded flex items-center justify-center ${selectedMemberIds.includes(contact.id) ? 'border-neon-green bg-neon-green' : 'border-gray-500'}`}>
                                            {selectedMemberIds.includes(contact.id) && <div className="w-2 h-2 bg-black rounded-full" />}
                                        </div>
                                        <span>{contact.username}</span>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={loading || !groupName || selectedMemberIds.length === 0}
                        className="w-full bg-neon-green text-black font-bold py-2 rounded hover:bg-green-400 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loading ? 'Creating...' : 'Create Group'}
                    </button>
                </form>
            </div>
        </div>
    );
};

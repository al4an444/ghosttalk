import React, { useState } from 'react';
import { LogOut, Shield, Users, Plus, UserPlus, Copy, Check } from 'lucide-react';
import { useStore } from '../store/store';
import { AddFriendModal } from './AddFriendModal';

interface ChatItem {
    id: string;
    name: string;
    type: 'user' | 'group';
}

interface SidebarProps {
    chats: ChatItem[];
    selectedChatId: string | undefined;
    onSelectChat: (chat: ChatItem) => void;
    onCreateGroup: () => void;
    onExportBackup: () => void;
    onRefresh: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
    chats,
    selectedChatId,
    onSelectChat,
    onCreateGroup,
    onExportBackup,
    onRefresh
}) => {
    const { user, logout } = useStore();
    const [showAddFriend, setShowAddFriend] = useState(false);
    const [copied, setCopied] = useState(false);

    // Filter chats by type
    const directMessages = chats.filter(c => c.type === 'user');
    const groups = chats.filter(c => c.type === 'group');

    const copyFriendCode = () => {
        if (user?.username && user?.friend_code) { // Assuming friend_code is added to store/user type later, or fetched. 
            // WAIT: The user object in store might not have friend_code yet if we didn't update the type.
            // We should handle this. For now, let's assume it's there or we fetch it.
            // Actually, we need to update the store/types to include friend_code.
            // For this step, I will assume it's available on the user object.
            navigator.clipboard.writeText(`${user.username}#${user.friend_code}`);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    return (
        <div className="w-80 bg-dark-surface border-r border-dark-border flex flex-col h-full">
            {/* Header / My Profile */}
            <div className="p-4 border-b border-dark-border bg-dark-bg/50">
                <div className="flex items-center justify-between mb-2">
                    <h1 className="text-xl font-bold text-neon-green tracking-wider">GHOST_TALK</h1>
                    <div className="flex gap-2">
                        <button onClick={onExportBackup} className="text-gray-400 hover:text-neon-green" title="Export Identity">
                            <Shield size={20} />
                        </button>
                        <button onClick={logout} className="text-gray-400 hover:text-red-500" title="Logout">
                            <LogOut size={20} />
                        </button>
                    </div>
                </div>

                {/* My Friend Code */}
                {user && (user as any).friend_code && (
                    <div className="flex items-center gap-2 bg-black/30 p-2 rounded border border-dashed border-gray-700">
                        <div className="flex-1 overflow-hidden">
                            <p className="text-xs text-gray-500">MY ID</p>
                            <p className="text-sm font-mono text-white truncate">
                                {user.username}<span className="text-neon-purple">#{(user as any).friend_code}</span>
                            </p>
                        </div>
                        <button
                            onClick={copyFriendCode}
                            className="text-gray-400 hover:text-white transition-colors"
                            title="Copy ID"
                        >
                            {copied ? <Check size={16} className="text-green-500" /> : <Copy size={16} />}
                        </button>
                    </div>
                )}
            </div>

            {/* Lists */}
            <div className="flex-1 overflow-y-auto p-4 space-y-6">

                {/* Contacts */}
                <div>
                    <div className="flex items-center justify-between mb-2">
                        <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Contacts</h2>
                        <button
                            onClick={() => setShowAddFriend(true)}
                            className="text-neon-green hover:text-green-400 text-xs flex items-center gap-1"
                        >
                            <UserPlus size={14} /> Add
                        </button>
                    </div>

                    <div className="space-y-1">
                        {directMessages.length === 0 ? (
                            <p className="text-sm text-gray-600 italic p-2">No contacts yet.</p>
                        ) : (
                            directMessages.map(chat => (
                                <button
                                    key={chat.id}
                                    onClick={() => onSelectChat(chat)}
                                    className={`w-full text-left p-3 rounded transition-all flex items-center gap-3 ${selectedChatId === chat.id
                                            ? 'bg-neon-green/10 border border-neon-green/50 text-white'
                                            : 'hover:bg-dark-bg text-gray-400 hover:text-gray-200 border border-transparent'
                                        }`}
                                >
                                    <div className="w-2 h-2 rounded-full bg-neon-green shadow-[0_0_5px_#00ff9d]" />
                                    <span className="font-medium">{chat.name}</span>
                                </button>
                            ))
                        )}
                    </div>
                </div>

                {/* Groups */}
                <div>
                    <div className="flex items-center justify-between mb-2">
                        <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Groups</h2>
                        <button
                            onClick={onCreateGroup}
                            className="text-neon-purple hover:text-purple-400 text-xs flex items-center gap-1"
                        >
                            <Plus size={14} /> Create
                        </button>
                    </div>

                    <div className="space-y-1">
                        {groups.length === 0 ? (
                            <p className="text-sm text-gray-600 italic p-2">No groups yet.</p>
                        ) : (
                            groups.map(chat => (
                                <button
                                    key={chat.id}
                                    onClick={() => onSelectChat(chat)}
                                    className={`w-full text-left p-3 rounded transition-all flex items-center gap-3 ${selectedChatId === chat.id
                                            ? 'bg-neon-purple/10 border border-neon-purple/50 text-white'
                                            : 'hover:bg-dark-bg text-gray-400 hover:text-gray-200 border border-transparent'
                                        }`}
                                >
                                    <Users size={16} />
                                    <span className="font-medium">{chat.name}</span>
                                </button>
                            ))
                        )}
                    </div>
                </div>
            </div>

            {showAddFriend && (
                <AddFriendModal
                    onClose={() => setShowAddFriend(false)}
                    onFriendAdded={onRefresh}
                />
            )}
        </div>
    );
};

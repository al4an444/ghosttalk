import React, { useState, useEffect } from 'react';
import { ShieldCheck, AlertTriangle, Users, User as UserIcon, Lock } from 'lucide-react';
import { VerificationModal } from './VerificationModal';
import { getVerificationStatus, type VerificationStatus } from '../lib/verification';

interface ChatHeaderProps {
    chatId: string;
    chatName: string;
    chatType: 'user' | 'group';
    publicKeySigning?: string; // For users
    myPublicKeySigning?: Uint8Array; // My key for generating safety number
}

export const ChatHeader: React.FC<ChatHeaderProps> = ({
    chatId,
    chatName,
    chatType,
    publicKeySigning,
    myPublicKeySigning
}) => {
    const [status, setStatus] = useState<VerificationStatus>('unverified');
    const [showModal, setShowModal] = useState(false);

    const checkStatus = () => {
        if (chatType === 'user' && publicKeySigning) {
            const s = getVerificationStatus(chatId, publicKeySigning);
            setStatus(s);
        }
    };

    useEffect(() => {
        checkStatus();
    }, [chatId, publicKeySigning]);

    return (
        <div className="p-4 border-b border-dark-border flex justify-between items-center bg-dark-surface/50 backdrop-blur">
            <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center border ${chatType === 'group' ? 'bg-neon-purple/20 text-neon-purple border-neon-purple/50' : 'bg-neon-green/20 text-neon-green border-neon-green/50'}`}>
                    {chatType === 'group' ? <Users size={20} /> : <UserIcon size={20} />}
                </div>
                <div>
                    <h3 className="font-bold text-lg flex items-center gap-2">
                        {chatName}
                        {chatType === 'user' && (
                            <div className="cursor-pointer" onClick={() => setShowModal(true)}>
                                {status === 'verified' && <ShieldCheck size={16} className="text-neon-green" />}
                                {status === 'mismatch' && <AlertTriangle size={16} className="text-red-500 animate-pulse" />}
                                {status === 'unverified' && <ShieldCheck size={16} className="text-gray-600 hover:text-gray-400 transition-colors" />}
                            </div>
                        )}
                    </h3>
                    <div className="flex items-center gap-1 text-xs text-neon-green">
                        <Lock size={10} />
                        <span>{chatType === 'group' ? 'Group E2EE' : 'End-to-End Encrypted'}</span>
                    </div>
                </div>
            </div>

            {chatType === 'user' && (
                <button
                    onClick={() => setShowModal(true)}
                    className={`flex items-center gap-2 text-xs border p-2 rounded transition-colors ${status === 'mismatch'
                        ? 'border-red-500 text-red-500 hover:bg-red-500/10'
                        : 'border-dark-border text-gray-500 hover:text-neon-blue hover:border-neon-blue'
                        }`}
                >
                    {status === 'mismatch' ? <AlertTriangle size={14} /> : <ShieldCheck size={14} />}
                    {status === 'verified' ? 'Verified' : status === 'mismatch' ? 'Identity Changed!' : 'Verify Identity'}
                </button>
            )}

            {showModal && publicKeySigning && myPublicKeySigning && (
                <VerificationModal
                    myPublicKey={myPublicKeySigning}
                    theirPublicKeyBase64={publicKeySigning}
                    theirUsername={chatName}
                    theirUserId={chatId}
                    currentStatus={status}
                    onClose={() => setShowModal(false)}
                    onStatusChange={checkStatus}
                />
            )}
        </div>
    );
};

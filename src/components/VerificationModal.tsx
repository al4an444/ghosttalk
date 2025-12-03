import React, { useEffect, useState } from 'react';
import { X, ShieldCheck, AlertTriangle, CheckCircle } from 'lucide-react';
import { generateSafetyNumber, setVerified, clearVerification, type VerificationStatus } from '../lib/verification';
import { fromBase64 } from '../lib/crypto';

interface VerificationModalProps {
    myPublicKey: Uint8Array;
    theirPublicKeyBase64: string;
    theirUsername: string;
    theirUserId: string;
    currentStatus: VerificationStatus;
    onClose: () => void;
    onStatusChange: () => void;
}

export const VerificationModal: React.FC<VerificationModalProps> = ({
    myPublicKey,
    theirPublicKeyBase64,
    theirUsername,
    theirUserId,
    currentStatus,
    onClose,
    onStatusChange
}) => {
    const [safetyNumber, setSafetyNumber] = useState<string>('Generating...');

    useEffect(() => {
        const gen = async () => {
            try {
                const theirKey = fromBase64(theirPublicKeyBase64);
                const sn = await generateSafetyNumber(myPublicKey, theirKey);
                setSafetyNumber(sn);
            } catch (e) {
                setSafetyNumber('Error generating safety number');
            }
        };
        gen();
    }, [myPublicKey, theirPublicKeyBase64]);

    const handleVerify = () => {
        setVerified(theirUserId, theirPublicKeyBase64);
        onStatusChange();
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
            <div className="bg-dark-surface border border-dark-border rounded-lg w-full max-w-md p-6 relative shadow-2xl shadow-black">
                <button onClick={onClose} className="absolute top-4 right-4 text-gray-500 hover:text-white">
                    <X size={20} />
                </button>

                <div className="text-center mb-6">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-dark-bg border border-dark-border mb-4">
                        {currentStatus === 'verified' && <ShieldCheck size={32} className="text-neon-green" />}
                        {currentStatus === 'mismatch' && <AlertTriangle size={32} className="text-red-500" />}
                        {currentStatus === 'unverified' && <ShieldCheck size={32} className="text-gray-500" />}
                    </div>
                    <h2 className="text-xl font-bold text-white mb-1">Verify Safety Number</h2>
                    <p className="text-sm text-gray-400">For {theirUsername}</p>
                </div>

                {currentStatus === 'mismatch' && (
                    <div className="bg-red-500/10 border border-red-500/50 p-4 rounded mb-6 text-center">
                        <h3 className="text-red-500 font-bold flex items-center justify-center gap-2 mb-2">
                            <AlertTriangle size={18} /> Security Warning
                        </h3>
                        <p className="text-xs text-red-200">
                            The identity key for this user has changed! This could mean someone is intercepting your communication, or they simply re-installed the app.
                        </p>
                    </div>
                )}

                <div className="bg-black/50 p-4 rounded border border-dark-border mb-6 text-center font-mono text-lg tracking-wider text-neon-blue break-all">
                    {safetyNumber}
                </div>

                <p className="text-xs text-gray-500 text-center mb-6">
                    Compare this number with the one on {theirUsername}'s device. If they match, your communication is secure.
                </p>

                <div className="flex gap-3">
                    {currentStatus !== 'verified' ? (
                        <button
                            onClick={handleVerify}
                            className={`flex-1 font-bold py-3 rounded transition-colors flex items-center justify-center gap-2 ${currentStatus === 'mismatch'
                                ? 'bg-red-600 hover:bg-red-500 text-white'
                                : 'bg-neon-green hover:bg-green-400 text-black'
                                }`}
                        >
                            <CheckCircle size={18} />
                            {currentStatus === 'mismatch' ? 'Accept New Key' : 'Mark as Verified'}
                        </button>
                    ) : (
                        <button
                            onClick={() => { clearVerification(theirUserId); onStatusChange(); onClose(); }}
                            className="flex-1 bg-dark-bg border border-dark-border text-gray-300 font-bold py-3 rounded hover:bg-dark-border/80 transition-colors"
                        >
                            Clear Verification
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

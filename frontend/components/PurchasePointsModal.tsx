import React, { useState } from 'react';
import ReactDOM from 'react-dom';
import { X, Check, Loader2, CreditCard, Wallet, Sparkles, ShieldCheck } from 'lucide-react';
import { usePoints } from '../context/PointsContext';

interface Props {
    isOpen: boolean;
    onClose: () => void;
}

const PaymentMethodCard = ({
    icon: Icon,
    title,
    selected,
    onClick
}: {
    icon: any,
    title: string,
    selected: boolean,
    onClick: () => void
}) => (
    <div
        onClick={onClick}
        className={`relative flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer ${selected
            ? 'bg-blue-50 border-blue-500 shadow-sm'
            : 'bg-white border-gray-200 hover:border-blue-200 hover:bg-gray-50'
            }`}
    >
        <div className={`flex items-center justify-center w-10 h-10 rounded-lg ${selected ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-500'}`}>
            <Icon className="w-5 h-5" />
        </div>
        <span className={`text-sm font-bold ${selected ? 'text-blue-900' : 'text-gray-600'}`}>
            {title}
        </span>
        {selected && (
            <div className="absolute top-3 right-3 text-blue-500">
                <div className="w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center">
                    <Check className="w-3 h-3 text-white" />
                </div>
            </div>
        )}
    </div>
);

export default function PurchasePointsModal({ isOpen, onClose }: Props) {
    const { purchasePoints, isLoading, packages } = usePoints();
    const [selectedPackageId, setSelectedPackageId] = useState<string | null>(null);

    // Set default selection when packages load
    React.useEffect(() => {
        if (packages.length > 0 && !selectedPackageId) {
            // Try to find popular or default to second item or first
            const defaultPkg = packages.find(p => p.popular) || packages[1] || packages[0];
            if (defaultPkg) setSelectedPackageId(defaultPkg.id);
        }
    }, [packages]);
    const [selectedMethod, setSelectedMethod] = useState<'card' | 'paypal'>('card');
    const [purchaseStep, setPurchaseStep] = useState<'select' | 'processing' | 'success'>('select');

    if (!isOpen) return null;

    const handlePurchase = async () => {
        if (!selectedPackageId) return;

        setPurchaseStep('processing');
        try {
            await purchasePoints(selectedPackageId);
            setPurchaseStep('success');
            // Auto close after success
            setTimeout(() => {
                onClose();
                setPurchaseStep('select'); // Reset for next time
            }, 2500);
        } catch (e) {
            console.error(e);
            setPurchaseStep('select');
            alert("Purchase failed");
        }
    };

    const selectedPkg = packages.find(p => p.id === selectedPackageId);

    return ReactDOM.createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">

                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-100">
                    <div>
                        <h2 className="text-xl font-black text-gray-900 flex items-center gap-2">
                            <Sparkles className="w-5 h-5 text-yellow-500 fill-yellow-500" />
                            儲值點數
                        </h2>
                        <p className="text-sm text-gray-500 mt-1">選擇最適合您的方案，盡情探索世界</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                {purchaseStep === 'select' && (
                    <div className="p-6 overflow-y-auto custom-scrollbar">
                        {/* Packages */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                            {packages.map((pkg) => {
                                const isSelected = selectedPackageId === pkg.id;
                                const isSubscription = pkg.type === 'subscription';

                                return (
                                    <div
                                        key={pkg.id}
                                        onClick={() => setSelectedPackageId(pkg.id)}
                                        className={`relative p-5 rounded-2xl border-2 cursor-pointer transition-all duration-300 flex flex-col items-center text-center ${isSelected
                                            ? 'border-brand-500 bg-brand-50/30 shadow-lg scale-105 z-10'
                                            : 'border-gray-100 bg-white hover:border-brand-200 hover:shadow-md'
                                            } ${isSubscription ? 'lg:col-span-1' : ''}`} // Optional: Make subscription card stand out? No, keep uniform.
                                    >
                                        {pkg.popular && (
                                            <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-gradient-to-r from-brand-600 to-sky-500 text-white text-[10px] font-bold rounded-full shadow-sm">
                                                最受歡迎
                                            </span>
                                        )}
                                        {isSubscription && (
                                            <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-gradient-to-r from-purple-600 to-pink-500 text-white text-[10px] font-bold rounded-full shadow-sm">
                                                推薦
                                            </span>
                                        )}

                                        <h3 className={`font-bold mb-1 ${isSelected ? 'text-brand-700' : 'text-gray-700'}`}>
                                            {pkg.name}
                                        </h3>

                                        {isSubscription ? (
                                            <div className="text-3xl font-black text-gray-900 mb-2 tracking-tight">
                                                ∞ <span className="text-sm font-medium text-gray-400">無限</span>
                                            </div>
                                        ) : (
                                            <div className="text-3xl font-black text-gray-900 mb-2 tracking-tight">
                                                {pkg.points} <span className="text-sm font-medium text-gray-400">P</span>
                                            </div>
                                        )}

                                        <p className="text-xs text-gray-500 leading-relaxed mb-4 min-h-[2.5em]">
                                            {pkg.description}
                                        </p>
                                        <div className={`mt-auto px-4 py-1.5 rounded-lg text-sm font-bold ${isSelected ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-600'
                                            }`}>
                                            NT$ {pkg.price}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Payment Methods */}
                        <div className="mb-8">
                            <h3 className="text-sm font-bold text-gray-900 mb-3">選擇付款方式</h3>
                            <div className="grid grid-cols-2 gap-4">
                                <PaymentMethodCard
                                    icon={CreditCard}
                                    title="信用卡 / 金融卡"
                                    selected={selectedMethod === 'card'}
                                    onClick={() => setSelectedMethod('card')}
                                />
                                <PaymentMethodCard
                                    icon={Wallet}
                                    title="PayPal / 電子錢包"
                                    selected={selectedMethod === 'paypal'}
                                    onClick={() => setSelectedMethod('paypal')}
                                />
                            </div>
                        </div>

                        {/* Summary & Action */}
                        <div className="bg-gray-50 rounded-xl p-4 flex items-center justify-between">
                            <div>
                                <div className="text-xs text-gray-500 mb-1">總計金額</div>
                                <div className="text-xl font-black text-gray-900">
                                    NT$ {selectedPkg?.price || 0}
                                </div>
                            </div>
                            <button
                                onClick={handlePurchase}
                                disabled={!selectedPackageId || isLoading}
                                className="px-8 py-3 bg-brand-600 hover:bg-brand-700 text-white rounded-xl font-bold shadow-lg shadow-brand-200 hover:shadow-xl hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                            >
                                <span>確認付款</span>
                                <ShieldCheck className="w-4 h-4 opacity-80" />
                            </button>
                        </div>
                    </div>
                )}

                {/* Processing State */}
                {purchaseStep === 'processing' && (
                    <div className="p-10 flex flex-col items-center text-center py-20">
                        <div className="relative mb-6">
                            <div className="absolute inset-0 bg-brand-500 blur-xl opacity-20 animate-pulse rounded-full"></div>
                            <Loader2 className="w-16 h-16 text-brand-600 animate-spin relative z-10" />
                        </div>
                        <h3 className="text-xl font-bold text-gray-900 mb-2">正在處理您的付款...</h3>
                        <p className="text-gray-500 text-sm">請稍候，這可能需要幾秒鐘的時間</p>
                    </div>
                )}

                {/* Success State */}
                {purchaseStep === 'success' && (
                    <div className="p-10 flex flex-col items-center text-center py-20 animate-in zoom-in duration-300">
                        {selectedPkg?.type === 'subscription' ? (
                            <>
                                <div className="w-20 h-20 bg-gradient-to-tr from-purple-100 to-pink-100 text-purple-600 rounded-full flex items-center justify-center mb-6 shadow-lg shadow-purple-200">
                                    <Sparkles className="w-10 h-10 animate-pulse" />
                                </div>
                                <h3 className="text-2xl font-black text-gray-900 mb-2">尊榮會員資格已啟用！</h3>
                                <p className="text-gray-500 text-lg mb-6">
                                    開始享受 <span className="font-bold text-purple-600">無限 AI 生成</span> 與專屬旅遊顧問服務
                                </p>
                            </>
                        ) : (
                            <>
                                <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-6 shadow-lg shadow-green-100">
                                    <Check className="w-10 h-10" />
                                </div>
                                <h3 className="text-2xl font-black text-gray-900 mb-2">儲值成功！</h3>
                                <p className="text-gray-500 text-lg mb-6">
                                    已將 <span className="font-bold text-brand-600">{selectedPkg?.points} P</span> 加入您的帳戶
                                </p>
                            </>
                        )}
                        <div className="text-sm text-gray-400">視窗將自動關閉...</div>
                    </div>
                )}

            </div>
        </div>,
        document.body
    );
}

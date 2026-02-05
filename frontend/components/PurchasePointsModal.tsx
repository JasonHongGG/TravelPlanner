import React, { useState } from 'react';
import ReactDOM from 'react-dom';
import { X, Check, Loader2, CreditCard, Wallet, Sparkles, ShieldCheck, Crown, Infinity, Star, Bot, Zap, Clock, Banknote, LayoutGrid, FileJson, AlertCircle } from 'lucide-react';
import { usePoints } from '../context/PointsContext';
import { useTranslation } from 'react-i18next';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    initialTab?: 'points' | 'membership';
}

export default function PurchasePointsModal({ isOpen, onClose, initialTab = 'points' }: Props) {
    const { t } = useTranslation();
    const { purchasePoints, isLoading, packages } = usePoints();
    const [selectedPackageId, setSelectedPackageId] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'points' | 'membership'>(initialTab);

    // Sync activeTab with initialTab when modal opens
    React.useEffect(() => {
        if (isOpen) {
            setActiveTab(initialTab);
        }
    }, [isOpen, initialTab]);

    // Filter packages by type
    const pointPackages = packages.filter(p => p.type !== 'subscription');
    const subscriptionPackages = packages.filter(p => p.type === 'subscription');

    // Set default selection when packages load or tab changes
    React.useEffect(() => {
        if (!isOpen) return;

        if (activeTab === 'points') {
            const defaultPkg = pointPackages.find(p => p.popular) || pointPackages[1] || pointPackages[0];
            if (defaultPkg) setSelectedPackageId(defaultPkg.id);
        } else {
            const defaultSub = subscriptionPackages[0];
            if (defaultSub) setSelectedPackageId(defaultSub.id);
        }
    }, [packages, activeTab, isOpen]);

    const [selectedMethod, setSelectedMethod] = useState<'card' | 'paypal'>('card');
    const [purchaseStep, setPurchaseStep] = useState<'select' | 'payment' | 'processing' | 'success' | 'error'>('select');
    const [errorMessage, setErrorMessage] = useState<string>('');
    const [countdown, setCountdown] = useState(3);

    // Auto-close timer effect
    React.useEffect(() => {
        let timer: NodeJS.Timeout;
        if (purchaseStep === 'success') {
            setCountdown(3);
            timer = setInterval(() => {
                setCountdown((prev) => {
                    if (prev <= 1) {
                        clearInterval(timer);
                        onClose();
                        setPurchaseStep('select');
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
        }
        return () => clearInterval(timer);
    }, [purchaseStep, onClose]);

    if (!isOpen) return null;

    const handleNextStep = () => {
        if (selectedPackageId) {
            setPurchaseStep('payment');
        }
    };

    const handleBack = () => {
        setPurchaseStep('select');
    };

    const handlePurchase = async () => {
        if (!selectedPackageId) return;

        setPurchaseStep('processing');
        try {
            await purchasePoints(selectedPackageId);
            setPurchaseStep('success');
            // Auto close handled by useEffect
        } catch (e: any) {
            console.error(e);
            setPurchaseStep('error');
            setErrorMessage(e.message || t('purchase.error_title'));
        }
    };

    const selectedPkg = packages.find(p => p.id === selectedPackageId);

    // Membership Benefits
    const membershipBenefits = [
        { icon: Sparkles, text: t('purchase.benefits.unlimited_ai'), sub: t('purchase.benefits.unlimited_ai_sub') },
        { icon: Bot, text: t('purchase.benefits.ai_consultant'), sub: t('purchase.benefits.ai_consultant_sub') },
        { icon: FileJson, text: t('purchase.benefits.json_export'), sub: t('purchase.benefits.json_export_sub') },
        { icon: CreditCard, text: t('purchase.benefits.early_access'), sub: t('purchase.benefits.early_access_sub') }
    ];

    // Points Benefits
    const pointsBenefits = [
        { icon: Banknote, text: t('purchase.points_benefits.no_fee'), sub: t('purchase.points_benefits.no_fee_sub') },
        { icon: Clock, text: t('purchase.points_benefits.forever_valid'), sub: t('purchase.points_benefits.forever_valid_sub') },
        { icon: Zap, text: t('purchase.points_benefits.instant'), sub: t('purchase.points_benefits.instant_sub') },
        { icon: LayoutGrid, text: t('purchase.points_benefits.all_features'), sub: t('purchase.points_benefits.all_features_sub') }
    ];

    return ReactDOM.createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-300">
            <div className="relative w-full max-w-4xl bg-white rounded-3xl shadow-xl overflow-hidden flex flex-col max-h-[90vh]">

                {/* Header & Tab Switcher Overlay - Only show in select step */}
                {purchaseStep === 'select' && (
                    <div className="relative bg-white pt-6 px-6 pb-4 border-b border-gray-100 grid grid-cols-[1fr_auto_1fr] items-center gap-4 z-10 animate-in slide-in-from-top-2 duration-300">
                        <div className="flex items-center gap-3 justify-self-start">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${activeTab === 'membership' ? 'bg-purple-50 text-purple-600' : 'bg-brand-50 text-brand-600'}`}>
                                {activeTab === 'membership' ? <Crown className="w-6 h-6" /> : <Sparkles className="w-6 h-6" />}
                            </div>
                            <div className="">
                                <h2 className="text-xl font-bold text-gray-900 tracking-tight whitespace-nowrap">
                                    {activeTab === 'membership' ? t('purchase.title_membership') : t('purchase.title_points')}
                                </h2>
                                <p className="text-xs font-medium text-gray-500 whitespace-nowrap">
                                    {activeTab === 'membership' ? t('purchase.subtitle_membership') : t('purchase.subtitle_points')}
                                </p>
                            </div>
                        </div>

                        {/* Styled Tab Switcher - Centered */}
                        <div className="flex bg-gray-100 p-1 rounded-xl justify-self-center">
                            <button
                                onClick={() => setActiveTab('points')}
                                className={`px-5 py-2 text-sm font-bold rounded-lg transition-all duration-300 flex items-center gap-2 ${activeTab === 'points'
                                    ? 'bg-white text-gray-900 shadow-sm ring-1 ring-black/5'
                                    : 'text-gray-500 hover:text-gray-700 hover:bg-black/5'
                                    }`}
                            >
                                <Sparkles className="w-4 h-4" />
                                {t('purchase.tab_points')}
                            </button>
                            <button
                                onClick={() => setActiveTab('membership')}
                                className={`px-5 py-2 text-sm font-bold rounded-lg transition-all duration-300 flex items-center gap-2 ${activeTab === 'membership'
                                    ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md shadow-purple-200/50'
                                    : 'text-gray-500 hover:text-gray-700 hover:bg-black/5'
                                    }`}
                            >
                                <Crown className="w-4 h-4" />
                                {t('purchase.tab_membership')}
                            </button>
                        </div>

                        <div className="justify-self-end">
                            <button
                                onClick={onClose}
                                className="p-2 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                )}

                {/* Header for Payment Step */}
                {purchaseStep === 'payment' && (
                    <div className="relative bg-white pt-6 px-6 pb-4 border-b border-gray-100 flex items-center justify-between z-10 animate-in slide-in-from-right-4 duration-300">
                        <div className="flex items-center gap-3">
                            <button onClick={handleBack} className="p-2 -ml-2 rounded-full hover:bg-gray-100 text-gray-500 transition-colors">
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
                            </button>
                            <div>
                                <h2 className="text-xl font-bold text-gray-900 tracking-tight">{t('purchase.order_summary')}</h2>
                                <p className="text-xs font-medium text-gray-500">{t('purchase.next_payment').replace("Next: ", "")}</p>
                            </div>
                        </div>
                        <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"><X className="w-5 h-5" /></button>
                    </div>
                )}


                {/* Main Scrollable Content */}
                <div className="flex-1 overflow-hidden bg-gray-50/50">
                    <div className="p-6 h-full flex flex-col justify-center">

                        {/* STEP 1: SELECT */}
                        {purchaseStep === 'select' && (
                            <>
                                {activeTab === 'membership' ? (
                                    <div className="space-y-6 animate-in slide-in-from-right-4 duration-500 fade-in">
                                        {/* Membership Section */}
                                        <div className="relative overflow-hidden rounded-3xl bg-white border border-purple-100 shadow-lg shadow-purple-50 p-6 md:p-8 min-h-[420px] flex flex-col justify-center">

                                            <div className="relative z-10 grid md:grid-cols-2 gap-8 items-center h-full">
                                                {/* Left: Copy & Benefits */}
                                                <div>
                                                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-50 border border-purple-100 text-xs font-bold uppercase tracking-wider text-purple-600 mb-4">
                                                        <Star className="w-3 h-3 fill-purple-600" />
                                                        {t('purchase.premium_access')}
                                                    </div>
                                                    <h3 className="text-3xl md:text-3xl font-black mb-4 leading-tight text-gray-900"
                                                        dangerouslySetInnerHTML={{ __html: t('purchase.unlock_potential_title') }}
                                                    />
                                                    <p className="text-gray-500 mb-8 max-w-sm leading-relaxed text-sm">
                                                        {t('purchase.unlock_potential_desc')}
                                                    </p>

                                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                        {membershipBenefits.map((b, i) => (
                                                            <div key={i} className="flex items-start gap-3">
                                                                <div className="mt-1 w-5 h-5 rounded-full bg-purple-50 flex items-center justify-center text-purple-600 shrink-0">
                                                                    <b.icon className="w-3 h-3" />
                                                                </div>
                                                                <div>
                                                                    <div className="text-sm font-bold text-gray-900">{b.text}</div>
                                                                    <div className="text-[10px] text-gray-500">{b.sub}</div>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>

                                                {/* Right: The Membership Card */}
                                                <div className="flex justify-center md:justify-end h-full">
                                                    {subscriptionPackages.map((pkg) => {
                                                        const isSelected = selectedPackageId === pkg.id;
                                                        return (
                                                            <div
                                                                key={pkg.id}
                                                                onClick={() => setSelectedPackageId(pkg.id)}
                                                                className={`relative w-full max-w-[320px] rounded-2xl transition-all duration-300 cursor-pointer group ${isSelected
                                                                    ? 'bg-white border-2 border-purple-500 shadow-xl shadow-purple-500/10 scale-[1.01]'
                                                                    : 'bg-white border text-gray-400 border-gray-100 hover:border-purple-200'
                                                                    }`}
                                                            >
                                                                {/* Inner Card Content */}
                                                                <div className={`relative h-full rounded-xl p-8 flex flex-col items-center text-center justify-center`}>

                                                                    <div className={`relative z-10 w-20 h-20 rounded-2xl flex items-center justify-center mb-6 transition-transform duration-500 ${isSelected ? 'bg-purple-50 text-purple-600' : 'bg-gray-50 text-gray-400'}`}>
                                                                        <Infinity className="w-10 h-10" />
                                                                    </div>

                                                                    <h4 className={`text-lg font-bold mb-2 ${isSelected ? 'text-gray-900' : 'text-gray-500'}`}>
                                                                        {t('purchase.plan_assistant')}
                                                                    </h4>
                                                                    <div className="flex items-baseline gap-1 mb-8">
                                                                        <span className={`text-4xl font-black tracking-tight ${isSelected ? 'text-gray-900' : 'text-gray-400'}`}>
                                                                            NT$ {pkg.price}
                                                                        </span>
                                                                        <span className="text-sm font-medium text-gray-400">{t('purchase.per_month')}</span>
                                                                    </div>

                                                                    <div className={`w-full py-3 rounded-lg text-sm font-bold transition-colors ${isSelected ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-400'}`}>
                                                                        {isSelected ? t('purchase.selected_plan') : t('purchase.select_plan')}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="space-y-6 animate-in slide-in-from-right-4 duration-500 fade-in">
                                        {/* Points Section - REDESIGNED to match Membership Layout */}
                                        <div className="relative overflow-hidden rounded-3xl bg-white border border-brand-100 shadow-lg shadow-brand-50 p-6 md:p-8 min-h-[420px] flex flex-col justify-center">

                                            <div className="relative z-10 grid md:grid-cols-2 gap-8 items-center h-full">
                                                {/* Left: Copy & Benefits */}
                                                <div>
                                                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-50 border border-brand-100 text-xs font-bold uppercase tracking-wider text-brand-600 mb-4">
                                                        <Sparkles className="w-3 h-3 fill-brand-600" />
                                                        {t('purchase.flexible_badge')}
                                                    </div>
                                                    <h3 className="text-3xl md:text-3xl font-black mb-4 leading-tight text-gray-900"
                                                        dangerouslySetInnerHTML={{ __html: t('purchase.flexible_title') }}
                                                    />
                                                    <p className="text-gray-500 mb-8 max-w-sm leading-relaxed text-sm">
                                                        {t('purchase.flexible_desc')}
                                                    </p>

                                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                        {pointsBenefits.map((b, i) => (
                                                            <div key={i} className="flex items-start gap-3">
                                                                <div className="mt-1 w-5 h-5 rounded-full bg-brand-50 flex items-center justify-center text-brand-600 shrink-0">
                                                                    <b.icon className="w-3 h-3" />
                                                                </div>
                                                                <div>
                                                                    <div className="text-sm font-bold text-gray-900">{b.text}</div>
                                                                    <div className="text-[10px] text-gray-500">{b.sub}</div>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>

                                                {/* Right: The Points Selection Stack */}
                                                <div className="flex flex-col gap-3 justify-center md:items-end h-full">
                                                    {pointPackages.map((pkg) => {
                                                        const isSelected = selectedPackageId === pkg.id;
                                                        return (
                                                            <div
                                                                key={pkg.id}
                                                                onClick={() => setSelectedPackageId(pkg.id)}
                                                                className={`relative w-full max-w-[320px] p-4 rounded-xl border transition-all cursor-pointer flex items-center justify-between group ${isSelected
                                                                    ? 'bg-brand-50/50 border-brand-500 shadow-md ring-1 ring-brand-200'
                                                                    : 'bg-white border-gray-100 hover:border-brand-200 hover:shadow-sm'
                                                                    }`}
                                                            >
                                                                <div className="flex items-center gap-4">
                                                                    {/* Icon Circle */}
                                                                    <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 ${isSelected ? 'bg-brand-100 text-brand-600' : 'bg-gray-50 text-gray-400 group-hover:bg-brand-50 group-hover:text-brand-500 transition-colors'
                                                                        }`}>
                                                                        <Sparkles className="w-5 h-5" />
                                                                    </div>

                                                                    <div>
                                                                        <div className="flex items-center gap-2">
                                                                            <h4 className={`font-bold ${isSelected ? 'text-gray-900' : 'text-gray-600'}`}>{t(`purchase.packages.${pkg.id}`)}</h4>
                                                                            {pkg.popular && (
                                                                                <span className="text-[10px] px-1.5 py-0.5 bg-gradient-to-r from-amber-400 to-orange-400 text-white font-bold rounded-full">{t('purchase.hot')}</span>
                                                                            )}
                                                                        </div>
                                                                        <div className="flex items-center gap-1">
                                                                            <span className={`text-lg font-black ${isSelected ? 'text-brand-600' : 'text-gray-400'}`}>{pkg.points}</span>
                                                                            <span className="text-xs font-bold text-gray-400">{t('purchase.point_unit')}</span>
                                                                        </div>
                                                                    </div>
                                                                </div>

                                                                <div className="text-right">
                                                                    <div className={`text-lg font-bold ${isSelected ? 'text-gray-900' : 'text-gray-400'}`}>
                                                                        NT$ {pkg.price}
                                                                    </div>
                                                                    {isSelected && (
                                                                        <div className="w-6 h-6 ml-auto bg-brand-500 rounded-full flex items-center justify-center animate-in zoom-in duration-200">
                                                                            <Check className="w-3.5 h-3.5 text-white" />
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </>
                        )}

                        {/* STEP 2: PAYMENT */}
                        {purchaseStep === 'payment' && (
                            <div className="animate-in slide-in-from-right-4 duration-300">
                                <div className="max-w-xl mx-auto space-y-8">

                                    {/* Order Summary Card */}
                                    <div className="bg-gradient-to-br from-gray-50 to-white border border-gray-200 rounded-3xl p-6 shadow-sm">
                                        <h3 className="text-sm font-bold text-gray-400 mb-4 uppercase tracking-wider">{t('purchase.order_summary')}</h3>
                                        <div className="flex items-center gap-5">
                                            <div className={`w-20 h-20 rounded-2xl flex items-center justify-center shadow-inner ${selectedPkg?.type === 'subscription' ? 'bg-purple-100 text-purple-600' : 'bg-brand-100 text-brand-600'
                                                }`}>
                                                {selectedPkg?.type === 'subscription' ? <Crown className="w-10 h-10" /> : <Sparkles className="w-10 h-10" />}
                                            </div>
                                            <div className="flex-1">
                                                <div className="flex items-start justify-between">
                                                    <div>
                                                        <h4 className="text-xl font-black text-gray-900">{selectedPkg?.name}</h4>
                                                        <p className="text-gray-500 text-sm mt-1">{selectedPkg?.description}</p>
                                                    </div>
                                                    <div className="text-right">
                                                        <div className="text-2xl font-black text-gray-900">NT$ {selectedPkg?.price}</div>
                                                        <div className="text-xs text-gray-400 font-bold">{selectedPkg?.type === 'subscription' ? t('purchase.per_month') : t('purchase.one_time')}</div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Payment Methods */}
                                    <div>
                                        <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                                            <CreditCard className="w-5 h-5 text-gray-400" />
                                            {t('purchase.payment_method')}
                                        </h3>
                                        <div className="grid grid-cols-1 gap-3">
                                            <div
                                                onClick={() => setSelectedMethod('card')}
                                                className={`flex items-center gap-4 p-4 rounded-2xl border-2 transition-all cursor-pointer ${selectedMethod === 'card' ? 'border-brand-500 bg-brand-50/20' : 'border-gray-100 hover:border-gray-200'
                                                    }`}>
                                                <div className="w-12 h-12 bg-white rounded-xl shadow-sm flex items-center justify-center text-blue-600">
                                                    <CreditCard className="w-6 h-6" />
                                                </div>
                                                <div className="flex-1">
                                                    <div className="font-bold text-gray-900">{t('purchase.card')}</div>
                                                    <div className="text-xs text-gray-500">{t('purchase.card_desc')}</div>
                                                </div>
                                                {selectedMethod === 'card' && <div className="w-6 h-6 bg-brand-500 rounded-full flex items-center justify-center"><Check className="w-4 h-4 text-white" /></div>}
                                            </div>

                                            <div
                                                onClick={() => setSelectedMethod('paypal')}
                                                className={`flex items-center gap-4 p-4 rounded-2xl border-2 transition-all cursor-pointer ${selectedMethod === 'paypal' ? 'border-brand-500 bg-brand-50/20' : 'border-gray-100 hover:border-gray-200'
                                                    }`}>
                                                <div className="w-12 h-12 bg-white rounded-xl shadow-sm flex items-center justify-center text-indigo-600">
                                                    <Wallet className="w-6 h-6" />
                                                </div>
                                                <div className="flex-1">
                                                    <div className="font-bold text-gray-900">{t('purchase.paypal')}</div>
                                                    <div className="text-xs text-gray-500">{t('purchase.paypal_desc')}</div>
                                                </div>
                                                {selectedMethod === 'paypal' && <div className="w-6 h-6 bg-brand-500 rounded-full flex items-center justify-center"><Check className="w-4 h-4 text-white" /></div>}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Total */}
                                    <div className="pt-6 border-t border-dashed border-gray-200">
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-gray-500">{t('purchase.subtotal')}</span>
                                            <span className="font-medium">NT$ {selectedPkg?.price}</span>
                                        </div>
                                        <div className="flex items-center justify-between mb-2 text-green-600">
                                            <span className="text-sm">{t('purchase.discount')}</span>
                                            <span className="font-medium">- NT$ 0</span>
                                        </div>
                                        <div className="flex items-center justify-between pt-4">
                                            <span className="text-lg font-bold text-gray-900">{t('purchase.total')}</span>
                                            <span className="text-3xl font-black text-brand-600">NT$ {selectedPkg?.price}</span>
                                        </div>
                                    </div>

                                </div>
                            </div>
                        )}

                        {/* Processing State */}
                        {purchaseStep === 'processing' && (
                            <div className="flex flex-col items-center justify-center flex-1 text-center min-h-[400px]">
                                <div className="relative mb-8">
                                    <div className={`absolute inset-0 blur-xl opacity-20 animate-pulse rounded-full ${activeTab === 'membership' ? 'bg-purple-500' : 'bg-brand-500'}`}></div>
                                    <Loader2 className={`w-20 h-20 animate-spin relative z-10 ${activeTab === 'membership' ? 'text-purple-600' : 'text-brand-600'}`} />
                                </div>
                                <h3 className="text-2xl font-black text-gray-900 mb-2">{t('purchase.processing_title')}</h3>
                                <p className="text-gray-500 text-base max-w-xs mx-auto">{t('purchase.processing_desc')}</p>
                            </div>
                        )}

                        {/* Error State */}
                        {purchaseStep === 'error' && (
                            <div className="flex flex-col items-center justify-center flex-1 text-center min-h-[400px] animate-in zoom-in duration-300">
                                <div className="w-24 h-24 bg-red-50 text-red-500 rounded-full flex items-center justify-center mb-6 shadow-lg shadow-red-100 border border-red-100">
                                    <AlertCircle className="w-12 h-12" />
                                </div>
                                <h3 className="text-3xl font-black text-gray-900 mb-2">{t('purchase.error_title')}</h3>
                                <p className="text-gray-500 text-lg mb-8 max-w-md break-words px-4">
                                    {t('purchase.error_prefix')}<br />
                                    <span className="text-red-500 text-base font-bold mt-2 inline-block">{errorMessage.includes('[UserService]') ? errorMessage : t(errorMessage)}</span>
                                </p>
                                <div className="flex gap-4">
                                    <button
                                        onClick={() => setPurchaseStep('select')}
                                        className="px-8 py-3 rounded-xl font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors"
                                    >
                                        {t('purchase.back_menu')}
                                    </button>
                                    <button
                                        onClick={handlePurchase}
                                        className="px-8 py-3 rounded-xl font-bold text-white bg-red-500 hover:bg-red-600 shadow-lg shadow-red-200 transition-colors"
                                    >
                                        {t('purchase.retry')}
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Success State */}
                        {purchaseStep === 'success' && (
                            <div className="flex flex-col items-center justify-center flex-1 text-center min-h-[400px] animate-in zoom-in duration-300">
                                {selectedPkg?.type === 'subscription' ? (
                                    <>
                                        <div className="relative w-24 h-24 mb-6">
                                            <div className="absolute inset-0 bg-purple-500/20 rounded-full animate-ping"></div>
                                            <div className="relative w-full h-full bg-gradient-to-tr from-purple-100 to-indigo-100 text-purple-600 rounded-full flex items-center justify-center shadow-lg shadow-purple-200">
                                                <Crown className="w-10 h-10 animate-bounce" />
                                            </div>
                                        </div>
                                        <h3 className="text-3xl font-black text-gray-900 mb-2">{t('purchase.success_membership_title')}</h3>
                                        <p className="text-gray-500 text-lg mb-8 max-w-md">
                                            {t('purchase.success_membership_desc')}
                                        </p>
                                    </>
                                ) : (
                                    <>
                                        <div className="w-24 h-24 bg-green-50 text-green-500 rounded-full flex items-center justify-center mb-6 shadow-lg shadow-green-100 border border-green-100">
                                            <Check className="w-12 h-12" />
                                        </div>
                                        <h3 className="text-3xl font-black text-gray-900 mb-2">{t('purchase.success_points_title')}</h3>
                                        <p className="text-gray-500 text-lg mb-8">
                                            {t('purchase.success_points_desc', { points: selectedPkg?.points })}<br />
                                            <span className="text-sm">{t('purchase.success_points_sub')}</span>
                                        </p>
                                    </>
                                )}
                                <button className="px-8 py-2 text-sm font-bold text-gray-400 hover:text-gray-600 transition-colors">
                                    {t('purchase.auto_close', { seconds: countdown })}
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer / CTA - Sticky */}
                {(purchaseStep === 'select' || purchaseStep === 'payment') && (
                    <div className="bg-white p-5 border-t border-gray-100 shadow-[0_-5px_20px_rgba(0,0,0,0.02)] z-20">
                        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                            <div className="flex flex-col">
                                <span className="text-xs text-gray-400 font-medium">{t('purchase.total')}</span>
                                <div className="flex items-baseline gap-1">
                                    <span className="text-sm font-bold text-gray-400">NT$</span>
                                    <span className="text-2xl font-black text-gray-900">{selectedPkg?.price || 0}</span>
                                </div>
                            </div>

                            {purchaseStep === 'select' ? (
                                <button
                                    onClick={handleNextStep}
                                    disabled={!selectedPackageId}
                                    className={`w-full sm:w-auto px-10 py-3.5 rounded-xl font-bold text-white shadow-xl hover:-translate-y-0.5 active:translate-y-0 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 ${activeTab === 'membership'
                                        ? 'bg-gradient-to-r from-purple-600 to-indigo-600 shadow-lg shadow-purple-200/50'
                                        : 'bg-gradient-to-r from-brand-600 to-sky-600 shadow-lg shadow-brand-200/50'
                                        }`}
                                >
                                    <span>{t('purchase.next_payment')}</span>
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="opacity-80"><path d="m9 18 6-6-6-6" /></svg>
                                </button>
                            ) : (
                                <button
                                    onClick={handlePurchase}
                                    disabled={!selectedPackageId || isLoading}
                                    className={`w-full sm:w-auto px-10 py-3.5 rounded-xl font-bold text-white shadow-xl hover:-translate-y-0.5 active:translate-y-0 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 ${activeTab === 'membership'
                                        ? 'bg-gradient-to-r from-purple-600 to-indigo-600 shadow-lg shadow-purple-200/50'
                                        : 'bg-gradient-to-r from-brand-600 to-sky-600 shadow-lg shadow-brand-200/50'
                                        }`}
                                >
                                    <span>{t('purchase.confirm_payment')}</span>
                                    <ShieldCheck className="w-5 h-5 opacity-90" />
                                </button>
                            )}
                        </div>
                    </div>
                )}

            </div>
        </div>,
        document.body
    );
}

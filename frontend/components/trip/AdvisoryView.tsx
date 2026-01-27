import React, { useState } from 'react';
import { Trip, TripData } from '../../types';
import {
    BookOpen, Sparkles, Shirt, Plane, ShieldCheck,
    HeartHandshake, FileSearch, CheckCircle2, AlertTriangle,
    CloudSun, Globe, Info, Zap, Wallet, Coins, Utensils, Phone, Stethoscope,
    Wind, ThermometerSun, Umbrella, ChevronRight, X, ArrowRight, MapPin
} from 'lucide-react';
import { aiService } from '../../services';
import { useAuth } from '../../context/AuthContext';
import { usePoints } from '../../context/PointsContext';

interface Props {
    trip: Trip;
    loading: boolean;
    error: string | null;
    onGenerate: () => void;
    onUpdateTrip?: (tripId: string, data: TripData) => void;
    isMapOpen?: boolean;
}

// ... imports ...



interface ModalData {
    title: string;
    icon: any;
    data: any; // The structured data object
    colorTheme: 'blue' | 'indigo' | 'emerald' | 'amber' | 'rose' | 'violet' | 'orange' | 'pink';
}

export default function AdvisoryView({ trip, loading, error, onGenerate, onUpdateTrip, isMapOpen = false }: Props) {
    const { user } = useAuth();
    const { balance, isSubscribed } = usePoints(); // Points Hook
    const advisory = trip.data?.advisory;

    // State for the active modal (Details)
    const [modalData, setModalData] = useState<ModalData | null>(null);

    // State for Payment Confirmation
    const [paymentModalOpen, setPaymentModalOpen] = useState(false);

    const openModal = (title: string, icon: any, data: any, colorTheme: ModalData['colorTheme']) => {
        if (!data) return;
        setModalData({ title, icon, data, colorTheme });
    };

    const closeModal = () => setModalData(null);

    if (!advisory) {
        return <EmptyState loading={loading} error={error} onGenerate={onGenerate} />;
    }

    // Main Content
    return (
        <div className="max-w-7xl mx-auto pb-24 animate-in fade-in slide-in-from-bottom-6 duration-700 px-4 sm:px-6 relative">

            {/* Payment Confirmation Modal */}
            <PaymentConfirmationModal
                isOpen={paymentModalOpen}
                onClose={() => setPaymentModalOpen(false)}
                onConfirm={onGenerate}
                title="開啟 AI 旅遊顧問"
                subtitle="AI 將為您全方位分析目的地天氣、安全與文化資訊"
                targetLabel="分析目的地"
                targetValue={trip.input.destination}
                costLabel="顧問生成費用"
                cost={30}
                balance={balance}
                isSubscribed={isSubscribed}
            />

            {/* Floating Regenerate Button */}
            {!loading && <FloatingRegenerateButton onClick={() => setPaymentModalOpen(true)} />}

            {/* Modal Layer (Content Details) */}
            {modalData && (
                <DetailModal
                    isOpen={!!modalData}
                    onClose={closeModal}
                    title={modalData.title}
                    icon={modalData.icon}
                    data={modalData.data}
                    colorTheme={modalData.colorTheme}
                />
            )}

            {/* Hero Header */}
            <div className="text-center mb-16 relative pt-12 md:pt-20">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-64 bg-brand-200/30 rounded-full blur-[100px] -z-10" />
                <h2 className="text-4xl md:text-6xl font-black text-gray-900 mb-6 tracking-tight leading-tight">
                    您的 <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-600 to-indigo-600">{trip.input.destination}</span> 專屬顧問
                </h2>
                <p className="text-xl text-gray-500 max-w-2xl mx-auto leading-relaxed font-light">
                    全方位分析目的地天氣、文化與安全資訊，為您打造最完美的旅程體驗
                </p>
            </div>

            <div className="grid grid-cols-12 gap-6">

                {/* 1. Itinerary Analysis (Span 12) */}
                <div className="col-span-12">
                    <div className="bg-slate-900 rounded-[2rem] p-8 md:p-10 text-white shadow-2xl relative overflow-hidden group border border-slate-800 isolate">
                        {/* Background Effects */}
                        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-indigo-500/20 rounded-full blur-[120px] -translate-y-1/2 translate-x-1/3 group-hover:bg-indigo-500/30 transition-colors duration-1000 -z-10" />
                        <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-blue-500/10 rounded-full blur-[80px] translate-y-1/3 -translate-x-1/3 -z-10" />

                        <div className="flex flex-col lg:flex-row gap-12 items-start">
                            {/* Left: Summary */}
                            <div className="lg:w-5/12 space-y-6">
                                <div className="flex items-center gap-4">
                                    <div className="p-3 bg-white/10 backdrop-blur-md rounded-2xl border border-white/10">
                                        <FileSearch className="w-8 h-8 text-indigo-300" />
                                    </div>
                                    <div>
                                        <h3 className="text-2xl font-bold tracking-tight text-white">行程分析概況</h3>
                                        <p className="text-slate-400 text-sm">AI 深度檢視您的路線規劃</p>
                                    </div>
                                </div>
                                <div className="text-slate-200 leading-loose text-lg font-light">
                                    <StructuredTextContent data={advisory.itineraryAnalysis?.pace} fallbackColor="text-slate-200" />
                                </div>
                                {/* View Details Button for Itinerary */}
                                <button
                                    onClick={() => openModal('行程分析詳情', FileSearch, advisory.itineraryAnalysis?.pace, 'indigo')}
                                    className="inline-flex items-center gap-2 text-indigo-300 hover:text-white transition-colors text-sm font-bold uppercase tracking-wider group/btn"
                                >
                                    View Full Analysis <ArrowRight className="w-4 h-4 group-hover/btn:translate-x-1 transition-transform" />
                                </button>
                            </div>

                            {/* Right: Highlights & Issues */}
                            <div className="lg:w-7/12 grid grid-cols-1 md:grid-cols-2 gap-6 w-full">
                                {/* Highlights */}
                                {advisory.itineraryAnalysis?.highlights && (
                                    <div className="bg-slate-800/50 backdrop-blur-sm rounded-3xl p-6 border border-slate-700/50">
                                        <div className="flex items-center gap-2 mb-4 text-emerald-400">
                                            <Sparkles className="w-4 h-4" />
                                            <span className="text-xs font-bold uppercase tracking-widest">Trip Highlights</span>
                                        </div>
                                        <div className="space-y-3">
                                            {advisory.itineraryAnalysis.highlights.map((h, i) => (
                                                <div key={i} className="flex gap-3 text-sm text-slate-300 leading-relaxed">
                                                    <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full mt-2 flex-shrink-0" />
                                                    <span>{h}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Issues */}
                                {advisory.itineraryAnalysis?.issues?.length > 0 && (
                                    <div className="bg-amber-900/10 backdrop-blur-sm rounded-3xl p-6 border border-amber-500/20">
                                        <div className="flex items-center gap-2 mb-4 text-amber-400">
                                            <AlertTriangle className="w-4 h-4" />
                                            <span className="text-xs font-bold uppercase tracking-widest">Suggestions</span>
                                        </div>
                                        <ul className="space-y-3">
                                            {advisory.itineraryAnalysis.issues.map((item, i) => (
                                                <li key={i} className="flex gap-3 text-sm text-amber-200/80 leading-relaxed">
                                                    <span className="w-1.5 h-1.5 bg-amber-500 rounded-full mt-2 flex-shrink-0" />
                                                    <span>{item}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* 2. Weather & Clothing (Span 7) - REDESIGNED */}
                <div className="col-span-12 lg:col-span-7">
                    <div className="h-full bg-white rounded-[2rem] p-8 border border-gray-100 shadow-sm relative overflow-hidden flex flex-col">
                        {/* Decorative Background Blob */}
                        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-50/50 rounded-full blur-[80px] -translate-y-1/2 translate-x-1/3 -z-10" />

                        {/* Header */}
                        <div className="flex items-center gap-3 mb-8">
                            <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
                                <CloudSun className="w-6 h-6" />
                            </div>
                            <h3 className="text-2xl font-bold text-gray-800">天氣概況 & 穿搭</h3>
                        </div>

                        {/* Content Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 flex-1">
                            {/* Weather Block */}
                            <div
                                className="group relative bg-blue-50/30 hover:bg-blue-50 rounded-2xl p-6 border border-blue-100/50 cursor-pointer transition-all duration-300 flex flex-col"
                                onClick={() => openModal('天氣預報詳情', Wind, advisory.weather?.forecast, 'blue')}
                            >
                                <div className="absolute top-4 right-4 text-blue-200 group-hover:text-blue-300 transition-colors">
                                    <Wind className="w-12 h-12 opacity-20 group-hover:scale-110 transition-transform duration-500" />
                                </div>

                                <div className="flex items-center gap-2 mb-3 text-blue-700">
                                    <ThermometerSun className="w-5 h-5" />
                                    <span className="text-xs font-bold uppercase tracking-widest">Forecast</span>
                                </div>

                                <div className="text-gray-600 leading-relaxed text-sm flex-1">
                                    <StructuredTextContent data={advisory.weather?.forecast} />
                                </div>

                                <div className="mt-4 flex items-center text-blue-600 text-sm font-bold opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0 transition-all">
                                    查看完整預報 <ArrowRight className="w-4 h-4 ml-1" />
                                </div>
                            </div>

                            {/* Clothing Block */}
                            <div
                                className="group relative bg-indigo-50/30 hover:bg-indigo-50 rounded-2xl p-6 border border-indigo-100/50 cursor-pointer transition-all duration-300 flex flex-col"
                                onClick={() => openModal('穿搭建議詳情', Shirt, advisory.weather?.clothing, 'indigo')}
                            >
                                <div className="absolute top-4 right-4 text-indigo-200 group-hover:text-indigo-300 transition-colors">
                                    <Shirt className="w-12 h-12 opacity-20 group-hover:scale-110 group-hover:-rotate-6 transition-transform duration-500" />
                                </div>

                                <div className="flex items-center gap-2 mb-3 text-indigo-700">
                                    <Shirt className="w-5 h-5" />
                                    <span className="text-xs font-bold uppercase tracking-widest">Outfit</span>
                                </div>

                                <div className="text-gray-600 leading-relaxed text-sm flex-1">
                                    <StructuredTextContent data={advisory.weather?.clothing} />
                                </div>

                                <div className="mt-4 flex items-center text-indigo-600 text-sm font-bold opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0 transition-all">
                                    查看穿搭指南 <ArrowRight className="w-4 h-4 ml-1" />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 3. Safety (Span 5) */}
                <div className="col-span-12 lg:col-span-5">
                    <div className="h-full bg-white rounded-[2rem] p-8 border border-gray-100 shadow-sm relative overflow-hidden flex flex-col">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-orange-100 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3" />

                        <div className="flex items-center gap-3 mb-8 relative z-10">
                            <div className="p-2.5 bg-orange-50 text-orange-600 rounded-xl">
                                <ShieldCheck className="w-6 h-6" />
                            </div>
                            <h3 className="text-2xl font-bold text-gray-800">安全須知</h3>
                        </div>

                        <div className="space-y-4 relative z-10 flex-1">
                            <SafetyItem
                                icon={AlertTriangle}
                                title="常見詐騙"
                                content={advisory.safety?.scams}
                                color="text-orange-600"
                                bg="bg-orange-50"
                                onClick={() => openModal('常見詐騙詳情', AlertTriangle, advisory.safety?.scams, 'orange')}
                            />
                            <SafetyItem
                                icon={Phone}
                                title="緊急聯絡"
                                content={advisory.safety?.emergency}
                                color="text-red-600"
                                bg="bg-red-50"
                                onClick={() => openModal('緊急聯絡資訊', Phone, advisory.safety?.emergency, 'rose')}
                            />
                            <SafetyItem
                                icon={Stethoscope}
                                title="健康醫療"
                                content={advisory.safety?.health}
                                color="text-emerald-600"
                                bg="bg-emerald-50"
                                onClick={() => openModal('健康醫療建議', Stethoscope, advisory.safety?.health, 'emerald')}
                            />
                        </div>
                    </div>
                </div>

                {/* 4. Logistics Grid (Span 12) */}
                <div className="col-span-12">
                    <div className="bg-gray-50 rounded-[2rem] p-8 border border-gray-100">
                        <div className="flex items-center gap-3 mb-8">
                            <div className="p-2.5 bg-white text-indigo-600 rounded-xl shadow-sm">
                                <Plane className="w-6 h-6" />
                            </div>
                            <h3 className="text-2xl font-bold text-gray-800">交通與實用資訊</h3>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                            <InfoCard
                                icon={Map} title="交通攻略"
                                data={advisory.logistics?.transport}
                                color="indigo"
                                onClick={() => openModal('當地交通攻略', Map, advisory.logistics?.transport, 'indigo')}
                            />
                            <InfoCard
                                icon={Zap} title="網路與電壓"
                                data={advisory.logistics?.connectivity}
                                color="blue"
                                onClick={() => openModal('網路與電壓資訊', Zap, advisory.logistics?.connectivity, 'blue')}
                            />
                            <InfoCard
                                icon={Wallet} title="貨幣匯率"
                                data={advisory.logistics?.currency}
                                color="emerald"
                                onClick={() => openModal('貨幣與匯率建議', Wallet, advisory.logistics?.currency, 'emerald')}
                            />
                            <InfoCard
                                icon={Info} title="退稅須知"
                                data={advisory.logistics?.refund}
                                color="violet"
                                onClick={() => openModal('購物退稅須知', Info, advisory.logistics?.refund, 'violet')}
                            />
                        </div>
                    </div>
                </div>

                {/* 5. Culture (Span 12) */}
                <div className="col-span-12 grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Culture Card */}
                    <div className="bg-white rounded-[2rem] p-8 border border-gray-100 shadow-sm flex flex-col">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="p-2.5 bg-pink-50 text-pink-600 rounded-xl">
                                <HeartHandshake className="w-6 h-6" />
                            </div>
                            <h3 className="text-2xl font-bold text-gray-800">文化禮儀</h3>
                        </div>

                        <div className="space-y-6 flex-1">
                            <div
                                className="bg-pink-50/50 rounded-2xl p-5 border border-pink-100/50 cursor-pointer hover:bg-pink-50 transition-colors group/tip"
                                onClick={() => openModal('小費文化詳情', Coins, advisory.cultural?.tipping, 'pink')}
                            >
                                <div className="flex items-center gap-2 mb-2 text-pink-700 font-bold text-sm">
                                    <Coins className="w-4 h-4" />
                                    消費者小費
                                    <ArrowRight className="w-3 h-3 opacity-0 group-hover/tip:opacity-100 transition-opacity ml-auto" />
                                </div>
                                <StructuredTextContent data={advisory.cultural?.tipping} />
                            </div>
                            <div
                                className="bg-pink-50/50 rounded-2xl p-5 border border-pink-100/50 cursor-pointer hover:bg-pink-50 transition-colors group/dining"
                                onClick={() => openModal('用餐禮儀詳情', Utensils, advisory.cultural?.diningEtiquette, 'pink')}
                            >
                                <div className="flex items-center gap-2 mb-2 text-pink-700 font-bold text-sm">
                                    <Utensils className="w-4 h-4" />
                                    用餐禮儀
                                    <ArrowRight className="w-3 h-3 opacity-0 group-hover/dining:opacity-100 transition-opacity ml-auto" />
                                </div>
                                <StructuredTextContent data={advisory.cultural?.diningEtiquette} />
                            </div>
                        </div>
                    </div>

                    {/* Do's & Don'ts */}
                    <div className="grid grid-cols-1 gap-6">
                        <div className="bg-emerald-50 rounded-[2rem] p-8 border border-emerald-100 relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-200/30 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3" />
                            <div className="relative z-10">
                                <div className="flex items-center gap-2 mb-4 text-emerald-800 font-bold text-lg">
                                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                                    Do's 建議做
                                </div>
                                <ul className="space-y-3">
                                    {advisory.cultural?.dos?.map((item: string, i: number) => (
                                        <li key={i} className="flex gap-3 text-emerald-900/80 font-medium">
                                            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full mt-2.5 flex-shrink-0" />
                                            {item}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>

                        <div className="bg-rose-50 rounded-[2rem] p-8 border border-rose-100 relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-rose-200/30 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3" />
                            <div className="relative z-10">
                                <div className="flex items-center gap-2 mb-4 text-rose-800 font-bold text-lg">
                                    <AlertTriangle className="w-5 h-5 text-rose-600" />
                                    Don'ts 千萬別做
                                </div>
                                <ul className="space-y-3">
                                    {advisory.cultural?.donts?.map((item: string, i: number) => (
                                        <li key={i} className="flex gap-3 text-rose-900/80 font-medium">
                                            <span className="w-1.5 h-1.5 bg-rose-500 rounded-full mt-2.5 flex-shrink-0" />
                                            {item}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 6. Local Lingo (Span 12) - REDESIGNED DECK */}
                <div className="col-span-12">
                    <div className="bg-white border border-gray-200 rounded-[2rem] p-8 shadow-sm overflow-hidden">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="p-2.5 bg-brand-50 text-brand-600 rounded-xl">
                                <Globe className="w-6 h-6" />
                            </div>
                            <h3 className="text-2xl font-bold text-gray-800">生存語言包</h3>
                        </div>

                        {/* Flashcards Deck (Horizontal Scrolling) */}
                        <div className="flex gap-4 overflow-x-auto pb-6 -mx-2 px-2 snap-x snap-mandatory custom-scrollbar items-stretch">
                            {Array.isArray(advisory.localLingo) ? (
                                advisory.localLingo.map((item: any, i: number) => (
                                    <div key={i} className="snap-start shrink-0 w-72 h-full">
                                        <LingoFlashcard item={item} />
                                    </div>
                                ))
                            ) : advisory.localLingo ? (
                                // Fallback for old data format (legacy support)
                                <>
                                    <div className="snap-start shrink-0 w-72 h-full"><LingoFlashcard item={{ term: (advisory.localLingo as any).hello, translation: "你好", pronunciation: "Hello" }} /></div>
                                    <div className="snap-start shrink-0 w-72 h-full"><LingoFlashcard item={{ term: (advisory.localLingo as any).thankYou, translation: "謝謝", pronunciation: "Thank You" }} /></div>
                                    <div className="snap-start shrink-0 w-72 h-full"><LingoFlashcard item={{ term: (advisory.localLingo as any).excuseMe, translation: "不好意思", pronunciation: "Excuse Me" }} /></div>
                                    <div className="snap-start shrink-0 w-72 h-full"><LingoFlashcard item={{ term: (advisory.localLingo as any).delicious, translation: "好吃", pronunciation: "Delicious" }} /></div>
                                </>
                            ) : null}
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
}

// ----------------------------------------------------------------------
// Sub-Components
// ----------------------------------------------------------------------

function LingoFlashcard({ item }: { item: any }) {
    return (
        <div className="relative group p-6 rounded-2xl bg-white border border-gray-200 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg cursor-default flex flex-col justify-between h-full min-h-[160px] w-full">
            {/* Pronunciation (Top) */}
            <div className="text-sm font-medium text-gray-400 mb-2">
                {item.pronunciation || "Pronunciation"}
            </div>

            {/* Main Term (Center Hero) */}
            <div className="text-3xl font-black text-gray-800 tracking-tight mb-4 break-words leading-tight">
                {item.term}
            </div>

            {/* Translation (Bottom) */}
            <div className="mt-auto pt-4 border-t border-gray-100 flex justify-between items-center">
                <span className="text-base font-bold text-gray-600">{item.translation}</span>
                {item.note && (
                    <div className="group/note relative">
                        <div className="p-1.5 rounded-full bg-gray-50 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors cursor-help">
                            <Info className="w-4 h-4" />
                        </div>
                        {/* Tooltip */}
                        <div className="absolute bottom-full right-0 mb-3 w-48 p-3 bg-gray-900 text-white text-xs font-medium rounded-xl shadow-xl opacity-0 invisible group-hover/note:opacity-100 group-hover/note:visible transition-all z-20 pointer-events-none transform translate-y-2 group-hover/note:translate-y-0 duration-200">
                            {item.note}
                            <div className="absolute bottom-[-4px] right-3 w-2 h-2 bg-gray-900 rotate-45" />
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

// Premium Modal Component (Independent Scrolling, Redesigned Header, No Footer)
const DetailModal = ({ isOpen, onClose, title, icon: Icon, data, colorTheme = 'indigo' }: any) => {
    if (!isOpen || !data) return null;

    // Theme Config (Simplified for clean look)
    const themes: any = {
        blue: { text: 'text-blue-900', icon: 'text-blue-600', dot: 'bg-blue-500' },
        indigo: { text: 'text-indigo-900', icon: 'text-indigo-600', dot: 'bg-indigo-500' },
        emerald: { text: 'text-emerald-900', icon: 'text-emerald-600', dot: 'bg-emerald-500' },
        amber: { text: 'text-amber-900', icon: 'text-amber-600', dot: 'bg-amber-500' },
        rose: { text: 'text-rose-900', icon: 'text-rose-600', dot: 'bg-rose-500' },
        violet: { text: 'text-violet-900', icon: 'text-violet-600', dot: 'bg-violet-500' },
        orange: { text: 'text-orange-900', icon: 'text-orange-600', dot: 'bg-orange-500' },
        pink: { text: 'text-pink-900', icon: 'text-pink-600', dot: 'bg-pink-500' },
    };

    const theme = themes[colorTheme] || themes.indigo;
    const details = typeof data === 'string' ? null : data.details;
    const summary = typeof data === 'string' ? data : data.summary;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm animate-in fade-in duration-300"
                onClick={onClose}
            />

            {/* Modal Content - Wide Landscape Mode */}
            <div className="relative bg-white rounded-[2rem] w-full max-w-4xl shadow-2xl animate-in zoom-in-95 duration-300 overflow-hidden flex flex-col max-h-[85vh]">

                {/* Header - Modern & Clean */}
                <div className="px-8 pt-8 pb-4 bg-white relative shrink-0 flex items-start justify-between">
                    <div className="flex gap-4 items-center">
                        {/* Icon - Integrated without box */}
                        <div className={`p-3 rounded-2xl bg-gray-50 ${theme.icon}`}>
                            <Icon className="w-8 h-8" />
                        </div>
                        <div>
                            <h3 className={`text-3xl font-black ${theme.text} tracking-tight`}>{title}</h3>
                            <div className={`h-1 w-12 ${theme.dot} rounded-full mt-2 opacity-50`} />
                        </div>
                    </div>

                    {/* Close Button - Top Right Clean */}
                    <button
                        onClick={onClose}
                        className="p-2 bg-gray-50 hover:bg-gray-100 rounded-full text-gray-400 hover:text-gray-900 transition-colors"
                        aria-label="Close"
                    >
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Body - Split Columns with Independent Scrolling */}
                <div className="flex-1 min-h-0 flex flex-col md:flex-row">
                    {/* Left: Overview (40%) */}
                    <div className="md:w-5/12 bg-white flex flex-col border-b md:border-b-0 md:border-r border-gray-100">
                        {/* Fixed Header */}
                        <div className="px-8 pt-8 pb-4 shrink-0">
                            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                                <Info className="w-3 h-3" /> Overview
                            </h4>
                        </div>
                        {/* Scrollable Content */}
                        <div className="px-8 pb-8 overflow-y-auto custom-scrollbar flex-1">
                            <p className="text-lg text-gray-700 leading-loose font-medium">
                                {summary}
                            </p>
                        </div>
                    </div>

                    {/* Right: Details (60%) */}
                    <div className="md:w-7/12 bg-white flex flex-col min-h-0">
                        {details && details.length > 0 ? (
                            <>
                                {/* Fixed Header */}
                                <div className="px-8 pt-8 pb-4 shrink-0 bg-white z-10">
                                    <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                                        <ArrowRight className="w-3 h-3" /> Detailed Insights
                                    </h4>
                                </div>
                                {/* Scrollable Content */}
                                <div className="px-8 pb-8 overflow-y-auto custom-scrollbar flex-1">
                                    <ul className="space-y-4">
                                        {details.map((item: string, i: number) => (
                                            <li key={i} className="flex gap-4 p-4 rounded-xl bg-gray-50 border border-gray-100 hover:bg-white hover:shadow-md transition-all duration-300">
                                                <span className={`mt-2 w-2 h-2 ${theme.dot} rounded-full flex-shrink-0 shadow-sm`} />
                                                <span className="text-gray-600 leading-relaxed text-sm">{item}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            </>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-gray-400 opacity-50 p-8">
                                <Sparkles className="w-12 h-12 mb-4" />
                                <p>No additional details available.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};


const StructuredTextContent = ({ data, fallbackColor = "text-gray-600" }: { data: any, fallbackColor?: string }) => {
    if (!data) return <span className="opacity-50 italic">尚無資訊</span>;
    if (typeof data === 'string') return <p className={fallbackColor}>{data}</p>;
    return <p className={`${fallbackColor} leading-relaxed`}>{data.summary}</p>;
};

const InfoCard = ({ icon: Icon, title, data, color, onClick }: any) => {
    const colorStyles: any = {
        indigo: "bg-indigo-50 text-indigo-900 icon-indigo-600",
        blue: "bg-blue-50 text-blue-900 icon-blue-600",
        emerald: "bg-emerald-50 text-emerald-900 icon-emerald-600",
        violet: "bg-violet-50 text-violet-900 icon-violet-600",
    };
    const style = colorStyles[color] || colorStyles.indigo;
    const iconColor = style.split(' ').find((c: string) => c.startsWith('icon-'))?.replace('icon-', 'text-');

    return (
        <button
            onClick={onClick}
            className="text-left w-full group bg-white rounded-3xl p-6 border border-gray-100 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-300 h-full flex flex-col relative overflow-hidden"
        >
            {/* Decoration for hover */}
            <div className={`absolute top-0 right-0 p-16 ${style.split(' ')[0]} rounded-full blur-2xl opacity-0 group-hover:opacity-20 transition-opacity translate-x-1/2 -translate-y-1/2`} />

            <div className="flex items-center justify-between w-full mb-4 relative z-10">
                <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-xl ${style.split(' ')[0]} ${iconColor}`}>
                        <Icon className="w-5 h-5" />
                    </div>
                    <h4 className="font-bold text-gray-800">{title}</h4>
                </div>
                <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-gray-800 -translate-x-2 group-hover:translate-x-0 opacity-0 group-hover:opacity-100 transition-all" />
            </div>
            <div className="flex-1 text-sm text-gray-600 leading-relaxed relative z-10">
                <StructuredTextContent data={data} />
            </div>
        </button>
    );
}

const SafetyItem = ({ icon: Icon, title, content, color, bg, onClick }: any) => {
    if (!content) return null;
    return (
        <div
            onClick={onClick}
            className="group flex gap-4 items-start p-3 -mx-3 rounded-2xl hover:bg-gray-50 transition-colors cursor-pointer"
        >
            <div className={`p-2.5 rounded-xl ${bg} ${color} flex-shrink-0 mt-1 shadow-sm`}>
                <Icon className="w-5 h-5" />
            </div>
            <div className="w-full">
                <div className="flex items-center justify-between mb-1">
                    <h4 className="font-bold text-gray-900 text-sm group-hover:text-brand-600 transition-colors">{title}</h4>
                    <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-gray-500" />
                </div>
                <div className="text-sm text-gray-500 leading-relaxed line-clamp-2">
                    <StructuredTextContent data={content} />
                </div>
            </div>
        </div>
    )
}

function LingoItem({ label, content }: { label: string, content: string }) {
    return (
        <div className="bg-gray-50 p-6 rounded-2xl border border-gray-100 text-center hover:bg-white hover:shadow-lg hover:-translate-y-1 transition-all duration-300 group">
            <div className="text-xs text-gray-400 mb-2 font-medium tracking-wider uppercase group-hover:text-brand-500 transition-colors">{label}</div>
            <div className="text-xl font-bold text-gray-800 tracking-wide group-hover:scale-110 transition-transform">{content}</div>
        </div>
    );
}

function EmptyState({ loading, error, onGenerate }: { loading: boolean, error: string | null, onGenerate: () => void }) {
    return (
        <div className="flex flex-col items-center justify-center py-32 px-6 text-center animate-in fade-in zoom-in-95 duration-500">
            <div className="relative mb-10 group">
                <div className="absolute inset-0 bg-brand-200 rounded-full blur-xl opacity-50 group-hover:opacity-80 transition-opacity" />
                <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center relative shadow-xl ring-4 ring-brand-50">
                    <BookOpen className="w-10 h-10 text-brand-600" />
                </div>
            </div>

            <h2 className="text-4xl font-black text-gray-900 mb-6 tracking-tight">獲取全方位旅遊建議</h2>
            <p className="text-gray-500 max-w-lg mb-12 leading-relaxed text-lg">
                讓 AI 旅遊顧問為您分析目的地天氣、交通、安全與文化禁忌，生成您的專屬懶人包。
            </p>

            {error && (
                <div className="mb-8 bg-red-50 text-red-600 px-6 py-4 rounded-2xl text-sm font-bold flex items-center gap-3 border border-red-100 shadow-sm">
                    <AlertTriangle className="w-5 h-5" />
                    {error}
                </div>
            )}

            <button
                onClick={onGenerate}
                disabled={loading}
                className="group relative flex items-center gap-3 px-10 py-5 bg-gray-900 text-white rounded-2xl font-bold hover:bg-black transition-all shadow-xl hover:shadow-2xl hover:-translate-y-1 disabled:opacity-70 disabled:hover:translate-y-0 disabled:hover:shadow-xl overflow-hidden"
            >
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
                {loading ? (
                    <>
                        <Sparkles className="w-5 h-5 animate-spin text-brand-300" />
                        <span>正在為您生成指南...</span>
                    </>
                ) : (
                    <>
                        <Sparkles className="w-5 h-5 text-brand-300" />
                        <span>立即生成旅遊顧問報告</span>
                    </>
                )}
            </button>
        </div>
    );
}

// Map icon was missing
function Map(props: any) {
    return (
        <svg
            {...props}
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21" />
            <line x1="9" x2="9" y1="3" y2="18" />
            <line x1="15" x2="15" y1="6" y2="21" />
        </svg>
    )
}

// Local components moved to shared
import PaymentConfirmationModal from '../PaymentConfirmationModal';

function FloatingRegenerateButton({ onClick, isMapOpen = false }: { onClick: () => void, isMapOpen?: boolean }) {
    return (
        <div className={`fixed bottom-8 z-40 animate-in slide-in-from-bottom-10 fade-in duration-700 delay-500 transition-all duration-300 -translate-x-1/2
            ${isMapOpen ? 'left-1/2 lg:left-[29.17%] xl:left-[25%]' : 'left-1/2'}
        `}>
            <button
                onClick={onClick}
                className="group flex items-center gap-3 px-6 py-3 bg-white/90 backdrop-blur-md border border-brand-100 text-brand-700 rounded-full shadow-2xl hover:bg-brand-50 hover:scale-105 transition-all duration-300 ring-4 ring-black/5"
            >
                <div className="bg-brand-100 p-2 rounded-full group-hover:rotate-12 transition-transform duration-500">
                    <Sparkles className="w-5 h-5 text-brand-600" />
                </div>
                <div className="flex flex-col items-start mr-1">
                    <span className="text-xs font-bold text-brand-400 uppercase tracking-wider">Updates Available</span>
                    <span className="text-sm font-black text-gray-800">重新生成建議</span>
                </div>
            </button>
        </div>
    );
}

import React from 'react';
import { Sparkles, Cloud, Users, Globe, ArrowRight, MapPin, Calendar, CheckCircle2, Star, Landmark, Heart, Crown, Building2, Mountain, Utensils, Gem } from 'lucide-react';

interface Props {
    onLoginClick: () => void;
}

export default function LandingPage({ onLoginClick }: Props) {
    return (
        <div className="min-h-screen w-full bg-[#0f172a] text-white overflow-x-hidden selection:bg-indigo-500/30 font-sans">

            {/* Custom Animations */}
            <style>{`
        @keyframes float {
          0% { transform: translateY(0px); }
          50% { transform: translateY(-20px); }
          100% { transform: translateY(0px); }
        }
        @keyframes scroll {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .animate-float {
          animation: float 6s ease-in-out infinite;
        }
        .animate-scroll {
          animation: scroll 40s linear infinite;
        }
        .bg-grid {
          background-size: 40px 40px;
          background-image: linear-gradient(to right, rgba(255, 255, 255, 0.05) 1px, transparent 1px),
                            linear-gradient(to bottom, rgba(255, 255, 255, 0.05) 1px, transparent 1px);
        }
        .perspective-1000 {
            perspective: 1000px;
        }
        .rotate-x-12 {
            transform: rotateX(12deg) rotateY(-4deg) rotateZ(2deg);
        }
      `}</style>

            {/* Background Layer */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
                <div className="absolute inset-0 bg-grid opacity-20 mask-image-gradient"></div>
                <div className="absolute top-[-20%] left-[-10%] w-[1000px] h-[1000px] rounded-full bg-blue-600/10 blur-[120px] animate-pulse"></div>
                <div className="absolute bottom-[-20%] right-[-10%] w-[800px] h-[800px] rounded-full bg-indigo-600/10 blur-[120px] animate-pulse delay-1000"></div>
            </div>

            {/* Navigation */}
            <nav className="fixed top-0 left-0 right-0 z-50 w-full px-6 py-4 bg-[#0f172a]/80 backdrop-blur-md border-b border-white/5 transition-all">
                <div className="max-w-7xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-gradient-to-tr from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-500/20">
                            <Globe className="w-5 h-5 text-white" />
                        </div>
                        <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-200 via-white to-indigo-200">
                            Travel Planner
                        </span>
                    </div>
                    <button
                        onClick={onLoginClick}
                        className="px-5 py-2 rounded-full bg-white/10 hover:bg-white/20 border border-white/10 backdrop-blur-sm transition-all text-sm font-medium hover:scale-105 active:scale-95"
                    >
                        Sign In
                    </button>
                </div>
            </nav>

            {/* Hero Section */}
            <section className="relative z-10 pt-32 pb-20 px-6 flex flex-col items-center text-center max-w-6xl mx-auto">

                {/* Floating Tag */}
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-bold uppercase tracking-wider mb-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
                    <Sparkles className="w-3 h-3" />
                    <span>AI-Powered Itinerary Generation</span>
                </div>

                {/* Main Title */}
                <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-8 leading-tight animate-in fade-in slide-in-from-bottom-8 duration-700 delay-100 drop-shadow-2xl">
                    Design Your <br />
                    <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-indigo-300 to-purple-400">
                        Perfect Journey
                    </span>
                </h1>

                {/* Subtitle */}
                <p className="text-lg md:text-xl text-gray-400 max-w-2xl mb-10 leading-relaxed animate-in fade-in slide-in-from-bottom-8 duration-700 delay-200">
                    Say goodbye to stressful planning. Let AI craft personalized itineraries in seconds, complete with local gems, optimized routes, and detailed maps.
                </p>

                {/* Action Buttons */}
                <div className="flex flex-col sm:flex-row items-center gap-4 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-300 z-20">
                    <button
                        onClick={onLoginClick}
                        className="group px-8 py-4 rounded-full bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold shadow-lg shadow-indigo-500/25 transition-all transform hover:scale-105 hover:-translate-y-1 flex items-center gap-2"
                    >
                        Start Planning Free
                        <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </button>

                    <button
                        className="px-8 py-4 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 backdrop-blur-sm text-gray-300 transition-all font-medium hover:text-white flex items-center gap-2"
                        onClick={() => {
                            const features = document.getElementById('features');
                            features?.scrollIntoView({ behavior: 'smooth' });
                        }}
                    >
                        <span className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
                            <ArrowRight className="w-4 h-4 rotate-90" />
                        </span>
                        How it Works
                    </button>
                </div>

                {/* 3D Tilted Hero Visual */}
                <div className="mt-16 w-full max-w-5xl perspective-1000 animate-in fade-in zoom-in duration-1000 delay-500">
                    <div className="relative group transition-all duration-700 transform hover:rotate-0 rotate-x-12 hover:scale-[1.02]">
                        <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl blur opacity-30 group-hover:opacity-70 transition duration-1000 group-hover:duration-200"></div>
                        <div className="relative rounded-xl overflow-hidden bg-[#1e293b] border border-white/10 shadow-2xl">
                            {/* Mock UI Header/Browser Bar */}
                            <div className="h-10 bg-[#0f172a] border-b border-white/5 flex items-center px-4 gap-2">
                                <div className="flex gap-1.5">
                                    <div className="w-3 h-3 rounded-full bg-red-500/80"></div>
                                    <div className="w-3 h-3 rounded-full bg-yellow-500/80"></div>
                                    <div className="w-3 h-3 rounded-full bg-green-500/80"></div>
                                </div>
                                <div className="bg-[#1e293b] rounded-md px-3 py-1 flex items-center justify-center flex-1 mx-4 max-w-md text-xs text-gray-500 font-mono">
                                    travel-planner.ai/dashboard
                                </div>
                            </div>

                            {/* Mock Content */}
                            <div className="flex flex-col md:flex-row h-[400px]">
                                {/* Sidebar Mock */}
                                <div className="w-64 bg-[#0f172a]/50 p-4 border-r border-white/5 hidden md:block">
                                    <div className="space-y-3">
                                        <div className="h-20 bg-indigo-500/20 rounded-lg animate-pulse"></div>
                                        <div className="h-20 bg-white/5 rounded-lg"></div>
                                        <div className="h-20 bg-white/5 rounded-lg"></div>
                                    </div>
                                </div>
                                {/* Map Mock */}
                                <div className="flex-1 relative bg-[#111827] overflow-hidden">
                                    {/* Map Grid Pattern */}
                                    <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle, #6366f1 1px, transparent 1px)', backgroundSize: '20px 20px' }}></div>

                                    {/* Decorative Map Lines */}
                                    <svg className="absolute inset-0 w-full h-full opacity-30 pointer-events-none" viewBox="0 0 400 400" preserveAspectRatio="none">
                                        {/* Main Route */}
                                        <path d="M100 100 Q 200 150 240 120 T 340 180" fill="none" stroke="#6366f1" strokeWidth="3" strokeDasharray="6 4" />
                                        {/* Secondary Paths */}
                                        <path d="M100 100 L 50 120" fill="none" stroke="#94a3b8" strokeWidth="1" opacity="0.5" />
                                        <path d="M240 120 L 280 80" fill="none" stroke="#94a3b8" strokeWidth="1" opacity="0.5" />
                                        <path d="M340 180 L 380 200" fill="none" stroke="#94a3b8" strokeWidth="1" opacity="0.5" />
                                        {/* Street Grid Hints */}
                                        <path d="M50 50 H 350" fill="none" stroke="#ffffff" strokeWidth="0.5" opacity="0.1" />
                                        <path d="M50 150 H 350" fill="none" stroke="#ffffff" strokeWidth="0.5" opacity="0.1" />
                                        <path d="M50 250 H 350" fill="none" stroke="#ffffff" strokeWidth="0.5" opacity="0.1" />
                                        <path d="M50 350 H 350" fill="none" stroke="#ffffff" strokeWidth="0.5" opacity="0.1" />
                                        <path d="M100 50 V 350" fill="none" stroke="#ffffff" strokeWidth="0.5" opacity="0.1" />
                                        <path d="M200 50 V 350" fill="none" stroke="#ffffff" strokeWidth="0.5" opacity="0.1" />
                                        <path d="M300 50 V 350" fill="none" stroke="#ffffff" strokeWidth="0.5" opacity="0.1" />
                                    </svg>
                                    {/* Floating Markers */}
                                    <div className="absolute top-1/4 left-1/4 animate-bounce delay-0">
                                        <MapPin className="w-8 h-8 text-indigo-400 drop-shadow-[0_0_10px_rgba(99,102,241,0.5)]" />
                                    </div>
                                    <div className="absolute top-[30%] left-[60%] animate-bounce delay-700">
                                        <MapPin className="w-8 h-8 text-purple-400 drop-shadow-[0_0_10px_rgba(168,85,247,0.5)]" />
                                    </div>
                                    <div className="absolute top-[45%] right-[15%] animate-bounce delay-300">
                                        <MapPin className="w-8 h-8 text-teal-400 drop-shadow-[0_0_10px_rgba(20,184,166,0.5)]" />
                                    </div>
                                    {/* Floating Card Overlay */}
                                    <div className="absolute bottom-8 left-8 right-8 bg-[#1e293b]/90 backdrop-blur-md p-4 rounded-xl border border-white/10 animate-float shadow-xl">
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 bg-indigo-500/20 rounded-lg flex items-center justify-center">
                                                <Sparkles className="w-6 h-6 text-indigo-400" />
                                            </div>
                                            <div className="flex-1">
                                                <div className="h-3 w-3/4 bg-white/20 rounded mb-2"></div>
                                                <div className="h-2 w-1/2 bg-white/10 rounded"></div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

            </section>

            {/* Infinite Scroll Marquee (Destinations) */}
            <section id="gallery-marquee" className="py-12 border-y border-white/5 bg-[#0f172a]/50 backdrop-blur-sm overflow-hidden relative z-20">
                <div className="w-full inline-flex flex-nowrap overflow-hidden">
                    <div className="flex items-center gap-8 animate-scroll pl-8">
                        <DestinationCard icon={<Landmark />} name="Tokyo" tag="Culture" color="text-red-400" />
                        <DestinationCard icon={<Heart />} name="Paris" tag="Romance" color="text-blue-400" />
                        <DestinationCard icon={<Crown />} name="London" tag="History" color="text-purple-400" />
                        <DestinationCard icon={<Building2 />} name="New York" tag="Urban" color="text-yellow-400" />
                        <DestinationCard icon={<Gem />} name="Dubai" tag="Luxury" color="text-orange-400" />
                        <DestinationCard icon={<Mountain />} name="Iceland" tag="Nature" color="text-teal-400" />
                        <DestinationCard icon={<Utensils />} name="Bangkok" tag="Food" color="text-pink-400" />
                        {/* Duplicate for seamless loop */}
                        <DestinationCard icon={<Landmark />} name="Tokyo" tag="Culture" color="text-red-400" />
                        <DestinationCard icon={<Heart />} name="Paris" tag="Romance" color="text-blue-400" />
                        <DestinationCard icon={<Crown />} name="London" tag="History" color="text-purple-400" />
                        <DestinationCard icon={<Building2 />} name="New York" tag="Urban" color="text-yellow-400" />
                        <DestinationCard icon={<Gem />} name="Dubai" tag="Luxury" color="text-orange-400" />
                        <DestinationCard icon={<Mountain />} name="Iceland" tag="Nature" color="text-teal-400" />
                        <DestinationCard icon={<Utensils />} name="Bangkok" tag="Food" color="text-pink-400" />
                    </div>
                </div>
            </section>

            {/* Features Grid */}
            <section id="features" className="relative z-10 py-32 px-6">
                <div className="max-w-7xl mx-auto">
                    <div className="text-center mb-20">
                        <h2 className="text-3xl md:text-5xl font-bold mb-6 bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">
                            Why Travelers Love Us
                        </h2>
                        <p className="text-gray-400 text-lg max-w-2xl mx-auto">
                            We combine advanced AI with intuitive design to solve the chaos of trip planning.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        <FeatureCard
                            icon={<Sparkles className="w-8 h-8 text-yellow-400" />}
                            title="Smart Generation"
                            description="Our AI considers your budget, pace, and interests to build the perfect schedule in seconds."
                        />
                        <FeatureCard
                            icon={<Cloud className="w-8 h-8 text-blue-400" />}
                            title="Cloud Sync"
                            description="Switch between your phone and laptop seamlessly. Your plans are always backed up."
                        />
                        <FeatureCard
                            icon={<Users className="w-8 h-8 text-pink-400" />}
                            title="Real-time Collaboration"
                            description="Invite friends to your trip. Edit the itinerary together and vote on destinations."
                        />
                    </div>
                </div>
            </section>

            {/* Smart Tools Section */}
            <section className="relative z-10 py-24 px-6 border-t border-white/5 bg-white/[0.02]">
                <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center gap-16">
                    <div className="flex-1 space-y-8">
                        <h2 className="text-3xl md:text-4xl font-bold leading-tight">
                            Smart tools for <br />
                            <span className="text-indigo-400">smart travelers</span>
                        </h2>
                        <div className="space-y-4">
                            <CheckItem text="Interactive Maps & Navigation Links" />
                            <CheckItem text="Budget Estimator & Expense Tracking" />
                            <CheckItem text="Smart Risk Alerts & Safety Tips" />
                            <CheckItem text="Personalized AI Travel Assistant" />
                        </div>
                        <button
                            onClick={onLoginClick}
                            className="px-6 py-3 rounded-lg bg-white/10 hover:bg-white/20 border border-white/10 text-white font-medium transition-colors"
                        >
                            Try it yourself
                        </button>
                    </div>

                    <div className="flex-1 w-full relative">
                        <div className="absolute -inset-4 bg-gradient-to-r from-blue-500/20 to-purple-500/20 rounded-2xl blur-xl"></div>
                        <div className="relative bg-[#1e293b]/80 backdrop-blur-md border border-white/10 rounded-2xl p-6 md:p-8">
                            <div className="flex items-start gap-4 mb-6">
                                <div className="w-12 h-12 rounded-xl bg-indigo-500/20 flex items-center justify-center flex-shrink-0">
                                    <Calendar className="w-6 h-6 text-indigo-400" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold">Day 1: Tokyo Exploration</h3>
                                    <p className="text-sm text-gray-400">09:00 AM - Senso-ji Temple</p>
                                </div>
                            </div>
                            <div className="space-y-3">
                                <div className="h-16 rounded-lg bg-white/5 border border-white/5 p-3 flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-orange-500/20 flex items-center justify-center">
                                        <span className="text-xs">🍜</span>
                                    </div>
                                    <div className="flex-1">
                                        <div className="h-2 w-24 bg-white/20 rounded mb-1.5"></div>
                                        <div className="h-1.5 w-16 bg-white/10 rounded"></div>
                                    </div>
                                </div>
                                <div className="h-16 rounded-lg bg-white/5 border border-white/5 p-3 flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
                                        <span className="text-xs">🌳</span>
                                    </div>
                                    <div className="flex-1">
                                        <div className="h-2 w-32 bg-white/20 rounded mb-1.5"></div>
                                        <div className="h-1.5 w-20 bg-white/10 rounded"></div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Footer CTA (Premium Design) */}
            <section className="relative py-16 sm:py-24 md:py-32 px-4 sm:px-6 flex justify-center overflow-hidden">
                <div className="w-full max-w-5xl relative">

                    {/* Ambient Glows Behind Card */}
                    <div className="absolute top-1/2 left-1/4 w-48 sm:w-96 h-48 sm:h-96 bg-blue-500/20 rounded-full blur-[80px] sm:blur-[100px] -translate-y-1/2 pointer-events-none"></div>
                    <div className="absolute top-1/2 right-1/4 w-48 sm:w-96 h-48 sm:h-96 bg-purple-500/20 rounded-full blur-[80px] sm:blur-[100px] -translate-y-1/2 pointer-events-none"></div>

                    {/* Main Card Container */}
                    <div className="relative overflow-hidden bg-white/5 backdrop-blur-3xl rounded-2xl sm:rounded-[2.5rem] border border-white/10 p-6 sm:p-12 md:p-24 text-center shadow-2xl shadow-indigo-500/10 group">

                        {/* Dynamic Background Effects */}
                        <div className="absolute inset-0 bg-grid opacity-10 pointer-events-none"></div>
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-in-out pointer-events-none"></div>

                        {/* Content */}
                        <div className="relative z-10 flex flex-col items-center">
                            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-sm font-medium mb-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
                                <Sparkles className="w-4 h-4" />
                                <span>Start Your Journey Today</span>
                            </div>

                            <h2 className="text-3xl sm:text-5xl md:text-7xl font-bold mb-6 sm:mb-8 leading-tight tracking-tight">
                                Ready for your next <br />
                                <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-indigo-300 to-purple-400 animate-pulse">
                                    adventure?
                                </span>
                            </h2>

                            <p className="text-slate-400 text-base sm:text-lg md:text-xl max-w-2xl mb-8 sm:mb-10 leading-relaxed">
                                Join thousands of modern explorers who are traveling smarter, not harder. Experience the future of trip planning.
                            </p>

                            <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6">
                                <button
                                    onClick={onLoginClick}
                                    className="w-full sm:w-auto px-8 sm:px-10 py-4 sm:py-5 rounded-full bg-white text-[#0f172a] font-bold text-base sm:text-lg shadow-[0_0_20px_rgba(255,255,255,0.3)] hover:shadow-[0_0_30px_rgba(255,255,255,0.5)] hover:scale-105 active:scale-95 transition-all duration-300 flex items-center justify-center gap-2 group/btn"
                                >
                                    Get Started Free
                                    <ArrowRight className="w-5 h-5 group-hover/btn:translate-x-1 transition-transform" />
                                </button>

                                <span className="text-sm text-slate-500 font-medium">
                                    No credit card required
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className="relative z-10 py-12 text-center text-gray-500 text-sm bg-[#0f172a] border-t border-white/5">
                <p>© 2026 TravelPlanner.AI · Engineered for Modern Explorers</p>
                <div className="flex justify-center gap-6 mt-4">
                    <a href="#" className="hover:text-indigo-400 transition-colors">Privacy</a>
                    <a href="#" className="hover:text-indigo-400 transition-colors">Terms</a>
                    <a href="#" className="hover:text-indigo-400 transition-colors">Contact</a>
                </div>
            </footer>
        </div>
    );
}

function DestinationCard({ icon, name, tag, color }: { icon: React.ReactElement<{ className?: string }>, name: string, tag: string, color: string }) {
    return (
        <div className="w-64 h-36 flex-shrink-0 relative group cursor-pointer overflow-hidden rounded-2xl bg-white/[0.03] hover:bg-white/[0.08] border border-white/5 transition-all duration-300 hover:-translate-y-1">
            <div className={`absolute top-3 right-3 opacity-30 group-hover:opacity-100 transition-opacity duration-300 ${color}`}>
                <ArrowRight className="w-4 h-4 -rotate-45" />
            </div>

            <div className={`absolute -bottom-6 -right-6 ${color} opacity-[0.03] group-hover:opacity-10 transition-opacity duration-500 transform rotate-12 scale-[2.5]`}>
                {React.cloneElement(icon, { className: "w-24 h-24" })}
            </div>

            <div className="h-full flex flex-col justify-between p-5 relative z-10">
                <div className={`w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center backdrop-blur-sm group-hover:scale-110 transition-transform duration-300 ${color} bg-opacity-20`}>
                    {React.cloneElement(icon, { className: "w-5 h-5" })}
                </div>

                <div>
                    <h4 className="font-bold text-lg text-white mb-1 group-hover:text-blue-100 transition-colors">{name}</h4>
                    <span className={`text-xs font-bold tracking-widest uppercase ${color}`}>{tag}</span>
                </div>
            </div>
        </div>
    )
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode, title: string, description: string }) {
    return (
        <div className="p-8 rounded-3xl bg-white/[0.03] border border-white/5 hover:border-indigo-500/30 hover:bg-white/[0.07] transition-all duration-300 group hover:-translate-y-2">
            <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mb-6 group-hover:scale-110 group-hover:bg-indigo-500/20 transition-all duration-300 shadow-lg">
                {icon}
            </div>
            <h3 className="text-2xl font-bold mb-4 bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-300 group-hover:to-white">
                {title}
            </h3>
            <p className="text-gray-400 leading-relaxed">
                {description}
            </p>
        </div>
    )
}

function CheckItem({ text }: { text: string }) {
    return (
        <div className="flex items-center gap-3">
            <div className="w-5 h-5 rounded-full bg-teal-500/20 flex items-center justify-center flex-shrink-0">
                <CheckCircle2 className="w-3.5 h-3.5 text-teal-400" />
            </div>
            <span className="text-gray-300">{text}</span>
        </div>
    )
}
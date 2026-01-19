
import React from 'react';
import { GoogleLogin } from '@react-oauth/google';
import { useAuth } from '../context/AuthContext';
import { Plane, Map, Compass } from 'lucide-react';

export default function LoginScreen() {
    const { login } = useAuth();

    const handleSuccess = (credentialResponse: any) => {
        if (credentialResponse.credential) {
            login(credentialResponse.credential);
        }
    };

    const handleError = () => {
        console.error('Login Failed');
    };

    return (
        <div className="min-h-screen w-full relative overflow-hidden flex items-center justify-center bg-[#0f172a]">
            {/* Dynamic Background Elements */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0">
                <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] rounded-full bg-blue-500/20 blur-[100px] animate-pulse"></div>
                <div className="absolute bottom-[-10%] right-[-10%] w-[600px] h-[600px] rounded-full bg-indigo-500/20 blur-[120px] animate-pulse delay-1000"></div>
                <div className="absolute top-[40%] left-[60%] w-[300px] h-[300px] rounded-full bg-teal-500/10 blur-[80px]"></div>
            </div>

            {/* Glassmorphism Card */}
            <div className="relative z-10 bg-white/5 backdrop-blur-xl border border-white/10 p-12 rounded-3xl shadow-2xl max-w-md w-full text-center flex flex-col items-center gap-8">

                {/* Logo / Icon */}
                <div className="relative w-24 h-24 mb-4">
                    <div className="absolute inset-0 bg-gradient-to-tr from-blue-400 to-indigo-500 rounded-2xl rotate-6 opacity-80 blur-lg"></div>
                    <div className="absolute inset-0 bg-gradient-to-tr from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg">
                        <Plane className="w-12 h-12 text-white" />
                    </div>

                    {/* Floating decorative icons */}
                    <div className="absolute -top-4 -right-4 bg-white/10 backdrop-blur-md p-2 rounded-lg border border-white/20 animate-bounce">
                        <Map className="w-5 h-5 text-teal-300" />
                    </div>
                    <div className="absolute -bottom-2 -left-4 bg-white/10 backdrop-blur-md p-2 rounded-lg border border-white/20 animate-bounce delay-700">
                        <Compass className="w-5 h-5 text-indigo-300" />
                    </div>
                </div>

                {/* Title */}
                <div className="space-y-2">
                    <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-200 via-white to-indigo-200">
                        AI Travel Planner
                    </h1>
                    <p className="text-gray-400 text-sm tracking-wide uppercase">
                        Design Your Perfect Journey
                    </p>
                </div>

                {/* Description */}
                <p className="text-gray-300 leading-relaxed">
                    Experience intelligent itinerary crafting. Sign in to access your personalized travel dashboard.
                </p>

                {/* Login Button Wrapper */}
                <div className="mt-4 w-full flex justify-center transform hover:scale-105 transition-transform duration-300">
                    <GoogleLogin
                        onSuccess={handleSuccess}
                        onError={handleError}
                        theme="filled_black"
                        shape="pill"
                        size="large"
                        width={280}
                    />
                </div>

                <p className="text-xs text-gray-500 mt-6">
                    Made By Jason Hong
                </p>

            </div>
        </div>
    );
}

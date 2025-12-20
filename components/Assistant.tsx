import React, { useState, useRef, useEffect } from 'react';
import { MessageCircle, Send, X, Bot, Sparkles, Loader2 } from 'lucide-react';
import { Message } from '../types';

interface Props {
  onUpdate: (history: Message[], onThought: (text: string) => void) => Promise<string | void>;
  isGenerating: boolean;
}

// Simple Markdown-ish renderer for chat messages
// Handles **bold** and * lists
const MessageContent = ({ text }: { text: string }) => {
  // Simple bold parser
  const parseBold = (str: string) => {
    // Split by **...**
    const parts = str.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i} className="font-bold text-gray-900">{part.slice(2, -2)}</strong>;
      }
      return part;
    });
  };

  const lines = text.split('\n');
  return (
    <div className="space-y-1">
      {lines.map((line, i) => {
        const trimmed = line.trim();
        // Check for list items
        if (trimmed.startsWith('* ') || trimmed.startsWith('- ')) {
           return (
             <div key={i} className="flex items-start gap-2 ml-2">
               <span className="mt-2 w-1 h-1 bg-current rounded-full flex-shrink-0 opacity-60" />
               <span className="leading-relaxed">{parseBold(trimmed.substring(2))}</span>
             </div>
           );
        }
        // Empty lines for spacing
        if (trimmed === '') return <div key={i} className="h-2" />;
        
        // Regular text
        return <div key={i} className="leading-relaxed">{parseBold(line)}</div>;
      })}
    </div>
  );
};

export default function Assistant({ onUpdate, isGenerating }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    { role: 'model', text: "嗨！我是您的 AI 旅遊貼身助理。對某天行程不滿意？想換家餐廳？告訴我，我馬上為您調整。", timestamp: Date.now() }
  ]);
  const [loading, setLoading] = useState(false);
  const [thinkingText, setThinkingText] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isOpen, thinkingText]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userText = input;
    setInput('');
    setLoading(true);
    setThinkingText('');
    
    // Add User Message locally first
    const newHistory = [...messages, { role: 'user', text: userText, timestamp: Date.now() } as Message];
    setMessages(newHistory);

    try {
      // Call Parent Handler with full history and thought callback
      // The parent returns the AI's final text response (if it was a chat) OR void (if it updated the trip, we usually get a confirmation text)
      const finalText = await onUpdate(newHistory, (text) => {
        setThinkingText(text);
      });

      if (finalText) {
          setMessages(prev => [...prev, { role: 'model', text: finalText, timestamp: Date.now() }]);
      } else {
          // Fallback if no text returned but update happened (shouldn't happen with new logic, but safe)
          setMessages(prev => [...prev, { role: 'model', text: "行程已更新！", timestamp: Date.now() }]);
      }

    } catch (error) {
       setMessages(prev => {
        return [...prev, { role: 'model', text: "抱歉，更新行程時發生錯誤，請稍後再試。", timestamp: Date.now() }];
      });
    } finally {
      setLoading(false);
      setThinkingText('');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
      {isOpen && (
        <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 w-80 md:w-96 h-[500px] mb-4 flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-10 duration-200">
          {/* Header */}
          <div className="bg-gradient-to-r from-brand-600 to-brand-500 p-4 flex justify-between items-center text-white">
            <div className="flex items-center gap-2">
              <div className="bg-white/20 p-1.5 rounded-lg">
                <Sparkles className="w-5 h-5 text-yellow-300" />
              </div>
              <div>
                <h3 className="font-bold text-sm">旅遊貼身助理</h3>
                <p className="text-xs text-brand-100">AI 智慧調整</p>
              </div>
            </div>
            <button onClick={() => setIsOpen(false)} className="hover:bg-white/20 p-1 rounded transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div 
                  className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm shadow-sm ${
                    msg.role === 'user' 
                      ? 'bg-brand-600 text-white rounded-br-none' 
                      : 'bg-white text-gray-800 border border-gray-200 rounded-bl-none'
                  }`}
                >
                  {msg.role === 'model' ? <MessageContent text={msg.text} /> : msg.text}
                </div>
              </div>
            ))}

            {/* Thinking Bubble */}
            {loading && (
              <div className="flex justify-start">
                <div className="max-w-[90%] bg-gray-100 text-gray-700 border border-gray-200 rounded-2xl rounded-bl-none px-4 py-3 text-sm shadow-sm">
                   {thinkingText ? (
                      <div className="animate-in fade-in duration-300">
                        <div className="flex items-center gap-2 mb-2 text-brand-600 font-bold text-xs uppercase tracking-wide">
                           <Loader2 className="w-3 h-3 animate-spin" />
                           思考中...
                        </div>
                        <MessageContent text={thinkingText} />
                      </div>
                   ) : (
                      <div className="flex items-center gap-2 text-gray-500">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>正在分析您的需求...</span>
                      </div>
                   )}
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <div className="p-3 bg-white border-t border-gray-200">
            <div className="relative flex items-center">
              <input
                type="text"
                className="w-full pl-4 pr-12 py-3 bg-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 transition-all"
                placeholder="輸入您想調整的內容..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyPress}
                disabled={loading}
              />
              <button 
                onClick={handleSend}
                disabled={loading || !input.trim()}
                className="absolute right-2 p-1.5 bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-50 disabled:hover:bg-brand-600 transition-colors"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toggle Button */}
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="group flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white px-4 py-3 rounded-full shadow-lg transition-all hover:scale-105 active:scale-95"
      >
        <div className="relative">
          <Bot className="w-6 h-6" />
          <span className="absolute -top-1 -right-1 flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
          </span>
        </div>
        <span className="font-medium pr-1">AI 助手</span>
      </button>
    </div>
  );
}
import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { Bot, X, Send, Sparkles, User, Loader2, Maximize2, Minimize2, Lock } from 'lucide-react';
import { Message } from '../types';
import { safeRender } from '../utils/formatters';
import { usePoints } from '../context/PointsContext';

interface NewProps {
  onUpdate: (history: Message[], onThought: (text: string) => void) => Promise<string>;
  isGenerating?: boolean; // Parent controls loading state if needed
}

const MarkdownComponents = {
  p: ({ children }: any) => <p className="mb-3 last:mb-0 leading-7 text-[15px] text-gray-700 font-normal">{children}</p>,
  ul: ({ children, ...props }: any) => <ul {...props} className="mb-4 pl-6 space-y-2 list-disc marker:text-brand-300">{children}</ul>,
  ol: ({ children, ...props }: any) => <ol {...props} className="mb-4 pl-6 space-y-2 list-decimal marker:text-brand-600 marker:font-bold">{children}</ol>,
  strong: ({ children }: any) => <span className="font-semibold text-gray-900 bg-brand-50/50 px-1 rounded mx-0.5">{children}</span>,
  h1: ({ children }: any) => <h1 className="text-lg font-bold text-gray-900 mt-6 mb-3 pb-2 border-b border-gray-100 flex items-center gap-2"><Sparkles className="w-4 h-4 text-brand-500" />{children}</h1>,
  h2: ({ children }: any) => <h2 className="text-base font-bold text-brand-700 mt-5 mb-2 flex items-center gap-2">{children}</h2>,
  h3: ({ children }: any) => <h3 className="text-sm font-bold text-gray-800 mt-4 mb-2 uppercase tracking-wider">{children}</h3>,
  blockquote: ({ children }: any) => <blockquote className="border-l-4 border-brand-200 pl-4 py-2 my-3 bg-gray-50/50 italic text-gray-600 rounded-r text-sm">{children}</blockquote>,
  code: ({ children }: any) => <code className="bg-gray-100 text-brand-600 px-1.5 py-0.5 rounded text-xs font-mono border border-gray-200 font-medium">{children}</code>,
  a: ({ children, href }: any) => <a href={href} target="_blank" rel="noopener noreferrer" className="text-brand-600 hover:text-brand-700 underline underline-offset-2 decoration-brand-200/50 hover:decoration-brand-500 transition-all font-medium">{children}</a>
};

export default function Assistant({ onUpdate, isGenerating: parentIsGenerating = false }: NewProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { role: 'model', text: '嗨！我是您的 AI 旅遊助理。想要調整行程、尋找餐廳，或是有任何旅行問題，都可以問我喔！', timestamp: Date.now() }
  ]);
  const [input, setInput] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [currentThought, setCurrentThought] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const { isSubscribed, openPurchaseModal } = usePoints();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isThinking, currentThought, isOpen]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen && isSubscribed) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 300);
    }
  }, [isOpen, isSubscribed]);

  // ... (handleSubmit and handleKeyDown remain same, but check isSubscribed)
  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || isThinking || !isSubscribed) return;

    const userMsg: Message = { role: 'user', text: input.trim(), timestamp: Date.now() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsThinking(true);
    setCurrentThought(''); // Changed from '正在思考中...'

    try {
      const newHistory = [...messages, userMsg];
      const responseText = await onUpdate(newHistory, (thought) => {
        setCurrentThought(thought);
      });

      // Add model response
      setMessages(prev => [...prev, {
        role: 'model',
        text: responseText,
        timestamp: Date.now()
      }]);
    } catch (error) {
      console.error(error);
      setMessages(prev => [...prev, {
        role: 'model',
        text: '抱歉，我現在有點累，請稍後再試。',
        timestamp: Date.now()
      }]);
    } finally {
      setIsThinking(false);
      setCurrentThought('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-50 bg-gradient-to-r from-brand-600 to-sky-600 hover:from-brand-500 hover:to-sky-500 text-white p-4 rounded-full shadow-lg shadow-brand-200 transition-all hover:scale-110 group"
      >
        <Bot className="w-8 h-8 group-hover:rotate-12 transition-transform" />
        <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs px-2 py-0.5 rounded-full animate-bounce">
          Beta
        </span>
      </button>
    );
  }

  return (
    <div className={`fixed z-[60] bg-white shadow-2xl transition-all duration-300 flex flex-col overflow-hidden border border-gray-100 font-sans
            ${isExpanded
        ? 'inset-4 md:inset-10 rounded-2xl'
        : 'bottom-6 right-6 w-[90vw] md:w-[450px] h-[600px] md:max-h-[80vh] rounded-2xl'
      }
        `}>
      {/* Header */}
      <div className="bg-gradient-to-r from-brand-600 to-sky-600 p-4 flex items-center justify-between text-white shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-white/20 rounded-lg">
            <Bot className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-bold text-lg">AI 旅遊顧問</h3>
            <p className="text-white/80 text-xs flex items-center gap-1">
              <Sparkles className="w-3 h-3" />
              {isThinking ? '正在思考中...' : '隨時為您服務'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-2 hover:bg-white/10 rounded-full transition-colors hidden md:block"
            title={isExpanded ? "縮小視窗" : "全螢幕"}
          >
            {isExpanded ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
          </button>
          <button
            onClick={() => setIsOpen(false)}
            className="p-2 hover:bg-white/10 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Content Gate */}
      {!isSubscribed ? (
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-gray-50">
          <div className="w-20 h-20 bg-gradient-to-tr from-brand-200 to-sky-200 rounded-full flex items-center justify-center mb-6 relative">
            <Bot className="w-10 h-10 text-brand-700" />
            <div className="absolute -bottom-2 -right-2 bg-white p-2 rounded-full shadow-md">
              <Lock className="w-5 h-5 text-gray-400" />
            </div>
          </div>
          <h3 className="text-2xl font-black text-gray-900 mb-2">解鎖您的專屬助理</h3>
          <p className="text-gray-500 mb-8 max-w-xs leading-relaxed">
            升級成為 <span className="font-bold text-brand-600">旅遊貼身助理</span> 會員，即可享有無限次 AI 行程調整與即時諮詢服務。
          </p>
          <button
            onClick={openPurchaseModal}
            className="w-full py-4 bg-brand-600 hover:bg-brand-700 text-white font-bold rounded-xl shadow-lg shadow-brand-200 hover:shadow-xl hover:-translate-y-1 transition-all flex items-center justify-center gap-2"
          >
            <Sparkles className="w-5 h-5" />
            查看升級方案
          </button>
        </div>
      ) : (
        <>
          {/* Custom Markdown Styles for AI Responses */}


          {/* Chat Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-6 bg-slate-50/80 scroll-smooth">
            {messages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
              >
                {/* Avatar */}
                <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 shadow-sm border border-white
                                    ${msg.role === 'user'
                    ? 'bg-gradient-to-br from-gray-100 to-gray-200'
                    : 'bg-gradient-to-br from-brand-50 to-brand-100 text-brand-600'
                  }
                                `}>
                  {msg.role === 'user' ? <User className="w-5 h-5 text-gray-600" /> : <Bot className="w-5 h-5" />}
                </div>

                {/* Message Bubble */}
                <div className={`max-w-[85%] rounded-2xl p-5 shadow-sm transition-all
                                    ${msg.role === 'user'
                    ? 'bg-gradient-to-br from-brand-600 to-brand-500 text-white rounded-tr-none shadow-brand-100'
                    : 'bg-white text-gray-800 border border-gray-100 rounded-tl-none shadow-sm'
                  }
                                `}>

                  {/* Content Renderer */}
                  <div className={`text-[15px] leading-relaxed ${msg.role === 'user' ? 'text-white' : ''}`}>
                    {msg.role === 'user' ? (
                      <p className="whitespace-pre-wrap">{msg.text}</p>
                    ) : (
                      <ReactMarkdown components={MarkdownComponents}>
                        {String(msg.text || '')}
                      </ReactMarkdown>
                    )}
                  </div>

                  {/* Timestamp */}
                  <div className={`text-[10px] mt-2 opacity-60 flex items-center gap-1 ${msg.role === 'user' ? 'justify-end text-brand-100' : 'justify-start text-gray-400'}`}>
                    {msg.role === 'model' && <Sparkles className="w-2 h-2" />}
                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>
            ))}

            {/* Streaming Message (Real-time) */}
            {isThinking && (
              <div className="flex gap-3 flex-row animate-in fade-in duration-300 items-start">
                {/* Avatar - Always visible */}
                <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 shadow-sm border border-white bg-gradient-to-br from-brand-50 to-brand-100 text-brand-600">
                  <Bot className="w-5 h-5 animate-pulse" />
                </div>

                {!currentThought ? (
                  // State 1: WAITING (Modern Premium UI)
                  <div className="flex items-center gap-3 px-4 py-3 bg-white border border-brand-100/50 rounded-2xl rounded-tl-none shadow-sm">
                    <div className="relative flex items-center justify-center w-5 h-5">
                      <div className="absolute inset-0 bg-brand-400 rounded-full animate-ping opacity-20 duration-1000"></div>
                      <Sparkles className="relative z-10 w-4 h-4 text-brand-500 animate-pulse duration-1000" />
                    </div>
                    <span className="text-sm font-medium text-gray-500">正在為您規劃行程</span>
                  </div>
                ) : (
                  // State 2: STREAMING (Full Bubble)
                  <div className="max-w-[85%] rounded-2xl p-5 shadow-sm bg-white text-gray-800 border border-gray-100 rounded-tl-none shadow-brand-50/50">
                    <div className="text-[15px] leading-relaxed min-h-[24px]">
                      <ReactMarkdown components={MarkdownComponents}>
                        {currentThought}
                      </ReactMarkdown>
                      <span className="inline-block w-2 h-4 ml-1 align-middle bg-brand-400 animate-pulse rounded-full"></span>
                    </div>
                  </div>
                )}
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="p-4 bg-white border-t border-gray-100">
            <div className="relative">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="輸入訊息..."
                disabled={isThinking}
                className="w-full pl-4 pr-12 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none resize-none h-[52px] max-h-32 min-h-[52px] [&::-webkit-scrollbar]:hidden"
              />
              <button
                onClick={() => handleSubmit()}
                disabled={!input.trim() || isThinking}
                className="absolute right-2 top-1.5 p-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {isThinking ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
              </button>
            </div>
            <div className="text-center mt-2">
              <p className="text-[10px] text-gray-400 flex items-center justify-center gap-1">
                <Sparkles className="w-3 h-3" />
                AI 可能會產生不準確的資訊，請以實際情況為準
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
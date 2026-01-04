import React, { useState, useEffect, useRef } from 'react';
import { Character, Message, UserPersona } from '../types';
import { chatWithCharacter, speakText, transcribeAudio, generateActionScene, processTimeSkip, evolveCharacterVisuals } from '../services/geminiService';
import { decodeAudioData, playAudioBuffer, blobToBase64 } from '../services/audioUtils';
import UserSetup from './UserSetup';

interface Props {
  sessionId: string;
  initialCharacter: Character;
  initialUserPersona: UserPersona | null;
  initialMessages: Message[];
  onSessionUpdate: (messages: Message[], character: Character, user: UserPersona | null) => void;
}

// Optimized Image Component
const ChatImage = React.memo(({ src, alt }: { src: string, alt: string }) => (
    <div className="mt-3 rounded-lg overflow-hidden border border-gray-700 bg-gray-900">
        <img 
            src={`data:image/jpeg;base64,${src}`} 
            alt={alt} 
            className="w-full h-auto" 
            loading="lazy"
            decoding="async"
        />
    </div>
));

const ChatArea: React.FC<Props> = ({ 
    sessionId, 
    initialCharacter, 
    initialUserPersona, 
    initialMessages, 
    onSessionUpdate 
}) => {
  // Local active state
  const [activeCharacter, setActiveCharacter] = useState<Character>(initialCharacter);
  const [activeUserPersona, setActiveUserPersona] = useState<UserPersona | null>(initialUserPersona);
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  
  const [inputText, setInputText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [autoPlayTTS, setAutoPlayTTS] = useState(true);
  
  // Game State
  const [isDead, setIsDead] = useState(false);
  const [showTimeSkipInput, setShowTimeSkipInput] = useState(false);
  const [timeSkipDuration, setTimeSkipDuration] = useState('');
  const [isSkippingTime, setIsSkippingTime] = useState(false);
  const [showNewUserForm, setShowNewUserForm] = useState(false);

  // Action Image State
  const [showActionInput, setShowActionInput] = useState(false);
  const [actionPrompt, setActionPrompt] = useState('');
  const [isGeneratingScene, setIsGeneratingScene] = useState(false);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  // Propagate changes to parent for persistence
  useEffect(() => {
    onSessionUpdate(messages, activeCharacter, activeUserPersona);
    
    // Check death state from messages history on load/update
    const lastMsg = messages[messages.length - 1];
    if (lastMsg?.isDeath) {
        setIsDead(true);
    }
  }, [messages, activeCharacter, activeUserPersona]);

  useEffect(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({sampleRate: 24000});
    }
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isProcessing]);

  const handleSendMessage = async () => {
    if (!inputText.trim()) return;
    
    const userMsg: Message = { id: Date.now().toString(), role: 'user', text: inputText, timestamp: Date.now() };
    setMessages(prev => [...prev, userMsg]);
    setInputText('');
    setIsProcessing(true);

    try {
      // Build history for Gemini
      const history = messages.filter(m => m.id !== 'init' && !m.generatedImage && !m.isDeath).map(m => ({
        role: m.role,
        parts: [{ text: m.text }]
      }));

      const responseText = await chatWithCharacter(history, userMsg.text, activeCharacter, activeUserPersona);
      
      const deathTag = "[GAME_OVER]";
      const died = responseText.includes(deathTag);
      const cleanText = responseText.replace(deathTag, "").trim();

      const botMsg: Message = { 
        id: (Date.now() + 1).toString(), 
        role: 'model', 
        text: cleanText, 
        timestamp: Date.now(),
        isDeath: died
      };
      
      setMessages(prev => [...prev, botMsg]);

      if (died) {
        setIsDead(true);
      } else if (autoPlayTTS && audioContextRef.current) {
        try {
            const audioBase64 = await speakText(cleanText);
            if (audioBase64) {
              const buffer = await decodeAudioData(audioBase64, audioContextRef.current);
              playAudioBuffer(buffer, audioContextRef.current);
            }
        } catch (e) {
            console.error("TTS Error", e);
        }
      }

    } catch (e) {
      console.error(e);
      setMessages(prev => [...prev, { id: 'err', role: 'model', text: "(Conexão interrompida...)", timestamp: Date.now() }]);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleTimeSkip = async () => {
      if (!timeSkipDuration) return;
      setIsSkippingTime(true);
      
      setMessages(prev => [...prev, {
          id: 'skip_calc',
          role: 'model',
          text: '⏳ O tempo está passando... Calculando consequências do período...',
          timestamp: Date.now()
      }]);
      
      try {
          const updates = await processTimeSkip(activeCharacter, timeSkipDuration);
          
          let newImage = activeCharacter.baseImage;
          if (updates.visualEvolutionPrompt) {
               try {
                  newImage = await evolveCharacterVisuals(activeCharacter.baseImage, updates.visualEvolutionPrompt);
               } catch (imgError) {
                  console.warn("Visual evolution failed", imgError);
               }
          }

          const newCharacter = {
              ...activeCharacter,
              weight: updates.newWeight,
              height: updates.newHeight,
              age: updates.newAge,
              baseImage: newImage
          };
          setActiveCharacter(newCharacter);

          const skipMsg: Message = {
              id: Date.now().toString(),
              role: 'model',
              text: `⏰ SALTO NO TEMPO CONCLUÍDO: ${timeSkipDuration}.\n\n📜 DIÁRIO DE ATIVIDADES:\n${updates.summary}\n\n📊 Estatísticas:\n${updates.stats}\n\nStatus Atual: Peso ${updates.newWeight} | Altura ${updates.newHeight} | Idade ${updates.newAge}`,
              timestamp: Date.now()
          };
          
          setMessages(prev => prev.filter(m => m.id !== 'skip_calc').concat(skipMsg));
          setShowTimeSkipInput(false);
          setShowNewUserForm(true);

      } catch (e) {
          alert("Erro ao processar salto no tempo.");
          setMessages(prev => prev.filter(m => m.id !== 'skip_calc'));
      } finally {
          setIsSkippingTime(false);
      }
  };

  const handleNewUserCreated = (newUser: UserPersona) => {
    setActiveUserPersona(newUser);
    
    const entranceMsg: Message = {
        id: Date.now().toString(),
        role: 'user',
        text: `*Um novo aventureiro se aproxima...*\nNome: ${newUser.name}\nIdade: ${newUser.age}\nDescrição: ${newUser.appearance}`,
        timestamp: Date.now()
    };
    setMessages(prev => [...prev, entranceMsg]);

    setShowNewUserForm(false);
    setIsDead(false);
    setIsSkippingTime(false);
    setTimeSkipDuration('');
  };

  const handleGenerateAction = async () => {
    if (!actionPrompt.trim()) return;
    setIsGeneratingScene(true);
    setShowActionInput(false);

    const userActionMsg: Message = { 
        id: Date.now().toString(), 
        role: 'user', 
        text: `(Ação) ${actionPrompt}`, 
        timestamp: Date.now() 
    };
    setMessages(prev => [...prev, userActionMsg]);

    try {
        const imageBase64 = await generateActionScene(activeCharacter, activeUserPersona, actionPrompt);
        
        const sceneMsg: Message = {
            id: (Date.now() + 1).toString(),
            role: 'model',
            text: `*Uma cena se desenrola: ${actionPrompt}*`,
            generatedImage: imageBase64,
            timestamp: Date.now()
        };
        setMessages(prev => [...prev, sceneMsg]);
        setActionPrompt('');
    } catch (e) {
        console.error(e);
        setMessages(prev => [...prev, { id: 'err', role: 'model', text: "(Falha ao visualizar a cena)", timestamp: Date.now() }]);
    } finally {
        setIsGeneratingScene(false);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => chunksRef.current.push(e.data);
      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(chunksRef.current, { type: 'audio/wav' });
        const base64 = await blobToBase64(audioBlob);
        
        setIsProcessing(true);
        try {
          const text = await transcribeAudio(base64);
          setInputText(text);
        } catch (e) {
          console.error("Transcription failed", e);
        } finally {
          setIsProcessing(false);
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (e) {
      alert("Microfone bloqueado");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-gray-900 rounded-xl overflow-hidden border border-gray-800 shadow-2xl relative">
       {/* Header */}
      <div className="p-4 bg-gray-800 border-b border-gray-700 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img 
            src={`data:image/jpeg;base64,${activeCharacter.baseImage}`} 
            className="w-10 h-10 rounded-full object-cover border border-primary-500" 
            loading="lazy"
            decoding="async"
            alt="Character Avatar"
          />
          <div>
            <h3 className="font-bold text-white">{activeCharacter.name}</h3>
            <p className="text-xs text-green-400">
                Online • {activeCharacter.height || '?'} • {activeCharacter.weight || '?'} • {activeCharacter.age || '?'}
                {activeCharacter.encounter?.environment && <span className="text-gray-400 block truncate max-w-[150px]">{activeCharacter.encounter.environment}</span>}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
           {activeUserPersona && (
             <div className="text-xs text-gray-400 text-right hidden md:block">
                <span className="block text-primary-400">{activeUserPersona.name} ({activeUserPersona.age})</span>
                <span>{activeUserPersona.height} • {activeUserPersona.weight}</span>
             </div>
           )}
           <label className="text-xs text-gray-400 flex items-center gap-2 cursor-pointer">
             <input type="checkbox" checked={autoPlayTTS} onChange={e => setAutoPlayTTS(e.target.checked)} className="rounded bg-gray-700 border-gray-600 text-primary-500" />
             TTS Auto
           </label>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div 
                className={`
                    max-w-[80%] rounded-2xl p-4 relative overflow-hidden transition-all duration-300
                    ${msg.role === 'user' 
                        ? 'bg-primary-900/50 text-white rounded-tr-none' 
                        : msg.isDeath 
                            ? 'bg-red-950/90 border border-red-600 text-red-200 rounded-tl-none shadow-[0_0_15px_rgba(220,38,38,0.4)]' 
                            : 'bg-gray-800 text-gray-100 rounded-tl-none'
                    }
                `}
            >
              {/* Death Visual Effects */}
              {msg.isDeath && (
                  <div className="absolute top-0 right-0 p-1 opacity-20">
                      <span className="text-4xl">💀</span>
                  </div>
              )}

              <p className={`whitespace-pre-wrap text-sm md:text-base ${msg.isDeath ? 'font-serif italic tracking-wide text-red-100 drop-shadow-sm' : ''}`}>
                  {msg.text}
              </p>
              
              {msg.generatedImage && (
                <ChatImage src={msg.generatedImage} alt="Scene" />
              )}
            </div>
          </div>
        ))}
        {isProcessing && (
          <div className="flex justify-start">
            <div className="bg-gray-800 rounded-2xl p-4 rounded-tl-none">
              <div className="flex gap-2">
                <div className="w-2 h-2 bg-primary-500 rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-primary-500 rounded-full animate-bounce delay-100"></div>
                <div className="w-2 h-2 bg-primary-500 rounded-full animate-bounce delay-200"></div>
              </div>
            </div>
          </div>
        )}
        {isGeneratingScene && (
           <div className="flex justify-center my-2">
               <span className="text-xs text-primary-400 animate-pulse">✨ Renderizando cena de ação...</span>
           </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* OVERLAYS */}

      {/* 1. DEATH OVERLAY */}
      {isDead && !showTimeSkipInput && !showNewUserForm && (
          <div className="absolute inset-0 bg-black/80 z-40 flex flex-col items-center justify-center p-8 text-center animate-fade-in backdrop-blur-sm">
              <h1 className="text-5xl md:text-7xl font-bold text-red-600 mb-4 tracking-widest drop-shadow-[0_0_10px_rgba(220,38,38,0.5)]">VOCÊ MORREU</h1>
              <p className="text-gray-400 max-w-md mb-8">Sua jornada com {activeCharacter.name} chegou a um fim trágico.</p>
              
              <div className="flex flex-col md:flex-row gap-4 w-full max-w-md">
                  <button 
                    onClick={() => setShowTimeSkipInput(true)}
                    className="flex-1 bg-gradient-to-r from-red-900 to-red-700 hover:from-red-800 hover:to-red-600 text-white py-4 rounded-lg font-bold shadow-lg shadow-red-900/50 transition-all hover:scale-105"
                  >
                      ⏳ Avançar Tempo (Novo Personagem)
                  </button>
              </div>
          </div>
      )}

      {/* 2. TIME SKIP INPUT */}
      {isDead && showTimeSkipInput && !showNewUserForm && (
           <div className="absolute inset-0 bg-black/90 z-40 flex flex-col items-center justify-center p-8 text-center animate-fade-in">
               <div className="max-w-md w-full bg-gray-900 p-8 rounded-xl border border-gray-700 shadow-2xl">
                   <h2 className="text-2xl font-bold text-white mb-4">Salto no Tempo</h2>
                   <p className="text-sm text-gray-400 mb-6">Quanto tempo se passou desde a sua morte? Um novo aventureiro surgirá.</p>
                   
                   <input 
                    type="text" 
                    value={timeSkipDuration}
                    onChange={(e) => setTimeSkipDuration(e.target.value)}
                    placeholder="Ex: 10 anos, 2 semanas..."
                    className="w-full bg-gray-950 border border-gray-600 rounded-lg px-4 py-3 text-white focus:border-primary-500 focus:outline-none mb-6 text-center text-lg"
                   />

                   <button 
                    onClick={handleTimeSkip}
                    disabled={!timeSkipDuration || isSkippingTime}
                    className="w-full bg-primary-600 hover:bg-primary-500 text-white py-3 rounded-lg font-bold disabled:opacity-50"
                   >
                       {isSkippingTime ? "Calculando evolução..." : "Avançar Tempo"}
                   </button>
               </div>
           </div>
      )}

      {/* 3. NEW USER CREATION OVERLAY */}
      {showNewUserForm && (
          <div className="absolute inset-0 bg-black/95 z-50 overflow-y-auto p-4 flex items-center justify-center">
              <div className="w-full max-w-2xl">
                  <div className="text-center mb-4">
                      <h2 className="text-2xl font-bold text-yellow-500">Novo Desafiante</h2>
                      <p className="text-gray-400">Quem ousa entrar no domínio de {activeCharacter.name} agora?</p>
                  </div>
                  <UserSetup 
                    existingUser={null} // Force fresh start
                    onComplete={handleNewUserCreated}
                    onCancel={() => {}} // Cannot cancel, mandatory
                  />
              </div>
          </div>
      )}

      {/* Action Input Layer */}
      {!isDead && showActionInput && (
        <div className="absolute bottom-20 left-4 right-4 bg-gray-800 p-4 rounded-xl border border-primary-500/30 shadow-2xl z-10 animate-fade-in-up">
            <div className="flex gap-2">
                <input
                    type="text"
                    value={actionPrompt}
                    onChange={(e) => setActionPrompt(e.target.value)}
                    placeholder="Descreva a ação (ex: Eu aperto a mão dele firmemente)"
                    className="flex-1 bg-gray-950 border border-gray-700 rounded px-4 py-2 text-white focus:border-primary-500 focus:outline-none"
                    onKeyDown={(e) => e.key === 'Enter' && handleGenerateAction()}
                />
                <button
                    onClick={handleGenerateAction}
                    className="bg-primary-600 hover:bg-primary-500 px-4 py-2 rounded text-white text-sm font-bold"
                >
                    Gerar
                </button>
                <button
                    onClick={() => setShowActionInput(false)}
                    className="bg-gray-700 hover:bg-gray-600 px-3 py-2 rounded text-white"
                >
                    ✕
                </button>
            </div>
        </div>
      )}

      {/* Controls */}
      <div className="p-4 bg-gray-800 border-t border-gray-700">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowActionInput(!showActionInput)}
            disabled={isDead}
            className="p-3 rounded-full bg-gray-700 hover:bg-gray-600 text-yellow-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title="Criar Cena de Ação"
          >
            📸
          </button>
          <div className="flex-1 relative">
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !isDead && handleSendMessage()}
              placeholder={isDead ? "Você está morto..." : "Digite sua mensagem..."}
              disabled={isDead}
              className="w-full bg-gray-950 border border-gray-700 rounded-full pl-4 pr-12 py-3 text-white focus:border-primary-500 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <button 
                className={`absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-full ${isRecording ? 'text-red-500 animate-pulse' : 'text-gray-400 hover:text-white'} disabled:opacity-50`}
                onMouseDown={!isDead ? startRecording : undefined}
                onMouseUp={!isDead ? stopRecording : undefined}
                onTouchStart={!isDead ? startRecording : undefined}
                onTouchEnd={!isDead ? stopRecording : undefined}
                disabled={isDead}
            >
                🎙️
            </button>
          </div>
          <button 
            onClick={handleSendMessage}
            disabled={!inputText.trim() || isProcessing || isDead}
            className="p-3 rounded-full bg-primary-600 hover:bg-primary-500 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            ➤
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatArea;
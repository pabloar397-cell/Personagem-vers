import React, { useState, useEffect } from 'react';
import CharacterSetup from './components/CharacterSetup';
import UserSetup from './components/UserSetup';
import ChatArea from './components/ChatArea';
import MediaLab from './components/MediaLab';
import WelcomeScreen from './components/WelcomeScreen';
import { Character, ViewMode, UserPersona, ChatSession, Message } from './types';

const App: React.FC = () => {
  // Session State
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  
  // Temporary State for Creation Flow
  const [tempCharacter, setTempCharacter] = useState<Character | null>(null);
  const [tempUser, setTempUser] = useState<UserPersona | null>(null);
  
  // Default to Welcome Screen
  const [view, setView] = useState<ViewMode>(ViewMode.WELCOME);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Load Sessions on Mount
  useEffect(() => {
    const saved = localStorage.getItem('persona_sessions');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setSessions(parsed);
      } catch (e) {
        console.error("Failed to load sessions", e);
      }
    }
  }, []);

  // Save Sessions whenever they change
  useEffect(() => {
    if (sessions.length > 0) {
      localStorage.setItem('persona_sessions', JSON.stringify(sessions));
    }
  }, [sessions]);

  const activeSession = sessions.find(s => s.id === activeSessionId);

  // --- Actions ---

  const handleStartApp = () => {
    if (sessions.length > 0) {
        // If sessions exist, go to chat (load first one optionally, or just show empty chat prompting selection)
        // For better UX, let's go to setup if no active session, or just stay in Setup mode
        setActiveSessionId(null);
        setView(ViewMode.SETUP);
    } else {
        setView(ViewMode.SETUP);
    }
  };

  const handleCreateNew = () => {
    setActiveSessionId(null);
    setTempCharacter(null);
    setTempUser(null);
    setView(ViewMode.SETUP);
    setIsSidebarOpen(false);
  };

  const handleCharacterComplete = (char: Character) => {
    setTempCharacter(char);
    // Proceed to User Setup
    setView(ViewMode.USER_SETUP);
  };

  const handleUserSetupComplete = (user: UserPersona) => {
    setTempUser(user);
    
    // Finalize creation: Create Session
    if (tempCharacter) {
      const newSession: ChatSession = {
        id: Date.now().toString(),
        character: tempCharacter,
        userPersona: user,
        messages: [{
            id: 'init',
            role: 'model',
            text: `*${tempCharacter.name} entra na sala.*`,
            timestamp: Date.now()
        }],
        lastUpdated: Date.now(),
        previewText: 'Início da jornada...'
      };

      setSessions(prev => [newSession, ...prev]);
      setActiveSessionId(newSession.id);
      setView(ViewMode.CHAT);
    }
  };

  const handleSelectSession = (sessionId: string) => {
    setActiveSessionId(sessionId);
    setTempCharacter(null); // Clear temp
    setTempUser(null);
    setView(ViewMode.CHAT);
    setIsSidebarOpen(false);
  };

  const handleDeleteSession = (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation();
    if (confirm("Tem certeza que deseja apagar este chat?")) {
      setSessions(prev => prev.filter(s => s.id !== sessionId));
      if (activeSessionId === sessionId) {
        setActiveSessionId(null);
        setView(ViewMode.SETUP);
      }
    }
  };

  const handleSessionUpdate = (messages: Message[], updatedCharacter: Character, updatedUser: UserPersona | null) => {
    if (!activeSessionId) return;

    setSessions(prev => prev.map(s => {
      if (s.id === activeSessionId) {
        const lastMsg = messages[messages.length - 1];
        return {
          ...s,
          messages,
          character: updatedCharacter,
          userPersona: updatedUser,
          lastUpdated: Date.now(),
          previewText: lastMsg ? (lastMsg.text.substring(0, 40) + '...') : s.previewText
        };
      }
      return s;
    }));
  };

  // Full Screen Welcome Mode
  if (view === ViewMode.WELCOME) {
      return <WelcomeScreen onStart={handleStartApp} />;
  }

  return (
    <div className="min-h-screen bg-black text-gray-100 flex overflow-hidden">
      
      {/* Sidebar - Mobile Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/80 z-40 md:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside 
        className={`
          fixed md:relative z-50 h-full w-72 bg-gray-950 border-r border-gray-800 flex flex-col transition-transform duration-300
          ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        `}
      >
        <div className="p-4 border-b border-gray-800 flex items-center justify-between">
          <h2 className="font-bold text-xl bg-clip-text text-transparent bg-gradient-to-r from-primary-400 to-purple-500 cursor-pointer" onClick={() => setView(ViewMode.WELCOME)}>
            PersonaForge
          </h2>
          <button 
            onClick={() => setIsSidebarOpen(false)}
            className="md:hidden text-gray-400 hover:text-white"
          >
            ✕
          </button>
        </div>

        <div className="p-3">
          <button 
            onClick={handleCreateNew}
            className="w-full bg-primary-600 hover:bg-primary-500 text-white py-2 px-4 rounded-lg font-medium flex items-center justify-center gap-2 transition-all"
          >
            <span>+</span> Novo Personagem
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          <h3 className="text-xs font-bold text-gray-500 uppercase px-2 mb-2">Histórico de Chats</h3>
          {sessions.length === 0 && (
            <p className="text-xs text-gray-600 px-2 italic">Nenhum chat salvo.</p>
          )}
          
          {sessions.map(session => (
            <div 
              key={session.id}
              onClick={() => handleSelectSession(session.id)}
              className={`
                group relative p-3 rounded-lg cursor-pointer transition-colors
                ${activeSessionId === session.id ? 'bg-gray-800 border border-gray-700' : 'hover:bg-gray-900 border border-transparent'}
              `}
            >
              <div className="flex items-center gap-3">
                 <img 
                   src={`data:image/jpeg;base64,${session.character.baseImage}`} 
                   className="w-10 h-10 rounded-full object-cover bg-gray-900" 
                   alt="Avatar"
                 />
                 <div className="flex-1 min-w-0">
                    <h4 className={`text-sm font-bold truncate ${activeSessionId === session.id ? 'text-white' : 'text-gray-300'}`}>
                      {session.character.name}
                    </h4>
                    <p className="text-xs text-gray-500 truncate">
                      {session.previewText}
                    </p>
                 </div>
              </div>
              <button 
                onClick={(e) => handleDeleteSession(e, session.id)}
                className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 p-1 text-gray-500 hover:text-red-400 transition-opacity"
                title="Apagar Chat"
              >
                🗑️
              </button>
            </div>
          ))}
        </div>

        <div className="p-4 border-t border-gray-800">
            <button 
                onClick={() => setView(ViewMode.MEDIA)}
                className="w-full py-2 text-xs font-medium text-gray-400 hover:text-white border border-gray-800 rounded hover:bg-gray-900"
            >
                🛠️ Ferramentas & Media Lab
            </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden relative">
        {/* Mobile Header */}
        <header className="md:hidden h-14 bg-gray-950 border-b border-gray-800 flex items-center px-4 justify-between shrink-0">
           <button onClick={() => setIsSidebarOpen(true)} className="text-gray-300">
             ☰
           </button>
           <span className="font-bold text-gray-200">
             {activeSession ? activeSession.character.name : 'PersonaForge'}
           </span>
           <div className="w-6"></div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-6 bg-black/95">
          <div className="max-w-5xl mx-auto h-full flex flex-col">
            
            {view === ViewMode.SETUP && (
              <CharacterSetup 
                onComplete={handleCharacterComplete} 
                existingCharacter={null} 
              />
            )}

            {view === ViewMode.USER_SETUP && (
                <UserSetup 
                    onComplete={handleUserSetupComplete}
                    existingUser={tempUser}
                    onCancel={() => setView(ViewMode.SETUP)}
                />
            )}

            {view === ViewMode.CHAT && activeSession && (
              <div className="h-full">
                <ChatArea 
                    key={activeSession.id} // Forces remount when switching sessions
                    sessionId={activeSession.id}
                    initialCharacter={activeSession.character} 
                    initialUserPersona={activeSession.userPersona} 
                    initialMessages={activeSession.messages}
                    onSessionUpdate={handleSessionUpdate}
                />
              </div>
            )}

            {view === ViewMode.MEDIA && (
              <div className="h-full">
                <MediaLab />
              </div>
            )}

            {view === ViewMode.CHAT && !activeSession && (
                <div className="flex flex-col items-center justify-center h-full text-gray-500">
                    <p>Selecione um chat ou crie um novo personagem.</p>
                </div>
            )}
            
          </div>
        </main>
      </div>
    </div>
  );
};

export default App;
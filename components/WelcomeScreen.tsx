import React, { useState } from 'react';

interface Props {
  onStart: () => void;
}

const GENERATION_PROMPT = `
/**
 * SYSTEM ARCHITECTURE & GENERATION PROMPT
 * APP: PersonaForge AI
 * ROLE: Senior Frontend Engineer & Game Designer
 */

1. CORE OBJECTIVE
   Build an immersive Roleplay Chat application where users create characters based on images. 
   The AI must strictly adhere to physical laws inferred from the image (mass, height, density).

2. TECH STACK
   - React 19 + TypeScript
   - TailwindCSS (Dark/Cinematic Theme)
   - SDK: @google/genai (Gemini 2.5 & 3.0 Series)

3. AI MODEL ORCHESTRATION
   - Character Analysis: 'gemini-3-flash-preview' (Fast visual estimation of weight/height)
   - Roleplay Logic: 'gemini-3-pro-preview' (Complex reasoning, physics enforcement)
   - Image Generation: 'gemini-2.5-flash-image' & 'imagen-3'
   - Video Generation: 'veo-3.1-fast-generate-preview'
   - Audio/TTS: 'gemini-2.5-flash-preview-tts'

4. GAME MECHANICS (MANDATORY)
   A. PERMADEATH SYSTEM:
      - If the character decides to kill the user (based on aggression/hunger), 
      - The UI must lock into a "GAME OVER" state.
      - Chat is disabled.
   
   B. TIME EVOLUTION (CHRONO-SYSTEM):
      - Users can trigger a "Time Skip" (e.g., "100 years later").
      - AI generates a "Activity Log" (what the creature ate, destroyed, or built).
      - AI regenerates the character's image to show aging/evolution.

   C. PHYSICS & IMMERSION:
      - Heavy characters (>200kg) must have slow, impactful descriptions.
      - Predatory characters must react to "fear" or "weakness" in user input.

5. DATA STRUCTURE
   - Character { id, baseImage, diet: { type, humanPreferences }, encounter: { whoSawFirst } }
   - Session { messages, isDeath: boolean, lastUpdated }

6. UI GUIDELINES
   - Aesthetic: Cyberpunk/Dark Fantasy.
   - Components: Media Lab, Chat Area (with bubble effects), Character Setup (Wizard).
*/
`;

const FeatureCard = ({ icon, title, desc }: { icon: string, title: string, desc: string }) => (
  <div className="bg-gray-900/50 p-6 rounded-xl border border-gray-800 hover:border-primary-500/50 transition-all hover:bg-gray-900 group">
    <div className="text-4xl mb-4 group-hover:scale-110 transition-transform duration-300">{icon}</div>
    <h3 className="text-xl font-bold text-white mb-2">{title}</h3>
    <p className="text-sm text-gray-400 leading-relaxed">{desc}</p>
  </div>
);

const WelcomeScreen: React.FC<Props> = ({ onStart }) => {
  const [showPrompt, setShowPrompt] = useState(false);

  return (
    <div className="min-h-full flex flex-col items-center justify-center p-6 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-gray-900 via-black to-black relative">
      
      <div className="max-w-5xl w-full space-y-12 z-10">
        
        {/* Header */}
        <div className="text-center space-y-4 animate-fade-in-up">
          <div className="inline-block px-4 py-1 rounded-full bg-primary-900/30 border border-primary-500/30 text-primary-400 text-xs font-bold tracking-widest uppercase mb-4">
            Beta v2.0
          </div>
          <h1 className="text-6xl md:text-8xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white via-primary-200 to-gray-500 tracking-tight">
            PersonaForge
          </h1>
          <p className="text-xl md:text-2xl text-gray-400 max-w-2xl mx-auto font-light">
            Simulação de RPG imersiva com <span className="text-primary-400 font-medium">Inteligência Artificial</span>, física realista e consequências mortais.
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-fade-in-up delay-100">
          
          <FeatureCard 
            icon="🧠" 
            title="Criação Neural" 
            desc="Envie uma imagem e a IA analisa fisicamente a criatura (peso, altura, densidade). Ou defina apenas o 'Tom da História' (ex: Gore, Terror) e ela cria tudo." 
          />
          
          <FeatureCard 
            icon="⚖️" 
            title="Física & Imersão" 
            desc="O peso e tamanho do personagem influenciam o combate. Personagens gigantes se movem devagar; predadores sentem o cheiro de medo." 
          />

          <FeatureCard 
            icon="💀" 
            title="Sistema de Morte" 
            desc="Se você morrer, é Game Over. A tela muda, o chat é bloqueado. A única saída é um Salto Temporal onde a história avança sem você." 
          />

          <FeatureCard 
            icon="⏳" 
            title="Evolução Temporal" 
            desc="Avance o tempo (10 anos, 1 século). O personagem envelhece, muda de aparência, e a IA gera um 'Diário de Atividades' detalhando quem ele devorou ou o que construiu." 
          />

          <FeatureCard 
            icon="🎙️" 
            title="Voz & Audição" 
            desc="Converse via microfone real-time. O personagem responde com voz neural (TTS) de alta fidelidade. Transcrição automática." 
          />

          <FeatureCard 
            icon="🎬" 
            title="Media Lab" 
            desc="Gere cenas de ação cinematográficas entre você e o personagem, crie vídeos (Veo) ou verifique fatos com Google Search." 
          />
          
        </div>

        {/* CTA */}
        <div className="flex flex-col items-center justify-center gap-4 pt-8 animate-bounce-subtle">
          <button 
            onClick={onStart}
            className="group relative inline-flex items-center justify-center px-8 py-4 font-bold text-white transition-all duration-200 bg-primary-600 font-lg rounded-full hover:bg-primary-500 hover:scale-105 hover:shadow-[0_0_30px_rgba(79,70,229,0.5)] w-full md:w-auto min-w-[250px]"
          >
            <span className="mr-2 text-2xl">⚔️</span>
            <span>Iniciar Jornada</span>
            <div className="absolute inset-0 rounded-full ring-2 ring-white/20 group-hover:ring-white/40 animate-pulse"></div>
          </button>

          <button 
            onClick={() => setShowPrompt(true)}
            className="text-gray-500 hover:text-primary-400 text-xs font-mono border-b border-transparent hover:border-primary-400 transition-all"
          >
            📜 Ver System Prompt / Arquitetura
          </button>

          <p className="text-xs text-gray-600 mt-2">
            Powered by Gemini 2.5 & 3 Pro • Google Cloud
          </p>
        </div>

      </div>

      {/* Prompt Modal */}
      {showPrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm animate-fade-in">
          <div className="bg-gray-900 border border-gray-700 rounded-lg shadow-2xl w-full max-w-4xl max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-gray-800 bg-gray-950 rounded-t-lg">
              <div className="flex gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500"></div>
                <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                <div className="w-3 h-3 rounded-full bg-green-500"></div>
              </div>
              <h3 className="font-mono text-sm text-gray-400">system_architecture.txt</h3>
              <button 
                onClick={() => setShowPrompt(false)}
                className="text-gray-400 hover:text-white"
              >
                ✕
              </button>
            </div>
            <div className="p-6 overflow-y-auto font-mono text-sm text-green-400 bg-black/50 custom-scrollbar">
              <pre className="whitespace-pre-wrap">{GENERATION_PROMPT}</pre>
            </div>
            <div className="p-4 border-t border-gray-800 bg-gray-950 rounded-b-lg text-right">
              <button 
                onClick={() => setShowPrompt(false)}
                className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded text-xs font-bold"
              >
                Fechar Console
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default WelcomeScreen;

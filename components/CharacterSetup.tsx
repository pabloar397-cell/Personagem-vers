import React, { useState, useRef } from 'react';
import { analyzeCharacterImage, autoFillCharacterProfile, editCharacterImage } from '../services/geminiService';
import { compressImage } from '../services/imageUtils';
import { Character, DietConfig, EncounterConfig } from '../types';

interface Props {
  onComplete: (character: Character) => void;
  existingCharacter?: Character | null;
}

const QUESTIONS = [
  "Como essa criatura/personagem surgiu? (Nascimento natural, experimento, maldição, construção...)",
  "Qual é o seu habitat natural? O ambiente é hostil ou acolhedor?",
  "Ela é única ou parte de uma espécie? Segue normas do grupo ou é pária?",
  "O que ela mais deseja neste exato momento? (Comida, segurança, poder...)",
  "Qual é o seu objetivo de longo prazo?",
  "O que ela estaria disposta a sacrificar para conseguir o que quer?",
  "Do que ela tem medo? (Físico ou abstrato)",
  "Qual é a sua maior fraqueza?",
  "O que a faria fugir de uma batalha?",
  "Como ela reage ao desconhecido? (Curiosidade, agressividade, cautela)",
  "Ela possui algum código moral ou de honra?",
  "Como ela se comunica? (Linguagem, grunhidos, telepatia)",
  "O que a faria poupar a vida de um inimigo?",
  "Ela tem algum hábito ou 'tique' estranho?",
  "Como ela passa o tempo quando não está caçando ou trabalhando?"
];

type Tab = 'INFO' | 'PERSONALITY' | 'DIET' | 'LOCATION';

const CharacterSetup: React.FC<Props> = ({ onComplete, existingCharacter }) => {
  const [activeTab, setActiveTab] = useState<Tab>('INFO');

  // Basic Info
  const [image, setImage] = useState<string | null>(existingCharacter?.baseImage || null);
  const [name, setName] = useState(existingCharacter?.name || '');
  const [description, setDescription] = useState(existingCharacter?.description || '');
  const [storyTone, setStoryTone] = useState("Sombrio e Realista"); // New Field
  const [height, setHeight] = useState(existingCharacter?.height || '');
  const [weight, setWeight] = useState(existingCharacter?.weight || '');
  const [age, setAge] = useState(existingCharacter?.age || '');
  const [lifeExpectancy, setLifeExpectancy] = useState(existingCharacter?.lifeExpectancy || '');
  const [powers, setPowers] = useState(existingCharacter?.powers || '');
  
  // Encounter/Location State
  const [environment, setEnvironment] = useState(existingCharacter?.encounter?.environment || '');
  const [whoSawFirst, setWhoSawFirst] = useState<'USER' | 'CHARACTER' | 'BOTH'>(existingCharacter?.encounter?.whoSawFirst || 'BOTH');

  // Diet State
  const [dietType, setDietType] = useState<'HERBIVORE' | 'CARNIVORE'>('HERBIVORE');
  const [dietDetails, setDietDetails] = useState('');
  const [eatsHumans, setEatsHumans] = useState(false);
  const [humanPreferences, setHumanPreferences] = useState({
    ageGroup: 'Qualquer um',
    bodyType: 'Qualquer um',
    tastePreference: 'Qualquer um'
  });

  // Questions State
  const [answers, setAnswers] = useState<{[key: number]: string}>({});

  // Processing States
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isAutoFilling, setIsAutoFilling] = useState(false);
  const [editPrompt, setEditPrompt] = useState('');
  const [isEditingImg, setIsEditingImg] = useState(false);
  const [isCompressing, setIsCompressing] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Helper to parse Gemini analysis text
  const parseAnalysis = (text: string) => {
    const heightMatch = text.match(/Altura Estimada:\s*(.*?)(?:\n|$)/i);
    const weightMatch = text.match(/Peso Estimado:\s*(.*?)(?:\n|$)/i);
    const envMatch = text.match(/Ambiente Sugerido:\s*(.*?)(?:\n|$)/i);

    if (heightMatch && heightMatch[1]) setHeight(prev => prev || heightMatch[1].trim());
    if (weightMatch && weightMatch[1]) setWeight(prev => prev || weightMatch[1].trim());
    if (envMatch && envMatch[1]) setEnvironment(prev => prev || envMatch[1].trim());
    
    return text;
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setIsCompressing(true);
      
      let compressedBase64 = "";
      
      // 1. Attempt Compression (Critical)
      try {
        compressedBase64 = await compressImage(e.target.files[0]);
        setImage(compressedBase64);
      } catch (err) {
        console.error("Image processing failed", err);
        alert("Erro ao processar imagem.");
        setIsCompressing(false);
        return;
      }
      
      setIsCompressing(false);

      // 2. Attempt AI Analysis (Optional)
      setIsAnalyzing(true);
      try {
        const analysis = await analyzeCharacterImage(compressedBase64);
        const processedDesc = parseAnalysis(analysis);
        setDescription(prev => prev + (prev ? "\n\n" : "") + "Análise Visual Automática: " + processedDesc);
      } catch (err) {
        console.warn("AI Analysis failed (Quota or Network)", err);
        // Do not alert user, just fail silently or show small toast if we had a toast system.
        // The image is already set, so the user can proceed.
      } finally {
        setIsAnalyzing(false);
      }
    }
  };

  const handleAutoFill = async () => {
    // Logic update: Allow autofill if we have just Tone, even without Description
    if (!storyTone) {
        alert("Defina um Tom para a história (ex: Gore, Terror, Aventura).");
        return;
    }

    setIsAutoFilling(true);
    try {
      const qIds = QUESTIONS.map((_, i) => i.toString());
      
      const result = await autoFillCharacterProfile(
        description, // Can be empty now
        qIds,
        storyTone
      );

      setName(result.name);
      setDescription(result.backstory);
      if (result.height) setHeight(result.height);
      if (result.weight) setWeight(result.weight);
      if (result.age) setAge(result.age);
      if (result.lifeExpectancy) setLifeExpectancy(result.lifeExpectancy);
      if (result.powers) setPowers(result.powers);
      if (result.environment) setEnvironment(result.environment);
      
      // Diet
      if (result.diet) {
        setDietType(result.diet.type as any);
        setDietDetails(result.diet.details);
        setEatsHumans(result.diet.eatsHumans);
        if (result.diet.humanPreferences) {
            setHumanPreferences({
                ageGroup: result.diet.humanPreferences.ageGroup || 'Qualquer um',
                bodyType: result.diet.humanPreferences.bodyType || 'Qualquer um',
                tastePreference: result.diet.humanPreferences.tastePreference || 'Qualquer um'
            });
        }
      }

      // Questions
      if (result.answers) {
        const newAnswers: any = {};
        Object.keys(result.answers).forEach(k => {
            newAnswers[parseInt(k)] = result.answers[k];
        });
        setAnswers(newAnswers);
      }
      
    } catch (e) {
      console.error(e);
      alert("Falha ao gerar perfil automático. Verifique sua cota da API ou tente novamente.");
    } finally {
      setIsAutoFilling(false);
    }
  };

  const handleImageEdit = async () => {
    if (!image || !editPrompt) return;
    setIsEditingImg(true);
    try {
      const newImage = await editCharacterImage(image, editPrompt);
      setImage(newImage);
      setEditPrompt('');
    } catch (e) {
      alert("Falha ao editar imagem. Verifique cota da API.");
    } finally {
      setIsEditingImg(false);
    }
  };

  const handleComplete = () => {
    if (!name || !description) {
      alert("Preencha pelo menos Nome e Descrição.");
      return;
    }

    // Use a placeholder image if user didn't upload one, to prevent errors
    const finalImage = image || "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

    const character: Character = {
      id: Date.now().toString(),
      name,
      description,
      baseImage: finalImage,
      systemInstruction: `Você é ${name}. ${description}. Tom da história: ${storyTone}.`,
      height,
      weight,
      age,
      lifeExpectancy,
      powers,
      encounter: { environment, whoSawFirst },
      diet: {
        type: dietType,
        details: dietDetails,
        eatsHumans,
        humanPreferences: eatsHumans ? humanPreferences : undefined
      },
      questionAnswers: Object.keys(answers).reduce((acc, key) => ({
        ...acc,
        [QUESTIONS[parseInt(key)]]: answers[parseInt(key)]
      }), {})
    };

    onComplete(character);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20">
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-6 shadow-2xl">
        <h1 className="text-3xl font-bold mb-6 text-transparent bg-clip-text bg-gradient-to-r from-primary-400 to-purple-500">
          Criar Personagem
        </h1>
        
        {/* Tabs */}
        <div className="flex gap-2 border-b border-gray-700 mb-6 overflow-x-auto pb-2">
            <button onClick={() => setActiveTab('INFO')} className={`px-4 py-2 rounded-t-lg transition-colors font-medium whitespace-nowrap ${activeTab === 'INFO' ? 'bg-gray-800 text-white border-b-2 border-primary-500' : 'text-gray-500 hover:text-white'}`}>Informações Básicas</button>
            <button onClick={() => setActiveTab('PERSONALITY')} className={`px-4 py-2 rounded-t-lg transition-colors font-medium whitespace-nowrap ${activeTab === 'PERSONALITY' ? 'bg-gray-800 text-white border-b-2 border-primary-500' : 'text-gray-500 hover:text-white'}`}>Psicologia</button>
            <button onClick={() => setActiveTab('DIET')} className={`px-4 py-2 rounded-t-lg transition-colors font-medium whitespace-nowrap ${activeTab === 'DIET' ? 'bg-gray-800 text-white border-b-2 border-primary-500' : 'text-gray-500 hover:text-white'}`}>Dieta</button>
            <button onClick={() => setActiveTab('LOCATION')} className={`px-4 py-2 rounded-t-lg transition-colors font-medium whitespace-nowrap ${activeTab === 'LOCATION' ? 'bg-gray-800 text-white border-b-2 border-primary-500' : 'text-gray-500 hover:text-white'}`}>Encontro</button>
        </div>

        {/* --- INFO TAB --- */}
        {activeTab === 'INFO' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-4">
              <div 
                onClick={() => fileInputRef.current?.click()}
                className="aspect-square bg-gray-950 rounded-xl border-2 border-dashed border-gray-700 hover:border-primary-500 transition-all cursor-pointer flex items-center justify-center overflow-hidden relative group"
              >
                {isCompressing ? (
                   <span className="text-primary-500 animate-pulse">Comprimindo...</span>
                ) : image ? (
                   <img src={`data:image/jpeg;base64,${image}`} className="w-full h-full object-cover" loading="lazy" />
                ) : (
                   <div className="text-center p-4">
                     <span className="text-4xl block mb-2">📸</span>
                     <span className="text-sm text-gray-400">Clique para enviar imagem</span>
                   </div>
                )}
                {isAnalyzing && (
                    <div className="absolute top-2 right-2 bg-black/70 px-2 py-1 rounded text-xs text-primary-400 animate-pulse border border-primary-500/50">
                        Analisando...
                    </div>
                )}
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white font-medium">
                    Alterar Imagem
                </div>
                <input ref={fileInputRef} type="file" className="hidden" accept="image/*" onChange={handleFileChange} />
              </div>

              {/* Edit Image Tool */}
              {image && (
                  <div className="bg-gray-800 p-3 rounded-lg border border-gray-700">
                      <label className="text-xs text-gray-400 font-bold uppercase mb-2 block">Editor Visual (AI)</label>
                      <div className="flex gap-2">
                          <input 
                            type="text" 
                            value={editPrompt} 
                            onChange={e => setEditPrompt(e.target.value)} 
                            placeholder="Ex: Deixar mais monstro, olhos vermelhos..." 
                            className="flex-1 bg-gray-950 border border-gray-600 rounded px-2 text-sm text-white"
                          />
                          <button 
                            onClick={handleImageEdit} 
                            disabled={isEditingImg || !editPrompt}
                            className="px-3 py-1 bg-primary-600 rounded text-xs font-bold hover:bg-primary-500 disabled:opacity-50"
                          >
                              {isEditingImg ? '...' : 'Editar'}
                          </button>
                      </div>
                  </div>
              )}
            </div>

            <div className="space-y-4">
              <div className="bg-gray-800 p-4 rounded-lg border border-primary-500/30">
                  <label className="block text-sm font-bold text-primary-400 mb-2">⚡ Criação Rápida / Tom da História</label>
                  <input 
                      value={storyTone}
                      onChange={e => setStoryTone(e.target.value)}
                      className="w-full bg-gray-950 border border-gray-600 rounded-lg p-3 text-white focus:border-primary-500 outline-none mb-3"
                      placeholder="Ex: Gore, Sangrento, Terror Psicológico, Aventura..."
                  />
                  <button 
                    onClick={handleAutoFill}
                    disabled={isAutoFilling || !storyTone}
                    className="w-full py-3 bg-gradient-to-r from-yellow-600 to-orange-600 hover:from-yellow-500 hover:to-orange-500 rounded-lg font-bold text-white shadow-lg disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isAutoFilling ? 'Criando Personagem Completo...' : '✨ Criar Automaticamente pelo Tom'}
                  </button>
                  <p className="text-xs text-gray-500 mt-2 text-center">
                      *Deixe a descrição vazia para a IA inventar tudo baseada no Tom.
                  </p>
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">Nome</label>
                <input 
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="w-full bg-gray-950 border border-gray-700 rounded-lg p-3 text-white focus:border-primary-500 outline-none"
                  placeholder="Nome da Criatura"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                 <div>
                    <label className="block text-sm text-gray-400 mb-1">Altura</label>
                    <input value={height} onChange={e => setHeight(e.target.value)} className="w-full bg-gray-950 border border-gray-700 rounded-lg p-3 text-white text-sm" placeholder="Ex: 2.10m" />
                 </div>
                 <div>
                    <label className="block text-sm text-gray-400 mb-1">Peso</label>
                    <input value={weight} onChange={e => setWeight(e.target.value)} className="w-full bg-gray-950 border border-gray-700 rounded-lg p-3 text-white text-sm" placeholder="Ex: 150kg" />
                 </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                 <div>
                    <label className="block text-sm text-gray-400 mb-1">Idade</label>
                    <input value={age} onChange={e => setAge(e.target.value)} className="w-full bg-gray-950 border border-gray-700 rounded-lg p-3 text-white text-sm" placeholder="Ex: 300 anos" />
                 </div>
                 <div>
                    <label className="block text-sm text-gray-400 mb-1">Exp. de Vida</label>
                    <input value={lifeExpectancy} onChange={e => setLifeExpectancy(e.target.value)} className="w-full bg-gray-950 border border-gray-700 rounded-lg p-3 text-white text-sm" placeholder="Ex: 1000 anos" />
                 </div>
              </div>

              <div>
                 <label className="block text-sm text-gray-400 mb-1">Poderes / Habilidades</label>
                 <textarea value={powers} onChange={e => setPowers(e.target.value)} className="w-full bg-gray-950 border border-gray-700 rounded-lg p-3 text-white h-20 text-sm" placeholder="Fogo, voar, invisibilidade..." />
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">Descrição Visual & História</label>
                <textarea 
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  className="w-full bg-gray-950 border border-gray-700 rounded-lg p-3 text-white h-40 text-sm"
                  placeholder="Descreva ou deixe vazio para a IA criar..."
                />
              </div>
            </div>
          </div>
        )}

        {/* --- PERSONALITY TAB --- */}
        {activeTab === 'PERSONALITY' && (
          <div className="space-y-4">
             {QUESTIONS.map((q, i) => (
               <div key={i}>
                 <label className="block text-sm text-gray-400 mb-1">{q}</label>
                 <input 
                   value={answers[i] || ''}
                   onChange={e => setAnswers({...answers, [i]: e.target.value})}
                   className="w-full bg-gray-950 border border-gray-700 rounded-lg p-3 text-white text-sm"
                   placeholder="Resposta..."
                 />
               </div>
             ))}
          </div>
        )}

        {/* --- DIET TAB --- */}
        {activeTab === 'DIET' && (
           <div className="space-y-4">
               <div>
                   <label className="block text-sm text-gray-400 mb-2">Tipo de Dieta</label>
                   <div className="flex gap-4">
                       <label className="flex items-center gap-2 text-white">
                           <input type="radio" checked={dietType === 'HERBIVORE'} onChange={() => setDietType('HERBIVORE')} />
                           Vegano/Herbívoro
                       </label>
                       <label className="flex items-center gap-2 text-white">
                           <input type="radio" checked={dietType === 'CARNIVORE'} onChange={() => setDietType('CARNIVORE')} />
                           Carnívoro
                       </label>
                   </div>
               </div>
               
               <div>
                   <label className="block text-sm text-gray-400 mb-1">Detalhes (O que come?)</label>
                   <input 
                      value={dietDetails} 
                      onChange={e => setDietDetails(e.target.value)} 
                      className="w-full bg-gray-950 border border-gray-700 rounded-lg p-3 text-white text-sm" 
                      placeholder="Ex: Frutas vermelhas, Cervos..." 
                   />
               </div>

               {dietType === 'CARNIVORE' && (
                   <div className="p-4 bg-red-900/20 border border-red-900 rounded-lg space-y-3">
                       <label className="flex items-center gap-2 text-red-200 font-bold">
                           <input type="checkbox" checked={eatsHumans} onChange={e => setEatsHumans(e.target.checked)} />
                           ⚠️ Come Humanos?
                       </label>

                       {eatsHumans && (
                           <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pl-6">
                               <div>
                                   <label className="block text-xs text-red-300 mb-1">Grupo de Idade</label>
                                   <input value={humanPreferences.ageGroup} onChange={e => setHumanPreferences({...humanPreferences, ageGroup: e.target.value})} className="w-full bg-gray-950 border border-red-900 rounded p-2 text-white text-xs" />
                               </div>
                               <div>
                                   <label className="block text-xs text-red-300 mb-1">Tipo Físico</label>
                                   <input value={humanPreferences.bodyType} onChange={e => setHumanPreferences({...humanPreferences, bodyType: e.target.value})} className="w-full bg-gray-950 border border-red-900 rounded p-2 text-white text-xs" />
                               </div>
                               <div>
                                   <label className="block text-xs text-red-300 mb-1">Preferência de Sabor</label>
                                   <input value={humanPreferences.tastePreference} onChange={e => setHumanPreferences({...humanPreferences, tastePreference: e.target.value})} className="w-full bg-gray-950 border border-red-900 rounded p-2 text-white text-xs" />
                               </div>
                           </div>
                       )}
                   </div>
               )}
           </div>
        )}

        {/* --- LOCATION TAB --- */}
        {activeTab === 'LOCATION' && (
            <div className="space-y-4">
                <div>
                   <label className="block text-sm text-gray-400 mb-1">Ambiente / Local do Encontro</label>
                   <textarea 
                      value={environment} 
                      onChange={e => setEnvironment(e.target.value)} 
                      className="w-full bg-gray-950 border border-gray-700 rounded-lg p-3 text-white h-24 text-sm" 
                      placeholder="Ex: Uma caverna úmida e escura..." 
                   />
                </div>
                <div>
                    <label className="block text-sm text-gray-400 mb-2">Quem viu quem primeiro?</label>
                    <div className="grid grid-cols-3 gap-2">
                        <button 
                            onClick={() => setWhoSawFirst('USER')} 
                            className={`p-3 rounded border text-sm ${whoSawFirst === 'USER' ? 'bg-primary-900 border-primary-500 text-white' : 'border-gray-700 text-gray-400'}`}
                        >
                            Usuário viu (Surpresa)
                        </button>
                        <button 
                            onClick={() => setWhoSawFirst('CHARACTER')} 
                            className={`p-3 rounded border text-sm ${whoSawFirst === 'CHARACTER' ? 'bg-primary-900 border-primary-500 text-white' : 'border-gray-700 text-gray-400'}`}
                        >
                            Personagem viu (Emboscada)
                        </button>
                        <button 
                            onClick={() => setWhoSawFirst('BOTH')} 
                            className={`p-3 rounded border text-sm ${whoSawFirst === 'BOTH' ? 'bg-primary-900 border-primary-500 text-white' : 'border-gray-700 text-gray-400'}`}
                        >
                            Ambos (Frente a Frente)
                        </button>
                    </div>
                </div>
            </div>
        )}

        <div className="pt-6 border-t border-gray-800">
            <button 
                onClick={handleComplete}
                className="w-full bg-primary-600 hover:bg-primary-500 text-white font-bold py-4 rounded-lg shadow-lg shadow-primary-900/20 transition-all hover:scale-[1.01]"
            >
                Confirmar Personagem
            </button>
        </div>

      </div>
    </div>
  );
};

export default CharacterSetup;
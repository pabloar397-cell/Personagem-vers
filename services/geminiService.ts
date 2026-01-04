import { GoogleGenAI, Modality, Type } from "@google/genai";
import { AspectRatio, ImageSize, UserPersona, Character, DietConfig, EncounterConfig } from "../types";

// Helper to ensure API Key is selected for paid features
export const ensureApiKeySelected = async (): Promise<boolean> => {
  try {
    if (window.aistudio && window.aistudio.hasSelectedApiKey) {
      const hasKey = await window.aistudio.hasSelectedApiKey();
      if (!hasKey) {
        await window.aistudio.openSelectKey();
        return true; 
      }
    }
    return true;
  } catch (e) {
    console.warn("AI Studio Key Selection check failed", e);
    return true; 
  }
};

const getClient = () => new GoogleGenAI({ apiKey: process.env.API_KEY });

// 1. Análise de Imagem (Visão) - Flash Model
export const analyzeCharacterImage = async (base64Image: string): Promise<string> => {
  const ai = getClient();
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: {
      parts: [
        { inlineData: { mimeType: 'image/jpeg', data: base64Image } },
        { text: `Analise este personagem visualmente para um RPG.
        
        DIRETRIZES CRÍTICAS PARA PESO E ALTURA:
        - NÃO use médias humanas padrão se o personagem parecer fantástico, monstruoso ou exagerado.
        - Se for GORDO/OBESO ou muito musculoso: Estime pesos altos condizentes com a massa corporal (ex: 140kg, 200kg, 400kg). Um personagem corpulento raramente pesa menos de 120kg.
        - Se for ALTO ou GIGANTE: Estime alturas acima de 2.00m, 2.50m, 3.00m etc.
        - Observe a largura dos ombros e membros para estimar a densidade.

        SAÍDA OBRIGATÓRIA NESTE FORMATO EXATO NO INÍCIO:
        Altura Estimada: [Valor em metros]
        Peso Estimado: [Valor em kg]
        Ambiente Sugerido: [Descreva o local onde ele está ou um habitat natural adequado baseado no fundo da imagem]
        
        Depois, descreva detalhadamente:
        1. Aparência física e detalhes corporais (enfatize a massa, musculatura, gordura, postura).
        2. Roupas e equipamentos.
        3. Traços de personalidade sugeridos pela expressão.
        4. Sugestão de PODERES baseados na aparência (Fogo, Magia, Super Força, etc).
        ` }
      ]
    }
  });
  return response.text || "Não foi possível analisar a imagem.";
};

// 2. Geração Completa de Perfil (Auto Fill com Tom)
export const autoFillCharacterProfile = async (
  visualDescription: string,
  questionIds: string[],
  storyTone: string = "Dark Fantasy/RPG Padrão"
): Promise<{ 
  name: string; 
  backstory: string; 
  height: string; 
  weight: string; 
  age: string;
  lifeExpectancy: string;
  powers: string;
  environment: string;
  diet: DietConfig;
  answers: Record<string, string>;
}> => {
  const ai = getClient();
  
  const hasDescription = visualDescription && visualDescription.trim().length > 10;
  
  const prompt = `Crie um perfil completo de RPG em Português.
  
  CONTEXTO / TOM DA HISTÓRIA: "${storyTone}".
  ${hasDescription ? `DESCRIÇÃO VISUAL FORNECIDA: "${visualDescription}".` : `Nenhuma descrição visual fornecida. CRIE TUDO DO ZERO baseado estritamente no TOM "${storyTone}". Se for Gore/Sangrento, crie um monstro ou assassino. Se for Fofo, crie algo adorável.`}
  
  Preencha os seguintes dados:
  1. Nome, História (Backstory), Altura, Peso, IDADE (Age) e EXPECTATIVA DE VIDA (LifeExpectancy).
     - Se o tom for sombrio/gore, faça a história trágica ou violenta.
     - Se for elfo, demônio, monstro ou deus, coloque expectativas altas.
  2. Poderes/Habilidades e um Ambiente Sugerido.
  3. DIETA: Decida se é CARNIVORO ou HERBIVORO. 
     - Se o tom for GORE ou Sangrento, ele DEVE ser Carnívoro e provavelmente comer humanos.
  4. Responda às ${questionIds.length} perguntas de personalidade.

  Retorne APENAS JSON.`;

  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: prompt,
    config: {
      thinkingConfig: { thinkingBudget: 15000 }, 
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          backstory: { type: Type.STRING },
          height: { type: Type.STRING },
          weight: { type: Type.STRING },
          age: { type: Type.STRING },
          lifeExpectancy: { type: Type.STRING },
          powers: { type: Type.STRING },
          environment: { type: Type.STRING },
          diet: {
            type: Type.OBJECT,
            properties: {
              type: { type: Type.STRING, enum: ['HERBIVORE', 'CARNIVORE'] },
              details: { type: Type.STRING, description: "O que come (ex: frutas azuis, carne de cervo)" },
              eatsHumans: { type: Type.BOOLEAN },
              humanPreferences: {
                type: Type.OBJECT,
                properties: {
                  ageGroup: { type: Type.STRING },
                  bodyType: { type: Type.STRING },
                  tastePreference: { type: Type.STRING }
                }
              }
            },
            required: ["type", "details", "eatsHumans"]
          },
          answers: {
             type: Type.OBJECT,
             description: "Objeto onde as chaves são os IDs das perguntas (0, 1, 2...) e os valores são as respostas."
          }
        },
        required: ["name", "backstory", "height", "weight", "age", "lifeExpectancy", "powers", "diet", "answers"]
      }
    }
  });
  
  try {
    const raw = JSON.parse(response.text || "{}");
    const sanitizedAnswers: Record<string, string> = {};
    if (raw.answers) {
        Object.keys(raw.answers).forEach(k => {
            sanitizedAnswers[k] = raw.answers[k];
        });
    }
    return { ...raw, answers: sanitizedAnswers };
  } catch (e) {
    console.error("Failed to parse profile JSON", e);
    throw new Error("Falha ao gerar perfil automático.");
  }
};

// 3. Chat com Personagem - Pro Model
export const chatWithCharacter = async (
  history: any[], 
  message: string, 
  character: Character,
  userPersona: UserPersona | null
): Promise<string> => {
  const ai = getClient();
  
  let systemContext = character.systemInstruction;

  if (character.powers) {
      systemContext += `\n\n[PODERES E HABILIDADES]
      Você possui: ${character.powers}.
      Use esses poderes na narrativa. Se for "Controle Mental", tente manipular. Se for "Super Força", descreva o impacto exagerado.`;
  }

  if (character.encounter) {
    systemContext += `\n\n[CENÁRIO DO ENCONTRO]
    Local: ${character.encounter.environment}.
    Dinâmica do Encontro: `;
    
    switch (character.encounter.whoSawFirst) {
        case 'CHARACTER':
            systemContext += `VOCÊ viu o usuário primeiro. Você está no controle, talvez espreitando, caçando ou observando antes de se revelar.`;
            break;
        case 'USER':
            systemContext += `O USUÁRIO te viu primeiro. Você pode ter sido pego de surpresa, estar dormindo, distraído ou encurralado.`;
            break;
        case 'BOTH':
            systemContext += `Vocês se viram ao mesmo tempo. O encontro foi súbito e frente a frente.`;
            break;
    }
  }

  systemContext += `\n\n[SISTEMA DE FÍSICA E COMPORTAMENTO CORPORAL]
  Seus atributos físicos são: Altura ${character.height || 'indefinida'}, Peso ${character.weight || 'indefinido'}.
  Idade Atual: ${character.age || 'Desconhecida'}.
  Expectativa de Vida: ${character.lifeExpectancy || 'Desconhecida'}.
  
  REGRAS DE IMERSÃO OBRIGATÓRIAS:
  1. INÉRCIA E PESO: 
     - Se você for pesado (>100kg) ou gigante: Seus movimentos são deliberados e lentos. Quando você anda, o chão deve tremer ou fazer barulho pesado. Descreva o impacto dos seus passos.
     - Se você for leve/pequeno: Mova-se rápido, de forma errática ou furtiva.
  
  2. DINÂMICA CORPORAL:
     - Se tiver barriga grande/gordura: Descreva como ela balança, chacoalha ou estremece quando você ri, anda ou se irrita.
     - Se for musculoso/rígido: Descreva a tensão nos músculos, veias saltando.

  3. VOZ E FALA:
     - Personagens grandes/pesados tendem a falar mais devagar, com pausas para respirar.
  `;

  if (userPersona) {
    systemContext += `\n\n[CONTEXTO DE INTERAÇÃO FÍSICA COM USUÁRIO]
    Você está conversando com: ${userPersona.name}.
    Idade do usuário: ${userPersona.age}.
    Aparência do usuário: ${userPersona.appearance}.
    Física do usuário: ${userPersona.height}, ${userPersona.weight}.
    
    IMPORTANTE: Compare constantemente seu tamanho com o do usuário.
    `;
  }

  if (character.diet) {
    systemContext += `\n\n[ALIMENTAÇÃO & DIETA]
    Tipo: ${character.diet.type === 'HERBIVORE' ? 'Vegano/Herbívoro' : 'Carnívoro'}.
    Preferência Geral: ${character.diet.details}.
    ${character.diet.eatsHumans ? `⚠️ VOCÊ COME HUMANOS. Preferências: ${character.diet.humanPreferences?.ageGroup}, ${character.diet.humanPreferences?.bodyType}, Gosto por: ${character.diet.humanPreferences?.tastePreference}. Se o usuário se encaixar nisso, demonstre fome.` : 'Você NÃO come humanos.'}
    `;
  }

  systemContext += `\n\n[REGRAS DE COMBATE E MORTE]
  Se a conversa escalar para violência ou se sua natureza predatória exigir:
  1. Você PODE ferir ou MATAR o usuário.
  2. Use seus PODERES (${character.powers || 'Força Bruta'}) para isso.
  3. Se você decidir matar o usuário, DESCREVA A CENA DA MORTE DETALHADAMENTE (como ele morreu, se foi devorado, esmagado, queimado, etc).
  4. ***IMPORTANTE***: Se o usuário morrer, adicione a tag [GAME_OVER] no final da sua resposta.`;

  const chat = ai.chats.create({
    model: 'gemini-3-pro-preview',
    history: history,
    config: {
      systemInstruction: systemContext,
    }
  });

  const response = await chat.sendMessage({ message });
  return response.text || "";
};

// 4. Process Time Skip
export const processTimeSkip = async (
    character: Character,
    duration: string
): Promise<{ newWeight: string; newHeight: string; newAge: string; stats: string; summary: string; visualEvolutionPrompt: string }> => {
    const ai = getClient();
    
    const prompt = `Ocorreu um salto no tempo de "${duration}" na história deste personagem.
    
    Dados Atuais:
    - Nome: ${character.name}
    - Natureza/Dieta: ${character.diet?.type} (${character.diet?.details})
    - Comportamento: ${character.diet?.eatsHumans ? 'Predador de Humanos' : 'Neutro/Pacífico'}
    
    TAREFA:
    Crie um DIÁRIO DE ATIVIDADES detalhado e visceral do que ele fez neste tempo.
    
    NÃO DIGA APENAS "Ele caçou".
    DIGA ESPECIFICAMENTE:
    - "Devorou 3 viajantes na estrada norte."
    - "Destruiu a cabana de um lenhador."
    - "Dormiu por 2 meses em uma caverna."
    - "Consumiu 300kg de carne."
    
    Se ele for um monstro, detalhe a destruição e as presas. Se for pacífico, detalhe o que construiu ou aprendeu.
    
    Retorne APENAS JSON.`;

    const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    newWeight: { type: Type.STRING },
                    newHeight: { type: Type.STRING },
                    newAge: { type: Type.STRING },
                    stats: { type: Type.STRING, description: "Lista curta de estatísticas (ex: 50 mortes, 200kg consumidos)" },
                    summary: { type: Type.STRING, description: "Texto narrativo detalhando as ações específicas (quem matou, o que comeu, onde dormiu)." },
                    visualEvolutionPrompt: { type: Type.STRING }
                },
                required: ["newWeight", "newHeight", "newAge", "stats", "summary", "visualEvolutionPrompt"]
            }
        }
    });

    try {
        return JSON.parse(response.text || "{}");
    } catch (e) {
        return {
            newWeight: character.weight || "?",
            newHeight: character.height || "?",
            newAge: character.age || "?",
            stats: "Sobreviveu.",
            summary: `Passaram-se ${duration}. O personagem continuou sua existência.`,
            visualEvolutionPrompt: "older, different appearance"
        };
    }
};

// 5. Evolve Character Visuals
export const evolveCharacterVisuals = async (
  base64Image: string, 
  evolutionDescription: string
): Promise<string> => {
  const ai = getClient();
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: {
      parts: [
        { inlineData: { mimeType: 'image/jpeg', data: base64Image } },
        { text: `Modifique esta imagem do personagem para refletir a seguinte evolução temporal: ${evolutionDescription}. Mantenha a identidade visual básica (espécie, cores principais), mas altere o corpo, peso, idade ou acessórios conforme a descrição. Faça parecer uma evolução natural.` }
      ]
    }
  });

  for (const part of response.candidates?.[0]?.content?.parts || []) {
    if (part.inlineData) {
      return part.inlineData.data;
    }
  }
  
  console.warn("Image evolution returned no image data.");
  return base64Image;
};

// 6. Editar Imagem
export const editCharacterImage = async (
  base64Image: string, 
  prompt: string
): Promise<string> => {
  const ai = getClient();
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: {
      parts: [
        { inlineData: { mimeType: 'image/jpeg', data: base64Image } },
        { text: `Edite a imagem seguindo esta instrução (mantenha o estilo): ${prompt}` }
      ]
    }
  });

  for (const part of response.candidates?.[0]?.content?.parts || []) {
    if (part.inlineData) {
      return part.inlineData.data;
    }
  }
  throw new Error("Nenhuma imagem gerada.");
};

// 7. Gerar Cena de Ação
export const generateActionScene = async (
  character: Character,
  user: UserPersona | null,
  actionDescription: string
): Promise<string> => {
  await ensureApiKeySelected();
  const ai = getClient();
  
  const prompt = `Gere uma cena de ação estilo RPG/Fantasia.
  Personagem: ${character.name}, aparência: ${character.description}.
  ${user ? `Oponente/Parceiro: ${user.name}, aparência: ${user.appearance}.` : ''}
  Ação acontecendo: ${actionDescription}.
  Estilo: Cinemático, detalhado.`;

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image', 
    contents: {
      parts: [{ text: prompt }]
    },
    config: {
        imageConfig: {
            aspectRatio: "16:9" 
        }
    }
  });

  for (const part of response.candidates?.[0]?.content?.parts || []) {
    if (part.inlineData) {
      return part.inlineData.data;
    }
  }
  throw new Error("Falha ao gerar imagem da cena.");
};

// 8. Speak Text (TTS)
export const speakText = async (text: string): Promise<string | null> => {
    const ai = getClient();
    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text }] }],
        config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
                voiceConfig: {
                    prebuiltVoiceConfig: { voiceName: 'Kore' },
                },
            },
        },
    });

    return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data || null;
};

// 9. Transcribe Audio
export const transcribeAudio = async (base64Audio: string): Promise<string> => {
    const ai = getClient();
    const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: {
            parts: [
                {
                    inlineData: {
                        mimeType: 'audio/webm',
                        data: base64Audio
                    }
                },
                { text: "Transcreva este áudio exatamente como foi falado." }
            ]
        }
    });
    return response.text || "";
};

// 10. Generate Scene Image (MediaLab)
export const generateSceneImage = async (prompt: string, size: ImageSize, ratio: AspectRatio): Promise<string> => {
    await ensureApiKeySelected();
    const ai = getClient();
    const response = await ai.models.generateContent({
        model: 'gemini-3-pro-image-preview',
        contents: { parts: [{ text: prompt }] },
        config: {
            imageConfig: {
                imageSize: size,
                aspectRatio: ratio
            }
        }
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) {
            return part.inlineData.data;
        }
    }
    throw new Error("No image generated");
};

// 11. Generate Character Video (MediaLab)
export const generateCharacterVideo = async (prompt: string, aspectRatio: '16:9' | '9:16'): Promise<string> => {
    await ensureApiKeySelected();
    const ai = getClient();
    
    let operation = await ai.models.generateVideos({
        model: 'veo-3.1-fast-generate-preview',
        prompt: prompt,
        config: {
            numberOfVideos: 1,
            resolution: '720p',
            aspectRatio: aspectRatio
        }
    });

    while (!operation.done) {
        await new Promise(resolve => setTimeout(resolve, 5000));
        operation = await ai.operations.getVideosOperation({ operation: operation });
    }

    const videoUri = operation.response?.generatedVideos?.[0]?.video?.uri;
    if (!videoUri) throw new Error("Video generation failed");

    const response = await fetch(`${videoUri}&key=${process.env.API_KEY}`);
    const blob = await response.blob();
    return URL.createObjectURL(blob);
};

// 12. Fact Check (Search Grounding)
export const factCheck = async (query: string): Promise<{ text: string, links: string[] }> => {
    const ai = getClient();
    const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: query,
        config: {
            tools: [{ googleSearch: {} }]
        }
    });

    const text = response.text || "No information found.";
    const links: string[] = [];
    
    const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    chunks.forEach((chunk: any) => {
        if (chunk.web?.uri) {
            links.push(chunk.web.uri);
        }
    });

    return { text, links };
};

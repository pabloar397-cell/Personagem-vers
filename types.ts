export interface Character {
  id: string;
  name: string;
  description: string;
  baseImage: string; // Base64
  systemInstruction: string;
  height?: string;
  weight?: string;
  powers?: string; // Poderes e Habilidades
  age?: string; // Idade atual
  lifeExpectancy?: string; // Expectativa de vida total
  diet?: DietConfig;
  encounter?: EncounterConfig;
  questionAnswers?: Record<string, string>; // ID da pergunta -> Resposta
}

export interface EncounterConfig {
  environment: string; // Onde estão
  whoSawFirst: 'USER' | 'CHARACTER' | 'BOTH'; // Quem viu quem primeiro
}

export interface DietConfig {
  type: 'HERBIVORE' | 'CARNIVORE'; // Vegano/Herbívoro ou Carnívoro
  details: string; // O que come especificamente (ex: Frutas, Bois)
  eatsHumans: boolean;
  humanPreferences?: HumanPreferences;
}

export interface HumanPreferences {
  ageGroup: string; // Crianças, Adultos, Idosos, Qualquer um
  bodyType: string; // Magros, Gordos, Musculosos
  tastePreference: string; // Ex: Crocantes, Suculentos
}

export interface UserPersona {
  name: string;
  appearance: string; // Descrição visual (roupas, cabelo)
  baseImage?: string; // Base64 opcional
  height: string;
  weight: string;
  age: string;
}

export interface Message {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: number;
  isDeath?: boolean;
  generatedImage?: string; // Base64 scene
}

export interface ChatSession {
  id: string;
  character: Character;
  userPersona: UserPersona | null;
  messages: Message[];
  lastUpdated: number;
  previewText?: string;
}

export enum ViewMode {
  WELCOME = 'WELCOME',
  SETUP = 'SETUP',
  USER_SETUP = 'USER_SETUP',
  CHAT = 'CHAT',
  MEDIA = 'MEDIA'
}

export enum AspectRatio {
  RATIO_1_1 = '1:1',
  RATIO_3_4 = '3:4',
  RATIO_4_3 = '4:3',
  RATIO_9_16 = '9:16',
  RATIO_16_9 = '16:9'
}

export enum ImageSize {
  SIZE_1K = '1K',
  SIZE_2K = '2K',
  SIZE_4K = '4K'
}
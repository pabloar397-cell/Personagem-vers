import React, { useState, useRef } from 'react';
import { UserPersona } from '../types';
import { blobToBase64 } from '../services/audioUtils';

interface Props {
  onComplete: (user: UserPersona) => void;
  existingUser: UserPersona | null;
  onCancel: () => void;
}

const UserSetup: React.FC<Props> = ({ onComplete, existingUser, onCancel }) => {
  const [name, setName] = useState(existingUser?.name || '');
  const [appearance, setAppearance] = useState(existingUser?.appearance || '');
  const [height, setHeight] = useState(existingUser?.height || '');
  const [weight, setWeight] = useState(existingUser?.weight || '');
  const [age, setAge] = useState(existingUser?.age || '');
  const [image, setImage] = useState<string | null>(existingUser?.baseImage || null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const base64 = await blobToBase64(e.target.files[0]);
      setImage(base64);
    }
  };

  const handleSubmit = () => {
    if (!name || !height || !weight || !age) return;
    onComplete({
      name,
      appearance: appearance || "Aparência padrão.",
      height,
      weight,
      age,
      baseImage: image || undefined
    });
  };

  return (
    <div className="max-w-2xl mx-auto p-6 bg-gray-900 rounded-xl border border-gray-800 shadow-2xl mt-10">
      <h2 className="text-2xl font-bold mb-6 text-primary-400">Seu Avatar</h2>
      <p className="text-gray-400 mb-6 text-sm">Defina suas características. Isso afeta como o personagem percebe você (ex: olhar para cima se você for muito alto, etc.).</p>

      <div className="flex flex-col md:flex-row gap-6">
        <div 
          className="w-32 h-32 md:w-40 md:h-40 bg-gray-950 rounded-full border-2 border-dashed border-gray-700 flex items-center justify-center overflow-hidden flex-shrink-0 cursor-pointer hover:border-primary-500 transition-colors"
          onClick={() => fileInputRef.current?.click()}
        >
          {image ? (
            <img 
              src={`data:image/png;base64,${image}`} 
              alt="User" 
              className="w-full h-full object-cover" 
              loading="lazy"
              decoding="async"
            />
          ) : (
            <span className="text-4xl">👤</span>
          )}
          <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileChange} />
        </div>

        <div className="flex-1 space-y-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Seu Nome</label>
            <input 
              type="text" 
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-gray-950 border border-gray-700 rounded px-3 py-2 text-white focus:border-primary-500 focus:outline-none"
              placeholder="Ex: Viajante"
            />
          </div>
          
          <div className="flex gap-3">
             <div className="flex-1">
              <label className="block text-xs text-gray-500 mb-1">Idade</label>
              <input 
                type="text" 
                value={age}
                onChange={(e) => setAge(e.target.value)}
                className="w-full bg-gray-950 border border-gray-700 rounded px-3 py-2 text-white focus:border-primary-500 focus:outline-none"
                placeholder="Ex: 25 anos"
              />
            </div>
            <div className="flex-1">
              <label className="block text-xs text-gray-500 mb-1">Altura</label>
              <input 
                type="text" 
                value={height}
                onChange={(e) => setHeight(e.target.value)}
                className="w-full bg-gray-950 border border-gray-700 rounded px-3 py-2 text-white focus:border-primary-500 focus:outline-none"
                placeholder="Ex: 1.80m"
              />
            </div>
            <div className="flex-1">
              <label className="block text-xs text-gray-500 mb-1">Peso</label>
              <input 
                type="text" 
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                className="w-full bg-gray-950 border border-gray-700 rounded px-3 py-2 text-white focus:border-primary-500 focus:outline-none"
                placeholder="Ex: 80kg"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">Descrição Visual & Roupas</label>
            <textarea 
              value={appearance}
              onChange={(e) => setAppearance(e.target.value)}
              className="w-full h-24 bg-gray-950 border border-gray-700 rounded px-3 py-2 text-white focus:border-primary-500 focus:outline-none resize-none"
              placeholder="O que você está vestindo? Cor do cabelo?"
            />
          </div>
        </div>
      </div>

      <div className="flex gap-4 mt-8">
        <button onClick={onCancel} className="flex-1 bg-gray-800 hover:bg-gray-700 py-2 rounded text-sm font-medium">
          Cancelar
        </button>
        <button onClick={handleSubmit} disabled={!name || !age} className="flex-1 bg-primary-600 hover:bg-primary-500 py-2 rounded text-sm font-medium disabled:opacity-50">
          Salvar Perfil
        </button>
      </div>
    </div>
  );
};

export default UserSetup;
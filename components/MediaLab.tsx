import React, { useState } from 'react';
import { generateSceneImage, generateCharacterVideo, factCheck } from '../services/geminiService';
import { AspectRatio, ImageSize } from '../types';

const MediaLab: React.FC = () => {
  const [prompt, setPrompt] = useState('');
  const [activeTab, setActiveTab] = useState<'IMAGE' | 'VIDEO' | 'SEARCH'>('IMAGE');
  
  // Image State
  const [imgSize, setImgSize] = useState<ImageSize>(ImageSize.SIZE_1K);
  const [imgRatio, setImgRatio] = useState<AspectRatio>(AspectRatio.RATIO_1_1);
  const [generatedImg, setGeneratedImg] = useState<string | null>(null);

  // Video State
  const [vidRatio, setVidRatio] = useState<'16:9' | '9:16'>('16:9');
  const [generatedVid, setGeneratedVid] = useState<string | null>(null);

  // Search State
  const [searchResult, setSearchResult] = useState<{text: string, links: string[]} | null>(null);

  const [loading, setLoading] = useState(false);

  const handleGenerate = async () => {
    if (!prompt) return;
    setLoading(true);
    setGeneratedImg(null);
    setGeneratedVid(null);
    setSearchResult(null);

    try {
      if (activeTab === 'IMAGE') {
        const result = await generateSceneImage(prompt, imgSize, imgRatio);
        setGeneratedImg(result);
      } else if (activeTab === 'VIDEO') {
        const result = await generateCharacterVideo(prompt, vidRatio);
        setGeneratedVid(result);
      } else {
        const result = await factCheck(prompt);
        setSearchResult(result);
      }
    } catch (e) {
      console.error(e);
      alert("Generation failed. See console.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 p-6 h-full overflow-y-auto">
      <h2 className="text-2xl font-bold mb-6 text-primary-400">Gemini Media Lab</h2>

      <div className="flex gap-2 mb-6 border-b border-gray-700 pb-2">
        {(['IMAGE', 'VIDEO', 'SEARCH'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
              activeTab === tab ? 'bg-gray-800 text-primary-400 border-b-2 border-primary-500' : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            {tab === 'IMAGE' ? 'Nano Banana Pro' : tab === 'VIDEO' ? 'Veo 3 Video' : 'Fact Check'}
          </button>
        ))}
      </div>

      <div className="space-y-4">
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder={activeTab === 'SEARCH' ? "Ask a question..." : "Describe the scene..."}
          className="w-full bg-gray-950 border border-gray-700 rounded p-3 text-white focus:border-primary-500"
          rows={3}
        />

        {activeTab === 'IMAGE' && (
          <div className="flex flex-wrap gap-4">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Size</label>
              <select value={imgSize} onChange={(e) => setImgSize(e.target.value as ImageSize)} className="bg-gray-800 text-white p-2 rounded text-sm">
                {Object.values(ImageSize).map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Ratio</label>
              <select value={imgRatio} onChange={(e) => setImgRatio(e.target.value as AspectRatio)} className="bg-gray-800 text-white p-2 rounded text-sm">
                {Object.values(AspectRatio).map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
          </div>
        )}

        {activeTab === 'VIDEO' && (
          <div>
            <label className="block text-xs text-gray-400 mb-1">Format</label>
            <div className="flex gap-2">
              <button 
                onClick={() => setVidRatio('16:9')} 
                className={`px-3 py-1 rounded border ${vidRatio === '16:9' ? 'bg-primary-900 border-primary-500' : 'border-gray-600'}`}
              >
                Landscape (16:9)
              </button>
              <button 
                onClick={() => setVidRatio('9:16')} 
                className={`px-3 py-1 rounded border ${vidRatio === '9:16' ? 'bg-primary-900 border-primary-500' : 'border-gray-600'}`}
              >
                Portrait (9:16)
              </button>
            </div>
            <p className="text-xs text-yellow-500 mt-2">Note: Video generation takes 1-2 minutes.</p>
          </div>
        )}

        <button
          onClick={handleGenerate}
          disabled={loading || !prompt}
          className="w-full bg-gradient-to-r from-primary-600 to-purple-600 hover:from-primary-500 hover:to-purple-500 py-3 rounded font-bold shadow-lg disabled:opacity-50"
        >
          {loading ? "Processing..." : "Generate"}
        </button>

        {/* Results */}
        <div className="mt-8">
          {generatedImg && (
            <div className="border border-gray-700 rounded-lg p-2 bg-gray-950">
              <img src={`data:image/png;base64,${generatedImg}`} className="w-full h-auto rounded" />
              <a href={`data:image/png;base64,${generatedImg}`} download="gen_image.png" className="block text-center mt-2 text-sm text-primary-400 hover:underline">Download</a>
            </div>
          )}
          
          {generatedVid && (
            <div className="border border-gray-700 rounded-lg p-2 bg-gray-950">
              <video controls src={generatedVid} className="w-full h-auto rounded" />
            </div>
          )}

          {searchResult && (
            <div className="bg-gray-800 p-4 rounded text-sm text-gray-200">
              <p className="mb-4 whitespace-pre-wrap">{searchResult.text}</p>
              {searchResult.links.length > 0 && (
                <div className="border-t border-gray-700 pt-2">
                  <p className="text-gray-500 text-xs mb-1">Sources:</p>
                  <ul className="list-disc pl-4 space-y-1">
                    {searchResult.links.map((link, i) => (
                      <li key={i}>
                        <a href={link} target="_blank" rel="noreferrer" className="text-primary-400 hover:underline truncate block">
                          {link}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MediaLab;
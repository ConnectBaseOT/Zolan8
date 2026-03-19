import { useState, useEffect, useRef, ChangeEvent } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Aperture, Upload, Sparkles, Image as ImageIcon, X, Loader2, Link as LinkIcon, Copy, Check, Key } from 'lucide-react';
import { GoogleGenAI } from '@google/genai';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, addDoc, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { saveImageLocally, getImageLocally } from '../lib/idb';
import { LightFlowLoader } from './LightFlowLoader';
import { cn } from '../lib/utils';

interface Generation {
  id: string;
  prompt: string;
  enhancedPrompt: string;
  createdAt: string;
  localImage?: string;
}

export function ImageLab({ sessionId, onClearKey }: { sessionId: string, onClearKey: () => void }) {
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [referenceImages, setReferenceImages] = useState<{ url: string; base64: string; mimeType: string }[]>([]);
  const [generations, setGenerations] = useState<Generation[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [copiedLink, setCopiedLink] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!sessionId) return;

    const q = query(
      collection(db, 'generations'),
      where('sessionId', '==', sessionId),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const gens: Generation[] = [];
      for (const doc of snapshot.docs) {
        const data = doc.data();
        let localImage = await getImageLocally(doc.id);
        
        // If not in local IndexedDB, try to use the one from Firestore if it exists
        if (!localImage && data.imageData) {
          localImage = data.imageData;
          // Cache it locally for next time
          await saveImageLocally(doc.id, localImage);
        }
        
        gens.push({
          id: doc.id,
          prompt: data.prompt,
          enhancedPrompt: data.enhancedPrompt,
          createdAt: data.createdAt,
          localImage
        });
      }
      setGenerations(gens);
      setLoadingHistory(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'generations');
    });

    return () => unsubscribe();
  }, [sessionId]);

  const handleFileUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []) as File[];
    if (files.length + referenceImages.length > 3) {
      alert('Maximum 3 reference images allowed.');
      return;
    }

    files.forEach((file: File) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const result = event.target?.result as string;
        const base64 = result.split(',')[1];
        setReferenceImages(prev => [...prev, { url: result, base64, mimeType: file.type }]);
      };
      reader.readAsDataURL(file);
    });
    
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeImage = (index: number) => {
    setReferenceImages(prev => prev.filter((_, i) => i !== index));
  };

  const enhancePrompt = (basePrompt: string) => {
    const enhancement = "shot on 35mm lens, DSLR, extremely detailed, 8k resolution, photorealistic, cinematic lighting, natural skin texture, subtle film grain, high dynamic range, masterpiece, award-winning photography, physically accurate lighting, real-world camera simulation, subtle imperfections";
    return `${basePrompt}, ${enhancement}`;
  };

  const generateImage = async () => {
    if (!prompt.trim()) return;
    setIsGenerating(true);

    try {
      // @ts-ignore
      const apiKey = localStorage.getItem('zolan8_api_key') || (typeof process !== 'undefined' && process.env ? process.env.API_KEY : undefined) || process.env.GEMINI_API_KEY;
      const ai = new GoogleGenAI({ apiKey });

      // Safety Handling Layer: Reframe prompt if necessary
      const reframeResponse = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `You are a prompt safety filter and enhancer for an extreme photorealism image generator.
Original prompt: "${prompt}"

Task:
1. If the prompt is safe, just return it exactly as is.
2. If the prompt risks violating safety policies (e.g., violence, explicit content, illegal acts), reframe it into a safe, realistic, policy-compliant version that preserves the visual intent as much as possible without violating rules.
3. Do not add any conversational text, just return the final safe prompt.`,
      });
      
      const safePrompt = reframeResponse.text?.trim() || prompt;
      const enhancedPrompt = enhancePrompt(safePrompt);
      
      const parts: any[] = [];
      
      referenceImages.forEach(img => {
        parts.push({
          inlineData: {
            data: img.base64,
            mimeType: img.mimeType
          }
        });
      });
      
      parts.push({ text: enhancedPrompt });

      const response = await ai.models.generateContent({
        model: 'gemini-3.1-flash-image-preview',
        contents: { parts },
        config: {
          imageConfig: {
            aspectRatio: "16:9",
            imageSize: "1K"
          }
        }
      });

      let base64Image = '';
      const candidates = response.candidates;
      if (candidates && candidates.length > 0 && candidates[0].content.parts) {
        for (const part of candidates[0].content.parts) {
          if (part.inlineData) {
            base64Image = part.inlineData.data;
            break;
          }
        }
      }

      if (base64Image) {
        // Try to save to Firestore (might fail if > 1MB, but usually 1K images are ~300-500KB)
        let imageDataToSave = base64Image;
        // If it's too large, we might skip saving it to Firestore and rely only on IndexedDB,
        // but we'll attempt it first.
        
        const docRef = await addDoc(collection(db, 'generations'), {
          sessionId,
          prompt,
          enhancedPrompt,
          imageData: imageDataToSave,
          createdAt: new Date().toISOString()
        });

        await saveImageLocally(docRef.id, base64Image);
        
        // Optimistically update local state to show immediately
        setGenerations(prev => [{
          id: docRef.id,
          prompt,
          enhancedPrompt,
          createdAt: new Date().toISOString(),
          localImage: base64Image
        }, ...prev]);
        
        setPrompt('');
        setReferenceImages([]);
      } else {
        throw new Error("No image generated. The prompt may have triggered safety filters.");
      }

    } catch (error: any) {
      console.error("Generation error:", error);
      const errorStr = typeof error === 'string' ? error : (error.message || JSON.stringify(error));
      if (errorStr.includes("Requested entity was not found")) {
        alert("Your API key does not have access to this model, or the key selection failed. Please select your key again.");
        onClearKey();
      } else {
        alert(error.message || "Failed to generate image.");
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const copySessionLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-50 font-sans selection:bg-indigo-500/30">
      {/* Ambient Background */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-[128px]" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-[128px]" />
      </div>

      {/* Header */}
      <header className="relative z-10 border-b border-white/5 bg-black/20 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Aperture className="w-6 h-6 text-indigo-400" />
            <span className="text-xl font-light tracking-widest uppercase">Zolan8</span>
          </div>
          <div className="flex items-center gap-4">
            <button 
              onClick={copySessionLink}
              className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium bg-white/5 hover:bg-white/10 border border-white/10 rounded-full transition-colors text-neutral-300"
            >
              {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <LinkIcon className="w-3.5 h-3.5" />}
              {copiedLink ? 'Link Copied' : 'Share Session'}
            </button>
            <button
              onClick={onClearKey}
              title="Change API Key"
              className="p-2 hover:bg-white/5 rounded-full transition-colors text-neutral-400 hover:text-white"
            >
              <Key className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="relative z-10 max-w-7xl mx-auto px-6 py-12 grid grid-cols-1 lg:grid-cols-12 gap-12">
        
        {/* Left Column: Input */}
        <div className="lg:col-span-5 space-y-8">
          <div>
            <h1 className="text-4xl font-light mb-3">Extreme Photorealism Lab</h1>
            <p className="text-neutral-400 leading-relaxed">
              Describe your vision. Zolan8 automatically enhances prompts for cinematic lighting, physical camera simulation, and ultra-realistic textures.
            </p>
          </div>

          <div className="bg-white/5 backdrop-blur-2xl border border-white/10 rounded-3xl p-6 shadow-2xl">
            <div className="mb-4">
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="A neon hologram of a cat driving at top speed..."
                className="w-full h-32 bg-transparent border-none resize-none focus:ring-0 text-lg placeholder:text-neutral-600 text-white"
              />
            </div>

            {/* Reference Images */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-medium text-neutral-500 uppercase tracking-wider">Reference Images ({referenceImages.length}/3)</span>
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  disabled={referenceImages.length >= 3}
                  className="text-xs flex items-center gap-1 text-indigo-400 hover:text-indigo-300 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Upload className="w-3 h-3" /> Upload
                </button>
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleFileUpload} 
                  accept="image/*" 
                  multiple 
                  className="hidden" 
                />
              </div>
              
              <div className="flex gap-3">
                <AnimatePresence>
                  {referenceImages.map((img, idx) => (
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      key={idx} 
                      className="relative w-20 h-20 rounded-xl overflow-hidden border border-white/10 group"
                    >
                      <img src={img.url} alt="Reference" className="w-full h-full object-cover" />
                      <button 
                        onClick={() => removeImage(idx)}
                        className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="w-4 h-4 text-white" />
                      </button>
                    </motion.div>
                  ))}
                  {referenceImages.length === 0 && (
                    <div className="w-full h-20 rounded-xl border border-dashed border-white/10 flex flex-col items-center justify-center text-neutral-600 text-xs">
                      <ImageIcon className="w-5 h-5 mb-1 opacity-50" />
                      Optional
                    </div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {isGenerating && <LightFlowLoader />}

            <button
              onClick={generateImage}
              disabled={isGenerating || !prompt.trim()}
              className="mt-4 w-full py-4 rounded-2xl font-medium text-white shadow-[0_0_40px_-10px_rgba(99,102,241,0.5)] bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isGenerating ? (
                <>
                  <Sparkles className="w-5 h-5 animate-pulse" />
                  Synthesizing Reality...
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5" />
                  Generate Masterpiece
                </>
              )}
            </button>
          </div>
        </div>

        {/* Right Column: Gallery */}
        <div className="lg:col-span-7">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-light">Session Gallery</h2>
            <span className="text-xs text-neutral-500">{generations.length} items</span>
          </div>

          {loadingHistory ? (
            <div className="flex items-center justify-center h-64 text-neutral-500">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : generations.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 border border-dashed border-white/10 rounded-3xl text-neutral-500">
              <ImageIcon className="w-8 h-8 mb-3 opacity-50" />
              <p>No generations yet.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {generations.map((gen) => (
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  key={gen.id} 
                  className="group relative rounded-2xl overflow-hidden border border-white/10 bg-white/5 aspect-[16/9]"
                >
                  {gen.localImage ? (
                    <img 
                      src={`data:image/jpeg;base64,${gen.localImage}`} 
                      alt={gen.prompt} 
                      className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-neutral-600 text-xs">
                      Image not available locally
                    </div>
                  )}
                  
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-4">
                    <p className="text-sm text-white line-clamp-2">{gen.prompt}</p>
                    <p className="text-xs text-neutral-400 mt-1">{new Date(gen.createdAt).toLocaleDateString()}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>

      </main>
    </div>
  );
}

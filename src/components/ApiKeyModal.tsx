import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Key, ArrowRight } from 'lucide-react';

export function ApiKeyModal({ onKeySelected }: { onKeySelected: () => void }) {
  const [loading, setLoading] = useState(false);
  const [manualKey, setManualKey] = useState('');

  const handleSelectKey = async () => {
    setLoading(true);
    try {
      // @ts-ignore
      if (window.aistudio && typeof window.aistudio.openSelectKey === 'function') {
        // @ts-ignore
        await window.aistudio.openSelectKey();
        // @ts-ignore
        const hasKey = await window.aistudio.hasSelectedApiKey();
        if (hasKey) {
          onKeySelected();
        }
      }
    } catch (err) {
      console.error('Error selecting key:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualKey.trim().length > 10) {
      localStorage.setItem('zolan8_api_key', manualKey.trim());
      onKeySelected();
    }
  };

  // @ts-ignore
  const isAIStudio = typeof window !== 'undefined' && window.aistudio;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-950/80 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md bg-neutral-900 border border-white/10 p-8 rounded-3xl shadow-2xl text-center"
      >
        <div className="w-16 h-16 bg-indigo-500/20 rounded-full flex items-center justify-center mx-auto mb-6 border border-indigo-500/30">
          <Key className="w-8 h-8 text-indigo-400" />
        </div>
        
        <h2 className="text-2xl font-light text-white mb-4">API Key Required</h2>
        <p className="text-neutral-400 text-sm mb-8 leading-relaxed">
          Zolan8 uses the advanced <strong>gemini-3.1-flash-image-preview</strong> model for extreme photorealism. 
          Please provide your Gemini API key to continue.
        </p>

        <form onSubmit={handleManualSubmit} className="mb-6">
          <div className="relative">
            <input
              type="password"
              value={manualKey}
              onChange={(e) => setManualKey(e.target.value)}
              placeholder="Paste your Gemini API key..."
              className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-neutral-600 focus:outline-none focus:border-indigo-500 transition-colors"
            />
            <button
              type="submit"
              disabled={manualKey.trim().length < 10}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 bg-indigo-500 hover:bg-indigo-400 disabled:bg-neutral-700 rounded-lg text-white transition-colors"
            >
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </form>

        {isAIStudio && (
          <>
            <div className="flex items-center gap-4 mb-6">
              <div className="flex-1 h-px bg-white/10"></div>
              <span className="text-xs text-neutral-500 uppercase tracking-wider">OR</span>
              <div className="flex-1 h-px bg-white/10"></div>
            </div>

            <button
              onClick={handleSelectKey}
              disabled={loading}
              className="w-full py-3 px-6 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-xl font-medium transition-all disabled:opacity-50"
            >
              {loading ? 'Opening...' : 'Select AI Studio Key'}
            </button>
          </>
        )}
        
        <p className="mt-6 text-xs text-neutral-500">
          Your key is stored locally in your browser and never sent to our servers.
        </p>
      </motion.div>
    </div>
  );
}

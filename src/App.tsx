import { useState, useEffect } from 'react';
import { ApiKeyModal } from './components/ApiKeyModal';
import { ImageLab } from './components/ImageLab';
import { Loader2 } from 'lucide-react';
import { getSessionId } from './lib/session';

export default function App() {
  const [hasApiKey, setHasApiKey] = useState(false);
  const [checkingKey, setCheckingKey] = useState(true);
  const [sessionId, setSessionId] = useState<string | null>(null);

  useEffect(() => {
    setSessionId(getSessionId());
    
    const checkKey = async () => {
      try {
        const localKey = localStorage.getItem('zolan8_api_key');
        if (localKey) {
          setHasApiKey(true);
          return;
        }

        // @ts-ignore
        if (window.aistudio && typeof window.aistudio.hasSelectedApiKey === 'function') {
          // @ts-ignore
          const hasSelected = await window.aistudio.hasSelectedApiKey();
          setHasApiKey(hasSelected);
        } else {
          // Fallback if not running in AI Studio environment
          setHasApiKey(false);
        }
      } catch (err) {
        console.error('Error checking API key:', err);
        setHasApiKey(false);
      } finally {
        setCheckingKey(false);
      }
    };

    checkKey();
  }, []);

  const handleClearKey = () => {
    localStorage.removeItem('zolan8_api_key');
    setHasApiKey(false);
  };

  if (checkingKey || !sessionId) {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
      </div>
    );
  }

  if (!hasApiKey) {
    return <ApiKeyModal onKeySelected={() => setHasApiKey(true)} />;
  }

  return <ImageLab sessionId={sessionId} onClearKey={handleClearKey} />;
}

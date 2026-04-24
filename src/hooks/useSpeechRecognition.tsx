import { useCallback, useEffect, useRef, useState } from 'react';

type SpeechRecognitionEventLike = {
  resultIndex: number;
  results: ArrayLike<{
    isFinal: boolean;
    0: { transcript: string };
  }>;
};

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
};

interface UseSpeechRecognitionOptions {
  lang?: string;
  continuous?: boolean;
  onFinal?: (transcript: string) => void;
}

export const isSpeechRecognitionSupported = () =>
  typeof window !== 'undefined' &&
  ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);

export function useSpeechRecognition({
  lang = 'fr-FR',
  continuous = false,
  onFinal,
}: UseSpeechRecognitionOptions = {}) {
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState('');
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const finalRef = useRef<((t: string) => void) | undefined>(onFinal);
  finalRef.current = onFinal;

  const supported = !!isSpeechRecognitionSupported();

  const stop = useCallback(() => {
    try {
      recognitionRef.current?.stop();
    } catch { /* noop */ }
  }, []);

  const start = useCallback(() => {
    if (!supported) {
      setError('unsupported');
      return;
    }
    setError(null);
    setInterim('');

    const Ctor =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const rec: SpeechRecognitionLike = new Ctor();
    rec.lang = lang;
    rec.continuous = continuous;
    rec.interimResults = true;

    let finalText = '';

    rec.onresult = (event) => {
      let interimText = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const res = event.results[i];
        const transcript = res[0].transcript;
        if (res.isFinal) {
          finalText += transcript;
        } else {
          interimText += transcript;
        }
      }
      setInterim(interimText);
    };

    rec.onerror = (e) => {
      setError(e.error || 'error');
      setListening(false);
    };

    rec.onend = () => {
      setListening(false);
      setInterim('');
      const trimmed = finalText.trim();
      if (trimmed && finalRef.current) finalRef.current(trimmed);
    };

    recognitionRef.current = rec;
    try {
      rec.start();
      setListening(true);
    } catch (e: any) {
      setError(e?.message || 'start_failed');
      setListening(false);
    }
  }, [supported, lang, continuous]);

  useEffect(() => () => stop(), [stop]);

  return { supported, listening, interim, error, start, stop };
}
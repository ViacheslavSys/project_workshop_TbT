import WaveSurfer from 'wavesurfer.js'
import { useEffect, useRef } from 'react';

export const WaveSurferTelegram = ({ audioBlob }) => {
  const waveformRef = useRef(null);
  const wavesurfer = useRef(null);

  useEffect(() => {
    if (audioBlob && waveformRef.current) {
      wavesurfer.current = WaveSurfer.create({
        container: waveformRef.current,
        waveColor: '#d4d4d4',
        progressColor: '#3390ec',
        height: 40,
        barWidth: 2,
        barGap: 1,
        responsive: true,
        backend: 'WebAudio'
      });

      // Загружаем Blob
      const url = URL.createObjectURL(audioBlob);
      wavesurfer.current.load(url);

      return () => {
        if (wavesurfer.current) {
          wavesurfer.current.destroy();
        }
      };
    }
  }, [audioBlob]);

  return (
    <div style={{
      backgroundColor: '#f0f0f0',
      padding: '8px 12px',
      borderRadius: '18px',
      maxWidth: '250px'
    }}>
      <div ref={waveformRef} />
    </div>
  );
};
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { InputType, MindMapMode } from '../types';
import LoadingSpinner from './LoadingSpinner';
import { transcribeAudio } from '../services/geminiService';

interface InputPanelProps {
  onGenerateMindMap: (input: string, inputType: InputType) => Promise<void>;
  onUpdateMindMap: (input: string, inputType: InputType) => Promise<void>;
  isLoading: boolean;
  selectedMode: MindMapMode;
}

const InputPanel: React.FC<InputPanelProps> = ({
  onGenerateMindMap,
  onUpdateMindMap,
  isLoading,
  selectedMode,
}) => {
  const [currentInputType, setCurrentInputType] = useState<InputType>(InputType.TEXT);
  const [textInput, setTextInput] = useState<string>('');
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const [recordedText, setRecordedText] = useState<string>('');

  // Voice Recording Logic
  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      // Use MediaRecorder for simpler blob capture for transcription
      mediaRecorderRef.current = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorderRef.current.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setIsRecording(false);
        // Clean up stream
        stream.getTracks().forEach(track => track.stop());
        mediaStreamRef.current = null;

        if (audioBlob.size > 0) {
          // You might need to convert audioBlob to PCM before sending to transcribeAudio
          // For simplicity in this example, we'll assume transcribeAudio can handle webm or a direct PCM conversion
          // A more robust solution would involve client-side audio processing (e.g., using AudioContext)
          // to get raw PCM data from the microphone.
          // For now, let's convert the webm to a PCM-like blob for the service.
          // This is a simplification. Real PCM conversion from webm would be more complex.
          // For the purpose of this demo, we'll indicate it's a 'raw' audio type that the service can process.
          const pcmBlob = await convertWebmToRawPcm(audioBlob);
          const transcription = await transcribeAudio(pcmBlob);
          setRecordedText(transcription);
          setTextInput(transcription); // Automatically put transcription into text input
        }
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
    } catch (error) {
      console.error('Error accessing microphone:', error);
      alert('Could not access microphone. Please ensure permissions are granted.');
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
    }
  }, [isRecording]);

  useEffect(() => {
    // Cleanup on unmount
    return () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(track => track.stop());
      }
      if (scriptProcessorRef.current) {
        scriptProcessorRef.current.disconnect();
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  const handleGenerateClick = () => {
    if (textInput.trim()) {
      onGenerateMindMap(textInput, currentInputType);
    }
  };

  const handleUpdateClick = () => {
    if (textInput.trim()) {
      onUpdateMindMap(textInput, currentInputType);
    }
  };

  const handlePdfUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type === 'application/pdf') {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const arrayBuffer = e.target?.result;
        if (arrayBuffer instanceof ArrayBuffer) {
          // In a real app, you'd parse PDF here (e.g., using pdf.js)
          // For this demo, we'll simulate text extraction or prompt the user to paste text.
          // For simplicity, let's assume we can tell the AI to extract text from a "PDF context"
          // Or we ask the user to paste content, which then goes to AI.
          alert('PDF upload detected. For this demo, please paste the text content from the PDF into the text area for processing.');
          // Or if using a PDF parsing library like pdf.js:
          // const pdf = await getDocument({ data: arrayBuffer }).promise;
          // const page = await pdf.getPage(1);
          // const textContent = await page.getTextContent();
          // const text = textContent.items.map((item: any) => item.str).join(' ');
          // setTextInput(text);
          // onGenerateMindMap(text, InputType.PDF);
        }
      };
      reader.readAsArrayBuffer(file);
    } else {
      alert('Please upload a valid PDF file.');
    }
  };

  // Dummy function for converting webm to a "raw PCM" like blob
  // This is a placeholder and would require proper audio decoding/encoding in a real app.
  // For the `transcribeAudio` function, it expects a PCM-like blob.
  const convertWebmToRawPcm = async (webmBlob: Blob): Promise<Blob> => {
    // In a real application, you'd use AudioContext to decode webm and then encode to raw PCM
    // For this example, we'll just return a blob that `transcribeAudio` can process
    // which expects base64 encoded PCM data.
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            const arrayBuffer = reader.result as ArrayBuffer;
            // Fix: Use AudioContext directly as webkitAudioContext is deprecated
            const audioCtx = new AudioContext({ sampleRate: 16000 });
            audioCtx.decodeAudioData(arrayBuffer, (buffer) => {
                const pcmData = buffer.getChannelData(0); // Get first channel
                const int16Array = new Int16Array(pcmData.length);
                for (let i = 0; i < pcmData.length; i++) {
                    int16Array[i] = Math.max(-1, Math.min(1, pcmData[i])) * 0x7FFF; // Convert to int16
                }
                const pcmBlob = new Blob([int16Array], { type: 'audio/pcm;rate=16000' });
                resolve(pcmBlob);
            }, (error) => {
                console.error('Error decoding audio:', error);
                // Fallback: just resolve with the original webmBlob, hoping service can handle or fail gracefully
                resolve(webmBlob);
            });
        };
        reader.readAsArrayBuffer(webmBlob);
    });
  };


  return (
    <div className="w-80 bg-gray-800 text-white flex flex-col p-4 shadow-xl">
      <h2 className="text-2xl font-bold mb-6 text-center text-blue-300">Mind Map Input</h2>

      <div className="mb-4">
        <div className="flex justify-around mb-4">
          <button
            onClick={() => setCurrentInputType(InputType.TEXT)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              currentInputType === InputType.TEXT
                ? 'bg-blue-600 hover:bg-blue-700'
                : 'bg-gray-700 hover:bg-gray-600'
            }`}
          >
            Text
          </button>
          <button
            onClick={() => setCurrentInputType(InputType.VOICE)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              currentInputType === InputType.VOICE
                ? 'bg-blue-600 hover:bg-blue-700'
                : 'bg-gray-700 hover:bg-gray-600'
            }`}
          >
            Voice
          </button>
          <button
            onClick={() => setCurrentInputType(InputType.PDF)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              currentInputType === InputType.PDF
                ? 'bg-blue-600 hover:bg-blue-700'
                : 'bg-gray-700 hover:bg-gray-600'
            }`}
          >
            PDF
          </button>
        </div>

        {currentInputType === InputType.TEXT && (
          <textarea
            className="w-full p-3 bg-gray-700 border border-gray-600 rounded-md text-gray-100 placeholder-gray-400 focus:ring-blue-500 focus:border-blue-500 outline-none resize-y min-h-[100px] text-sm"
            placeholder="Enter your text, notes, or ideas here..."
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            disabled={isLoading}
          ></textarea>
        )}

        {currentInputType === InputType.VOICE && (
          <div className="flex flex-col items-center justify-center p-4 bg-gray-700 rounded-md">
            <button
              onClick={isRecording ? stopRecording : startRecording}
              className={`p-4 rounded-full ${
                isRecording ? 'bg-red-500 hover:bg-red-600 animate-pulse' : 'bg-blue-500 hover:bg-blue-600'
              } text-white transition-colors flex items-center justify-center`}
              disabled={isLoading}
            >
              {isRecording ? (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7H6v6h2V7zm4 0h-2v6h2V7zm4 0h-2v6h2V7z" clipRule="evenodd" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.748V16a3 3 0 01-3 3H6a3 3 0 01-3-3v-1.252A8.149 8.049 0 014 10a8 8 0 017-6.914V14.748z" clipRule="evenodd" />
                </svg>
              )}
            </button>
            <p className="mt-3 text-sm text-gray-300">
              {isRecording ? 'Recording... Click to stop.' : 'Click to record your ideas.'}
            </p>
            {recordedText && (
              <p className="mt-2 text-xs text-gray-400 italic">
                Transcribed: <span className="text-gray-200">{recordedText}</span>
              </p>
            )}
          </div>
        )}

        {currentInputType === InputType.PDF && (
          <div className="flex flex-col items-center justify-center p-4 bg-gray-700 rounded-md">
            <input
              type="file"
              accept=".pdf"
              onChange={handlePdfUpload}
              className="block w-full text-sm text-gray-300
                file:mr-4 file:py-2 file:px-4
                file:rounded-full file:border-0
                file:text-sm file:font-semibold
                file:bg-blue-50 file:text-blue-700
                hover:file:bg-blue-100 cursor-pointer"
              disabled={isLoading}
            />
            <p className="mt-3 text-sm text-gray-300">Upload a PDF to extract its content.</p>
            <p className="mt-2 text-xs text-gray-400 italic">
              (For this demo, you'll be prompted to paste content after upload.)
            </p>
          </div>
        )}
      </div>

      <div className="flex flex-col space-y-3 mt-auto">
        <button
          onClick={handleGenerateClick}
          className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-md transition-colors flex items-center justify-center"
          disabled={!textInput.trim() || isLoading}
        >
          {isLoading ? <LoadingSpinner /> : 'Generate New Mind Map'}
        </button>
        <button
          onClick={handleUpdateClick}
          className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-md transition-colors flex items-center justify-center"
          disabled={!textInput.trim() || isLoading}
        >
          {isLoading ? <LoadingSpinner /> : 'Update Mind Map'}
        </button>
        {recordedText && currentInputType === InputType.VOICE && (
            <button
                onClick={() => setTextInput(recordedText)}
                className="w-full bg-gray-600 hover:bg-gray-700 text-white font-bold py-1.5 px-4 rounded-md transition-colors text-sm"
                disabled={isLoading}
            >
                Use Transcribed Text
            </button>
        )}
      </div>
    </div>
  );
};

export default InputPanel;
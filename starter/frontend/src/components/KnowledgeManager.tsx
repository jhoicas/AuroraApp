import { useRef, useState } from 'react';

export default function KnowledgeManager() {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [status, setStatus] = useState('Listo para alimentar la base de conocimiento');
  const [progress, setProgress] = useState(0);

  const handleFiles = (selected: FileList | null) => {
    if (!selected) return;
    const accepted = Array.from(selected).filter(file => /\.(md|xml)$/i.test(file.name));
    setFiles(accepted);
    setStatus(`Se recibirán ${accepted.length} archivo(s) para procesamiento`);
    setProgress(0);
  };

  const uploadKnowledge = async () => {
    if (!files.length) return;

    const formData = new FormData();
    files.forEach(file => formData.append('files', file));
    setStatus('Procesando archivos…');
    setProgress(50);

    try {
      const response = await fetch('/api/tenant/knowledge/upload', {
        method: 'POST',
        body: formData,
      });
      const data = await response.json();
      setProgress(100);
      setStatus(data.message || 'Base de conocimiento actualizada');
    } catch (error) {
      setStatus('No se pudo procesar el archivo');
      setProgress(0);
    }
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-slate-900">Cerebro de conocimiento</h3>
        <p className="text-sm text-slate-600">Sube archivos Markdown o XML para alimentar la memoria de Aurora.</p>
      </div>

      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          handleFiles(e.dataTransfer.files);
        }}
        className="cursor-pointer rounded-xl border-2 border-dashed border-emerald-400 bg-emerald-50 p-6 text-center"
        onClick={() => inputRef.current?.click()}
      >
        <p className="font-medium text-emerald-700">Arrastra y suelta tus archivos aquí</p>
        <p className="mt-1 text-sm text-slate-600">o haz clic para seleccionar .md y .xml</p>
        <input ref={inputRef} type="file" multiple accept=".md,.xml" className="hidden" onChange={(e) => handleFiles(e.target.files)} />
      </div>

      {files.length > 0 && (
        <ul className="mt-4 space-y-2 text-sm text-slate-700">
          {files.map(file => (
            <li key={file.name} className="rounded bg-slate-100 px-3 py-2">{file.name}</li>
          ))}
        </ul>
      )}

      <div className="mt-4 h-2 rounded-full bg-slate-200">
        <div className="h-2 rounded-full bg-emerald-600 transition-all" style={{ width: `${progress}%` }} />
      </div>

      <div className="mt-3 flex items-center justify-between text-sm">
        <span className="text-slate-600">{status}</span>
        <button onClick={uploadKnowledge} className="rounded bg-emerald-600 px-4 py-2 font-medium text-white hover:bg-emerald-700">
          Alimentar cerebro
        </button>
      </div>
    </div>
  );
}

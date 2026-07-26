import { useEffect, useMemo, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { FileCode2, FileText, LoaderCircle, CloudUpload, Trash2, Eye, FolderOpen } from 'lucide-react';

type Note = { title: string; category?: string };
type GroupedNotes = Record<string, Note[]>;

const categories = ['Normatividad', 'Manuales Técnicos', 'Reportes SUIFP', 'Otros'];

export default function WikiManager() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [content, setContent] = useState('');
  const [status, setStatus] = useState('Listo');
  const [isUploading, setIsUploading] = useState(false);
  const [category, setCategory] = useState(categories[0]);

  const fetchNotes = async () => {
    try {
      const res = await fetch('/api/tenant/wiki/list');
      const data = await res.json();
      const parsed = (data.titles || []).map((t: string) => ({ title: t, category }));
      setNotes(parsed);
    } catch {
      setNotes([]);
    }
  };

  const loadNote = async (title: string) => {
    setStatus('Cargando nota...');
    const res = await fetch(`/api/tenant/wiki/read?title=${encodeURIComponent(title)}`);
    if (!res.ok) {
      setStatus('Error al cargar la nota');
      return;
    }
    const data = await res.json();
    setSelected(title);
    setContent(data.content || '');
    setStatus('Listo');
  };

  const saveNote = async () => {
    if (!selected) return;
    setStatus('Guardando...');
    await fetch('/api/tenant/wiki/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: selected, content }),
    });
    setStatus('Guardado');
    fetchNotes();
  };

  const handleUpload = async (file?: File) => {
    if (!file) return;
    setIsUploading(true);
    setStatus('Subiendo archivo...');
    const fd = new FormData();
    fd.append('files', file);
    try {
      const res = await fetch('/api/tenant/wiki/upload', { method: 'POST', body: fd });
      if (!res.ok) throw new Error('upload failed');
      const data = await res.json();
      setStatus(data.message || 'Archivo integrado exitosamente al cerebro de la IA');
      setIsUploading(false);
      fetchNotes();
    } catch {
      setStatus('No fue posible integrar el archivo');
      setIsUploading(false);
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { 'text/markdown': ['.md'], 'application/xml': ['.xml'], 'text/xml': ['.xml'] },
    multiple: false,
    onDrop: acceptedFiles => handleUpload(acceptedFiles[0]),
  });

  const groupedNotes = useMemo(() => {
    const groups: GroupedNotes = {};
    for (const note of notes) {
      const key = note.category || 'Otros';
      if (!groups[key]) groups[key] = [];
      groups[key].push(note);
    }
    return groups;
  }, [notes]);

  useEffect(() => { fetchNotes(); }, []);

  return (
    <div className="rounded-2xl border border-stone-200 bg-stone-50 p-5 shadow-sm">
      <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h3 className="text-xl font-semibold text-slate-800">Cerebro Wiki</h3>
          <p className="text-sm text-slate-700">Manuales, reportes y normativa para la IA institucional.</p>
        </div>
        <span className="rounded-full bg-teal-100 px-3 py-1 text-sm font-medium text-teal-800">{status}</span>
      </div>

      <label className="mb-4 flex flex-col gap-2 text-sm font-medium text-slate-700">
        <span>Categoría del documento</span>
        <select
          value={category}
          onChange={e => setCategory(e.target.value)}
          className="h-12 rounded-xl border border-stone-300 bg-stone-50 px-3 text-base text-slate-800 outline-none focus:border-teal-700 focus:ring-2 focus:ring-teal-200"
        >
          {categories.map(option => <option key={option} value={option}>{option}</option>)}
        </select>
      </label>

      <div
        {...getRootProps()}
        className={`mb-4 rounded-3xl border-2 border-dashed border-teal-600 bg-stone-100 p-8 text-center transition ${isDragActive ? 'bg-teal-50 ring-2 ring-teal-300' : ''}`}
      >
        <input {...getInputProps()} />
        <div className="mx-auto flex max-w-2xl flex-col items-center gap-3">
          <div className="rounded-full bg-teal-700 p-4 text-stone-50">
            {isUploading ? <LoaderCircle className="h-8 w-8 animate-spin" /> : <CloudUpload className="h-8 w-8" />}
          </div>
          <p className="text-xl font-semibold text-slate-800">Arrastre aquí los archivos del Manual MGA (.md) o los reportes del SUIFP (.xml)</p>
          <p className="text-base text-slate-700">El asistente de IA podrá leerlos y usar su contenido para responder.</p>
          <button type="button" className="rounded-2xl border border-stone-300 bg-stone-50 px-5 py-3 text-base font-semibold text-slate-800 hover:bg-stone-200">
            O haga clic para buscar en su computador
          </button>
        </div>
      </div>

      <div className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-100 px-4 py-3 text-sm font-medium text-emerald-800">
        ✅ Archivo integrado exitosamente al cerebro de la IA
      </div>

      <div className="space-y-4">
        {Object.entries(groupedNotes).map(([groupName, groupItems]) => (
          <div key={groupName} className="rounded-2xl border border-stone-200 bg-stone-50 p-3">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-800">
              <FolderOpen className="h-4 w-4 text-teal-700" />
              {groupName}
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {groupItems.map(note => {
                const ext = note.title.toLowerCase().endsWith('.xml') ? 'xml' : 'md';
                return (
                  <div key={note.title} className="rounded-2xl border border-stone-200 bg-stone-50 p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        {ext === 'xml' ? <FileCode2 className="mt-1 h-6 w-6 text-teal-700" /> : <FileText className="mt-1 h-6 w-6 text-teal-700" />}
                        <div>
                          <p className="font-semibold text-slate-800">{note.title}</p>
                          <p className="text-sm text-slate-600">Documento disponible para consulta de IA</p>
                        </div>
                      </div>
                    </div>
                    <div className="mt-4 flex gap-2">
                      <button onClick={() => loadNote(note.title)} className="flex items-center gap-2 rounded-xl border border-stone-300 bg-stone-50 px-3 py-2 text-sm font-medium text-slate-800 hover:bg-stone-200">
                        <Eye className="h-4 w-4" /> Ver contenido
                      </button>
                      <button className="flex items-center gap-2 rounded-xl border border-stone-300 bg-stone-50 px-3 py-2 text-sm font-medium text-slate-800 hover:bg-stone-200">
                        <Trash2 className="h-4 w-4" /> Borrar del cerebro
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-5 rounded-2xl border border-stone-200 bg-stone-50 p-4">
        <div className="mb-2 flex items-center justify-between">
          <div className="text-sm font-semibold text-slate-800">{selected || 'Seleccione un archivo para revisar'}</div>
          <div className="text-sm text-slate-600">Edición en Markdown</div>
        </div>
        <textarea
          className="min-h-48 w-full rounded-xl border border-stone-300 bg-stone-50 p-3 font-mono text-sm text-slate-800 outline-none focus:border-teal-700 focus:ring-2 focus:ring-teal-200"
          value={content}
          onChange={e => setContent(e.target.value)}
        />
        <div className="mt-3 flex justify-end">
          <button onClick={saveNote} className="rounded-2xl bg-teal-700 px-4 py-2 text-sm font-semibold text-stone-50 hover:bg-teal-800">
            Guardar
          </button>
        </div>
      </div>
    </div>
  );
}

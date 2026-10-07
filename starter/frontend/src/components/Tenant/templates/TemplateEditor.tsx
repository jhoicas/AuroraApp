import { useEffect } from 'react';
import { useEditor, EditorContent, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import TextAlign from '@tiptap/extension-text-align';
import { Table, TableRow, TableHeader, TableCell } from '@tiptap/extension-table';
import { MgaVar } from './MgaVarNode';
import { MGA_VARIABLE_GROUPS } from '../../../lib/mgaVariables';

type Props = {
  initialHtml: string;
  readOnly?: boolean;
  onChange: (html: string) => void;
};

function Btn({ label, active, onClick, children }: { label: string; active?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={active ?? false}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={`px-2 py-1 rounded text-sm ${active ? 'bg-teal-100 text-teal-800' : 'text-gray-700 hover:bg-gray-100'}`}
    >
      {children}
    </button>
  );
}

function Toolbar({ editor }: { editor: Editor }) {
  const c = () => editor.chain().focus();
  return (
    <div role="toolbar" aria-label="Formato" className="flex flex-wrap gap-1 border-b border-gray-200 p-2">
      <Btn label="Negrita" active={editor.isActive('bold')} onClick={() => c().toggleBold().run()}><b>B</b></Btn>
      <Btn label="Cursiva" active={editor.isActive('italic')} onClick={() => c().toggleItalic().run()}><i>I</i></Btn>
      <Btn label="Subrayado" active={editor.isActive('underline')} onClick={() => c().toggleUnderline().run()}><u>U</u></Btn>
      <Btn label="Título 1" active={editor.isActive('heading', { level: 1 })} onClick={() => c().toggleHeading({ level: 1 }).run()}>H1</Btn>
      <Btn label="Título 2" active={editor.isActive('heading', { level: 2 })} onClick={() => c().toggleHeading({ level: 2 }).run()}>H2</Btn>
      <Btn label="Título 3" active={editor.isActive('heading', { level: 3 })} onClick={() => c().toggleHeading({ level: 3 }).run()}>H3</Btn>
      <Btn label="Lista con viñetas" active={editor.isActive('bulletList')} onClick={() => c().toggleBulletList().run()}>• Lista</Btn>
      <Btn label="Lista numerada" active={editor.isActive('orderedList')} onClick={() => c().toggleOrderedList().run()}>1. Lista</Btn>
      <Btn label="Alinear a la izquierda" active={editor.isActive({ textAlign: 'left' })} onClick={() => c().setTextAlign('left').run()}>⇤</Btn>
      <Btn label="Centrar" active={editor.isActive({ textAlign: 'center' })} onClick={() => c().setTextAlign('center').run()}>↔</Btn>
      <Btn label="Alinear a la derecha" active={editor.isActive({ textAlign: 'right' })} onClick={() => c().setTextAlign('right').run()}>⇥</Btn>
      <Btn label="Insertar tabla" onClick={() => c().insertTable({ rows: 2, cols: 2, withHeaderRow: false }).run()}>▦ Tabla</Btn>
      {editor.isActive('table') && (
        <>
          <Btn label="Añadir fila" onClick={() => c().addRowAfter().run()}>+Fila</Btn>
          <Btn label="Añadir columna" onClick={() => c().addColumnAfter().run()}>+Col</Btn>
          <Btn label="Eliminar fila" onClick={() => c().deleteRow().run()}>−Fila</Btn>
          <Btn label="Eliminar columna" onClick={() => c().deleteColumn().run()}>−Col</Btn>
          <Btn label="Eliminar tabla" onClick={() => c().deleteTable().run()}>✕ Tabla</Btn>
        </>
      )}
      <Btn label="Deshacer" onClick={() => c().undo().run()}>↶</Btn>
      <Btn label="Rehacer" onClick={() => c().redo().run()}>↷</Btn>
    </div>
  );
}

/** Editor TipTap ultraligero con panel de chips de variables MGA. */
export default function TemplateEditor({ initialHtml, readOnly = false, onChange }: Props) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
      MgaVar,
    ],
    content: initialHtml,
    editable: !readOnly,
    immediatelyRender: false,
    onUpdate: ({ editor: e }) => onChange(e.getHTML()),
  });

  useEffect(() => {
    editor?.setEditable(!readOnly);
  }, [editor, readOnly]);

  if (!editor) return null;

  return (
    <div className="flex flex-col gap-3 lg:flex-row">
      <div className="flex-1 min-w-0 rounded-lg border border-gray-200 bg-gray-100">
        {!readOnly && (
          <div className="sticky top-0 z-10 rounded-t-lg bg-white">
            <Toolbar editor={editor} />
          </div>
        )}
        <div className="overflow-x-auto p-4 sm:p-8">
          <div className="tpl-page" data-testid="template-editor">
            <div className="tpl-prose">
              <EditorContent editor={editor} />
            </div>
          </div>
        </div>
      </div>
      {!readOnly && (
        <aside aria-label="Variables MGA" className="lg:w-60 shrink-0 rounded-lg border border-gray-200 bg-white p-3 space-y-3">
          <p className="text-xs text-gray-500">Haz clic en una variable para insertarla en el cursor.</p>
          {MGA_VARIABLE_GROUPS.map((g) => (
            <div key={g.group}>
              <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1">{g.group}</h4>
              <div className="flex flex-wrap gap-1">
                {g.vars.map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    data-var-id={v.id}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() =>
                      editor.chain().focus().insertContent([{ type: 'mgaVar', attrs: { id: v.id, label: v.label } }, { type: 'text', text: ' ' }]).run()
                    }
                    className="mga-var cursor-pointer hover:bg-teal-200"
                  >
                    {v.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </aside>
      )}
    </div>
  );
}

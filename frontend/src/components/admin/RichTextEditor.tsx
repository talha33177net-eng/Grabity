import Image from '@tiptap/extension-image'
import { TableKit } from '@tiptap/extension-table'
import TextAlign from '@tiptap/extension-text-align'
import { EditorContent, useEditor, useEditorState, type Editor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Code,
  Heading2,
  Heading3,
  ImagePlus,
  Italic,
  Link2,
  List,
  ListOrdered,
  LoaderCircle,
  Quote,
  Redo2,
  Strikethrough,
  Table,
  Underline,
  Undo2,
} from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { toast } from 'sonner'
import { errorMessage, http } from '@/lib/api'
import { cn } from '@/lib/utils'

interface RichTextEditorProps {
  value?: string | null
  onChange: (html: string) => void
  folder?: string
  placeholder?: string
  minHeight?: string
  compact?: boolean
}

export function RichTextEditor({ value, onChange, folder = 'misc', minHeight = 'min-h-[220px]', compact }: RichTextEditorProps) {
  const [source, setSource] = useState(false)
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ link: { openOnClick: false, autolink: true, HTMLAttributes: { rel: 'noopener', target: null } } }),
      Image.configure({ HTMLAttributes: { loading: 'lazy' } }),
      TableKit.configure({ table: { resizable: false } }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
    ],
    content: value || '',
    editorProps: { attributes: { class: cn('rich-content max-w-none px-4 py-3 outline-none', minHeight) } },
    onUpdate: ({ editor }) => onChange(editor.isEmpty ? '' : editor.getHTML()),
  })

  // Keep the editor in sync when the value is replaced from outside (e.g. form data loaded).
  useEffect(() => {
    if (!editor || editor.isFocused) return
    const current = editor.isEmpty ? '' : editor.getHTML()
    if ((value || '') !== current) editor.commands.setContent(value || '', { emitUpdate: false })
  }, [value, editor])

  return (
    <div className="overflow-hidden rounded-xl border border-slate-300 bg-white focus-within:border-brand focus-within:ring-3 focus-within:ring-brand-ring">
      {editor && <Toolbar editor={editor} folder={folder} compact={compact} source={source} onToggleSource={() => setSource((s) => !s)} />}
      {source ? (
        <textarea
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          className={cn('block w-full resize-y px-4 py-3 font-mono text-xs text-slate-700 outline-none', minHeight)}
          spellCheck={false}
        />
      ) : (
        <EditorContent editor={editor} />
      )}
    </div>
  )
}

function Toolbar({ editor, folder, compact, source, onToggleSource }: { editor: Editor; folder: string; compact?: boolean; source: boolean; onToggleSource: () => void }) {
  const fileInput = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const state = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e.isActive('bold'),
      italic: e.isActive('italic'),
      underline: e.isActive('underline'),
      strike: e.isActive('strike'),
      h2: e.isActive('heading', { level: 2 }),
      h3: e.isActive('heading', { level: 3 }),
      bullet: e.isActive('bulletList'),
      ordered: e.isActive('orderedList'),
      quote: e.isActive('blockquote'),
      link: e.isActive('link'),
      left: e.isActive({ textAlign: 'left' }),
      center: e.isActive({ textAlign: 'center' }),
      right: e.isActive({ textAlign: 'right' }),
      canUndo: e.can().undo(),
      canRedo: e.can().redo(),
    }),
  })

  const chain = () => editor.chain().focus()
  const setLink = () => {
    const previous = editor.getAttributes('link').href as string | undefined
    const href = window.prompt('Link URL (leave empty to remove)', previous ?? 'https://')
    if (href === null) return
    if (!href.trim()) chain().extendMarkRange('link').unsetLink().run()
    else chain().extendMarkRange('link').setLink({ href: href.trim() }).run()
  }
  const upload = async (file?: File) => {
    if (!file) return
    setUploading(true)
    try {
      const { url } = await http.upload(file, folder)
      chain().setImage({ src: url, alt: file.name.replace(/\.[^.]+$/, '') }).run()
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-0.5 border-b border-slate-200 bg-slate-50 px-1.5 py-1">
      <Tool label="Bold" active={state.bold} onClick={() => chain().toggleBold().run()} disabled={source}>
        <Bold />
      </Tool>
      <Tool label="Italic" active={state.italic} onClick={() => chain().toggleItalic().run()} disabled={source}>
        <Italic />
      </Tool>
      <Tool label="Underline" active={state.underline} onClick={() => chain().toggleUnderline().run()} disabled={source}>
        <Underline />
      </Tool>
      {!compact && (
        <Tool label="Strikethrough" active={state.strike} onClick={() => chain().toggleStrike().run()} disabled={source}>
          <Strikethrough />
        </Tool>
      )}
      <Divider />
      <Tool label="Heading" active={state.h2} onClick={() => chain().toggleHeading({ level: 2 }).run()} disabled={source}>
        <Heading2 />
      </Tool>
      <Tool label="Subheading" active={state.h3} onClick={() => chain().toggleHeading({ level: 3 }).run()} disabled={source}>
        <Heading3 />
      </Tool>
      <Tool label="Bullet list" active={state.bullet} onClick={() => chain().toggleBulletList().run()} disabled={source}>
        <List />
      </Tool>
      <Tool label="Numbered list" active={state.ordered} onClick={() => chain().toggleOrderedList().run()} disabled={source}>
        <ListOrdered />
      </Tool>
      {!compact && (
        <Tool label="Quote" active={state.quote} onClick={() => chain().toggleBlockquote().run()} disabled={source}>
          <Quote />
        </Tool>
      )}
      <Divider />
      {!compact && (
        <>
          <Tool label="Align left" active={state.left} onClick={() => chain().setTextAlign('left').run()} disabled={source}>
            <AlignLeft />
          </Tool>
          <Tool label="Align center" active={state.center} onClick={() => chain().setTextAlign('center').run()} disabled={source}>
            <AlignCenter />
          </Tool>
          <Tool label="Align right" active={state.right} onClick={() => chain().setTextAlign('right').run()} disabled={source}>
            <AlignRight />
          </Tool>
          <Divider />
        </>
      )}
      <Tool label="Link" active={state.link} onClick={setLink} disabled={source}>
        <Link2 />
      </Tool>
      {!compact && (
        <>
          <Tool label="Insert image" onClick={() => fileInput.current?.click()} disabled={source || uploading}>
            {uploading ? <LoaderCircle className="animate-spin" /> : <ImagePlus />}
          </Tool>
          <Tool label="Insert table" onClick={() => chain().insertTable({ rows: 3, cols: 2, withHeaderRow: true }).run()} disabled={source}>
            <Table />
          </Tool>
        </>
      )}
      <Divider />
      <Tool label="Undo" onClick={() => chain().undo().run()} disabled={source || !state.canUndo}>
        <Undo2 />
      </Tool>
      <Tool label="Redo" onClick={() => chain().redo().run()} disabled={source || !state.canRedo}>
        <Redo2 />
      </Tool>
      <div className="flex-1" />
      <Tool label={source ? 'Visual editor' : 'Edit HTML'} active={source} onClick={onToggleSource}>
        <Code />
      </Tool>
      <input ref={fileInput} type="file" accept="image/*" className="hidden" onChange={(e) => upload(e.target.files?.[0])} />
    </div>
  )
}

function Tool({ label, active, disabled, onClick, children }: { label: string; active?: boolean; disabled?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={cn('flex size-8 items-center justify-center rounded-md text-slate-600 transition [&>svg]:size-4', active ? 'bg-brand-soft text-brand' : 'hover:bg-white hover:text-slate-900', disabled && 'opacity-35')}
    >
      {children}
    </button>
  )
}

function Divider() {
  return <span className="mx-1 h-5 w-px bg-slate-200" />
}

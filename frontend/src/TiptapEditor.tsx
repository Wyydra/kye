import { useEditor, EditorContent, Editor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { Markdown } from 'tiptap-markdown'
import { useEffect, useRef } from 'react'

interface TiptapEditorProps {
    initialValue: string;
    onChange?: (markdown: string) => void;
    readOnly?: boolean;
}

export function TiptapEditor({ initialValue, onChange, readOnly = false }: TiptapEditorProps) {
    const onChangeRef = useRef(onChange);

    useEffect(() => {
        onChangeRef.current = onChange;
    }, [onChange]);

    const editor = useEditor({
        extensions: [
            StarterKit,
            Markdown,
        ],
        content: initialValue,
        editable: !readOnly,
        onUpdate: ({ editor }: { editor: Editor }) => {
            const markdown = editor.storage.markdown.getMarkdown();
            onChangeRef.current?.(markdown);
        },
    });

    useEffect(() => {
        if (editor && editor.isEditable === readOnly) {
            editor.setEditable(!readOnly);
        }
    }, [editor, readOnly]);

    return (
        <div className={`tiptap-container ${readOnly ? 'readonly' : ''}`} style={{ height: '100%', width: '100%' }}>
            <EditorContent editor={editor} style={{ height: '100%' }} />
        </div>
    )
}

import { useEditor, EditorContent, Editor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { Markdown } from 'tiptap-markdown'
import { useEffect, useRef } from 'react'

interface TiptapEditorProps {
    initialValue: string;
    onChange?: (markdown: string) => void;
    readOnly?: boolean;
    clickCoords?: { x: number, y: number } | null;
}

export function TiptapEditor({ initialValue, onChange, readOnly = false, clickCoords }: TiptapEditorProps) {
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
        autofocus: true,
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

    useEffect(() => {
        if (!editor || editor.isDestroyed) return;
        
        const currentMarkdown = editor.storage.markdown.getMarkdown();
        if (initialValue !== currentMarkdown && !editor.isFocused) {
            editor.commands.setContent(initialValue);
        }
    }, [initialValue, editor]);

    useEffect(() => {
        if (editor && !editor.isDestroyed && clickCoords) {
            setTimeout(() => {
                if (editor.isDestroyed) return;
                const pos = editor.view.posAtCoords({ left: clickCoords.x, top: clickCoords.y });
                if (pos) {
                    editor.commands.focus();
                    editor.commands.setTextSelection(pos.pos);
                }
            }, 10);
        }
    }, [editor, clickCoords]);

    return (
        <div className={`tiptap-container ${readOnly ? 'readonly' : ''}`} style={{ height: '100%', width: '100%' }}>
            <EditorContent editor={editor} style={{ height: '100%' }} />
        </div>
    )
}

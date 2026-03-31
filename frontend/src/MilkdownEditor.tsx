import { useEffect, useRef, forwardRef, memo } from 'react';
import { Crepe } from '@milkdown/crepe';
import { listener, listenerCtx } from '@milkdown/plugin-listener';
import { Editor, editorViewOptionsCtx } from '@milkdown/core';

// Required styles for Crepe
import '@milkdown/crepe/theme/common/style.css';

interface MilkdownEditorProps {
    initialValue: string;
    onChange?: (markdown: string) => void;
    readOnly?: boolean;
}

export const MilkdownEditor = memo(forwardRef<HTMLDivElement, MilkdownEditorProps>(({ initialValue, onChange, readOnly = false }, _ref) => {
    const ref = useRef<HTMLDivElement>(null);
    const crepe = useRef<Crepe | null>(null);
    const onChangeRef = useRef(onChange);

    useEffect(() => { onChangeRef.current = onChange }, [onChange]);

    // Update readOnly state without re-mounting
    useEffect(() => {
        if (crepe.current) {
            crepe.current.editor.config((ctx) => {
                ctx.set(editorViewOptionsCtx, { editable: () => !readOnly });
            });
            // Force a redraw or update if needed? Usually editor.config updates the context
            // but we might need to notify the view.
        }
    }, [readOnly]);

    useEffect(() => {
        if (!ref.current || crepe.current) return;
        const instance = new Crepe({
            root: ref.current,
            defaultValue: initialValue,
            featureConfigs: {
                // We can disable some features in readOnly if we want
            }
        });

        instance.editor
            .use(listener)
            .config(ctx => {
                ctx.set(editorViewOptionsCtx, { editable: () => !readOnly });
                ctx.get(listenerCtx).markdownUpdated((_, md) => onChangeRef.current?.(md));
            });

        instance.create().then(() => crepe.current = instance);
        return () => { if (ref.current) ref.current.innerHTML = ''; crepe.current = null; };
    }, []);

    return (
        <div
            ref={ref}
            className={`milkdown-crepe-container nodrag nopan ${readOnly ? 'readonly' : ''}`}
            style={{ height: '100%', width: '100%' }}
        >
            <style>{`
        .milkdown-crepe-container.readonly .milkdown .editor {
            caret-color: transparent;
        }
        /* Hide hover menus/toolbars in readonly if they exist */
        .milkdown-crepe-container.readonly [data-crepe-feature] {
            pointer-events: none;
        }
        /* Make links clickable even in readonly if needed, but for now let's be strict */
      `}</style>
        </div>
    );
}));

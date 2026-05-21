import React from "react";
import { ArrowLeft, X, CheckCircle2, AlertCircle } from "lucide-react";
import { RemotePeer, ReviewableCommand } from "../types/sync";

interface PatchReviewProps {
  reviewPeer: RemotePeer;
  pendingChanges: {
    local: ReviewableCommand[];
    remote: ReviewableCommand[];
  };
  statusMessage: string | null;
  errorMessage: string | null;
  onBack: () => void;
  onClose: () => void;
  onToggleChange: (section: 'local' | 'remote', index: number) => void;
  onToggleAllSection: (section: 'local' | 'remote') => void;
  onApply: () => void;
}

export const PatchReview: React.FC<PatchReviewProps> = ({
  reviewPeer,
  pendingChanges,
  statusMessage,
  errorMessage,
  onBack,
  onClose,
  onToggleChange,
  onToggleAllSection,
  onApply
}) => {
  const selectedLocalCount = pendingChanges.local.filter(c => c.selected).length;
  const selectedRemoteCount = pendingChanges.remote.filter(c => c.selected).length;
  const totalSelected = selectedLocalCount + selectedRemoteCount;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-md p-4 animate-fade-in">
      <div className="relative w-full max-w-2xl bg-card border border-border/80 rounded-2xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden">
        
        {/* Header */}
        <div className="p-5 border-b border-border/50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button 
              onClick={onBack}
              className="p-1.5 hover:bg-muted rounded-lg transition-colors text-muted-foreground hover:text-foreground mr-1"
            >
              <ArrowLeft className="w-4.5 h-4.5" />
            </button>
            <div>
              <h2 className="text-sm font-bold tracking-tight text-card-foreground">Review Sync Changes</h2>
              <p className="text-[10px] text-muted-foreground">Comparing with {reviewPeer.name}</p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="p-1 hover:bg-muted rounded-lg transition-colors text-muted-foreground hover:text-foreground"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          
          {/* Status Messages */}
          {statusMessage && (
            <div className="p-3 bg-primary/10 border border-primary/30 rounded-xl text-primary text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              <span>{statusMessage}</span>
            </div>
          )}

          {errorMessage && (
            <div className="p-3 bg-destructive/10 border border-destructive/30 rounded-xl text-destructive text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* INCOMING SECTION */}
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-border/40 pb-2">
              <div className="flex items-center gap-2">
                <span className="flex h-2 w-2 rounded-full bg-emerald-500" />
                <h3 className="font-semibold text-xs text-foreground uppercase tracking-wider">Incoming Updates (PULL)</h3>
                <span className="text-[10px] bg-emerald-500/10 text-emerald-500 px-1.5 py-0.5 rounded-full font-medium">
                  {pendingChanges.local.length} changes
                </span>
              </div>
              {pendingChanges.local.length > 0 && (
                <button 
                  onClick={() => onToggleAllSection('local')}
                  className="text-[10px] text-primary hover:underline font-semibold"
                >
                  {pendingChanges.local.every(c => c.selected) ? "Deselect All" : "Select All"}
                </button>
              )}
            </div>

            {pendingChanges.local.length === 0 ? (
              <p className="text-[11px] text-muted-foreground/60 italic pl-4">No incoming changes. Local workspace is up to date.</p>
            ) : (
              <div className="space-y-3">
                {pendingChanges.local.map((item, idx) => (
                  <div key={item.id} className="p-3 bg-muted/10 border border-border/50 rounded-xl space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <label className="flex items-start gap-2.5 cursor-pointer select-none min-w-0">
                        <input 
                          type="checkbox" 
                          checked={item.selected}
                          onChange={() => onToggleChange('local', idx)}
                          className="mt-0.5 h-3.5 w-3.5 rounded border-border text-primary focus:ring-primary/20"
                        />
                        <div className="min-w-0">
                          <span className="text-xs font-medium text-foreground block leading-tight">{item.description}</span>
                          <span className="text-[9px] text-muted-foreground mt-0.5 block truncate">ID: {(item.cmd as any).node_id || (item.cmd as any).id || ""}</span>
                        </div>
                      </label>
                      <span className={`text-[8px] font-bold px-2 py-0.5 rounded-full uppercase flex-shrink-0 ${
                        item.cmd.type === 'create_node' 
                          ? 'bg-emerald-500/10 text-emerald-500' 
                          : item.cmd.type === 'set_view_override'
                          ? 'bg-indigo-500/10 text-indigo-500'
                          : 'bg-sky-500/10 text-sky-500'
                      }`}>
                        {item.cmd.type === 'create_node' ? 'Create' : item.cmd.type === 'set_view_override' ? 'Layout' : 'Update'}
                      </span>
                    </div>
                    
                    {/* Diff block */}
                    {item.diffLines.length > 0 && (
                      <div className="bg-muted/30 border border-border/40 font-mono text-[10px] rounded-lg p-2 overflow-x-auto leading-relaxed select-text">
                        {item.diffLines.map((line, lIdx) => (
                          <div key={lIdx} className={
                            line.type === 'add' 
                              ? 'text-emerald-500 bg-emerald-500/5 px-1 rounded' 
                              : line.type === 'remove'
                              ? 'text-rose-500 bg-rose-500/5 px-1 rounded line-through decoration-rose-500/30'
                              : 'text-muted-foreground/70 px-1'
                          }>
                            {line.text}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* OUTGOING SECTION */}
          <div className="space-y-3 pt-4">
            <div className="flex items-center justify-between border-b border-border/40 pb-2">
              <div className="flex items-center gap-2">
                <span className="flex h-2 w-2 rounded-full bg-blue-500" />
                <h3 className="font-semibold text-xs text-foreground uppercase tracking-wider">Outgoing Updates (PUSH)</h3>
                <span className="text-[10px] bg-blue-500/10 text-blue-500 px-1.5 py-0.5 rounded-full font-medium">
                  {pendingChanges.remote.length} changes
                </span>
              </div>
              {pendingChanges.remote.length > 0 && (
                <button 
                  onClick={() => onToggleAllSection('remote')}
                  className="text-[10px] text-primary hover:underline font-semibold"
                >
                  {pendingChanges.remote.every(c => c.selected) ? "Deselect All" : "Select All"}
                </button>
              )}
            </div>

            {pendingChanges.remote.length === 0 ? (
              <p className="text-[11px] text-muted-foreground/60 italic pl-4">No outgoing changes. Remote device is up to date.</p>
            ) : (
              <div className="space-y-3">
                {pendingChanges.remote.map((item, idx) => (
                  <div key={item.id} className="p-3 bg-muted/10 border border-border/50 rounded-xl space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <label className="flex items-start gap-2.5 cursor-pointer select-none min-w-0">
                        <input 
                          type="checkbox" 
                          checked={item.selected}
                          onChange={() => onToggleChange('remote', idx)}
                          className="mt-0.5 h-3.5 w-3.5 rounded border-border text-primary focus:ring-primary/20"
                        />
                        <div className="min-w-0">
                          <span className="text-xs font-medium text-foreground block leading-tight">{item.description}</span>
                          <span className="text-[9px] text-muted-foreground mt-0.5 block truncate">ID: {(item.cmd as any).node_id || (item.cmd as any).id || ""}</span>
                        </div>
                      </label>
                      <span className={`text-[8px] font-bold px-2 py-0.5 rounded-full uppercase flex-shrink-0 ${
                        item.cmd.type === 'create_node' 
                          ? 'bg-emerald-500/10 text-emerald-500' 
                          : item.cmd.type === 'set_view_override'
                          ? 'bg-indigo-500/10 text-indigo-500'
                          : 'bg-sky-500/10 text-sky-500'
                      }`}>
                        {item.cmd.type === 'create_node' ? 'Create' : item.cmd.type === 'set_view_override' ? 'Layout' : 'Update'}
                      </span>
                    </div>
                    
                    {/* Diff block */}
                    {item.diffLines.length > 0 && (
                      <div className="bg-muted/30 border border-border/40 font-mono text-[10px] rounded-lg p-2 overflow-x-auto leading-relaxed select-text">
                        {item.diffLines.map((line, lIdx) => (
                          <div key={lIdx} className={
                            line.type === 'add' 
                              ? 'text-emerald-500 bg-emerald-500/5 px-1 rounded' 
                              : line.type === 'remove'
                              ? 'text-rose-500 bg-rose-500/5 px-1 rounded line-through decoration-rose-500/30'
                              : 'text-muted-foreground/70 px-1'
                          }>
                            {line.text}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

        {/* Footer */}
        <div className="p-4 bg-muted/10 border-t border-border/50 flex items-center justify-between">
          <span className="text-[11px] text-muted-foreground font-medium">
            {totalSelected} changes selected for sync
          </span>
          <div className="flex gap-2">
            <button 
              onClick={onBack}
              className="px-4 py-2 bg-muted hover:bg-muted/80 text-foreground rounded-xl text-xs font-semibold transition-all"
            >
              Cancel
            </button>
            <button 
              onClick={onApply}
              disabled={totalSelected === 0}
              className="px-4 py-2 bg-primary text-primary-foreground font-semibold rounded-xl text-xs shadow-md hover:bg-primary/95 transition-all disabled:opacity-50"
            >
              Apply Changes
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

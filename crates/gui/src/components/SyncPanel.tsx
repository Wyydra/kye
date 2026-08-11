import React, { useState, useEffect } from "react";
import { 
  Wifi, 
  WifiOff, 
  Camera, 
  Trash2, 
  X, 
  Smartphone, 
  Network,
  Zap,
  ArrowUp,
  ArrowDown,
  Search,
  MoreVertical,
  CheckCircle2,
  AlertCircle
} from "lucide-react";
import { kyeService } from "../services/kyeService";
import { useGraphStore } from "../store/graphStore";
import { RemotePeer, ReviewableCommand } from "../types/sync";
import { useQrScanner } from "../hooks/useQrScanner";
import { PatchReview } from "./PatchReview";

export const SyncPanel: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [serverRunning, setServerRunning] = useState(false);
  const [port] = useState(1425);
  const [deviceName, setDeviceName] = useState("");
  const [peerId, setPeerId] = useState("");
  const [pin] = useState("1234");
  const [qrSvg, setQrSvg] = useState<string | null>(null);
  const [localIp, setLocalIp] = useState<string | null>(null);

  // Remotes list state
  const [remotes, setRemotes] = useState<RemotePeer[]>([]);
  const [syncingPeerId, setSyncingPeerId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [manualUrl, setManualUrl] = useState("");
  const [activeMenuPeerId, setActiveMenuPeerId] = useState<string | null>(null);

  // Patch review state
  const [isReviewing, setIsReviewing] = useState(false);
  const [reviewPeer, setReviewPeer] = useState<RemotePeer | null>(null);
  const [pendingChanges, setPendingChanges] = useState<{
    local: ReviewableCommand[];
    remote: ReviewableCommand[];
  } | null>(null);

  // QR Code Scanner hook
  const {
    scanning,
    videoRef,
    error: scannerError,
    startScanning,
    stopScanning
  } = useQrScanner((url) => {
    handleScannedPairingUrl(url);
  });

  useEffect(() => {
    if (scannerError) {
      setErrorMessage(scannerError);
    }
  }, [scannerError]);

  useEffect(() => {
    kyeService.getMeta().then((meta) => {
      if (meta) {
        setDeviceName(meta.name);
        setPeerId(meta.id);
      }
    }).catch(console.error);

    kyeService.listRemotes().then((list) => {
      setRemotes(
        list.map((r) => ({
          id: r.name,
          name: r.name,
          url: r.url,
          pin: "",
        }))
      );
    }).catch(console.error);

    kyeService.isP2pServerRunning().then(setServerRunning);
    kyeService.getLocalPeerInfo().then(setLocalIp);
  }, []);

  const refreshRemotes = async () => {
    try {
      const list = await kyeService.listRemotes();
      setRemotes(
        list.map((r) => ({
          id: r.name,
          name: r.name,
          url: r.url,
          pin: "",
        }))
      );
    } catch (e) {
      console.error(e);
    }
  };

  const handleToggleServer = async () => {
    try {
      if (serverRunning) {
        await kyeService.stopP2pServer();
        setServerRunning(false);
        setQrSvg(null);
      } else {
        await kyeService.startP2pServer(port, peerId, deviceName);
        setServerRunning(true);
        const svg = await kyeService.generatePairingQr(port, deviceName, pin);
        setQrSvg(svg);
        const ip = await kyeService.getLocalPeerInfo();
        setLocalIp(ip);
      }
      setErrorMessage(null);
    } catch (e: any) {
      setErrorMessage(`Erreur serveur : ${e.toString()}`);
    }
  };

  const handleScannedPairingUrl = async (url: string) => {
    stopScanning();
    try {
      let name = "remote";
      let baseRemoteUrl = "";

      if (url.startsWith("kye-remote://")) {
        const cleanUrl = url.replace("kye-remote://", "http://");
        const urlObj = new URL(cleanUrl);
        name = urlObj.searchParams.get("name") || `peer-${Math.floor(Math.random() * 1000)}`;
        baseRemoteUrl = `${urlObj.protocol}//${urlObj.host}`;
      } else if (url.startsWith("http://") || url.startsWith("https://")) {
        const urlObj = new URL(url);
        name = urlObj.searchParams.get("name") || `peer-${Math.floor(Math.random() * 1000)}`;
        baseRemoteUrl = `${urlObj.protocol}//${urlObj.host}`;
      } else {
        throw new Error("Format d'URL invalide. Utilisez un lien kye-remote:// ou http://");
      }

      const sanitizedName = name.replace(/[^a-zA-Z0-9_-]/g, "_").toLowerCase().slice(0, 32);

      await kyeService.addRemote(sanitizedName, baseRemoteUrl);
      await refreshRemotes();
      setStatusMessage(`Appairage réussi avec "${sanitizedName}" !`);
    } catch (e: any) {
      setErrorMessage(`Échec de l'appairage : ${e.message || e}`);
    }
  };

  const handleDeleteRemote = async (name: string) => {
    try {
      await kyeService.removeRemote(name);
      await refreshRemotes();
      setActiveMenuPeerId(null);
    } catch (e: any) {
      setErrorMessage(`Échec de la suppression : ${e.toString()}`);
    }
  };

  const handlePingRemote = async (peer: RemotePeer) => {
    try {
      setStatusMessage(`Test de connexion avec ${peer.name}...`);
      const info = await kyeService.pingRemotePeer(peer.url);
      setStatusMessage(`En ligne ! Connecté à "${info.name}"`);
      setErrorMessage(null);
    } catch (e: any) {
      setErrorMessage(`Connexion impossible : ${e.toString()}`);
    } finally {
      setActiveMenuPeerId(null);
    }
  };

  const handleAutoSyncRemote = async (peer: RemotePeer) => {
    setSyncingPeerId(peer.id);
    setStatusMessage(`Synchronisation avec ${peer.name}...`);
    setErrorMessage(null);

    try {
      const summary = await kyeService.syncWithRemotePeer(peer.url);

      if (summary.hasConflicts) {
        const diff = await kyeService.computeSyncDiff(peer.url);
        setPendingChanges({
          local: diff.local,
          remote: diff.remote
        });
        setReviewPeer(peer);
        setIsReviewing(true);
        setStatusMessage("Des conflits structurels ont été détectés. Veuillez les vérifier.");
        return;
      }

      await useGraphStore.getState().loadGraph(true);

      const nowStr = new Date().toLocaleTimeString();
      setRemotes(remotes.map(r => r.id === peer.id ? { ...r, lastSync: nowStr } : r));

      if (summary.appliedLocal === 0 && summary.pushedRemote === 0) {
        setStatusMessage(`✅ ${peer.name} est déjà à jour !`);
      } else {
        setStatusMessage(`⚡ Synchronisé avec succès ! (${summary.appliedLocal} reçus, ${summary.pushedRemote} envoyés)`);
      }
    } catch (e: any) {
      setErrorMessage(`Erreur de synchronisation : ${e.toString()}`);
    } finally {
      setSyncingPeerId(null);
    }
  };

  const handleInspectDiffRemote = async (peer: RemotePeer) => {
    setActiveMenuPeerId(null);
    setSyncingPeerId(peer.id);
    setStatusMessage(`Inspection des différences avec ${peer.name}...`);
    setErrorMessage(null);

    try {
      const diff = await kyeService.computeSyncDiff(peer.url);
      if (diff.local.length === 0 && diff.remote.length === 0) {
        setStatusMessage(`✅ Aucun changement à inspecter. ${peer.name} est à jour.`);
        return;
      }
      setPendingChanges({
        local: diff.local,
        remote: diff.remote
      });
      setReviewPeer(peer);
      setIsReviewing(true);
      setStatusMessage(null);
    } catch (e: any) {
      setErrorMessage(`Erreur d'inspection : ${e.toString()}`);
    } finally {
      setSyncingPeerId(null);
    }
  };

  const handlePushRemote = async (peer: RemotePeer) => {
    setActiveMenuPeerId(null);
    setSyncingPeerId(peer.id);
    setStatusMessage(`Envoi des modifications vers ${peer.name}...`);
    setErrorMessage(null);

    try {
      const summary = await kyeService.syncWithRemotePeer(peer.url);
      const nowStr = new Date().toLocaleTimeString();
      setRemotes(remotes.map(r => r.id === peer.id ? { ...r, lastSync: nowStr } : r));
      setStatusMessage(`⬆️ Push terminé ! ${summary.pushedRemote} envoyés à ${peer.name}.`);
    } catch (e: any) {
      setErrorMessage(`Erreur Push : ${e.toString()}`);
    } finally {
      setSyncingPeerId(null);
    }
  };

  const handlePullRemote = async (peer: RemotePeer) => {
    setActiveMenuPeerId(null);
    setSyncingPeerId(peer.id);
    setStatusMessage(`Récupération du graphe depuis ${peer.name}...`);
    setErrorMessage(null);

    try {
      const summary = await kyeService.syncWithRemotePeer(peer.url);
      await useGraphStore.getState().loadGraph();
      const nowStr = new Date().toLocaleTimeString();
      setRemotes(remotes.map(r => r.id === peer.id ? { ...r, lastSync: nowStr } : r));
      setStatusMessage(`⬇️ Pull terminé ! ${summary.appliedLocal} appliqués depuis ${peer.name}.`);
    } catch (e: any) {
      setErrorMessage(`Erreur Pull : ${e.toString()}`);
    } finally {
      setSyncingPeerId(null);
    }
  };

  const handleApplySync = async () => {
    if (!pendingChanges || !reviewPeer) return;
    
    setSyncingPeerId(reviewPeer.id);
    setStatusMessage("Application des modifications sélectionnées...");
    setErrorMessage(null);
    setIsReviewing(false);

    try {
      const selectedLocal = pendingChanges.local.filter(c => c.selected).map(c => c.cmd);
      const selectedRemote = pendingChanges.remote.filter(c => c.selected).map(c => c.cmd);

      if (selectedLocal.length > 0) {
        await kyeService.executeBatch(selectedLocal);
      }

      if (selectedRemote.length > 0) {
        await kyeService.pushToRemotePeer(reviewPeer.url, selectedRemote);
      }

      const nowStr = new Date().toLocaleTimeString();
      setRemotes(remotes.map(r => r.id === reviewPeer.id ? { ...r, lastSync: nowStr } : r));

      await useGraphStore.getState().loadGraph();
      setStatusMessage("Synchronisation terminée avec succès !");
      setPendingChanges(null);
      setReviewPeer(null);
    } catch (e: any) {
      setErrorMessage(`Erreur de synchronisation : ${e.toString()}`);
    } finally {
      setSyncingPeerId(null);
    }
  };

  const toggleChange = (section: 'local' | 'remote', index: number) => {
    if (!pendingChanges) return;
    const updated = { ...pendingChanges };
    updated[section] = [...updated[section]];
    updated[section][index] = {
      ...updated[section][index],
      selected: !updated[section][index].selected
    };
    setPendingChanges(updated);
  };

  const toggleAllSection = (section: 'local' | 'remote') => {
    if (!pendingChanges) return;
    const updated = { ...pendingChanges };
    const allSelected = updated[section].every(c => c.selected);
    updated[section] = updated[section].map(c => ({
      ...c,
      selected: !allSelected
    }));
    setPendingChanges(updated);
  };

  if (isReviewing && pendingChanges && reviewPeer) {
    return (
      <PatchReview
        reviewPeer={reviewPeer}
        pendingChanges={pendingChanges}
        statusMessage={statusMessage}
        errorMessage={errorMessage}
        onBack={() => { setIsReviewing(false); setPendingChanges(null); setReviewPeer(null); }}
        onClose={() => { stopScanning(); onClose(); }}
        onToggleChange={toggleChange}
        onToggleAllSection={toggleAllSection}
        onApply={handleApplySync}
      />
    );
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-md p-4 animate-fade-in">
      <div className="relative w-full max-w-xl bg-card border border-border/80 rounded-2xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden">
        
        {/* Header */}
        <div className="p-5 border-b border-border/50 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-primary/10 text-primary">
              <Network className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold tracking-tight text-card-foreground">Synchronisation P2P</h2>
              <p className="text-xs text-muted-foreground">Connectez vos appareils pour synchroniser vos graphes en temps réel</p>
            </div>
          </div>
          <button 
            onClick={() => { stopScanning(); onClose(); }} 
            className="p-1.5 hover:bg-muted rounded-xl transition-colors text-muted-foreground hover:text-foreground"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* Status Messages */}
          {statusMessage && (
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-500 text-xs flex items-center gap-2">
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

          {/* Local Server Toggle & Pairing QR */}
          <div className="p-4 bg-muted/20 border border-border/60 rounded-xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-3 h-3 rounded-full ${serverRunning ? "bg-emerald-500 animate-pulse" : "bg-muted-foreground/40"}`} />
                <div>
                  <h3 className="font-semibold text-xs text-card-foreground">Serveur de Sync Local</h3>
                  <p className="text-[11px] text-muted-foreground">
                    {serverRunning ? `Actif sur le port ${port}` : "Désactivé (Partage de graphe éteint)"}
                  </p>
                </div>
              </div>
              <button 
                onClick={handleToggleServer}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all shadow-sm ${
                  serverRunning 
                    ? "bg-destructive/10 text-destructive border border-destructive/30 hover:bg-destructive/20" 
                    : "bg-primary text-primary-foreground hover:bg-primary/95"
                }`}
              >
                {serverRunning ? <WifiOff className="w-3.5 h-3.5" /> : <Wifi className="w-3.5 h-3.5" />}
                {serverRunning ? "Arrêter" : "Démarrer"}
              </button>
            </div>

            {serverRunning && (
              <div className="pt-3 border-t border-border/40 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="space-y-1 text-center sm:text-left">
                  <div className="text-xs font-semibold text-foreground">Appareil : {deviceName}</div>
                  {localIp && (
                    <div className="text-[11px] text-muted-foreground">IP Réseau : <span className="text-foreground font-mono">{localIp}:{port}</span></div>
                  )}
                  <div className="text-[11px] text-muted-foreground">PIN d'appairage : <span className="text-foreground font-medium">{pin}</span></div>
                </div>
                {qrSvg && (
                  <div className="flex flex-col items-center justify-center p-2 bg-white rounded-xl border border-border w-28 h-28 mx-auto sm:mx-0">
                    <div 
                      className="w-20 h-20"
                      dangerouslySetInnerHTML={{ 
                        __html: qrSvg.replace(/width="[^"]*"/, 'width="100%"').replace(/height="[^"]*"/, 'height="100%"') 
                      }}
                    />
                    <span className="text-[8px] text-black font-semibold mt-0.5">Scannez pour appairer</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Pair New Peer Section */}
          {scanning ? (
            <div className="relative border border-border/60 rounded-xl overflow-hidden bg-black aspect-video flex flex-col items-center justify-center">
              <video ref={videoRef} className="w-full h-full object-cover" />
              <div className="absolute inset-0 border-2 border-primary/50 m-12 pointer-events-none rounded-lg animate-pulse" />
              <button 
                onClick={stopScanning}
                className="absolute bottom-4 bg-destructive hover:bg-destructive/95 text-white px-4 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow"
              >
                <X className="w-3.5 h-3.5" /> Annuler le Scan
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-xs text-muted-foreground uppercase tracking-wider">Appairer un Appareil</h3>
                <button 
                  onClick={startScanning}
                  className="flex items-center gap-1.5 bg-muted/40 border border-border hover:bg-muted text-foreground px-3 py-1.5 rounded-xl text-xs font-semibold transition-all"
                >
                  <Camera className="w-3.5 h-3.5 text-primary" />
                  Scanner un QR Code
                </button>
              </div>

              <div className="flex gap-2">
                <input 
                  type="text" 
                  placeholder="Coller l'URL d'appairage (kye-remote://... ou http://...)" 
                  value={manualUrl}
                  onChange={(e) => setManualUrl(e.target.value)}
                  className="flex-1 px-3 py-2 bg-muted/20 border border-border/60 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-muted-foreground/45"
                />
                <button 
                  onClick={() => {
                    if (manualUrl.trim()) {
                      handleScannedPairingUrl(manualUrl.trim());
                      setManualUrl("");
                    }
                  }}
                  className="px-4 py-2 bg-primary text-primary-foreground font-semibold rounded-xl text-xs shadow-md hover:bg-primary/95 transition-all"
                >
                  Appairer
                </button>
              </div>
            </div>
          )}

          {/* Paired Remote Peers List */}
          <div className="space-y-3">
            <h3 className="font-semibold text-xs flex items-center gap-2 text-muted-foreground uppercase tracking-wider">
              <Smartphone className="w-4 h-4 text-primary" /> Appareils Appairés ({remotes.length})
            </h3>
            
            {remotes.length === 0 ? (
              <div className="text-center p-8 border border-dashed border-border/55 rounded-xl text-xs text-muted-foreground">
                Aucun appareil appairé. Démarrez le serveur ou scannez un QR code pour vous connecter.
              </div>
            ) : (
              <div className="space-y-2.5">
                {remotes.map(peer => (
                  <div key={peer.id} className="p-4 bg-muted/15 border border-border/50 rounded-xl flex items-center justify-between gap-4 transition-all hover:border-border/80">
                    <div className="min-w-0">
                      <h4 className="font-semibold text-xs text-card-foreground truncate">{peer.name}</h4>
                      <p className="text-[10px] text-muted-foreground mt-0.5 truncate font-mono">{peer.url}</p>
                      {peer.lastSync && (
                        <p className="text-[10px] text-emerald-500 font-medium mt-1">Dernière sync : {peer.lastSync}</p>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-2 relative">
                      {/* 1-Click Automated Sync Button */}
                      <button 
                        onClick={() => handleAutoSyncRemote(peer)}
                        disabled={syncingPeerId !== null}
                        title="Synchroniser automatiquement"
                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-primary-foreground bg-primary hover:bg-primary/95 shadow-md transition-all disabled:opacity-50"
                      >
                        <Zap className={`w-3.5 h-3.5 ${syncingPeerId === peer.id ? "animate-spin" : ""}`} />
                        {syncingPeerId === peer.id ? "Sync..." : "Synchroniser"}
                      </button>

                      {/* Dropdown Options Trigger */}
                      <button 
                        onClick={() => setActiveMenuPeerId(activeMenuPeerId === peer.id ? null : peer.id)}
                        className="p-2 hover:bg-muted rounded-xl text-muted-foreground hover:text-foreground transition-colors border border-border/60"
                        title="Options avancées"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>

                      {/* Advanced Options Dropdown Menu */}
                      {activeMenuPeerId === peer.id && (
                        <div className="absolute right-0 top-11 z-50 w-48 bg-card border border-border/80 rounded-xl shadow-xl p-1.5 space-y-1 animate-fade-in">
                          <button 
                            onClick={() => handleInspectDiffRemote(peer)}
                            className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-foreground hover:bg-muted rounded-lg transition-colors text-left"
                          >
                            <Search className="w-3.5 h-3.5 text-primary" />
                            Inspecter les diffs
                          </button>
                          <button 
                            onClick={() => handlePushRemote(peer)}
                            className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-foreground hover:bg-muted rounded-lg transition-colors text-left"
                          >
                            <ArrowUp className="w-3.5 h-3.5 text-blue-500" />
                            Forcer Push (Envoi)
                          </button>
                          <button 
                            onClick={() => handlePullRemote(peer)}
                            className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-foreground hover:bg-muted rounded-lg transition-colors text-left"
                          >
                            <ArrowDown className="w-3.5 h-3.5 text-emerald-500" />
                            Forcer Pull (Réception)
                          </button>
                          <button 
                            onClick={() => handlePingRemote(peer)}
                            className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-foreground hover:bg-muted rounded-lg transition-colors text-left"
                          >
                            <Wifi className="w-3.5 h-3.5 text-muted-foreground" />
                            Tester la connexion
                          </button>
                          <div className="h-[1px] bg-border/40 my-1" />
                          <button 
                            onClick={() => handleDeleteRemote(peer.id)}
                            className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-destructive hover:bg-destructive/10 rounded-lg transition-colors text-left font-medium"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            Supprimer cet appareil
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

        {/* Footer */}
        <div className="p-4 bg-muted/10 border-t border-border/50 flex justify-end">
          <button 
            onClick={() => { stopScanning(); onClose(); }}
            className="px-4 py-2 bg-muted hover:bg-muted/80 text-foreground rounded-xl text-xs font-semibold transition-all"
          >
            Fermer
          </button>
        </div>

      </div>
    </div>
  );
};

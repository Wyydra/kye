import React, { useState, useEffect } from "react";
import { 
  Wifi, 
  WifiOff, 
  Camera, 
  RefreshCw, 
  Trash2, 
  X, 
  Smartphone, 
  Network
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

  // Set scanning error if any
  useEffect(() => {
    if (scannerError) {
      setErrorMessage(scannerError);
    }
  }, [scannerError]);

  // Load remotes and server status on mount
  useEffect(() => {
    kyeService.getMeta().then((meta) => {
      if (meta) {
        setDeviceName(meta.name);
        setPeerId(meta.id);
      }
    }).catch(console.error);

    // Load remotes from WorkspaceMeta (Domain Service)
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
      setErrorMessage(`Server error: ${e.toString()}`);
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
        throw new Error("Invalid pairing format. Paste the full pairing URL (kye-remote://... or http://...)");
      }

      // Sanitize remote name for domain validation
      const sanitizedName = name.replace(/[^a-zA-Z0-9_-]/g, "_").toLowerCase().slice(0, 32);

      await kyeService.addRemote(sanitizedName, baseRemoteUrl);
      await refreshRemotes();
      setStatusMessage(`Successfully paired with "${sanitizedName}"!`);
    } catch (e: any) {
      setErrorMessage(`Pairing failed: ${e.message || e}`);
    }
  };

  const handleDeleteRemote = async (name: string) => {
    try {
      await kyeService.removeRemote(name);
      await refreshRemotes();
    } catch (e: any) {
      setErrorMessage(`Failed to remove remote: ${e.toString()}`);
    }
  };

  const handlePingRemote = async (peer: RemotePeer) => {
    try {
      setStatusMessage(`Pinging ${peer.name}...`);
      const info = await kyeService.pingRemotePeer(peer.url);
      setStatusMessage(`Online! Connected to "${info.name}"`);
      setErrorMessage(null);
    } catch (e: any) {
      setErrorMessage(`Ping failed: ${e.toString()}`);
    }
  };

  const handleSyncRemote = async (peer: RemotePeer) => {
    setSyncingPeerId(peer.id);
    setStatusMessage(`Initiating bidirectional sync with ${peer.name}...`);
    setErrorMessage(null);

    try {
      const diff = await kyeService.computeSyncDiff(peer.url);

      if (diff.local.length === 0 && diff.remote.length === 0) {
        setStatusMessage("Vos graphes sont déjà parfaitement synchronisés !");
        setErrorMessage(null);
        setSyncingPeerId(null);
        return;
      }

      setPendingChanges({
        local: diff.local,
        remote: diff.remote
      });
      setReviewPeer(peer);
      setIsReviewing(true);
      setStatusMessage(null);
      setErrorMessage(null);
    } catch (e: any) {
      setErrorMessage(`Sync diff failed: ${e.toString()}`);
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
        setStatusMessage(`Application de ${selectedLocal.length} mise(s) à jour locale(s)...`);
        await kyeService.executeBatch(selectedLocal);
      }

      if (selectedRemote.length > 0) {
        setStatusMessage(`Envoi de ${selectedRemote.length} mise(s) à jour distante(s)...`);
        await kyeService.pushToRemotePeer(reviewPeer.url, selectedRemote);
      }

      const nowStr = new Date().toLocaleTimeString();
      const updatedRemotes = remotes.map(r => 
        r.id === reviewPeer.id ? { ...r, lastSync: nowStr } : r
      );
      setRemotes(updatedRemotes);

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
      <div className="relative w-full max-w-2xl bg-card border border-border/80 rounded-2xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden">
        
        {/* Header */}
        <div className="p-5 border-b border-border/50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Network className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-bold tracking-tight text-card-foreground">P2P Synchronisation</h2>
          </div>
          <button 
            onClick={() => { stopScanning(); onClose(); }} 
            className="p-1 hover:bg-muted rounded-lg transition-colors text-muted-foreground hover:text-foreground"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* Status Messages */}
          {statusMessage && (
            <div className="p-3 bg-primary/10 border border-primary/30 rounded-xl text-primary text-xs flex flex-row items-center gap-2">
              <span className="flex h-1.5 w-1.5 rounded-full bg-primary" />
              <span>{statusMessage}</span>
            </div>
          )}

          {errorMessage && (
            <div className="p-3 bg-destructive/10 border border-destructive/30 rounded-xl text-destructive text-xs flex flex-row items-center gap-2">
              <span className="flex h-1.5 w-1.5 rounded-full bg-destructive" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Local Server Config */}
          <div className="p-5 bg-muted/20 border border-border/40 rounded-xl space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-sm">Local Sync Listener</h3>
                <p className="text-[11px] text-muted-foreground mt-0.5">Allow other Kye instances to connect and sync with this device.</p>
              </div>
              <button 
                onClick={handleToggleServer}
                className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-semibold shadow transition-all ${
                  serverRunning 
                    ? "bg-emerald-600 hover:bg-emerald-500 text-white" 
                    : "bg-primary hover:bg-primary/90 text-primary-foreground"
                }`}
              >
                {serverRunning ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
                {serverRunning ? "Online (Server running)" : "Go Online"}
              </button>
            </div>

            {serverRunning && (
              <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-4 pt-3 border-t border-border/40 items-center">
                <div className="space-y-2 min-w-0">
                  <div className="text-[11px] text-muted-foreground truncate">Device Name: <span className="text-foreground font-medium">{deviceName}</span></div>
                  {localIp && (
                    <div className="text-[11px] text-muted-foreground truncate">Network URL: <span className="text-foreground font-medium">http://{localIp}:{port}</span></div>
                  )}
                  <div className="text-[11px] text-muted-foreground">Pairing PIN: <span className="text-foreground font-medium">{pin}</span></div>
                </div>
                {qrSvg && (
                  <div className="flex flex-col items-center justify-center p-2 bg-white rounded-lg border border-border w-28 h-28 sm:w-32 sm:h-32 self-center sm:self-auto mx-auto sm:mx-0">
                    <div 
                      className="w-20 h-20 sm:w-24 sm:h-24"
                      dangerouslySetInnerHTML={{ 
                        __html: qrSvg.replace(/width="[^"]*"/, 'width="100%"').replace(/height="[^"]*"/, 'height="100%"') 
                      }}
                    />
                    <span className="text-[8px] text-black font-semibold mt-1">Scan to Pair Device</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* QR Code Scanner (Camera View) */}
          {scanning ? (
            <div className="relative border border-border/60 rounded-xl overflow-hidden bg-black aspect-video flex flex-col items-center justify-center">
              <video ref={videoRef} className="w-full h-full object-cover" />
              <div className="absolute inset-0 border-2 border-primary/50 m-12 pointer-events-none rounded-lg animate-pulse" />
              <button 
                onClick={stopScanning}
                className="absolute bottom-4 bg-destructive hover:bg-destructive/95 text-white px-4 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow"
              >
                <X className="w-3.5 h-3.5" /> Cancel Scan
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex justify-center">
                <button 
                  onClick={startScanning}
                  className="flex items-center gap-2 bg-muted/30 border border-border hover:bg-muted/50 text-foreground px-5 py-2.5 rounded-xl text-xs font-semibold transition-all shadow-sm"
                >
                  <Camera className="w-4 h-4 text-primary" />
                  Scan Remote Pairing QR Code
                </button>
              </div>

              <div className="flex items-center gap-3 my-2">
                <div className="flex-1 h-[1px] bg-border/40" />
                <span className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-wider">or enter manually</span>
                <div className="flex-1 h-[1px] bg-border/40" />
              </div>

              <div className="flex gap-2">
                <input 
                  type="text" 
                  placeholder="kye-remote://... or http://192.168.1.X:1425" 
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
                  Pair Device
                </button>
              </div>
            </div>
          )}

          {/* Paired Remote Peers List */}
          <div className="space-y-3">
            <h3 className="font-semibold text-sm flex items-center gap-2 text-muted-foreground">
              <Smartphone className="w-4 h-4" /> Paired Peers ({remotes.length})
            </h3>
            
            {remotes.length === 0 ? (
              <div className="text-center p-8 border border-dashed border-border/55 rounded-xl text-xs text-muted-foreground">
                No paired peers found. Toggle the sync server or scan a pairing QR code to connect.
              </div>
            ) : (
              <div className="space-y-2">
                {remotes.map(peer => (
                  <div key={peer.id} className="p-4 bg-muted/15 border border-border/50 rounded-xl flex items-center justify-between gap-4">
                    <div>
                      <h4 className="font-semibold text-xs text-card-foreground">{peer.name}</h4>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{peer.url}</p>
                      {peer.lastSync && (
                        <p className="text-[9px] text-emerald-500 font-medium mt-1">Last synced: {peer.lastSync}</p>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => handlePingRemote(peer)}
                        className="px-2.5 py-1 hover:bg-muted rounded-md text-[10px] font-semibold border border-border text-muted-foreground hover:text-foreground transition-all"
                      >
                        Ping
                      </button>
                      <button 
                        onClick={() => handleSyncRemote(peer)}
                        disabled={syncingPeerId !== null}
                        className="flex items-center gap-1.5 px-3 py-1 rounded-md text-[10px] font-semibold text-primary-foreground bg-primary hover:bg-primary/95 transition-all disabled:opacity-50"
                      >
                        <RefreshCw className={`w-3 h-3 ${syncingPeerId === peer.id ? "animate-spin" : ""}`} />
                        {syncingPeerId === peer.id ? "Syncing..." : "Sync Now"}
                      </button>
                      <button 
                        onClick={() => handleDeleteRemote(peer.id)}
                        className="p-1 hover:bg-destructive/10 rounded-md text-muted-foreground hover:text-destructive transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
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
            Close
          </button>
        </div>

      </div>
    </div>
  );
};

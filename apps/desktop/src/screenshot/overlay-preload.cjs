const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("edgeeverScreenshot", Object.freeze({
  onInit: (callback) => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on("desktop:screenshot-overlay-init", listener);
    return () => ipcRenderer.removeListener("desktop:screenshot-overlay-init", listener);
  },
  complete: (rect) => ipcRenderer.send("desktop:screenshot-overlay-complete", rect),
  cancel: () => ipcRenderer.send("desktop:screenshot-overlay-cancel"),
}));

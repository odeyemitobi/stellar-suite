"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.SidebarAutoRefreshService = void 0;
const path = __importStar(require("path"));
const vscode = __importStar(require("vscode"));
/**
 * Debounced file-change driven refresh orchestration for the sidebar.
 */
class SidebarAutoRefreshService {
    constructor(sidebarProvider, outputChannel, config = {}) {
        this.sidebarProvider = sidebarProvider;
        this.outputChannel = outputChannel;
        this.pendingChanges = new Set();
        this.lastRefreshAt = 0;
        this.debounceMs = config.debounceMs ?? 350;
        this.minRefreshIntervalMs = config.minRefreshIntervalMs ?? 900;
        this.watcher = vscode.workspace.createFileSystemWatcher('**/*');
        this.watcher.onDidCreate(uri => this.onFileEvent(uri, 'create'));
        this.watcher.onDidChange(uri => this.onFileEvent(uri, 'change'));
        this.watcher.onDidDelete(uri => this.onFileEvent(uri, 'delete'));
    }
    triggerManualRefresh() {
        this.outputChannel.appendLine('[AutoRefresh] Manual refresh requested');
        this.sidebarProvider.refresh();
    }
    queueFileChange(fsPath) {
        if (!this.isRelevantPath(fsPath)) {
            return;
        }
        this.pendingChanges.add(fsPath);
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
        }
        this.debounceTimer = setTimeout(() => {
            this.debounceTimer = undefined;
            this.flushPending();
        }, this.debounceMs);
    }
    isRelevantPath(fsPath) {
        const normalized = fsPath.replace(/\\/g, '/');
        if (path.basename(normalized) === 'Cargo.toml') {
            return true;
        }
        if (normalized.endsWith('.wasm') && normalized.includes('/target/')) {
            return true;
        }
        return false;
    }
    onFileEvent(uri, event) {
        const fsPath = uri.fsPath;
        if (!this.isRelevantPath(fsPath)) {
            return;
        }
        this.outputChannel.appendLine(`[AutoRefresh] ${event}: ${fsPath}`);
        this.queueFileChange(fsPath);
    }
    flushPending() {
        if (!this.pendingChanges.size) {
            return;
        }
        const now = Date.now();
        const elapsed = now - this.lastRefreshAt;
        const waitMs = Math.max(0, this.minRefreshIntervalMs - elapsed);
        if (waitMs > 0) {
            if (this.flushTimer) {
                clearTimeout(this.flushTimer);
            }
            this.flushTimer = setTimeout(() => {
                this.flushTimer = undefined;
                this.flushPending();
            }, waitMs);
            return;
        }
        const changedPaths = Array.from(this.pendingChanges);
        this.pendingChanges.clear();
        this.lastRefreshAt = Date.now();
        this.outputChannel.appendLine(`[AutoRefresh] Refreshing sidebar from ${changedPaths.length} debounced file change(s)`);
        this.sidebarProvider.refresh();
    }
    dispose() {
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
        }
        if (this.flushTimer) {
            clearTimeout(this.flushTimer);
        }
        this.watcher.dispose();
    }
}
exports.SidebarAutoRefreshService = SidebarAutoRefreshService;

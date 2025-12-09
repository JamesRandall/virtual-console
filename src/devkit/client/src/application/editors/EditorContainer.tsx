import {useState, useCallback} from "react";

import {useDevkitStore, type SpritePaletteConfig, type TilemapEditorFileConfig, type ProjectConfig} from "../../stores/devkitStore.ts";
import "./EditorContainer.css";

import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import {faImage, faSave} from "@fortawesome/free-solid-svg-icons";
import {ImageGenerator} from "../../components/ImageGenerator.tsx";
import {TabStrip, type Tab} from "../../components/TabStrip.tsx";
import {writeFile, writeBinaryFile, readFile} from "../../services/fileSystemService.ts";
import {AssemblyEditor} from "./assembly/AssemblyEditor.tsx";
import {PaletteEditor} from "./palette/PaletteEditor.tsx";
import {SpriteEditor} from "./spriteEditor/SpriteEditor.tsx";
import {CartridgeEditor} from "./cartridge/CartridgeEditor.tsx";
import {TilemapEditor} from "./tilemapEditor/TilemapEditor.tsx";

// Extract gbin name from path (e.g., "sprites/player.gbin" -> "player")
function getGbinName(filePath: string): string {
    const fileName = filePath.split('/').pop() || filePath;
    return fileName.replace('.gbin', '');
}

// Extract tbin name from path (e.g., "tilemaps/level1.tbin" -> "level1")
function getTbinName(filePath: string): string {
    const fileName = filePath.split('/').pop() || filePath;
    return fileName.replace('.tbin', '');
}

// Get the sbin path for a given tbin path (e.g., "tilemaps/level1.tbin" -> "tilemaps/level1.sbin")
function getSbinPath(tbinPath: string): string {
    return tbinPath.replace(/\.tbin$/, '.sbin');
}

export function EditorContainer() {
    // Zustand store hooks
    const sourceMap = useDevkitStore((state) => state.sourceMap);
    const breakpointsByFile = useDevkitStore((state) => state.breakpointsByFile);
    const codeChangedSinceAssembly = useDevkitStore((state) => state.codeChangedSinceAssembly);

    // Project state
    const currentProjectHandle = useDevkitStore((state) => state.currentProjectHandle);
    const openFiles = useDevkitStore((state) => state.openFiles);
    const activeFilePath = useDevkitStore((state) => state.activeFilePath);
    const setActiveFile = useDevkitStore((state) => state.setActiveFile);
    const closeFile = useDevkitStore((state) => state.closeFile);
    const updateFileContent = useDevkitStore((state) => state.updateFileContent);
    const markFileDirty = useDevkitStore((state) => state.markFileDirty);
    const setProjectConfig = useDevkitStore((state) => state.setProjectConfig);

    // Local state
    const [isImageGeneratorOpen, setIsImageGeneratorOpen] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [showPaletteIndexes, setShowPaletteIndexes] = useState(true);

    // Get the active file
    const activeFile = openFiles.find(f => f.path === activeFilePath);

    // Check file types
    const isAsmFile = activeFilePath?.endsWith('.asm') ?? false;
    const isPbinFile = activeFilePath?.endsWith('.pbin') ?? false;
    const isGbinFile = activeFilePath?.endsWith('.gbin') ?? false;
    const isTbinFile = activeFilePath?.endsWith('.tbin') ?? false;
    const isCartridgeJson = activeFilePath === 'cartridge.json';
    const isBinaryFile = isPbinFile || isGbinFile || isTbinFile;

    // Event handlers
    const handleSaveFile = useCallback(async () => {
        if (!activeFile || !currentProjectHandle || !activeFilePath) {
            return;
        }

        setIsSaving(true);

        try {
            // For binary files (.pbin, .gbin), content is stored as a base64-encoded string
            // For other files, it's plain text
            if (isBinaryFile) {
                // Decode base64 back to binary
                const binaryString = atob(activeFile.content);
                const bytes = new Uint8Array(binaryString.length);
                for (let i = 0; i < binaryString.length; i++) {
                    bytes[i] = binaryString.charCodeAt(i);
                }
                await writeBinaryFile(currentProjectHandle, activeFilePath, bytes);

                // For gbin files, also save palette configs to config.json
                if (isGbinFile) {
                    const gbinName = getGbinName(activeFilePath);
                    const paletteConfigs = (window as unknown as Record<string, SpritePaletteConfig[]>)[`__spritePaletteConfigs_${gbinName}`];

                    if (paletteConfigs && paletteConfigs.length > 0) {
                        try {
                            // Read current config.json (it may have been modified by other editors)
                            const configContent = await readFile(currentProjectHandle, 'config.json');
                            const config: ProjectConfig = JSON.parse(configContent);

                            // Initialize sprite-editor section if it doesn't exist
                            if (!config['sprite-editor']) {
                                config['sprite-editor'] = {};
                            }

                            // Update only this gbin's palette configs
                            config['sprite-editor'][gbinName] = paletteConfigs;

                            // Write back to config.json
                            await writeFile(currentProjectHandle, 'config.json', JSON.stringify(config, null, 2));

                            // Update the Zustand store so reopening the editor uses the new config
                            setProjectConfig(config);
                        } catch (error) {
                            console.error('Error saving sprite palette config:', error);
                            // Don't fail the save if config update fails
                        }
                    }
                }

                // For tbin files, also save file config (gbin/pbin selections) to config.json
                if (isTbinFile) {
                    const tbinName = getTbinName(activeFilePath);
                    const fileConfig = (window as unknown as Record<string, TilemapEditorFileConfig | null>)[`__tilemapFileConfig_${tbinName}`];

                    if (fileConfig && (fileConfig.gbin || fileConfig.pbin)) {
                        try {
                            // Read current config.json (it may have been modified by other editors)
                            const configContent = await readFile(currentProjectHandle, 'config.json');
                            const config: ProjectConfig = JSON.parse(configContent);

                            // Initialize tilemap-editor section if it doesn't exist
                            if (!config['tilemap-editor']) {
                                config['tilemap-editor'] = {};
                            }

                            // Update only this tbin's file config
                            config['tilemap-editor'][tbinName] = fileConfig;

                            // Write back to config.json
                            await writeFile(currentProjectHandle, 'config.json', JSON.stringify(config, null, 2));

                            // Update the Zustand store so reopening the editor uses the new config
                            setProjectConfig(config);
                        } catch (error) {
                            console.error('Error saving tilemap file config:', error);
                            // Don't fail the save if config update fails
                        }
                    }

                    // Also save the associated sbin file (sprite placements)
                    const sbinPath = getSbinPath(activeFilePath);
                    const sbinFile = openFiles.find(f => f.path === sbinPath);
                    if (sbinFile) {
                        try {
                            const binaryString = atob(sbinFile.content);
                            const bytes = new Uint8Array(binaryString.length);
                            for (let i = 0; i < binaryString.length; i++) {
                                bytes[i] = binaryString.charCodeAt(i);
                            }
                            await writeBinaryFile(currentProjectHandle, sbinPath, bytes);
                            markFileDirty(sbinPath, false);
                        } catch (error) {
                            console.error('Error saving sbin file:', error);
                            // Don't fail the tbin save if sbin save fails
                        }
                    }
                }
            } else {
                await writeFile(currentProjectHandle, activeFilePath, activeFile.content);
            }
            markFileDirty(activeFilePath, false);
        } catch (error) {
            console.error('Error saving file:', error);
            alert('Failed to save file: ' + (error instanceof Error ? error.message : 'Unknown error'));
        } finally {
            setIsSaving(false);
        }
    }, [activeFile, currentProjectHandle, activeFilePath, isBinaryFile, isGbinFile, isTbinFile, markFileDirty, setProjectConfig, openFiles]);

    const handleContentChange = useCallback((content: string) => {
        if (!activeFilePath) {
            return;
        }

        // Update the file content in the store
        updateFileContent(activeFilePath, content);

        // Mark as dirty if content changed
        const currentFile = openFiles.find(f => f.path === activeFilePath);
        if (currentFile && currentFile.content !== content) {
            markFileDirty(activeFilePath, true);
        }
    }, [activeFilePath, updateFileContent, openFiles, markFileDirty]);

    const handleGenerateFromImage = useCallback((assemblyCode: string) => {
        if (activeFilePath) {
            updateFileContent(activeFilePath, assemblyCode);
            markFileDirty(activeFilePath, true);
        }
    }, [activeFilePath, updateFileContent, markFileDirty]);

    const handleTabChange = useCallback((tabId: string) => {
        setActiveFile(tabId);
    }, [setActiveFile]);

    const handleTabClose = useCallback((tabId: string) => {
        const file = openFiles.find(f => f.path === tabId);
        if (file?.isDirty) {
            const shouldClose = confirm(`${file.path} has unsaved changes. Close anyway?`);
            if (!shouldClose) {
                return;
            }
        }
        closeFile(tabId);
    }, [openFiles, closeFile]);

    // Determine if we should show the warning banner
    // Show if there are any breakpoints across any file
    const hasAnyBreakpoints = breakpointsByFile.size > 0;
    const showWarningBanner = codeChangedSinceAssembly && hasAnyBreakpoints && sourceMap.length > 0;

    // Convert open files to tabs
    const tabs: Tab[] = openFiles.map(file => ({
        id: file.path,
        label: file.path.split('/').pop() || file.path,
        isDirty: file.isDirty,
    }));

    // Render
    if (!currentProjectHandle) {
        return (
            <div className="flex flex-col h-full w-full bg-zinc-800 items-center justify-center text-zinc-400">
                <p>No project loaded. Open or create a project to start editing.</p>
            </div>
        );
    }

    if (openFiles.length === 0) {
        return (
            <div className="flex flex-col h-full w-full bg-zinc-800 items-center justify-center text-zinc-400">
                <p>No files open. Double-click a file in the project explorer to open it.</p>
            </div>
        );
    }

    return <div className="flex flex-col h-full w-full bg-zinc-800">
        <ImageGenerator
            isOpen={isImageGeneratorOpen}
            onClose={() => setIsImageGeneratorOpen(false)}
            onGenerate={handleGenerateFromImage}
        />

        {/* Tabs */}
        {tabs.length > 0 && (
            <TabStrip
                tabs={tabs}
                activeTabId={activeFilePath || ''}
                onTabChange={handleTabChange}
                onTabClose={handleTabClose}
            />
        )}

        {/* Editor */}
        <div className="flex-1 min-h-0 overflow-hidden relative">
            {/* Warning banner for out-of-sync breakpoints */}
            {showWarningBanner && (
                <div className="absolute top-0 left-0 right-0 z-10 bg-amber-600 text-white px-4 py-2 text-sm flex items-center justify-between shadow-lg">
                    <div className="flex items-center gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                        <span className="font-medium">Code changed since last assembly</span>
                        <span>- Breakpoint addresses may be out of sync. Reassemble to update.</span>
                    </div>
                </div>
            )}

            {isAsmFile ? (
                <AssemblyEditor
                    content={activeFile?.content || ''}
                    filePath={activeFilePath || ''}
                    onChange={handleContentChange}
                />
            ) : isPbinFile ? (
                <PaletteEditor
                    filePath={activeFilePath || ''}
                    content={activeFile?.content || ''}
                    showIndexes={showPaletteIndexes}
                    onShowIndexesChange={setShowPaletteIndexes}
                />
            ) : isGbinFile ? (
                <SpriteEditor
                    filePath={activeFilePath || ''}
                    content={activeFile?.content || ''}
                />
            ) : isCartridgeJson ? (
                <CartridgeEditor
                    filePath={activeFilePath || ''}
                    content={activeFile?.content || ''}
                />
            ) : isTbinFile ? (
                <TilemapEditor
                    filePath={activeFilePath || ''}
                    content={activeFile?.content || ''}
                />
            ) : (
                <div className="flex flex-col h-full items-center justify-center text-zinc-400">
                    <p>This file type is not editable yet.</p>
                    <p className="text-sm mt-2">Only .asm, .pbin, .gbin, .tbin, and cartridge.json files can be edited.</p>
                </div>
            )}
        </div>

        {/* Toolbar */}
        <div className="flex justify-between dk-gap-compact px-3 py-1.5 dk-border-t items-center dk-text-primary flex-shrink-0">
            {/* Left side - palette options */}
            <div className="flex items-center dk-gap-compact">
                {isPbinFile && (
                    <label className="flex items-center dk-gap-compact cursor-pointer dk-text-secondary">
                        <input
                            type="checkbox"
                            checked={showPaletteIndexes}
                            onChange={(e) => setShowPaletteIndexes(e.target.checked)}
                            className="cursor-pointer"
                        />
                        <span className="text-sm">Show palette indexes</span>
                    </label>
                )}
            </div>

            {/* Right side - action buttons */}
            <div className="flex dk-gap-compact">
                <button
                    onClick={handleSaveFile}
                    disabled={!activeFile?.isDirty || isSaving}
                    className="dk-btn-icon dk-btn-disabled border border-transparent"
                    title="Save file"
                >
                    <FontAwesomeIcon icon={faSave} />
                </button>
                {isAsmFile && (
                    <button
                        onClick={() => setIsImageGeneratorOpen(true)}
                        className="dk-btn-icon border border-transparent"
                        title="Convert image to assembly"
                    >
                        <FontAwesomeIcon icon={faImage} />
                    </button>
                )}
            </div>
        </div>
    </div>
}

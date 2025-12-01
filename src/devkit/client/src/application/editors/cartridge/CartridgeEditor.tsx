import { useCallback, useMemo, useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faBox,
  faCode,
  faImage,
  faMap,
  faPalette,
  faGripVertical,
  faTrash,
  faPlus,
  faLock,
} from '@fortawesome/free-solid-svg-icons';
import { useDevkitStore } from '../../../stores/devkitStore';
import { AssetPalette } from './AssetPalette';

interface CartridgeEditorProps {
  filePath: string;
  content: string;
}

interface CartridgeConfig {
  banks?: string[];
  [key: string]: unknown;
}

interface BankItem {
  id: string;
  path: string;
  isFixed: boolean;
  type: 'metadata' | 'code' | 'gbin' | 'pbin' | 'tbin';
}

// Get icon for bank type
function getBankIcon(type: BankItem['type']) {
  switch (type) {
    case 'metadata':
      return faBox;
    case 'code':
      return faCode;
    case 'gbin':
      return faImage;
    case 'pbin':
      return faPalette;
    case 'tbin':
      return faMap;
    default:
      return faBox;
  }
}

// Get type from file path
function getTypeFromPath(path: string): BankItem['type'] {
  if (path === 'metadata.bin') return 'metadata';
  if (path === 'code.bin') return 'code';
  if (path.endsWith('.gbin')) return 'gbin';
  if (path.endsWith('.pbin')) return 'pbin';
  if (path.endsWith('.tbin')) return 'tbin';
  return 'gbin';
}

export function CartridgeEditor({ filePath, content }: CartridgeEditorProps) {
  // Zustand store hooks
  const updateFileContent = useDevkitStore((state) => state.updateFileContent);
  const markFileDirty = useDevkitStore((state) => state.markFileDirty);

  // Local state
  const [banks, setBanks] = useState<BankItem[]>([]);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // Parse the cartridge.json content
  const cartridgeConfig = useMemo((): CartridgeConfig => {
    try {
      return JSON.parse(content) as CartridgeConfig;
    } catch {
      return {};
    }
  }, [content]);

  // Initialize banks from content
  useEffect(() => {
    const configBanks = cartridgeConfig.banks || [];

    // Build bank items - always start with fixed banks
    const bankItems: BankItem[] = [
      { id: 'bank-0-metadata', path: 'metadata.bin', isFixed: true, type: 'metadata' },
      { id: 'bank-1-code', path: 'code.bin', isFixed: true, type: 'code' },
    ];

    // Add configured banks (skip first two if they match the fixed banks)
    let startIndex = 0;
    if (configBanks[0] === 'metadata.bin') startIndex++;
    if (configBanks[1] === 'code.bin') startIndex++;

    for (let i = startIndex; i < configBanks.length; i++) {
      const path = configBanks[i];
      bankItems.push({
        id: `bank-${i}-${path}`,
        path,
        isFixed: false,
        type: getTypeFromPath(path),
      });
    }

    setBanks(bankItems);
  }, [cartridgeConfig]);

  // Update content when banks change
  const updateContent = useCallback((newBanks: BankItem[]) => {
    const newConfig: CartridgeConfig = {
      ...cartridgeConfig,
      banks: newBanks.map(b => b.path),
    };
    updateFileContent(filePath, JSON.stringify(newConfig, null, 2));
    markFileDirty(filePath, true);
  }, [cartridgeConfig, filePath, updateFileContent, markFileDirty]);

  // Handle adding asset from palette
  const handleAddAsset = useCallback((assetPath: string) => {
    // Check if already in banks
    if (banks.some(b => b.path === assetPath)) {
      return;
    }

    const newBank: BankItem = {
      id: `bank-${banks.length}-${assetPath}-${Date.now()}`,
      path: assetPath,
      isFixed: false,
      type: getTypeFromPath(assetPath),
    };

    const newBanks = [...banks, newBank];
    setBanks(newBanks);
    updateContent(newBanks);
  }, [banks, updateContent]);

  // Handle removing a bank
  const handleRemoveBank = useCallback((index: number) => {
    if (banks[index].isFixed) return;

    const newBanks = banks.filter((_, i) => i !== index);
    setBanks(newBanks);
    updateContent(newBanks);
  }, [banks, updateContent]);

  // Drag and drop handlers for reordering
  const handleDragStart = useCallback((e: React.DragEvent, index: number) => {
    if (banks[index].isFixed) {
      e.preventDefault();
      return;
    }
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(index));
  }, [banks]);

  const handleDragOver = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault();
    // Don't allow dropping on fixed banks
    if (index < 2) {
      setDragOverIndex(null);
      return;
    }
    setDragOverIndex(index);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOverIndex(null);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    setDragOverIndex(null);

    if (draggedIndex === null || targetIndex < 2 || draggedIndex < 2) {
      setDraggedIndex(null);
      return;
    }

    if (draggedIndex === targetIndex) {
      setDraggedIndex(null);
      return;
    }

    const newBanks = [...banks];
    const [removed] = newBanks.splice(draggedIndex, 1);
    newBanks.splice(targetIndex, 0, removed);

    // Update IDs based on new positions
    const updatedBanks = newBanks.map((bank, i) => ({
      ...bank,
      id: `bank-${i}-${bank.path}-${Date.now()}`,
    }));

    setBanks(updatedBanks);
    updateContent(updatedBanks);
    setDraggedIndex(null);
  }, [banks, draggedIndex, updateContent]);

  const handleDragEnd = useCallback(() => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  }, []);

  // Handle drop from asset palette
  const handleDropFromPalette = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const assetPath = e.dataTransfer.getData('application/asset-path');
    if (assetPath) {
      handleAddAsset(assetPath);
    }
    setDragOverIndex(null);
  }, [handleAddAsset]);

  const handleDragOverList = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    // Check if this is a drop from the palette
    if (e.dataTransfer.types.includes('application/asset-path')) {
      setDragOverIndex(banks.length);
    }
  }, [banks.length]);

  return (
    <div className="flex flex-col h-full dk-bg-primary">
      {/* Header */}
      <div className="dk-layout-header">
        <h2 className="dk-subsection-header">Cartridge Configuration</h2>
        <span className="dk-tertiary-text">{banks.length} banks configured</span>
      </div>

      {/* Main content area */}
      <div className="flex flex-1 min-h-0">
        {/* Bank list */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="dk-padding-compact dk-border-b">
            <span className="dk-label">Cartridge Banks (32KB each)</span>
          </div>

          <div
            className="flex-1 overflow-auto dk-padding-compact"
            onDragOver={handleDragOverList}
            onDrop={handleDropFromPalette}
          >
            <div className="flex flex-col dk-gap-small">
              {banks.map((bank, index) => (
                <div
                  key={bank.id}
                  className={`
                    flex items-center dk-gap-small dk-padding-compact rounded
                    ${bank.isFixed ? 'dk-bg-secondary' : 'dk-bg-elevated cursor-move'}
                    ${draggedIndex === index ? 'opacity-50' : ''}
                    ${dragOverIndex === index ? 'ring-2 ring-zinc-500' : ''}
                  `}
                  draggable={!bank.isFixed}
                  onDragStart={(e) => handleDragStart(e, index)}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, index)}
                  onDragEnd={handleDragEnd}
                >
                  {/* Drag handle or lock icon */}
                  <div className="w-6 flex justify-center">
                    {bank.isFixed ? (
                      <FontAwesomeIcon icon={faLock} className="dk-text-muted text-xs" />
                    ) : (
                      <FontAwesomeIcon icon={faGripVertical} className="dk-text-secondary text-xs" />
                    )}
                  </div>

                  {/* Bank index */}
                  <div className="w-8 dk-mono-small dk-text-secondary">
                    #{index}
                  </div>

                  {/* Type icon */}
                  <FontAwesomeIcon
                    icon={getBankIcon(bank.type)}
                    className={`w-4 ${bank.type === 'code' ? 'text-blue-400' : bank.type === 'metadata' ? 'text-amber-400' : 'dk-text-secondary'}`}
                  />

                  {/* Path */}
                  <div className="flex-1 dk-mono-small dk-text-primary truncate">
                    {bank.path}
                  </div>

                  {/* Description for fixed banks */}
                  {bank.isFixed && (
                    <span className="dk-tertiary-text text-xs">
                      {bank.type === 'metadata' ? 'Load addresses & metadata' : 'Assembled code'}
                    </span>
                  )}

                  {/* Delete button */}
                  {!bank.isFixed && (
                    <button
                      onClick={() => handleRemoveBank(index)}
                      className="dk-btn-icon dk-btn-disabled p-1"
                      title="Remove from cartridge"
                    >
                      <FontAwesomeIcon icon={faTrash} className="text-xs" />
                    </button>
                  )}
                </div>
              ))}

              {/* Drop zone indicator when dragging from palette */}
              {dragOverIndex === banks.length && (
                <div className="flex items-center dk-gap-small dk-padding-compact rounded border-2 border-dashed border-zinc-500 dk-text-secondary">
                  <FontAwesomeIcon icon={faPlus} className="text-xs" />
                  <span className="text-sm">Drop asset here</span>
                </div>
              )}

              {/* Empty state */}
              {banks.length <= 2 && (
                <div className="dk-padding-standard text-center dk-text-secondary">
                  <p className="mb-2">No asset banks configured yet.</p>
                  <p className="text-xs">Drag assets from the palette on the right to add them to your cartridge.</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Asset palette */}
        <div className="w-64 flex-shrink-0 dk-border-l flex flex-col">
          <div className="dk-padding-compact dk-border-b">
            <span className="dk-label">Available Assets</span>
          </div>
          <div className="flex-1 min-h-0 overflow-auto">
            <AssetPalette
              onAssetClick={handleAddAsset}
              existingBanks={banks.map(b => b.path)}
            />
          </div>
        </div>
      </div>

      {/* Footer info */}
      <div className="dk-padding-compact dk-border-t dk-text-secondary text-xs">
        <p>Banks 0 (metadata) and 1 (code) are fixed. Drag other banks to reorder. Each bank is 32KB.</p>
      </div>
    </div>
  );
}

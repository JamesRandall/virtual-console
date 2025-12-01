import { useCallback, useEffect, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faImage, faPalette, faMap, faCheck } from '@fortawesome/free-solid-svg-icons';
import { useDevkitStore } from '../../../stores/devkitStore';

interface AssetPaletteProps {
  onAssetClick: (assetPath: string) => void;
  existingBanks: string[];
}

interface AssetItem {
  path: string;
  name: string;
  type: 'gbin' | 'pbin' | 'tbin';
}

// Get icon for asset type
function getAssetIcon(type: AssetItem['type']) {
  switch (type) {
    case 'gbin':
      return faImage;
    case 'pbin':
      return faPalette;
    case 'tbin':
      return faMap;
  }
}

// Recursively find all assets in a directory
async function findAssetsInDirectory(
  handle: FileSystemDirectoryHandle,
  basePath: string,
  assets: AssetItem[]
): Promise<void> {
  for await (const entry of handle.values()) {
    const entryPath = basePath ? `${basePath}/${entry.name}` : entry.name;

    if (entry.kind === 'directory') {
      const subDirHandle = await handle.getDirectoryHandle(entry.name);
      await findAssetsInDirectory(subDirHandle, entryPath, assets);
    } else if (entry.kind === 'file') {
      const ext = entry.name.split('.').pop()?.toLowerCase();
      if (ext === 'gbin' || ext === 'pbin' || ext === 'tbin') {
        assets.push({
          path: entryPath,
          name: entry.name,
          type: ext as AssetItem['type'],
        });
      }
    }
  }
}

export function AssetPalette({ onAssetClick, existingBanks }: AssetPaletteProps) {
  // Zustand store hooks
  const currentProjectHandle = useDevkitStore((state) => state.currentProjectHandle);
  const projectTreeVersion = useDevkitStore((state) => state.projectTreeVersion);

  // Local state
  const [assets, setAssets] = useState<AssetItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Load assets from project
  useEffect(() => {
    async function loadAssets() {
      if (!currentProjectHandle) {
        setAssets([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      const foundAssets: AssetItem[] = [];

      try {
        // Search in sprites, tiles, maps, and palettes directories
        const directories = ['sprites', 'tiles', 'maps', 'palettes'];

        for (const dir of directories) {
          try {
            const dirHandle = await currentProjectHandle.getDirectoryHandle(dir, { create: false });
            await findAssetsInDirectory(dirHandle, dir, foundAssets);
          } catch {
            // Directory doesn't exist, skip
          }
        }

        // Sort by path
        foundAssets.sort((a, b) => a.path.localeCompare(b.path));
        setAssets(foundAssets);
      } catch (error) {
        console.error('Error loading assets:', error);
      } finally {
        setLoading(false);
      }
    }

    loadAssets();
  }, [currentProjectHandle, projectTreeVersion]);

  // Handle drag start
  const handleDragStart = useCallback((e: React.DragEvent, asset: AssetItem) => {
    e.dataTransfer.effectAllowed = 'copy';
    e.dataTransfer.setData('application/asset-path', asset.path);
    e.dataTransfer.setData('text/plain', asset.path);
  }, []);

  // Handle click to add
  const handleClick = useCallback((asset: AssetItem) => {
    if (!existingBanks.includes(asset.path)) {
      onAssetClick(asset.path);
    }
  }, [existingBanks, onAssetClick]);

  // Group assets by type
  const groupedAssets = assets.reduce((acc, asset) => {
    if (!acc[asset.type]) {
      acc[asset.type] = [];
    }
    acc[asset.type].push(asset);
    return acc;
  }, {} as Record<AssetItem['type'], AssetItem[]>);

  if (loading) {
    return (
      <div className="dk-padding-compact dk-text-secondary text-sm">
        Loading assets...
      </div>
    );
  }

  if (assets.length === 0) {
    return (
      <div className="dk-padding-standard dk-text-secondary text-center">
        <p className="text-sm mb-2">No assets found.</p>
        <p className="text-xs">Create .gbin, .pbin, or .tbin files in your project.</p>
      </div>
    );
  }

  const typeLabels: Record<AssetItem['type'], string> = {
    gbin: 'Graphics (sprites/tiles)',
    pbin: 'Palettes',
    tbin: 'Tilemaps',
  };

  const typeOrder: AssetItem['type'][] = ['gbin', 'pbin', 'tbin'];

  return (
    <div className="flex flex-col">
      {typeOrder.map(type => {
        const typeAssets = groupedAssets[type];
        if (!typeAssets || typeAssets.length === 0) return null;

        return (
          <div key={type} className="dk-border-b">
            <div className="dk-padding-compact dk-bg-secondary">
              <span className="dk-tertiary-text text-xs uppercase tracking-wide">
                {typeLabels[type]}
              </span>
            </div>
            <div className="dk-padding-tight">
              {typeAssets.map(asset => {
                const isAdded = existingBanks.includes(asset.path);

                return (
                  <div
                    key={asset.path}
                    className={`
                      flex items-center dk-gap-small dk-padding-minimal rounded cursor-pointer
                      ${isAdded ? 'dk-bg-secondary dk-text-muted' : 'hover:dk-bg-hover'}
                    `}
                    draggable={!isAdded}
                    onDragStart={(e) => handleDragStart(e, asset)}
                    onClick={() => handleClick(asset)}
                    title={isAdded ? 'Already in cartridge' : 'Click or drag to add to cartridge'}
                  >
                    <FontAwesomeIcon
                      icon={isAdded ? faCheck : getAssetIcon(asset.type)}
                      className={`w-3 ${isAdded ? 'text-green-600' : 'dk-text-secondary'}`}
                    />
                    <span className={`text-xs truncate flex-1 ${isAdded ? 'line-through' : ''}`}>
                      {asset.path}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

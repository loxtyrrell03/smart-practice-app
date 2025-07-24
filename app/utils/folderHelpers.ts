// In app/utils/folderHelpers.ts

// --------------------------------------------------------------
// Nested folders + PDF files (pure in-memory demo store)
// --------------------------------------------------------------

export type PdfFile = {
  id: string;
  name: string;
  uri: string;
  type: 'pdf';
};

export type Folder = {
  id: string;
  name: string;
  type: 'folder';
  children: Folder[];
  files: PdfFile[];
};

export type Item = Folder | PdfFile;

/* ---------- root-level state ---------- */
let ROOT_FOLDERS: Folder[] = [
  { id: '1', name: 'Repertoire', type: 'folder', children: [], files: [] },
];
let ROOT_FILES: PdfFile[] = [];

/* ---------- getters ---------- */
export const findParentOfItem = (itemId: string): Folder | null => {
  const find = (folders: Folder[]): Folder | null => {
    for (const folder of folders) {
      const isChild = folder.children.some(f => f.id === itemId);
      const isFile = folder.files.some(f => f.id === itemId);
      if (isChild || isFile) {
        return folder;
      }
      const found = find(folder.children);
      if (found) return found;
    }
    return null;
  };
  return find(ROOT_FOLDERS);
};

export function getFolderById(id: string): Folder | null {
  const stack: Folder[] = [...ROOT_FOLDERS];
  while (stack.length) {
    const n = stack.pop()!;
    if (n.id === id) return n;
    stack.push(...n.children);
  }
  return null;
}

export function getChildFolders(parentId: string | null | undefined): Folder[] {
  if (!parentId) return ROOT_FOLDERS;
  const p = getFolderById(parentId);
  return p ? p.children : [];
}

export function getChildFiles(parentId: string | null | undefined): PdfFile[] {
  if (!parentId) return ROOT_FILES;
  const p = getFolderById(parentId);
  return p ? p.files : [];
}

export function getAllFolders(): Folder[] {
  const allFolders: Folder[] = [];
  const traverse = (folders: Folder[]) => {
    for (const folder of folders) {
      allFolders.push(folder);
      traverse(folder.children);
    }
  };
  traverse(ROOT_FOLDERS);
  return allFolders;
}

export function getFolderPath(folderId: string | null): { name: string, path: string } {
  if (!folderId) return { name: 'Home', path: 'Home' };
  const targetFolder = getFolderById(folderId);
  if (!targetFolder) return { name: 'Home', path: 'Home' };

  let pathParts = [targetFolder.name];
  let currentId = targetFolder.id;
  let parent = findParentOfItem(currentId);

  while (parent) {
    pathParts.unshift(parent.name);
    currentId = parent.id;
    parent = findParentOfItem(currentId);
  }

  pathParts.unshift('Home');
  return { name: targetFolder.name, path: pathParts.join(' / ') };
}

/**
 * [NEW] Gets all descendant folder IDs for a given folder.
 * This is crucial to prevent moving a folder into itself.
 */
export function getDescendantFolderIds(folderId: string): string[] {
    const mainFolder = getFolderById(folderId);
    if (!mainFolder) return [];

    const descendantIds: string[] = [];
    const traverse = (folders: Folder[]) => {
        for (const folder of folders) {
            descendantIds.push(folder.id);
            traverse(folder.children);
        }
    };
    traverse(mainFolder.children);
    return descendantIds;
}

/* ---------- mutators ---------- */
export function addChildFolder(parentId: string | null | undefined, folder: Folder) {
  if (!parentId) {
    ROOT_FOLDERS.push(folder);
    return;
  }
  const p = getFolderById(parentId);
  if (p) p.children.push(folder);
}

export function addFileToFolder(parentId: string | null | undefined, file: PdfFile) {
  if (!parentId) {
    ROOT_FILES.push(file);
    return;
  }
  const p = getFolderById(parentId);
  if (p) p.files.push(file);
}

export function deleteChildFolder(parentId: string | null | undefined, id: string) {
  if (!parentId) {
    ROOT_FOLDERS = ROOT_FOLDERS.filter(f => f.id !== id);
    return;
  }
  const p = getFolderById(parentId);
  if (p) p.children = p.children.filter(f => f.id !== id);
}

export function deleteFileFromFolder(parentId: string | null | undefined, id: string) {
  if (!parentId) {
    ROOT_FILES = ROOT_FILES.filter(f => f.id !== id);
    return;
  }
  const p = getFolderById(parentId);
  if (p) p.files = p.files.filter(f => f.id !== id);
}

export const moveItem = (itemToMove: Item, oldParentId: string | null, newParentId: string | null) => {
  if (itemToMove.type === 'folder') {
    deleteChildFolder(oldParentId, itemToMove.id);
    addChildFolder(newParentId, itemToMove);
  } else {
    deleteFileFromFolder(oldParentId, itemToMove.id);
    addFileToFolder(newParentId, itemToMove);
  }
};
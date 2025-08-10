import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { GitHubDirEntry, listDirectory } from '@/api/github';
import { TextInput, Button, ActionIcon, Group, Tooltip, ScrollArea } from '@mantine/core';

type Node = {
  name: string;
  path: string;
  type: 'file' | 'dir';
  children?: Node[];
  loaded?: boolean;
  expanded?: boolean;
};

type Props = {
  owner: string;
  repo: string;
  branch: string;
  rootPath?: string;
  onSelectFile: (path: string) => void;
  onCreate?: (dirPath: string) => void;
  onDelete?: (filePath: string) => void;
};

export function FileTree({ owner, repo, branch, rootPath = '', onSelectFile, onCreate, onDelete }: Props): JSX.Element {
  const [root, setRoot] = useState<Node>({ name: '/', path: '', type: 'dir', expanded: true, loaded: false });
  const [filter, setFilter] = useState('');

  const loadChildren = useCallback(async (node: Node) => {
    if (node.type !== 'dir' || node.loaded) return;
    try {
      const entries = await listDirectory(owner, repo, node.path || rootPath, branch);
      const children: Node[] = entries
        .filter((e) => e.type === 'dir' || e.type === 'file')
        .sort((a, b) => {
          if (a.type !== b.type) return a.type === 'dir' ? -1 : 1;
          return a.name.localeCompare(b.name);
        })
        .map((e) => ({ name: e.name, path: e.path, type: e.type as 'dir' | 'file', expanded: false, loaded: false }));
      setRoot((prev) => applyUpdate(prev, node.path, { children, loaded: true }));
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('Failed to load directory', node.path, e);
      setRoot((prev) => applyUpdate(prev, node.path, { children: [], loaded: true }));
    }
  }, [owner, repo, branch, rootPath]);

  useEffect(() => {
    // Reset tree on repo change
    setRoot({ name: '/', path: '', type: 'dir', expanded: true, loaded: false });
  }, [owner, repo, branch, rootPath]);

  useEffect(() => {
    if (owner && repo && !root.loaded) {
      void loadChildren(root);
    }
  }, [owner, repo, branch, root.loaded, loadChildren, root]);

  const visibleTree = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return root;
    const clone = cloneTree(root);
    filterTreeInPlace(clone, q);
    return clone;
  }, [root, filter]);

  return (
    <div>
      <Group justify="space-between" className="tree-header">
        <strong className="tree-title">Files</strong>
        <Group gap={6} className="tree-toolbar">
          <TextInput placeholder="Filter files…" value={filter} onChange={(e) => setFilter(e.currentTarget.value)} maw={220} size="sm" />
          {onCreate && (
            <Tooltip label="New file" withArrow>
              <ActionIcon variant="subtle" onClick={() => onCreate(visibleTree.path || '')} aria-label="New file">＋</ActionIcon>
            </Tooltip>
          )}
        </Group>
      </Group>
      <ScrollArea className="tree-scroll" type="auto" mah={560}>
        <div className="tree-list" role="tree" aria-label="Repository files">
          <TreeNode node={visibleTree} onToggle={async (n) => {
            if (n.type === 'dir') {
              if (!n.loaded) await loadChildren(n);
              setRoot((prev) => applyUpdate(prev, n.path, { expanded: !findNode(prev, n.path)?.expanded }));
            }
          }} onSelect={(n) => n.type === 'file' && onSelectFile(n.path)} onDelete={onDelete ? (n) => onDelete(n.path) : undefined} />
        </div>
      </ScrollArea>
    </div>
  );
}

function TreeNode({ node, onToggle, onSelect, onDelete }: { node: Node; onToggle: (n: Node) => void; onSelect: (n: Node) => void; onDelete?: (n: Node) => void }) {
  const isRoot = node.path === '' && node.type === 'dir';
  const children = node.children || [];
  return (
    <div className="tree-branch" style={{ marginLeft: isRoot ? 0 : 12 }}>
      {!isRoot && (
        <div className={`tree-row ${node.type}`}>
          {node.type === 'dir' ? (
            <button className={`tree-caret ${node.expanded ? 'open' : ''}`} onClick={() => onToggle(node)} aria-label={node.expanded ? 'Collapse' : 'Expand'} />
          ) : (
            <span className="tree-caret placeholder" />
          )}
          <button
            className="tree-name"
            onClick={() => (node.type === 'dir' ? onToggle(node) : onSelect(node))}
            onKeyDown={(e) => {
              if (e.key === 'Enter') (node.type === 'dir' ? onToggle(node) : onSelect(node));
              if (e.key === ' ' || e.key === 'Spacebar') { e.preventDefault(); (node.type === 'dir' ? onToggle(node) : onSelect(node)); }
              if (e.key === 'ArrowRight' && node.type === 'dir' && !node.expanded) onToggle(node);
              if (e.key === 'ArrowLeft' && node.type === 'dir' && node.expanded) onToggle(node);
            }}
          >
            {node.name}
          </button>
          {node.type === 'file' && onDelete && (
            <Tooltip label="Delete" withArrow>
              <ActionIcon variant="subtle" color="red" onClick={() => onDelete(node)} aria-label="Delete file">🗑</ActionIcon>
            </Tooltip>
          )}
        </div>
      )}
      {isRoot && children.length === 0 && (
        <div className="muted">Select a repository to load files.</div>
      )}
      {node.expanded && children.length > 0 && (
        <div className="tree-children">
          {children.map((c) => (
            <TreeNode key={c.path} node={c} onToggle={onToggle} onSelect={onSelect} onDelete={onDelete} />
          ))}
        </div>
      )}
    </div>
  );
}

function applyUpdate(root: Node, targetPath: string, patch: Partial<Node>): Node {
  if (root.path === targetPath) {
    return { ...root, ...patch };
  }
  if (!root.children) return root;
  return { ...root, children: root.children.map((c) => applyUpdate(c, targetPath, patch)) };
}

function findNode(root: Node, targetPath: string): Node | undefined {
  if (root.path === targetPath) return root;
  for (const c of root.children || []) {
    const f = findNode(c, targetPath);
    if (f) return f;
  }
  return undefined;
}

function cloneTree(node: Node): Node {
  return { ...node, children: node.children?.map(cloneTree) };
}

function filterTreeInPlace(node: Node, q: string): boolean {
  if (node.type === 'file') {
    return node.name.toLowerCase().includes(q);
  }
  const children = node.children || [];
  const kept: Node[] = [];
  for (const child of children) {
    // Ensure directories are considered matches if they contain matches
    const match = filterTreeInPlace(child, q) || child.name.toLowerCase().includes(q);
    if (match) kept.push(child);
  }
  node.children = kept;
  node.expanded = true;
  return kept.length > 0;
}



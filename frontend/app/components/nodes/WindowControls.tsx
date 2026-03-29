"use client";

import { useReactFlow } from "@xyflow/react";

interface WindowControlsProps {
  nodeId: string;
  minimized: boolean;
  onToggleMinimize: () => void;
}

export default function WindowControls({ nodeId, minimized, onToggleMinimize }: WindowControlsProps) {
  const { deleteElements, setNodes, getNode } = useReactFlow();

  function handleClose(e: React.MouseEvent) {
    e.stopPropagation();
    deleteElements({ nodes: [{ id: nodeId }] });
  }

  function handleMinimize(e: React.MouseEvent) {
    e.stopPropagation();
    onToggleMinimize();
  }

  function handleEnlarge(e: React.MouseEvent) {
    e.stopPropagation();
    const node = getNode(nodeId);
    if (!node) return;
    const currentW = (node.style?.width as number) ?? 340;
    const newW = currentW > 500 ? Math.round(currentW / 1.5) : Math.round(currentW * 1.5);
    setNodes((nds) =>
      nds.map((n) =>
        n.id === nodeId ? { ...n, style: { ...n.style, width: newW } } : n
      )
    );
  }

  return (
    <div className="flex items-center gap-1.5">
      <button
        onClick={handleClose}
        className="w-3 h-3 rounded-full transition-all active:scale-90 hover:brightness-90"
        style={{ background: "#ff5f57" }}
        title="Close"
      />
      <button
        onClick={handleMinimize}
        className="w-3 h-3 rounded-full transition-all active:scale-90 hover:brightness-90"
        style={{ background: "#ffbd2e" }}
        title={minimized ? "Expand" : "Minimize"}
      />
      <button
        onClick={handleEnlarge}
        className="w-3 h-3 rounded-full transition-all active:scale-90 hover:brightness-90"
        style={{ background: "#27c93f" }}
        title="Enlarge"
      />
    </div>
  );
}

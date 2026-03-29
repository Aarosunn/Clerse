\"use client\";

import { useReactFlow } from \"@xyflow/react\";

interface WindowControlsProps {
  nodeId: string;
  minimized: boolean;
  onToggleMinimize: () => void;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
}

export default function WindowControls({
  nodeId,
  minimized,
  onToggleMinimize,
  isFullscreen,
  onToggleFullscreen,
}: WindowControlsProps) {
  const { deleteElements } = useReactFlow();

  function handleClose(e: React.MouseEvent) {
    e.stopPropagation();
    deleteElements({ nodes: [{ id: nodeId }] });
  }

  function handleMinimize(e: React.MouseEvent) {
    e.stopPropagation();
    onToggleMinimize();
  }

  function handleFullscreen(e: React.MouseEvent) {
    e.stopPropagation();
    onToggleFullscreen?.();
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
        onClick={handleFullscreen}
        className="w-3 h-3 rounded-full transition-all active:scale-90 hover:brightness-90"
        style={{ background: "#27c93f" }}
        title={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
      />
    </div>
  );
}

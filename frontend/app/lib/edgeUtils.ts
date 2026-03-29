import { Node, Position } from '@xyflow/react';

export function getEdgeParams(source: Node, target: Node) {
  const sourceIntersectionPoint = getNodeIntersection(source, target);
  const targetIntersectionPoint = getNodeIntersection(target, source);

  const sourcePos = getEdgePosition(source, sourceIntersectionPoint);
  const targetPos = getEdgePosition(target, targetIntersectionPoint);

  return {
    sx: sourceIntersectionPoint.x,
    sy: sourceIntersectionPoint.y,
    tx: targetIntersectionPoint.x,
    ty: targetIntersectionPoint.y,
    sourcePos,
    targetPos,
  };
}

function getNodeIntersection(intersectionNode: Node, targetNode: Node) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const intersectPos = (intersectionNode as any).internals?.positionAbsolute ?? intersectionNode.position;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const intersectWidth = intersectionNode.measured?.width ?? (intersectionNode as any).width ?? 0;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const intersectHeight = intersectionNode.measured?.height ?? (intersectionNode as any).height ?? 0;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const targetPos = (targetNode as any).internals?.positionAbsolute ?? targetNode.position;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const targetWidth = targetNode.measured?.width ?? (targetNode as any).width ?? 0;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const targetHeight = targetNode.measured?.height ?? (targetNode as any).height ?? 0;

  const w = intersectWidth / 2;
  const h = intersectHeight / 2;

  const x2 = intersectPos.x + w;
  const y2 = intersectPos.y + h;
  const x1 = targetPos.x + targetWidth / 2;
  const y1 = targetPos.y + targetHeight / 2;

  if (w === 0 || h === 0) return { x: x2, y: y2 }; // Fallback

  const xx1 = (x1 - x2) / (2 * w) - (y1 - y2) / (2 * h);
  const yy1 = (x1 - x2) / (2 * w) + (y1 - y2) / (2 * h);
  
  const aPos = Math.abs(xx1) + Math.abs(yy1);
  if (aPos === 0) return { x: x2, y: y2 }; // Nodes exactly cover each other

  const a = 1 / aPos;
  const xx3 = a * x1 + (1 - a) * x2;
  const yy3 = a * y1 + (1 - a) * y2;

  return { x: xx3, y: yy3 };
}

function getEdgePosition(node: Node, intersectionPoint: { x: number; y: number }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const nPos = (node as any).internals?.positionAbsolute ?? node.position;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const nWidth = node.measured?.width ?? (node as any).width ?? 0;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const nHeight = node.measured?.height ?? (node as any).height ?? 0;

  const nx = Math.round(nPos.x);
  const ny = Math.round(nPos.y);
  const px = Math.round(intersectionPoint.x);
  const py = Math.round(intersectionPoint.y);

  if (px <= nx + 1) return Position.Left;
  if (px >= nx + nWidth - 1) return Position.Right;
  if (py <= ny + 1) return Position.Top;
  if (py >= ny + nHeight - 1) return Position.Bottom;

  return Position.Top;
}

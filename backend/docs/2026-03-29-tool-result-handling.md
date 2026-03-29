# Tool Result Handling Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Handle SSE `tool_result` events from the backend stream in `ClaudeNode.tsx`, placing returned nodes onto the canvas and showing inline suggestion UI for `suggest_branch`.

**Architecture:** `spawnNode` is added to `ConnectContext` so ClaudeNode can access it without prop-drilling through ReactFlow's data model. The SSE parsing loop in `sendMessage` is extended with a `tool_result` branch that calls `addNodes`/`addEdges` directly for node-creating tools and sets a React state for `suggest_branch`. The suggestion UI renders inline in the message area as a collapsible block.

**Tech Stack:** React, React Flow (`@xyflow/react`), TypeScript, existing `ConnectContext`

---

## File Map

| File | Change |
|------|--------|
| `frontend/app/components/Canvas.tsx` | Add `spawnNode` to `ConnectContextValue` and provide it |
| `frontend/app/components/nodes/ClaudeNode.tsx` | Consume `spawnNode`, handle `tool_result` SSE events, add suggestion UI |

---

### Task 1: Expose `spawnNode` via `ConnectContext`

**Files:**
- Modify: `frontend/app/components/Canvas.tsx`

- [ ] **Step 1: Add `spawnNode` to `ConnectContextValue` interface and default**

In `Canvas.tsx`, update the interface and default context value. The `spawnNode` signature must exactly match the function defined in `CanvasInner`:

```typescript
// replace the existing ConnectContextValue interface
interface ConnectContextValue {
  connectingFrom: string | null;
  cachedMessages: Message[] | null;
  connectionOrigin: { x: number; y: number } | null;
  startConnect: (nodeId: string, messages?: Message[], origin?: { x: number; y: number }) => void;
  workspaceId: string;
  spawnNode: (kind: NodeKind, initialMessages?: Message[], position?: { x: number; y: number }) => string;
}

// replace the existing createContext call
export const ConnectContext = createContext<ConnectContextValue>({
  connectingFrom: null,
  cachedMessages: null,
  connectionOrigin: null,
  startConnect: () => {},
  workspaceId: "",
  spawnNode: () => "",
});
```

- [ ] **Step 2: Pass `spawnNode` into the provider**

Locate the `ConnectContext.Provider` JSX in `CanvasInner`'s return. Update `value` to include `spawnNode`:

```typescript
<ConnectContext.Provider value={{ connectingFrom, cachedMessages, connectionOrigin, startConnect, workspaceId, spawnNode }}>
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd /home/asunaron/hackathons/Clerse/frontend
npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors related to `ConnectContext` or `spawnNode`.

- [ ] **Step 4: Commit**

```bash
cd /home/asunaron/hackathons/Clerse/frontend
git add app/components/Canvas.tsx
git commit -m "feat: expose spawnNode via ConnectContext"
```

---

### Task 2: Handle `tool_result` in ClaudeNode SSE loop

**Files:**
- Modify: `frontend/app/components/nodes/ClaudeNode.tsx`

Backend SSE `tool_result` events have this shape:

```
// node-creating tools
data: {"type": "tool_result", "name": "create_branches", "nodes": [...], "edges": [...]}
data: {"type": "tool_result", "name": "create_markdown",  "nodes": [...], "edges": [...]}
data: {"type": "tool_result", "name": "generate_flashcards", "nodes": [...], "edges": [...]}
data: {"type": "tool_result", "name": "generate_quiz", "nodes": [...], "edges": [...]}

// suggestion only — no nodes/edges
data: {"type": "tool_result", "name": "suggest_branch", "title": "...", "reason": "..."}
```

- [ ] **Step 1: Add `Node` and `Edge` type imports**

Extend the existing `@xyflow/react` import line:

```typescript
import { Handle, Position, NodeProps, useReactFlow, NodeResizer, Node, Edge } from "@xyflow/react";
```

- [ ] **Step 2: Add `pendingSuggestion` state**

After the existing `useState` declarations (around line 38), add:

```typescript
interface PendingSuggestion {
  title: string;
  reason: string;
}
const [pendingSuggestion, setPendingSuggestion] = useState<PendingSuggestion | null>(null);
```

- [ ] **Step 3: Consume `spawnNode` from context**

Update the `useConnectMode()` destructure (currently around line 53):

```typescript
const { startConnect: startConnectMode, workspaceId, spawnNode } = useConnectMode();
```

- [ ] **Step 4: Handle `tool_result` in the SSE parsing loop**

Inside the `for (const line of lines)` loop in `sendMessage`, after the existing `event.type === "error"` branch, add:

```typescript
} else if (event.type === "tool_result") {
  const name = event.name as string;
  if (name === "suggest_branch") {
    setPendingSuggestion({
      title: event.title as string,
      reason: event.reason as string,
    });
  } else if (
    name === "create_branches" ||
    name === "create_markdown" ||
    name === "generate_flashcards" ||
    name === "generate_quiz"
  ) {
    const toolNodes = event.nodes as Node[];
    const toolEdges = event.edges as Edge[];
    if (toolNodes?.length) addNodes(toolNodes);
    if (toolEdges?.length) addEdges(toolEdges);
  }
}
```

- [ ] **Step 5: Add `acceptSuggestion` handler**

Add this function after `quickBranch`, before the `return` statement:

```typescript
function acceptSuggestion() {
  if (!pendingSuggestion) return;
  const currentNode = getNode(id);
  const pos = currentNode?.position ?? { x: 0, y: 0 };
  const branchId = spawnNode("claude", undefined, { x: pos.x + 460, y: pos.y + 40 });
  addEdges({
    id: `${id}-${branchId}`,
    source: id,
    target: branchId,
    type: "river",
  });
  setPendingSuggestion(null);
}
```

- [ ] **Step 6: Add suggestion UI in the message area**

In the message area `<div>`, directly before the `<div className="space-y-6">` that renders the messages list, add the collapsible suggestion block:

```tsx
{pendingSuggestion && (
  <div
    className="mb-4 rounded-lg overflow-hidden"
    style={{
      border: "1px solid rgba(164,60,18,0.25)",
      background: "rgba(164,60,18,0.04)",
    }}
  >
    <details>
      <summary
        className="flex items-center gap-2 px-3 py-2 cursor-pointer select-none"
        style={{
          background: "rgba(164,60,18,0.08)",
          borderBottom: "1px solid rgba(164,60,18,0.12)",
          listStyle: "none",
        }}
      >
        <BranchIcon size={12} className="text-[#a43c12]" />
        <span
          className="font-label uppercase tracking-widest text-[#a43c12] flex-1"
          style={{ fontSize: 9, fontWeight: 600 }}
        >
          Branch Suggestion: {pendingSuggestion.title}
        </span>
      </summary>
      <div className="px-3 py-2">
        <p className="font-body text-xs text-on-surface/70 leading-relaxed mb-2">
          {pendingSuggestion.reason}
        </p>
        <div className="flex items-center gap-2">
          <button
            onClick={acceptSuggestion}
            className="px-3 py-1 rounded-full font-label uppercase tracking-widest text-white transition-all"
            style={{ fontSize: 9, fontWeight: 600, background: "#a43c12" }}
          >
            Accept
          </button>
          <button
            onClick={() => setPendingSuggestion(null)}
            className="px-3 py-1 rounded-full font-label uppercase tracking-widest transition-all"
            style={{
              fontSize: 9,
              fontWeight: 600,
              background: "rgba(164,60,18,0.1)",
              color: "#a43c12",
            }}
          >
            Dismiss
          </button>
        </div>
      </div>
    </details>
  </div>
)}
```

- [ ] **Step 7: Verify TypeScript compiles**

```bash
cd /home/asunaron/hackathons/Clerse/frontend
npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors in `ClaudeNode.tsx`.

- [ ] **Step 8: Commit**

```bash
cd /home/asunaron/hackathons/Clerse/frontend
git add app/components/nodes/ClaudeNode.tsx
git commit -m "feat: handle tool_result SSE events and suggest_branch UI in ClaudeNode"
```

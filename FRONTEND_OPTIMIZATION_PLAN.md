# Frontend Optimization Plan (Clerse)

This document outlines the proposed optimizations to improve the loading speed and bundle efficiency of the Clerse frontend.

## 🎯 Objectives
- Reduce the **First Load JS** size.
- Remove unused dependencies from the project.
- Implement lazy loading for heavy feature-specific modules.

---

## 🛠 Proposed Changes

### 1. Dependency Cleanup
We are currently loading several modules that are either unused or no longer required.
- **[REMOVE]** `react-pdf`: The code identifies that `PDFNode.tsx` extracts text via the backend and renders it as plain text. This large library is currently unused in the actual frontend components.
- **[REMOVE]** `DashboardIcon`, `FolderIcon`, `SettingsIcon` from `page.tsx`: These were part of the old sidebar that has been removed.
- **[AUDIT]** `Icons.tsx`: I will remove approximately 12 SVG icons that have zero references in the project to trim the icon module.

### 2. Smart Code Splitting (Dynamic Imports)
Next.js allows us to defer loading heavy libraries until they are actually needed using `next/dynamic`.

#### [MODIFY] Landing Page (`page.tsx`)
- **Action**: Wrap `BeachWaveBackground` and `SplitText` in `dynamic()` imports.
- **Benefit**: **GSAP** (animation) and **OGL** (WebGL) will only be fetched when a user lands on the homepage. Users going directly to `/canvas` will no longer download these libraries.

#### [MODIFY] Chat Node (`ClaudeNode.tsx`)
- **Action**: Wrap `ReactMarkdown` in a `dynamic()` import.
- **Benefit**: Defer loading the markdown parser and its LaTeX plugins (`remark-math`, `rehype-katex`) until a user actually spawns a Chat Node.

### 3. Package Management
- Update `package.json` to remove `react-pdf` and any other orphaned dependencies found during the audit.

---

## 🧪 Verification Plan

### Automated
1. Run `npm run build` to compare bundle sizes.
2. Monitor terminal for any "unused import" or "module not found" lint errors.

### Manual
1. **Landing Page**: Check that the wave animation and text reveal still work (verify there's no "pop-in" jank).
2. **Canvas**: Spawn a `ClaudeNode`, send a message with Markdown (e.g., `**bold**`) and LaTeX (e.g., `$E=mc^2$`) to ensure rendering is still perfect.
3. **PDF Node**: Ensure file selection and text display still function without the `react-pdf` dependency.

---

### [IMPORTANT]
**Please review the plan and let me know if you are ready for me to execute these optimizations.**

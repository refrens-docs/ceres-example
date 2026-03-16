/* Vendor chunk: marked – lightweight markdown parser (fallback renderer) */
import { marked } from "marked";

(window as any).marked = (window as any).marked || {};
(window as any).marked.marked = marked;

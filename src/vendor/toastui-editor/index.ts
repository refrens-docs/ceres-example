/* Vendor chunk: ToastUI Editor Viewer – rich markdown rendering */

// CSS extracted by MiniCssExtractPlugin into a separate bundle.css
import "@toast-ui/editor/dist/toastui-editor-viewer.css";

// The dist UMD build exposes the Viewer constructor
// eslint-disable-next-line @typescript-eslint/no-var-requires
const Viewer = require("@toast-ui/editor/dist/toastui-editor-viewer");

(window as any).toastui = (window as any).toastui || {};
(window as any).toastui.Editor = Viewer.default || Viewer;

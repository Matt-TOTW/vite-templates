---
'oc-vite-compiler': patch
---

Resolve compiled template mount targets relative to their rendered OC element so components can mount inside shadow roots. Delayed mounts are scoped to the exact render and ignored if that render is replaced before its externals finish loading.

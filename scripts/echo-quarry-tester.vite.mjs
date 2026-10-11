import {defineConfig} from 'vite'
import {fileURLToPath} from 'node:url'
export default defineConfig({root:fileURLToPath(new URL('../src/renderer/echo-quarry-tester/',import.meta.url)),base:'./',build:{outDir:fileURLToPath(new URL('../previews/area05-trial/dist/',import.meta.url)),emptyOutDir:true}})

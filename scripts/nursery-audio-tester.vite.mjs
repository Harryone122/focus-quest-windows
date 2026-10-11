import {defineConfig} from 'vite'
import {fileURLToPath} from 'node:url'
export default defineConfig({root:fileURLToPath(new URL('../src/renderer/nursery-tester/',import.meta.url)),base:'./',build:{outDir:fileURLToPath(new URL('../previews/nursery-audio-tester/dist/',import.meta.url)),emptyOutDir:true,assetsInlineLimit:0},server:{host:'127.0.0.1',port:4177,strictPort:true,fs:{allow:[fileURLToPath(new URL('../',import.meta.url))]}}})

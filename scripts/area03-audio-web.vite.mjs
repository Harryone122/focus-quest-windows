import { defineConfig } from 'vite'
import { fileURLToPath } from 'node:url'
const root=fileURLToPath(new URL('../previews/area03-audio-web/',import.meta.url))
export default defineConfig({root,base:'./',build:{outDir:'dist',emptyOutDir:true,assetsInlineLimit:0},server:{host:'127.0.0.1',port:4173,strictPort:true,fs:{allow:[fileURLToPath(new URL('../',import.meta.url))]}}})

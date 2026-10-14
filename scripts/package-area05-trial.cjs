// Package the accepted standalone scene without enabling unreleased map rewards.
const {build,Platform,Arch}=require('electron-builder'),path=require('node:path'),fs=require('node:fs'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),version=require('../package.json').version;
const input=fs.mkdtempSync(path.join(root,'previews',`area05-package-input-${version}-`));
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
function inventory(dir,prefix=''){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?inventory(path.join(dir,e.name),path.join(prefix,e.name)):[path.join(prefix,e.name)])}
const renderer=path.join(root,'previews/area05-trial/dist'),before=Object.fromEntries(inventory(renderer).map(p=>[p,hash(path.join(renderer,p))]));
fs.cpSync(renderer,path.join(input,'trial-renderer'),{recursive:true});
for(const [p,h] of Object.entries(before)){if(hash(path.join(renderer,p))!==h||hash(path.join(input,'trial-renderer',p))!==h)throw Error('Trial renderer changed during snapshot; rerun after its build completes')}
for(const p of ['scripts/try-echo-quarry.cjs','scripts/echo-quarry-trial-preload.cjs','src/shared/area05TrialRules.cjs','build/icon.ico']){fs.mkdirSync(path.dirname(path.join(input,p)),{recursive:true});fs.copyFileSync(path.join(root,p),path.join(input,p))}
const qa=path.join(root,`previews/release-v${version}-qa`);fs.mkdirSync(qa,{recursive:true});fs.writeFileSync(path.join(qa,'area05-package-input.json'),JSON.stringify({version,input,sha256:Object.fromEntries(inventory(input).map(p=>[p,hash(path.join(input,p))]))},null,2));
build({projectDir:root,targets:Platform.WINDOWS.createTarget('portable',Arch.x64),config:{extends:null,appId:'com.focusquest.area05trial',productName:'Focus Quest Area 05 Trial',
 extraMetadata:{name:'focusquest-area05-trial',main:'scripts/try-echo-quarry.cjs'},asar:true,
 files:['!out/**/*','!scripts/**/*','!src/**/*','!build/**/*',{from:input,to:'.',filter:['**/*']}],
 asarUnpack:['node_modules/better-sqlite3/**/*','node_modules/get-windows/**/*'],
 directories:{output:`release-area05-v${version}`},win:{icon:'build/icon.ico',target:[{target:'portable',arch:['x64']}]},
 artifactName:'Focus Quest Area 05 Trial ${version} Portable.${ext}'}}).catch(e=>{console.error(e);process.exitCode=1});

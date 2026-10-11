const http=require('node:http'),fs=require('node:fs'),path=require('node:path')
const root=path.resolve(__dirname,'../previews/area03-audio-web/dist'),port=4173
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.wav':'audio/wav','.png':'image/png','.json':'application/json'}
http.createServer((req,res)=>{
 let file;try{file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname))}catch{res.writeHead(400);res.end();return}
 if(file===root)file=path.join(root,'index.html')
 if(!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return}
 fs.stat(file,(err,stat)=>{if(err||!stat.isFile()){res.writeHead(404);res.end();return}
  const headers={'Content-Type':types[path.extname(file)]||'application/octet-stream','Accept-Ranges':'bytes','Cache-Control':'no-cache'}
  const range=req.headers.range?.match(/^bytes=(\d+)-(\d*)$/)
  let begin=0,end=stat.size-1,code=200
  if(range){begin=Number(range[1]);end=range[2]?Math.min(end,Number(range[2])):end;if(begin>end||begin>=stat.size){res.writeHead(416,{'Content-Range':`bytes */${stat.size}`});res.end();return}code=206;headers['Content-Range']=`bytes ${begin}-${end}/${stat.size}`}
  headers['Content-Length']=end-begin+1;res.writeHead(code,headers);if(req.method==='HEAD'){res.end();return}fs.createReadStream(file,{start:begin,end}).pipe(res)
 })
}).listen(port,'127.0.0.1',()=>console.log(`倒影湖畔試聽：http://127.0.0.1:${port}`))

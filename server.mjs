import http from 'node:http';
import {createReadStream} from 'node:fs';
import {readFile, stat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), 'public');
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.svg':'image/svg+xml','.avif':'image/avif','.webp':'image/webp','.woff':'font/woff','.woff2':'font/woff2','.ttf':'font/ttf','.otf':'font/otf','.gif':'image/gif','.ico':'image/x-icon','.mp4':'video/mp4'};
const cacheControl=file=>path.extname(file)==='.html'?'no-cache':/\.(?:mp4|webp|png|jpe?g|woff2?|ttf|otf)$/i.test(file)?'public, max-age=86400':'no-cache';
http.createServer(async(req,res)=>{
  try {
    let pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    if(pathname==='/' || pathname==='/agent') pathname='/index.html';
    if(pathname==='/record'){
      res.writeHead(301,{'Location':'/record/'});
      res.end();
      return;
    }
    if(pathname==='/record/') pathname='/record/index.html';
    if(pathname==='/policy-coding') pathname='/policy-coding.html';
    const file=path.resolve(root,'.'+pathname);
    if(!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
    if(path.extname(file)==='.mp4'){
      const fileStat=await stat(file);
      const range=req.headers.range;
      if(range){
        const [startText,endText]=range.replace('bytes=','').split('-');
        const start=Number.parseInt(startText,10);
        const end=endText ? Number.parseInt(endText,10) : fileStat.size-1;
        if(!Number.isFinite(start) || start<0 || end>=fileStat.size || start>end){
          res.writeHead(416,{'Content-Range':`bytes */${fileStat.size}`});
          res.end();
          return;
        }
        res.writeHead(206,{'Content-Type':'video/mp4','Content-Length':end-start+1,'Content-Range':`bytes ${start}-${end}/${fileStat.size}`,'Accept-Ranges':'bytes','Cache-Control':cacheControl(file),'X-Content-Type-Options':'nosniff'});
        createReadStream(file,{start,end}).pipe(res);
        return;
      }
      res.writeHead(200,{'Content-Type':'video/mp4','Content-Length':fileStat.size,'Accept-Ranges':'bytes','Cache-Control':cacheControl(file),'X-Content-Type-Options':'nosniff'});
      createReadStream(file).pipe(res);
      return;
    }
    const data=await readFile(file);
    res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':cacheControl(file),'X-Content-Type-Options':'nosniff'});
    res.end(data);
  }catch {res.writeHead(404);res.end('Not found');}
}).listen(4313,'127.0.0.1',()=>console.log('Local site: http://127.0.0.1:4313'));

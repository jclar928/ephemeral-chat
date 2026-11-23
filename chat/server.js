'use strict';
const express=require('express'),http=require('http'),crypto=require('crypto');
const {Server}=require('socket.io');
const app=express(),server=http.createServer(app),io=new Server(server,{maxHttpBufferSize:1e6});
const PORT=process.env.PORT||3000,SECRET=process.env.ADMIN_CONTROL_SECRET||'';
const rooms=new Map();let settings={maxUploadGB:10,watermark:true,blurOnBlur:true,maintenance:false};
app.disable('x-powered-by');app.use(express.json({limit:'1mb'}));app.use(express.static('public'));
app.get('/health',(_,r)=>r.send('ok'));
const auth=(q,r,n)=>{if(!SECRET||q.get('authorization')!==`Bearer ${SECRET}`)return r.sendStatus(401);n()};
const pub=()=>({...settings});
app.get('/control/status',auth,(_,r)=>r.json({rooms:rooms.size,people:[...rooms.values()].reduce((n,x)=>n+x.members.size,0),settings:pub(),storage:'Peer-to-peer (no server-side media storage)'}));
app.post('/control/settings',auth,(q,r)=>{let b=q.body||{};if(b.maxUploadGB!==undefined){let g=Number(b.maxUploadGB);if(!Number.isFinite(g)||g<1||g>10)return r.status(400).json({error:'Choose an upload limit between 1 and 10 GB.'});settings.maxUploadGB=g;}for(let k of ['watermark','blurOnBlur','maintenance'])if(b[k]!==undefined)settings[k]=!!b[k];io.emit('settings',pub());r.json({ok:true,settings:pub()})});
app.post('/control/clear-all',auth,(_,r)=>{let list=[...rooms.values()];rooms.clear();for(let room of list)for(let id of room.members.keys()){let s=io.sockets.sockets.get(id);if(s){s.emit('cleared');s.leave(room.code);delete s.data.roomCode;}}r.json({ok:true,clearedRooms:list.length})});
function leave(s){let code=s.data.roomCode;if(!code)return;delete s.data.roomCode;s.leave(code);let room=rooms.get(code);if(!room)return;room.members.delete(s.id);room.messages.length=0;io.to(code).emit('peer-left',{id:s.id});if(!room.members.size)rooms.delete(code);else io.to(code).emit('presence',{people:room.members.size,members:[...room.members].map(([id,name])=>({id,name}))})}
io.on('connection',s=>{
 s.emit('settings',pub());
 s.on('join-room',({code,name,hasRoomKey=false}={},reply=()=>{})=>{
  code=String(code||'').toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,8);name=String(name||'Guest').trim().slice(0,24)||'Guest';
  if(settings.maintenance)return reply({ok:false,error:'The website is in maintenance mode.'});
  if(code.length<4)return reply({ok:false,error:'Room code must be at least 4 characters.'});
  leave(s);let room=rooms.get(code);if(room&&room.members.size>0&&!hasRoomKey)return reply({ok:false,error:'This room is already active. Join using the complete invitation link so you receive its encryption key.'});if(!room){room={code,members:new Map(),messages:[]};rooms.set(code,room)}
  if(room.members.size>=8&&!room.members.has(s.id))return reply({ok:false,error:'Room is full (maximum 8 people).'});
  let peers=[...room.members].map(([id,n])=>({id,name:n}));room.members.set(s.id,name);s.data.roomCode=code;s.join(code);
  reply({ok:true,code,name,history:room.messages,people:room.members.size,settings:pub(),peers});
  for(const peer of peers)io.to(peer.id).emit('peer-joined',{id:s.id,name});
  io.to(code).emit('presence',{people:room.members.size,members:[...room.members].map(([id,n])=>({id,name:n}))});
 });
 s.on('signal',(p={})=>{let room=rooms.get(s.data.roomCode);if(!room||!room.members.has(s.id)||!room.members.has(p.to))return;io.to(p.to).emit('signal',{from:s.id,data:p.data})});
 s.on('transfer-offer',(p={})=>{let room=rooms.get(s.data.roomCode);if(!room||!room.members.has(s.id))return;let size=Number(p.size);if(!Number.isFinite(size)||size<0||size>settings.maxUploadGB*1024**3||!p.meta?.iv||!p.meta?.data)return;let transferId=String(p.transferId||'').slice(0,80);if(!transferId)return;s.to(room.code).emit('transfer-offer',{transferId,from:s.id,sender:room.members.get(s.id),size,meta:p.meta})});
 s.on('transfer-accept',(p={})=>{let room=rooms.get(s.data.roomCode);if(!room||!room.members.has(s.id)||!room.members.has(p.to))return;io.to(p.to).emit('transfer-accept',{from:s.id,transferId:String(p.transferId||'').slice(0,80)})});
 s.on('transfer-reject',(p={})=>{let room=rooms.get(s.data.roomCode);if(!room||!room.members.has(s.id)||!room.members.has(p.to))return;io.to(p.to).emit('transfer-reject',{from:s.id,transferId:String(p.transferId||'').slice(0,80)})});
 s.on('chat-message',(p={},reply=()=>{})=>{let room=rooms.get(s.data.roomCode);if(!room||!room.members.has(s.id))return reply({ok:false,error:'Join a room first.'});if(typeof p.iv!=='string'||typeof p.data!=='string'||p.iv.length>64||p.data.length>14000)return reply({ok:false,error:'Invalid encrypted message.'});let m={id:crypto.randomUUID(),sender:room.members.get(s.id),senderId:s.id,iv:p.iv,data:p.data,time:Date.now()};room.messages.push(m);if(room.messages.length>100)room.messages.shift();io.to(room.code).emit('new-message',m);reply({ok:true})});
 s.on('leave-room',()=>leave(s));s.on('disconnect',()=>leave(s));
});
server.listen(PORT,'0.0.0.0',()=>console.log(`Chat listening on ${PORT}`));

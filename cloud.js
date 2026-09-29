/* 共有（Supabase）とのやり取り。設定がなければ何もしない */
const Cloud=(function(){
  const cfg=window.MJ_CONFIG||{};
  const configured=!!(cfg.supabaseUrl&&cfg.supabaseKey);
  let sb=null, loading=null;
  function load(){
    if(!configured) return Promise.reject(new Error('共有機能が設定されていません'));
    if(sb) return Promise.resolve(sb);
    if(!loading) loading=new Promise((res,rej)=>{
      const s=document.createElement('script'); s.src='lib/supabase.js';
      s.onload=()=>{ sb=window.supabase.createClient(cfg.supabaseUrl,cfg.supabaseKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,flowType:'pkce'}}); res(sb); };
      s.onerror=()=>{ loading=null; rej(new Error('共有機能を読み込めませんでした。通信状態を確認してください')); };
      document.head.appendChild(s);
    });
    return loading;
  }
  const ok=r=>{ if(r.error) throw new Error(r.error.message||'通信エラー'); return r.data; };
  async function session(){ const c=await load(); return ok(await c.auth.getSession()).session; }
  async function signIn(){ const c=await load(); ok(await c.auth.signInWithOAuth({provider:'google',options:{redirectTo:location.origin+location.pathname}})); }
  async function signOut(){ const c=await load(); await c.auth.signOut(); }
  async function onAuth(cb){ const c=await load(); c.auth.onAuthStateChange((ev,s)=>cb(s)); }
  async function listTables(){ const c=await load(); return ok(await c.from('mj_tables').select('id,name,updated_at,created_by').order('updated_at',{ascending:false})); }
  async function createTable(name,state,games,display){ const c=await load(); return ok(await c.rpc('mj_create_table',{p_name:name,p_state:state,p_games:games,p_display_name:display})); }
  async function join(token,display){ const c=await load(); return ok(await c.rpc('mj_join_table',{p_token:token,p_display_name:display})); }
  async function fetchTable(id){
    const c=await load();
    const [t,g,m]=await Promise.all([
      c.from('mj_tables').select('*').eq('id',id).maybeSingle(),
      c.from('mj_games').select('id,data,created_at').eq('table_id',id).eq('deleted',false).order('created_at'),
      c.from('mj_members').select('user_id,display_name,joined_at').eq('table_id',id).order('joined_at')
    ]);
    return {table:ok(t),games:ok(g),members:ok(m)};
  }
  async function saveState(id,state){ const c=await load(); ok(await c.from('mj_tables').update({state}).eq('id',id)); }
  async function rename(id,name){ const c=await load(); ok(await c.from('mj_tables').update({name}).eq('id',id)); }
  async function addGame(tid,id,data,uid){ const c=await load(); ok(await c.from('mj_games').insert({id,table_id:tid,data,created_by:uid})); }
  async function deleteGame(id){ const c=await load(); ok(await c.from('mj_games').update({deleted:true}).eq('id',id)); }
  async function resetLinks(id){ const c=await load(); return ok(await c.rpc('mj_reset_links',{p_table:id})); }
  async function leave(tid,uid){ const c=await load(); ok(await c.from('mj_members').delete().eq('table_id',tid).eq('user_id',uid)); }
  async function view(token){ const c=await load(); return ok(await c.rpc('mj_view_table',{p_token:token})); }
  function subscribe(tid,onTable,onGame){
    if(!sb) return ()=>{};
    const ch=sb.channel('mj-'+tid)
      .on('postgres_changes',{event:'*',schema:'public',table:'mj_games',filter:'table_id=eq.'+tid},p=>{ if(p.new&&p.new.id) onGame(p.new); })
      .on('postgres_changes',{event:'UPDATE',schema:'public',table:'mj_tables',filter:'id=eq.'+tid},p=>{ if(p.new) onTable(p.new); })
      .subscribe();
    return ()=>{ try{ sb.removeChannel(ch); }catch(e){} };
  }
  return {configured,load,session,signIn,signOut,onAuth,listTables,createTable,join,fetchTable,saveState,rename,addGame,deleteGame,resetLinks,leave,view,subscribe};
})();

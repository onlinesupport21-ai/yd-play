'use client';

import { FormEvent, useEffect, useState } from 'react';
import { api, API_URL } from '../lib/api';

type Admin = { id:string; email:string; displayName?:string; display_name?:string; role:string };
type Dashboard = any;
type UserRow = any;
type FraudFlag = any;
type Report = any;
type Push = any;
type Audit = any;

const tabs = ['Overview','Users','Referrals','Fraud','Moderation','Economy','Analytics','Push','Audit'] as const;
type Tab = typeof tabs[number];

export default function Page() {
  const [token,setToken] = useState('');
  const [admin,setAdmin] = useState<Admin|null>(null);
  const [tab,setTab] = useState<Tab>('Overview');
  const [error,setError] = useState('');

  useEffect(() => {
    const saved = localStorage.getItem('ydplay-admin-token') ?? '';
    if (!saved) return;
    setToken(saved);
    api<Admin>('/admin/me', saved).then(setAdmin).catch(() => localStorage.removeItem('ydplay-admin-token'));
  }, []);

  async function login(email:string,password:string) {
    setError('');
    try {
      const result = await api<any>('/admin/auth/login', undefined, { method:'POST', body: JSON.stringify({email,password}) });
      localStorage.setItem('ydplay-admin-token', result.accessToken);
      setToken(result.accessToken); setAdmin(result.admin);
    } catch (e:any) { setError(e.message); }
  }

  async function logout() {
    try { await api('/admin/auth/logout', token, {method:'POST'}); } catch {}
    localStorage.removeItem('ydplay-admin-token'); setToken(''); setAdmin(null);
  }

  if (!admin || !token) return <Login error={error} onLogin={login}/>;

  return <div className="shell">
    <aside className="sidebar">
      <div className="brand"><div className="logo">YD</div><div><strong>YD Play</strong><small>Operations Console</small></div></div>
      <div className="nav">{tabs.map(t => <button key={t} className={tab===t?'active':''} onClick={()=>setTab(t)}>{t}</button>)}</div>
      <div style={{marginTop:24}} className="muted"><small>{admin.email}<br/>{admin.role}</small></div>
      <button className="btn secondary" style={{marginTop:12,width:'100%'}} onClick={logout}>Sign out</button>
    </aside>
    <main className="main">
      <div className="topbar"><div><h1>{tab}</h1><div className="muted">{API_URL}</div></div><span className="badge active">{admin.role}</span></div>
      {tab==='Overview' && <Overview token={token}/>} 
      {tab==='Users' && <Users token={token}/>} 
      {tab==='Referrals' && <Referrals token={token}/>} 
      {tab==='Fraud' && <Fraud token={token}/>} 
      {tab==='Moderation' && <Moderation token={token}/>} 
      {tab==='Economy' && <Economy token={token}/>} 
      {tab==='Analytics' && <Analytics token={token}/>} 
      {tab==='Push' && <Pushes token={token}/>} 
      {tab==='Audit' && <AuditLogs token={token}/>} 
    </main>
  </div>;
}

function Login({error,onLogin}:{error:string;onLogin:(e:string,p:string)=>Promise<void>}) {
  const [email,setEmail]=useState(''); const [password,setPassword]=useState(''); const [busy,setBusy]=useState(false);
  async function submit(e:FormEvent){e.preventDefault();setBusy(true);try{await onLogin(email,password)}finally{setBusy(false)}}
  return <div className="login"><div className="loginbox"><div className="logo">YD</div><h1>YD Play Admin</h1><div className="muted">Named admin account required. The bootstrap API key is never used by this browser console.</div>{error&&<p className="error">{error}</p>}<form onSubmit={submit}><input type="email" placeholder="Admin email" value={email} onChange={e=>setEmail(e.target.value)} required/><input type="password" placeholder="Password" value={password} onChange={e=>setPassword(e.target.value)} minLength={10} required/><button className="btn" disabled={busy}>{busy?'Signing in…':'Sign in'}</button></form></div></div>
}

function useLoad<T>(token:string,path:string){const [data,setData]=useState<T|null>(null);const [error,setError]=useState('');const reload=()=>api<T>(path,token).then(setData).catch(e=>setError(e.message));useEffect(reload,[token,path]);return {data,error,reload};}
const Metric=({label,value}:{label:string;value:any})=><div className="card metric"><div className="label">{label}</div><div className="value">{value ?? '—'}</div></div>;

function Overview({token}:{token:string}){
  const {data,error}=useLoad<Dashboard>(token,'/admin/dashboard');
  if(error)return <p className="error">{error}</p>; if(!data)return <p className="muted">Loading dashboard…</p>;
  return <><div className="grid"><Metric label="Total users" value={data.users?.total_users}/><Metric label="Logged in 24h" value={data.users?.logged_in_24h}/><Metric label="Game sessions 24h" value={data.games?.sessions_24h}/><Metric label="Circulating coins" value={data.economy?.circulating_coins}/><Metric label="Open fraud flags" value={data.referrals?.open_flags}/><Metric label="Open reports" value={data.moderation?.open_reports}/><Metric label="New users 24h" value={data.users?.new_users_24h}/><Metric label="Est. D1 login retention" value={data.retention?.estimatedD1LoginRetention==null?'—':`${data.retention.estimatedD1LoginRetention}%`}/></div><div className="section card"><h2>Retention note</h2><div className="muted">{data.retention?.note}</div></div></>;
}

function Users({token}:{token:string}){
  const [q,setQ]=useState(''); const [items,setItems]=useState<UserRow[]>([]); const [error,setError]=useState(''); const [selected,setSelected]=useState<any>(null); const [reason,setReason]=useState(''); const [amount,setAmount]=useState('100');
  const load=async()=>{try{setItems((await api<any>(`/admin/users?q=${encodeURIComponent(q)}&limit=50`,token)).items);setError('')}catch(e:any){setError(e.message)}}; useEffect(()=>{load()},[]);
  const open=async(id:string)=>{try{setSelected(await api<any>(`/admin/users/${id}`,token));setError('')}catch(e:any){setError(e.message)}};
  async function status(s:'active'|'suspended'|'banned'){if(!selected||reason.trim().length<3){setError('Reason required');return;}try{await api(`/admin/users/${selected.user.id}/status`,token,{method:'PATCH',body:JSON.stringify({status:s,reason})});await open(selected.user.id);await load()}catch(e:any){setError(e.message)}}
  async function coins(direction:'credit'|'debit'){if(!selected||reason.trim().length<5)return setError('Adjustment reason required');try{await api(`/admin/users/${selected.user.id}/coins`,token,{method:'POST',body:JSON.stringify({direction,amount:Number(amount),reason})});await open(selected.user.id);await load()}catch(e:any){setError(e.message)}}
  return <><div className="row"><input value={q} onChange={e=>setQ(e.target.value)} placeholder="email / username / name"/><button className="btn" onClick={load}>Search</button></div>{error&&<p className="error">{error}</p>}<div className="section tablewrap"><table><thead><tr><th>User</th><th>Status</th><th>Coins</th><th>Devices</th><th>Created</th></tr></thead><tbody>{items.map(u=><tr key={u.id} onClick={()=>open(u.id)} style={{cursor:'pointer'}}><td><b>{u.username}</b><br/><span className="muted">{u.email}</span></td><td><span className={`badge ${u.status}`}>{u.status}</span></td><td>{u.coin_balance}</td><td>{u.device_count}</td><td>{new Date(u.created_at).toLocaleString()}</td></tr>)}</tbody></table></div>{selected&&<div className="section card"><h2>{selected.user.username}</h2><div className="row"><span className={`badge ${selected.user.status}`}>{selected.user.status}</span><span className="badge">Coins {selected.user.coin_balance}</span></div><div className="row" style={{marginTop:12}}><input style={{minWidth:300}} value={reason} onChange={e=>setReason(e.target.value)} placeholder="Required reason"/><button className="btn secondary" onClick={()=>status('active')}>Reactivate</button><button className="btn secondary" onClick={()=>status('suspended')}>Suspend</button><button className="btn danger" onClick={()=>status('banned')}>Ban</button></div><div className="row" style={{marginTop:10}}><input type="number" min="1" max="1000000" value={amount} onChange={e=>setAmount(e.target.value)}/><button className="btn" onClick={()=>coins('credit')}>Credit coins</button><button className="btn secondary" onClick={()=>coins('debit')}>Debit coins</button></div><details style={{marginTop:14}}><summary>Recent wallet & devices</summary><pre>{JSON.stringify({devices:selected.devices,walletTransactions:selected.walletTransactions},null,2)}</pre></details></div>}</>;
}


function Referrals({token}:{token:string}){
  const {data:config,error,reload}=useLoad<any>(token,'/admin/referrals/config');
  const overview=useLoad<any>(token,'/admin/referrals/overview');
  const [draft,setDraft]=useState<any>(null); const [msg,setMsg]=useState('');
  useEffect(()=>{if(config)setDraft({...config})},[config]);
  async function save(){if(!draft)return;try{const body:any={};for(const k of fields){const v=draft[k];if(typeof v==='number')body[k]=v;}await api('/admin/referrals/config',token,{method:'PATCH',body:JSON.stringify(body)});setMsg('Referral configuration updated and audit logged.');reload()}catch(e:any){setMsg(e.message)}}
  if(error)return <p className="error">{error}</p>; if(!draft)return <p className="muted">Loading…</p>;
  const fields=['inviterReward','inviteeReward','dailyInviterRewardCap','lifetimeInviterRewardCap','minAccountAgeMinutes','maxInvitesPerHour','sameDeviceRisk','sameIpRisk','ipVelocityRisk','deviceMultiAccountRisk','inviterVelocityRisk','reviewThreshold','blockThreshold'];
  return <><div className="grid"><Metric label="Total referrals" value={overview.data?.referrals_total}/><Metric label="Rewarded" value={overview.data?.rewarded}/><Metric label="Granted coins" value={overview.data?.granted_coins}/><Metric label="Open flags" value={overview.data?.open_flags}/></div><div className="section card"><h2>Reward & abuse configuration</h2><div className="row">{fields.map(f=><label key={f} style={{display:'grid',gap:5,minWidth:190}}><span className="muted"><small>{f}</small></span><input type="number" value={draft[f]??''} onChange={e=>setDraft({...draft,[f]:Number(e.target.value)})}/></label>)}</div><button className="btn" style={{marginTop:14}} onClick={save}>Save configuration</button>{msg&&<p className={msg.startsWith('Referral')?'success':'error'}>{msg}</p>}</div></>;
}

function Fraud({token}:{token:string}){
  const {data,error,reload}=useLoad<any>(token,'/admin/fraud/flags?status=open&limit=100');
  async function review(id:string,status:'reviewing'|'confirmed'|'dismissed'){const reason=prompt('Review reason (recommended)')??'';try{await api(`/admin/fraud/flags/${id}`,token,{method:'PATCH',body:JSON.stringify({status,reason})});reload()}catch(e:any){alert(e.message)}}
  if(error)return <p className="error">{error}</p>; const items:FraudFlag[]=data?.items??data??[];
  return <div className="tablewrap"><table><thead><tr><th>Rule</th><th>Risk</th><th>User</th><th>Status</th><th>Evidence</th><th>Review</th></tr></thead><tbody>{items.map((f:any)=><tr key={f.id}><td>{f.rule_code}</td><td>{f.risk_points ?? f.risk_score}</td><td>{f.user_id??'—'}</td><td><span className={`badge ${f.status}`}>{f.status}</span></td><td><code>{JSON.stringify(f.evidence)}</code></td><td><div className="row"><button className="btn secondary" onClick={()=>review(f.id,'reviewing')}>Review</button><button className="btn danger" onClick={()=>review(f.id,'confirmed')}>Confirm</button><button className="btn" onClick={()=>review(f.id,'dismissed')}>Dismiss</button></div></td></tr>)}</tbody></table></div>;
}

function Moderation({token}:{token:string}){
  const {data,error,reload}=useLoad<any>(token,'/admin/moderation/reports?status=all&limit=100'); const items:Report[]=data?.items??[];
  async function review(id:string,status:'reviewing'|'resolved'|'dismissed'){const note=prompt('Resolution/review note')??'';try{await api(`/admin/moderation/reports/${id}`,token,{method:'PATCH',body:JSON.stringify({status,note})});reload()}catch(e:any){alert(e.message)}}
  if(error)return <p className="error">{error}</p>;
  return <div className="tablewrap"><table><thead><tr><th>Category</th><th>Reporter</th><th>Target</th><th>Status</th><th>Details</th><th>Action</th></tr></thead><tbody>{items.map((r:any)=><tr key={r.id}><td>{r.category}</td><td>{r.reporter_username??'—'}</td><td>{r.target_username??'—'}</td><td><span className={`badge ${r.status}`}>{r.status}</span></td><td>{r.details??'—'}</td><td><div className="row"><button className="btn secondary" onClick={()=>review(r.id,'reviewing')}>Review</button><button className="btn" onClick={()=>review(r.id,'resolved')}>Resolve</button><button className="btn secondary" onClick={()=>review(r.id,'dismissed')}>Dismiss</button></div></td></tr>)}</tbody></table></div>;
}

function Economy({token}:{token:string}){
  const {data,error}=useLoad<any>(token,'/admin/economy?days=7'); if(error)return <p className="error">{error}</p>; if(!data)return <p className="muted">Loading…</p>;
  return <><div className="grid"><Metric label="Circulating coins" value={data.supply?.circulating_coins}/><Metric label="User wallets" value={data.supply?.wallets}/><Metric label="Window" value={`${data.days} days`}/></div><div className="section tablewrap"><table><thead><tr><th>Reason</th><th>Sources</th><th>Sinks</th><th>Transactions</th></tr></thead><tbody>{data.flows?.map((f:any)=><tr key={f.reason}><td>{f.reason}</td><td>{f.source_coins}</td><td>{f.sink_coins}</td><td>{f.transactions}</td></tr>)}</tbody></table></div></>;
}

function Analytics({token}:{token:string}){
  const {data,error}=useLoad<any>(token,'/admin/analytics/events?days=7');
  if(error)return <p className="error">{error}</p>; if(!data)return <p className="muted">Loading…</p>;
  return <><div className="grid"><Metric label="Window" value={`${data.days} days`}/><Metric label="Tracked event types" value={data.items?.length??0}/></div><div className="section tablewrap"><table><thead><tr><th>Event</th><th>Events</th><th>Unique users</th><th>Last seen</th></tr></thead><tbody>{(data.items??[]).map((e:any)=><tr key={e.event_name}><td>{e.event_name}</td><td>{e.events}</td><td>{e.unique_users}</td><td>{e.last_seen?new Date(e.last_seen).toLocaleString():'—'}</td></tr>)}</tbody></table></div></>;
}

function Pushes({token}:{token:string}){
  const {data,error,reload}=useLoad<any>(token,'/admin/push-campaigns?limit=100'); const [form,setForm]=useState({name:'',title:'',body:'',scheduledAt:''}); const [msg,setMsg]=useState('');
  async function submit(e:FormEvent){e.preventDefault();try{await api('/admin/push-campaigns',token,{method:'POST',body:JSON.stringify({...form,scheduledAt:form.scheduledAt?new Date(form.scheduledAt).toISOString():undefined})});setMsg('Campaign saved. Dispatch when ready.');reload()}catch(e:any){setMsg(e.message)}}
  async function dispatch(id:string){if(!confirm('Dispatch this campaign to active users? In-app notifications will be created immediately.'))return;try{const r=await api<any>(`/admin/push-campaigns/${id}/dispatch`,token,{method:'POST'});setMsg(`Dispatched: ${r.inAppCreated} inbox items; push sent ${r.push?.sent??0}, skipped ${r.push?.skipped??0}, failed ${r.push?.failed??0}.`);reload()}catch(e:any){setMsg(e.message)}}
  return <>{error&&<p className="error">{error}</p>}<form className="card" onSubmit={submit}><h2>Compose notification</h2><div className="row"><input placeholder="Campaign name" value={form.name} onChange={e=>setForm({...form,name:e.target.value})} required/><input placeholder="Notification title" value={form.title} onChange={e=>setForm({...form,title:e.target.value})} required/><input type="datetime-local" value={form.scheduledAt} onChange={e=>setForm({...form,scheduledAt:e.target.value})}/></div><textarea style={{width:'100%',marginTop:10}} rows={3} placeholder="Message" value={form.body} onChange={e=>setForm({...form,body:e.target.value})} required/><button className="btn" style={{marginTop:10}}>Save campaign</button>{msg&&<p className={msg.startsWith('Campaign')||msg.startsWith('Dispatched')?'success':'error'}>{msg}</p>}</form><div className="section tablewrap"><table><thead><tr><th>Name</th><th>Title</th><th>Status</th><th>Scheduled</th><th>Created</th><th>Delivery</th></tr></thead><tbody>{(data?.items??[]).map((p:Push)=><tr key={p.id}><td>{p.name}</td><td>{p.title}</td><td><span className="badge">{p.status}</span></td><td>{p.scheduled_at?new Date(p.scheduled_at).toLocaleString():'—'}</td><td>{new Date(p.created_at).toLocaleString()}</td><td><button className="btn secondary" disabled={p.status==='sending'} onClick={()=>dispatch(p.id)}>Dispatch</button></td></tr>)}</tbody></table></div></>;
}

function AuditLogs({token}:{token:string}){
  const {data,error}=useLoad<any>(token,'/admin/audit-logs?limit=150'); if(error)return <p className="error">{error}</p>;
  return <div className="tablewrap"><table><thead><tr><th>Time</th><th>Admin</th><th>Action</th><th>Target</th><th>Reason</th><th>Result</th></tr></thead><tbody>{(data?.items??[]).map((a:Audit)=><tr key={a.id}><td>{new Date(a.created_at).toLocaleString()}</td><td>{a.admin_email??a.actor}</td><td>{a.action}</td><td>{a.target_type??'—'} {a.target_id??''}</td><td>{a.reason??'—'}</td><td>{a.result}</td></tr>)}</tbody></table></div>;
}

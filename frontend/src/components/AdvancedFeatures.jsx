import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { io } from 'socket.io-client';
import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet.heat';
import api from '../api';

export function AIHelper({ form, setForm }) {
  const [loading, setLoading] = useState(false), [suggestion, setSuggestion] = useState(null), [error, setError] = useState('');
  const suggest = async () => {
    setLoading(true); setError('');
    try { const { data } = await api.post('/advanced/ai/suggest', { description: form.description }); setSuggestion(data); }
    catch (e) { setError(e.response?.data?.message || 'Could not generate suggestions.'); }
    finally { setLoading(false); }
  };
  return <section className="advanced-inline"><div className="advanced-inline-head"><div><b>✦ AI complaint assistant</b><small>Suggests a category, priority and title from your description.</small></div><button type="button" className="btn btn-outline btn-small" onClick={suggest} disabled={loading || form.description.trim().length < 8}>{loading ? 'Analysing…' : 'Get suggestions'}</button></div>
    {error && <p className="advanced-error">{error}</p>}
    {suggestion && <div className="suggestion-result"><p>{suggestion.note}</p><div className="suggestion-values"><span><small>Category</small><b>{suggestion.category}</b></span><span><small>Priority</small><b>{suggestion.priority}</b></span><span><small>Title</small><b>{suggestion.title || '—'}</b></span></div><button type="button" className="btn btn-primary btn-small" onClick={() => setForm(old => ({...old, category:suggestion.category, priority:suggestion.priority, title:old.title || suggestion.title}))}>Apply suggestions</button></div>}
  </section>;
}

export function DuplicateChecker({ form, position }) {
  const [loading,setLoading]=useState(false), [result,setResult]=useState(null), [error,setError]=useState('');
  const check = async () => {
    if (!position || position.length < 2) {
      setError('Please select a location before checking duplicates.');
      return;
    }

    setLoading(true);
    setError('');
    setResult(null);

    try {
      const { data } = await api.post('/advanced/duplicates/check', {
        description: form.description,
        latitude: position[0],
        longitude: position[1]
      });

      setResult(data);
    } catch (e) {
      setError(e.response?.data?.message || 'Duplicate check failed.');
    } finally {
      setLoading(false);
    }
  };
  return <section className="advanced-inline"><div className="advanced-inline-head"><div><b>⌕ Check for similar complaints</b><small>Checks complaints within 500 metres and compares descriptions.</small></div><button type="button" className="btn btn-outline btn-small" onClick={check} disabled={loading || form.description.trim().length < 8}>{loading?'Checking…':'Check duplicates'}</button></div>
    {error&&<p className="advanced-error">{error}</p>}
    {result && (result.possibleDuplicate ? <div className="duplicate-results"><b>Possible similar complaints found</b>{result.matches.map(x=><Link key={x._id} to={`/issues/${x._id}`} className="duplicate-item"><span><b>{x.title}</b><small>{x.category} · {x.status.replace('_',' ')}</small></span><strong>{Math.round(x.similarity*100)}% match</strong></Link>)}</div> : <p className="advanced-success">No close matching complaint was found. You can continue submitting.</p>)}
  </section>;
}

export function FeedbackForm({ issue }) {
  const [rating,setRating]=useState(5),[review,setReview]=useState(''),[done,setDone]=useState(Boolean(issue.feedback?.rating)),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  const submit=async e=>{e.preventDefault();setBusy(true);setError('');try{await api.post(`/advanced/issues/${issue._id}/feedback`,{rating,review});setDone(true)}catch(err){setError(err.response?.data?.message||'Could not submit feedback.')}finally{setBusy(false)}};
  if(issue.feedback?.rating) return <section className="panel"><h3>Citizen feedback</h3><b>{'★'.repeat(issue.feedback.rating)}{'☆'.repeat(5-issue.feedback.rating)} ({issue.feedback.rating}/5)</b><p>{issue.feedback.review||'No written review.'}</p></section>;
  if(done) return <section className="panel"><h3>Thank you!</h3><p>Your feedback has been recorded.</p></section>;
  return <section className="panel"><h3>Rate the resolution</h3><p className="muted">Your feedback helps improve civic services.</p><form onSubmit={submit}><label className="field">Rating<select value={rating} onChange={e=>setRating(Number(e.target.value))}>{[5,4,3,2,1].map(n=><option key={n} value={n}>{n} star{n>1?'s':''}</option>)}</select></label><label className="field">Review (optional)<textarea rows="3" maxLength="1000" value={review} onChange={e=>setReview(e.target.value)} placeholder="Tell us about the resolution…"/></label>{error&&<div className="alert">{error}</div>}<button className="btn btn-primary" disabled={busy}>{busy?'Submitting…':'Submit feedback'}</button></form></section>;
}


function HeatLayer({ points }) {
  const map = useMap();
  useEffect(() => {
    if (!points.length) return;
    const layer = L.heatLayer(points.map(p => [p.lat, p.lng, p.intensity]), {
      radius: 30, blur: 22, maxZoom: 17,
      gradient: { 0.2: '#16865f', 0.5: '#e5a000', 0.8: '#d94841' }
    }).addTo(map);
    return () => { map.removeLayer(layer); };
  }, [map, points]);
  return null;
}

export default function AdvancedFeatures() {
  const [user, setUser] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [points, setPoints] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [error, setError] = useState('');
  const [notificationError, setNotificationError] = useState('');
  const canManage=['officer','admin'].includes(user?.role);
  const hasUnread = notifications.some(n => !n.read);
  const loadNotifications = async () => {
    try {
      const { data } = await api.get('/advanced/notifications');

      if (Array.isArray(data)) {
        setNotifications(data);
        setNotificationError('');
      }
    } catch (err) {
      setNotificationError(
        err.response?.data?.message || 'Unable to load notifications.'
      );
    }
  };
  useEffect(()=>{api.get('/auth/me').then(r=>setUser(r.data.user)).catch(()=>{});loadNotifications();
    const token=localStorage.getItem('civicgrid_token');
    const socket=io({auth:{token},transports:['websocket','polling']});
    socket.on('notification:new',item=>setNotifications(old=>[item,...old.filter(x=>x._id!==item._id)].slice(0,50)));
    socket.on('connect_error',()=>setError('Live notifications unavailable; saved notifications still refresh.'));
    const timer=setInterval(loadNotifications,15000);
    return()=>{clearInterval(timer);socket.disconnect()};
  },[]);
  useEffect(()=>{if(!canManage)return;Promise.all([api.get('/advanced/heatmap'),api.get('/advanced/workers/performance')]).then(([a,b])=>{setPoints(a.data);setWorkers(b.data)}).catch(e=>setError(e.response?.data?.message||'Could not load management metrics.'))},[canManage]);
  const markRead = async (id) => {
    try {
      await api.patch(`/advanced/notifications/${id}/read`);

      setNotifications(old =>
        old.map(n =>
          n._id === id ? { ...n, read: true } : n
        )
      );

      setNotificationError('');
    } catch (e) {
      setNotificationError(
        e.response?.data?.message || 'Could not mark notification as read.'
      );
    }
  };

  const markAll = async () => {
    try {
      await api.patch('/advanced/notifications/read-all');

      setNotifications(old =>
        old.map(n => ({ ...n, read: true }))
      );

      setNotificationError('');
    } catch (e) {
      setNotificationError(
        e.response?.data?.message || 'Could not mark all notifications as read.'
      );
    }
  };
  return <><div className="page-title"><div><span className="eyebrow">CIVICGRID INTELLIGENCE</span><h1>Advanced features</h1><p>Notifications, issue insights and service performance.</p></div></div>
    {error&&<div className="alert">{error}</div>}
    <section className="panel advanced-panel"><div className="section-top"><h3>Notifications</h3><button className="btn btn-outline btn-small" onClick={markAll} disabled={!hasUnread}>Mark all read</button></div>{notificationError&&<div className="alert">{notificationError}</div>}{!notifications.length?<p className="muted">No notifications yet. Updates about your complaints will appear here.</p>:<div className="notification-list">{notifications.map(n=><div key={n._id} className={`notification-item ${n.read?'is-read':''}`}><span className="notification-dot"/><div><b>{n.title}</b><p>{n.message}</p><small>{new Date(n.createdAt).toLocaleString()} {n.issue&&n.issue._id&&<> · <Link to={`/issues/${n.issue._id}`}>View complaint</Link></>}</small></div>{!n.read&&<button className="btn btn-outline btn-small" onClick={()=>markRead(n._id)}>Mark read</button>}</div>)}</div>}</section>
    {canManage&&<><section className="panel advanced-panel"><h3>Issue heatmap</h3><p className="muted">Heat intensity reflects complaint concentration and priority; red zones need closer attention.</p><MapContainer center={points.length?[points[0].lat,points[0].lng]:[27.4924,77.6737]} zoom={11} style={{height:350,width:'100%',borderRadius:14}}><TileLayer attribution='&copy; OpenStreetMap contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"/><HeatLayer points={points}/></MapContainer><small className="muted">{points.length} mapped complaints</small></section>
      <section className="panel advanced-panel"><h3>Worker performance</h3>{!workers.length?<p className="muted">No active field workers found.</p>:<div className="performance-grid">{workers.map(w=><div className="performance-card" key={w._id}><b>{w.name}</b><small>{w.department}</small><div><span>Completed</span><strong>{w.completed}</strong></div><div><span>Pending</span><strong>{w.pending}</strong></div><div><span>Total assigned</span><strong>{w.total}</strong></div><div><span>Avg. resolution</span><strong>{w.averageResolutionHours==null?'—':`${w.averageResolutionHours} h`}</strong></div></div>)}</div>}</section></>}
  </>;
}

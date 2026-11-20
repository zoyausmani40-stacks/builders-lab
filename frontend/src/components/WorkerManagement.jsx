import React, { useEffect, useState } from 'react';
import api from '../api';

const emptyForm = { name: '', email: '', password: '', department: 'Roads' };
export default function WorkerManagement() {
  const [workers, setWorkers] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try { setWorkers((await api.get('/users/workers/manage')).data); }
    catch (e) { setError(e.response?.data?.message || 'Could not load workers.'); }
  };
  useEffect(() => { load(); }, []);

  const change = e => setForm(current => ({ ...current, [e.target.name]: e.target.value }));
  const reset = () => { setForm(emptyForm); setEditing(null); };
  const submit = async e => {
    e.preventDefault(); setBusy(true); setError(''); setNotice('');
    try {
      if (editing) {
        const payload = { name: form.name, email: form.email, department: form.department };
        if (form.password) payload.password = form.password;
        await api.patch(`/users/workers/${editing}`, payload);
        setNotice('Worker details updated.');
      } else {
        await api.post('/users/workers', form);
        setNotice('Worker account created successfully.');
      }
      reset(); await load();
    } catch (e2) { setError(e2.response?.data?.message || 'Could not save worker.'); }
    finally { setBusy(false); }
  };
  const edit = worker => {
    setEditing(worker._id);
    setForm({ name: worker.name, email: worker.email, password: '', department: worker.department || 'General' });
    setError(''); setNotice('');
  };
  const toggle = async worker => {
    setError(''); setNotice('');
    try {
      await api.patch(`/users/workers/${worker._id}`, { active: !worker.active });
      setNotice(`${worker.name} has been ${worker.active ? 'deactivated' : 'activated'}.`);
      await load();
    } catch (e) { setError(e.response?.data?.message || 'Could not update worker status.'); }
  };

  return <section className="panel worker-management">
    <div className="worker-management-heading"><div><span className="eyebrow">ADMIN ONLY</span><h2>Worker management</h2><p className="muted">Create, edit, activate or deactivate field-worker accounts.</p></div><span className="worker-count">{workers.length} workers</span></div>
    <form className="worker-form" onSubmit={submit}>
      <h3>{editing ? 'Edit worker' : 'Hire a new worker'}</h3>
      <div className="worker-form-grid">
        <label className="field"><span>Full name</span><input name="name" value={form.name} onChange={change} required placeholder="Worker name" /></label>
        <label className="field"><span>Email address</span><input name="email" type="email" value={form.email} onChange={change} required placeholder="worker@example.com" /></label>
        <label className="field"><span>{editing ? 'New password (optional)' : 'Temporary password'}</span><input name="password" type="password" value={form.password} onChange={change} minLength="8" required={!editing} placeholder="At least 8 characters" /></label>
        <label className="field"><span>Department</span><select name="department" value={form.department} onChange={change}>{['Roads','Sanitation','Streetlight','Water Supply','Drainage','Public Safety','General'].map(d => <option key={d}>{d}</option>)}</select></label>
      </div>
      {error && <div className="alert">{error}</div>}{notice && <div className="success-message">{notice}</div>}
      <div className="worker-form-actions"><button className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : editing ? 'Save changes' : 'Create worker account'}</button>{editing && <button type="button" className="btn btn-outline" onClick={reset}>Cancel</button>}</div>
    </form>
    <div className="worker-list-heading"><h3>All field workers</h3><button type="button" className="btn btn-outline btn-small" onClick={load}>Refresh</button></div>
    {workers.length === 0 ? <p className="muted">No worker accounts yet. Create the first worker above.</p> : <div className="worker-table-wrap"><table className="worker-table"><thead><tr><th>Name</th><th>Email</th><th>Department</th><th>Status</th><th>Actions</th></tr></thead><tbody>{workers.map(w => <tr key={w._id}><td><b>{w.name}</b></td><td>{w.email}</td><td>{w.department || 'General'}</td><td><span className={`worker-status ${w.active ? 'is-active' : 'is-inactive'}`}>{w.active ? 'Active' : 'Inactive'}</span></td><td><div className="worker-actions"><button className="btn btn-outline btn-small" onClick={() => edit(w)}>Edit</button><button className={`btn btn-small ${w.active ? 'btn-danger' : 'btn-primary'}`} onClick={() => toggle(w)}>{w.active ? 'Deactivate' : 'Activate'}</button></div></td></tr>)}</tbody></table></div>}
  </section>;
}

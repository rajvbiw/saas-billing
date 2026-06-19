import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { Key, Plus, Trash2, RotateCw, Copy, Check, EyeOff, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

interface ApiKey {
  id: number;
  name: string;
  prefix: string;
  last_used_at: string | null;
  is_active: boolean;
  created_at: string;
}

export const ApiKeys: React.FC = () => {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [keyName, setKeyName] = useState('');
  const [creating, setCreating] = useState(false);
  const [plainKey, setPlainKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const fetchKeys = async () => {
    try {
      const res = await api.get('/keys');
      setKeys(res.data);
    } catch (err: any) {
      toast.error('Failed to fetch API keys.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchKeys();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!keyName) return;

    setCreating(true);
    try {
      const res = await api.post('/keys', { name: keyName });
      setPlainKey(res.data.rawKey);
      setKeyName('');
      toast.success('API key generated successfully!');
      fetchKeys();
    } catch (error) {
      toast.error('Failed to generate API key.');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Are you sure you want to revoke this API key? Applications using it will instantly fail.')) return;
    try {
      await api.delete(`/keys/${id}`);
      toast.success('API key revoked.');
      fetchKeys();
    } catch (error) {
      toast.error('Failed to revoke API key.');
    }
  };

  const handleRotate = async (id: number) => {
    if (!window.confirm('Are you sure you want to rotate this key? The old key prefix will be deactivated immediately.')) return;
    try {
      const res = await api.put(`/keys/${id}/rotate`);
      setPlainKey(res.data.rawKey);
      toast.success('Key rotated successfully!');
      fetchKeys();
    } catch (error) {
      toast.error('Failed to rotate API key.');
    }
  };

  const handleCopy = () => {
    if (!plainKey) return;
    navigator.clipboard.writeText(plainKey);
    setCopied(true);
    toast.success('API key copied to clipboard!');
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-10 bg-gray-200 rounded-lg w-1/4"></div>
        <div className="h-32 bg-gray-200 rounded-3xl"></div>
        <div className="h-64 bg-gray-200 rounded-3xl"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-gray-950">Developer API Keys</h1>
        <p className="text-sm text-gray-400 mt-1">Generate and rotate keys to authenticate workspace requests programmatically.</p>
      </div>

      {/* Plain Key Warning Banner - Displayed strictly ONCE on creation */}
      {plainKey && (
        <div className="bg-amber-50 border border-amber-200 rounded-3xl p-6 space-y-4">
          <div className="flex gap-3 text-xs text-amber-800 leading-relaxed">
            <EyeOff className="text-amber-600 shrink-0 mt-0.5" size={18} />
            <div>
              <span className="font-bold text-amber-950 block mb-1">Make sure to copy your API key now</span>
              <p>
                For security reasons, this key will not be displayed again. Store it securely in your environment parameters.
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-3 bg-white border border-amber-100 rounded-2xl p-4">
            <code className="text-xs font-mono font-bold text-gray-900 break-all select-all flex-1">{plainKey}</code>
            <button 
              onClick={handleCopy}
              className="p-2.5 rounded-xl bg-amber-100 hover:bg-amber-200 text-amber-800 transition"
              title="Copy key"
            >
              {copied ? <Check size={16} /> : <Copy size={16} />}
            </button>
            <button 
              onClick={() => setPlainKey(null)}
              className="text-xs font-semibold text-gray-500 hover:text-gray-900"
            >
              Done
            </button>
          </div>
        </div>
      )}

      <div className="grid md:grid-cols-3 gap-8">
        
        {/* Key Creator Form */}
        <div>
          <form onSubmit={handleCreate} className="bg-white border border-gray-200 rounded-3xl p-6 space-y-4 shadow-sm">
            <h3 className="font-bold text-lg text-gray-900">Create API Key</h3>
            
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-500 uppercase">Key Name Label</label>
              <input 
                type="text" 
                required 
                placeholder="e.g., Staging Webhooks"
                value={keyName}
                onChange={(e) => setKeyName(e.target.value)}
                className="w-full text-sm border border-gray-200 rounded-xl py-2 px-3 focus:outline-none focus:border-indigo-500 bg-gray-50/50"
              />
            </div>

            <button 
              type="submit" 
              disabled={creating}
              className="w-full text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-200 text-white py-2.5 rounded-xl transition flex items-center justify-center gap-1.5 shadow-sm"
            >
              {creating ? <Loader2 className="animate-spin" size={14} /> : <><Plus size={14} /> Generate Key</>}
            </button>
          </form>
        </div>

        {/* Existing Keys Table */}
        <div className="md:col-span-2 bg-white border border-gray-200 rounded-3xl overflow-hidden shadow-sm flex flex-col">
          <div className="p-6 border-b border-gray-100">
            <h3 className="font-bold text-lg text-gray-950">Active API Keys</h3>
            <p className="text-xs text-gray-400 mt-1">Credentials with active platform authentication scopes.</p>
          </div>
          
          {keys.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-16">No API credentials generated yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-gray-50 border-b border-gray-100 text-gray-400 uppercase">
                  <tr>
                    <th className="py-3 px-6">Name</th>
                    <th className="py-3 px-6">Prefix</th>
                    <th className="py-3 px-6">Created At</th>
                    <th className="py-3 px-6">Last Used</th>
                    <th className="py-3 px-6 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-gray-600">
                  {keys.map((k) => (
                    <tr key={k.id} className={`hover:bg-gray-50/50 ${!k.is_active ? 'opacity-50' : ''}`}>
                      <td className="py-3 px-6 font-semibold text-gray-900">{k.name}</td>
                      <td className="py-3 px-6 font-mono text-[11px] bg-gray-50 py-0.5 px-2.5 rounded-lg inline-block my-2 mx-6">{k.prefix}...</td>
                      <td className="py-3 px-6">{new Date(k.created_at).toLocaleDateString()}</td>
                      <td className="py-3 px-6">{k.last_used_at ? new Date(k.last_used_at).toLocaleDateString() : 'Never'}</td>
                      <td className="py-3 px-6 text-right space-x-2">
                        {k.is_active && (
                          <button 
                            onClick={() => handleRotate(k.id)}
                            className="p-1.5 rounded-lg bg-gray-50 hover:bg-gray-100 text-gray-500 hover:text-indigo-600 transition inline-block"
                            title="Rotate Key"
                          >
                            <RotateCw size={14} />
                          </button>
                        )}
                        <button 
                          onClick={() => handleDelete(k.id)}
                          className="p-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 transition inline-block"
                          title="Revoke Key"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>

    </div>
  );
};

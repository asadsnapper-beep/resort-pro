'use client';

import { useEffect, useState } from 'react';
import {
  HardDrive, Cloud, Server, CheckCircle2, XCircle,
  Loader2, Save, FlaskConical, Eye, EyeOff, Info,
} from 'lucide-react';
import { adminApi } from '@/lib/admin-api';
import { cn } from '@/lib/utils';

type Driver = 'local' | 's3';

interface StorageConfig {
  driver:     Driver;
  endpoint?:  string;
  region?:    string;
  bucket?:    string;
  publicUrl?: string;
  accessKey?: string;
  secretKey?: string;
}

type TestStatus = 'idle' | 'testing' | 'ok' | 'fail';

const DRIVER_OPTIONS: { id: Driver; label: string; desc: string; icon: React.ElementType }[] = [
  {
    id:    'local',
    label: 'Local Disk',
    desc:  'Files saved to server disk — perfect for development and self-hosted setups.',
    icon:  Server,
  },
  {
    id:    's3',
    label: 'S3 / Cloudflare R2',
    desc:  'Production-grade object storage. Works with AWS S3, Cloudflare R2, MinIO, or any S3-compatible provider.',
    icon:  Cloud,
  },
];

export default function StorageConfigPage() {
  const [config,   setConfig]   = useState<StorageConfig>({ driver: 'local' });
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);
  const [test,     setTest]     = useState<TestStatus>('idle');
  const [testMsg,  setTestMsg]  = useState('');
  const [saveMsg,  setSaveMsg]  = useState('');
  const [showKey,  setShowKey]  = useState(false);
  const [error,    setError]    = useState('');

  // ── Fetch current config ──────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const res = await adminApi.get('/storage');
        if (res.data?.data) setConfig(res.data.data as StorageConfig);
      } catch {
        setError('Failed to load storage config.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const patch = (key: keyof StorageConfig, value: string) =>
    setConfig((c) => ({ ...c, [key]: value }));

  // ── Save ─────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    setSaving(true);
    setSaveMsg('');
    setError('');
    try {
      await adminApi.patch('/storage', config);
      setSaveMsg('Configuration saved successfully.');
      setTimeout(() => setSaveMsg(''), 4000);
    } catch (err: any) {
      setError(err?.response?.data?.error ?? 'Failed to save config.');
    } finally {
      setSaving(false);
    }
  };

  // ── Test connection ───────────────────────────────────────────────────────
  const handleTest = async () => {
    setTest('testing');
    setTestMsg('');
    try {
      const res = await adminApi.post('/storage/test', {});
      setTest('ok');
      setTestMsg(res.data?.data?.url
        ? `Test file uploaded & deleted. Storage is working correctly.`
        : 'Connection successful.');
    } catch (err: any) {
      setTest('fail');
      setTestMsg(err?.response?.data?.error ?? 'Connection test failed.');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-1">
          <div className="w-10 h-10 bg-indigo-600/20 border border-indigo-500/30 rounded-xl flex items-center justify-center">
            <HardDrive className="w-5 h-5 text-indigo-400" />
          </div>
          <h1 className="text-2xl font-bold text-white">Storage Configuration</h1>
        </div>
        <p className="text-gray-400 text-sm ml-13">
          Choose where uploaded files (room photos, avatars, menu images) are stored.
        </p>
      </div>

      {/* Driver selector */}
      <section className="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-4">
        <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wide">Storage Driver</h2>
        <div className="grid grid-cols-2 gap-3">
          {DRIVER_OPTIONS.map(({ id, label, desc, icon: Icon }) => (
            <button
              key={id}
              onClick={() => patch('driver', id)}
              className={cn(
                'text-left p-4 rounded-xl border-2 transition-all',
                config.driver === id
                  ? 'border-indigo-500 bg-indigo-600/10'
                  : 'border-gray-700 bg-gray-800/50 hover:border-gray-600'
              )}
            >
              <div className="flex items-center gap-2 mb-2">
                <Icon className={cn('w-5 h-5', config.driver === id ? 'text-indigo-400' : 'text-gray-500')} />
                <span className={cn('font-semibold text-sm', config.driver === id ? 'text-indigo-300' : 'text-gray-300')}>
                  {label}
                </span>
                {config.driver === id && (
                  <CheckCircle2 className="w-4 h-4 text-indigo-400 ml-auto shrink-0" />
                )}
              </div>
              <p className="text-xs text-gray-500 leading-relaxed">{desc}</p>
            </button>
          ))}
        </div>
      </section>

      {/* Local driver info */}
      {config.driver === 'local' && (
        <section className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <div className="flex items-start gap-3 p-4 bg-blue-950/40 border border-blue-800/40 rounded-xl">
            <Info className="w-5 h-5 text-blue-400 mt-0.5 shrink-0" />
            <div className="text-sm text-blue-300 space-y-1">
              <p className="font-medium">Local disk storage is active</p>
              <p className="text-blue-400/80">
                Files are saved to the <code className="bg-blue-900/40 px-1 rounded text-xs">uploads/</code> folder
                on your API server and served at <code className="bg-blue-900/40 px-1 rounded text-xs">/uploads/…</code>.
              </p>
              <p className="text-blue-400/80">
                This is ideal for development. For production, switch to S3 / Cloudflare R2 so files survive
                server restarts and scale across instances.
              </p>
            </div>
          </div>
        </section>
      )}

      {/* S3 / R2 credentials */}
      {config.driver === 's3' && (
        <section className="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-5">
          <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wide">S3 / R2 Credentials</h2>

          {/* Preset hint */}
          <div className="flex gap-2">
            <button
              onClick={() => setConfig((c) => ({ ...c, endpoint: '', region: 'us-east-1', publicUrl: '' }))}
              className="text-xs px-3 py-1.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-300 rounded-lg transition-colors"
            >
              AWS S3
            </button>
            <button
              onClick={() => setConfig((c) => ({ ...c, endpoint: 'https://<accountid>.r2.cloudflarestorage.com', region: 'auto' }))}
              className="text-xs px-3 py-1.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-300 rounded-lg transition-colors"
            >
              Cloudflare R2
            </button>
          </div>

          <div className="space-y-4">
            {/* Endpoint */}
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">
                Endpoint URL
                <span className="text-gray-600 font-normal ml-1">(leave empty for AWS S3, required for R2/MinIO)</span>
              </label>
              <input
                type="url"
                value={config.endpoint ?? ''}
                onChange={(e) => patch('endpoint', e.target.value)}
                placeholder="https://<accountid>.r2.cloudflarestorage.com"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500 transition-colors"
              />
            </div>

            {/* Region + Bucket */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">Region</label>
                <input
                  type="text"
                  value={config.region ?? ''}
                  onChange={(e) => patch('region', e.target.value)}
                  placeholder="auto  (R2)  or  us-east-1  (S3)"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500 transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">Bucket Name</label>
                <input
                  type="text"
                  value={config.bucket ?? ''}
                  onChange={(e) => patch('bucket', e.target.value)}
                  placeholder="my-resort-uploads"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500 transition-colors"
                />
              </div>
            </div>

            {/* Public URL */}
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">
                Public CDN URL
                <span className="text-gray-600 font-normal ml-1">(base URL for serving files)</span>
              </label>
              <input
                type="url"
                value={config.publicUrl ?? ''}
                onChange={(e) => patch('publicUrl', e.target.value)}
                placeholder="https://cdn.yourresort.com  or  https://pub-xxx.r2.dev"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500 transition-colors"
              />
            </div>

            {/* Access Key + Secret Key */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">Access Key ID</label>
                <input
                  type="text"
                  value={config.accessKey ?? ''}
                  onChange={(e) => patch('accessKey', e.target.value)}
                  placeholder="AKIAIOSFODNN7EXAMPLE"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500 transition-colors font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">Secret Access Key</label>
                <div className="relative">
                  <input
                    type={showKey ? 'text' : 'password'}
                    value={config.secretKey ?? ''}
                    onChange={(e) => patch('secretKey', e.target.value)}
                    placeholder="wJalrXUtnFEMI/K7MDENG/…"
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 pr-10 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500 transition-colors font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowKey((v) => !v)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                  >
                    {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Test + Save */}
      <section className="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-4">
        <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wide">Actions</h2>

        {/* Error / success banners */}
        {error && (
          <div className="flex items-center gap-2 px-4 py-3 bg-red-950/40 border border-red-800/40 rounded-lg text-sm text-red-300">
            <XCircle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}
        {saveMsg && (
          <div className="flex items-center gap-2 px-4 py-3 bg-green-950/40 border border-green-800/40 rounded-lg text-sm text-green-300">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            {saveMsg}
          </div>
        )}

        {/* Test result */}
        {(test === 'ok' || test === 'fail') && testMsg && (
          <div className={cn(
            'flex items-center gap-2 px-4 py-3 rounded-lg text-sm border',
            test === 'ok'
              ? 'bg-green-950/40 border-green-800/40 text-green-300'
              : 'bg-red-950/40 border-red-800/40 text-red-300'
          )}>
            {test === 'ok'
              ? <CheckCircle2 className="w-4 h-4 shrink-0" />
              : <XCircle className="w-4 h-4 shrink-0" />}
            {testMsg}
          </div>
        )}

        <div className="flex items-center gap-3">
          {/* Test connection */}
          <button
            onClick={handleTest}
            disabled={test === 'testing'}
            className="flex items-center gap-2 px-4 py-2.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-200 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
          >
            {test === 'testing' ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <FlaskConical className="w-4 h-4" />
            )}
            Test Connection
          </button>

          {/* Save */}
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 ml-auto"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            Save Configuration
          </button>
        </div>

        <p className="text-xs text-gray-600">
          Changes take effect immediately — no server restart required. The storage config is read from the
          database on each upload request (cached for 60 s).
        </p>
      </section>

      {/* Current status summary */}
      <section className="bg-gray-900/50 border border-gray-800/60 rounded-2xl p-5">
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Active Configuration</h2>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-gray-600">Driver</span>
            <span className={cn(
              'ml-auto px-2 py-0.5 rounded-full text-xs font-semibold',
              config.driver === 'local'
                ? 'bg-amber-500/20 text-amber-400'
                : 'bg-indigo-500/20 text-indigo-400'
            )}>
              {config.driver === 'local' ? 'Local Disk' : 'S3 / R2'}
            </span>
          </div>
          {config.driver === 's3' && (
            <>
              <div className="flex items-center gap-2">
                <span className="text-gray-600">Bucket</span>
                <span className="ml-auto text-gray-300 font-mono text-xs truncate max-w-32">{config.bucket || '—'}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-gray-600">Region</span>
                <span className="ml-auto text-gray-300 font-mono text-xs">{config.region || '—'}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-gray-600">CDN URL</span>
                <span className="ml-auto text-gray-300 text-xs truncate max-w-32">{config.publicUrl || '—'}</span>
              </div>
            </>
          )}
        </div>
      </section>
    </div>
  );
}

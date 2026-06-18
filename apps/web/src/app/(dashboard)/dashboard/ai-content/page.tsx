'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAiFeature } from '@/hooks/use-ai-status';
import { aiApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';
import { Sparkles, Loader2, Copy, Check } from 'lucide-react';

const CONTENT_TYPES = [
  { value: 'room_desc', label: 'Room Description' },
  { value: 'promo_email', label: 'Promotional Email' },
  { value: 'social_post', label: 'Social Media Post' },
  { value: 'offer_copy', label: 'Offer Copy' },
  { value: 'review_response', label: 'Review Response' },
];
const TONES = ['Luxury', 'Friendly', 'Formal', 'Playful'];

export default function AiContentPage() {
  const aiEnabled = useAiFeature('ai_content');
  const router = useRouter();

  const [contentType, setContentType] = useState('room_desc');
  const [details, setDetails] = useState('');
  const [tone, setTone] = useState('Friendly');
  const [language, setLanguage] = useState('en');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Hard gate: if AI is off (master OR tenant flag), this feature does not exist.
  if (!aiEnabled) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center text-gray-400">
        <Sparkles className="h-12 w-12 mb-3 text-gray-300" />
        <p className="font-semibold text-gray-600">AI features are not enabled</p>
        <p className="text-sm mt-1">Contact your administrator to enable AI content generation.</p>
        <Button variant="outline" className="mt-6" onClick={() => router.push('/dashboard')}>
          Back to Dashboard
        </Button>
      </div>
    );
  }

  async function generate() {
    if (details.trim().length < 3) {
      toast({ title: 'Add a few details first', variant: 'destructive' });
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const res = await aiApi.generateContent({ contentType, details, tone, language });
      setResult(res.data.data.content);
    } catch (e: any) {
      const code = e?.response?.data?.code;
      toast({
        title: code === 'AI_NOT_CONFIGURED' ? 'AI key not set up yet' : 'Generation failed',
        description: e?.response?.data?.error ?? e.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }

  function copyResult() {
    if (!result) return;
    navigator.clipboard.writeText(result);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="p-6 max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-black flex items-center gap-2">
          <Sparkles className="h-6 w-6 text-purple-600" />
          AI Content Generator
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Describe what you need — AI drafts it. Review before using anywhere.
        </p>
      </div>

      <div className="space-y-4 bg-white border border-gray-200 rounded-2xl p-5">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="text-sm font-semibold text-gray-700">Content Type</label>
            <select
              value={contentType}
              onChange={(e) => setContentType(e.target.value)}
              className="mt-1 w-full h-10 border border-gray-300 rounded-lg px-3 text-sm"
            >
              {CONTENT_TYPES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>
          <div>
            <label className="text-sm font-semibold text-gray-700">Tone</label>
            <select
              value={tone}
              onChange={(e) => setTone(e.target.value)}
              className="mt-1 w-full h-10 border border-gray-300 rounded-lg px-3 text-sm"
            >
              {TONES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="text-sm font-semibold text-gray-700">Language</label>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="mt-1 w-full h-10 border border-gray-300 rounded-lg px-3 text-sm"
            >
              <option value="en">English</option>
              <option value="bn">Bangla</option>
            </select>
          </div>
        </div>

        <div>
          <label className="text-sm font-semibold text-gray-700">Details / Brief</label>
          <textarea
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            rows={4}
            placeholder="e.g. Deluxe sea-view room, 40 sqm, private balcony, king bed, ideal for couples"
            className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none"
          />
        </div>

        <Button onClick={generate} disabled={loading} className="gap-2">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {loading ? 'Generating...' : 'Generate Draft'}
        </Button>
      </div>

      {result && (
        <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-gray-800">Draft</h2>
            <button onClick={copyResult} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-emerald-600">
              {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
          <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{result}</p>
          <p className="text-xs text-gray-400">This is a draft — review and edit before publishing.</p>
        </div>
      )}
    </div>
  );
}

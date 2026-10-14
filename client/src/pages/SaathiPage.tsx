import type { PhotoAi, SaathiCard, SaathiReply } from '@gavran/shared';
import { fieldValue, withField } from '@gavran/shared';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { Alert, Button, Card, Field, Input } from '@/components/ui';
import { api } from '@/lib/api';

type ChatReply = Extract<SaathiReply, { type: 'confirm' | 'ask' | 'answer' | 'denied' }>;
type Line = { role: 'user' | 'assistant'; text: string };

const ID_KEYS = new Set(['rowId', 'batchId', 'categoryId', 'itemId', 'customerId', 'sittingId', 'birdTypeId', 'shedId']);

function speak(text: string, lang: string) {
  if (!text || typeof window.speechSynthesis === 'undefined') return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = lang.startsWith('hi') ? 'hi-IN' : lang.startsWith('mr') ? 'mr-IN' : 'en-IN';
  window.speechSynthesis.speak(utterance);
}

function said(reply: ChatReply, t: (key: string, vars?: Record<string, string>) => string) {
  if (reply.type === 'denied') return t('saathi.denied');
  return t(reply.speechKey, reply.vars);
}

function ready(card: SaathiCard): boolean {
  const value = (key: string) => fieldValue(card, key).trim();
  if (card.action === 'eggs') return Boolean(value('collectedOn') && value('categoryId') && value('eggCount'));
  if (card.action === 'loss') return Boolean(value('occurredOn') && value('birdCount') && value('note'));
  if (card.action === 'dose') return Boolean(value('batchId') && value('rowId') && value('givenOn'));
  if (card.action === 'task') return Boolean(value('title') && value('dueOn'));
  if (card.action === 'feed') return Boolean(value('itemId') && value('quantity') && value('occurredOn'));
  if (card.action === 'sale') return Boolean(value('customerId') && value('orderedOn') && value('quantity') && value('unitPrice'));
  if (card.action === 'expense') return Boolean(value('occurredOn') && value('categoryId') && value('amount') && value('unitLabel'));
  const chicks = Number(value('liveChicks') || '0');
  return Boolean(value('sittingId') && value('hatchedOn') && value('liveChicks') && (chicks === 0 || (value('batchCode') && value('birdTypeId') && value('shedId'))));
}

export function SaathiPage() {
  const { farmId = '' } = useParams();
  const { t, i18n } = useTranslation();
  const [text, setText] = useState('');
  const [lines, setLines] = useState<Line[]>([]);
  const [pending, setPending] = useState<unknown>(null);
  const [card, setCard] = useState<SaathiCard | null>(null);
  const [listening, setListening] = useState(false);
  const [photo, setPhoto] = useState<{ url: string; ai: PhotoAi; matches: Array<{ title: string; sourceFile: string; sourcePage: number; howToGive: string; amountOnPage: boolean; label: string }>; id: string; kind: string } | null>(null);
  const [count, setCount] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const kindRef = useRef('eggs');
  const recorder = useRef<MediaRecorder | null>(null);
  const key = useQuery({ queryKey: ['saathi-key', farmId], queryFn: () => api<{ configured: boolean; hint: string }>(`/api/v1/farms/${farmId}/saathi/key`) });

  function pushAssistant(reply: ChatReply) {
    const sentence = said(reply, t);
    setLines((current) => [...current, { role: 'assistant', text: sentence }]);
    speak(sentence, i18n.language);
    setCard(reply.type === 'confirm' ? reply.card : null);
    setPending(reply.type === 'ask' ? reply.pending : null);
  }

  const send = useMutation({
    mutationFn: (utterance: string) => api<ChatReply>(`/api/v1/farms/${farmId}/saathi/propose`, { method: 'POST', json: { text: utterance, pending } }),
    onSuccess: (reply) => pushAssistant(reply),
  });

  const save = useMutation({
    mutationFn: (next: SaathiCard) => api(`/api/v1/farms/${farmId}/saathi/commit`, { method: 'POST', json: next, idempotencyKey: crypto.randomUUID() }),
    onSuccess: () => {
      const sentence = t('saathi.saved');
      setLines((current) => [...current, { role: 'assistant', text: sentence }]);
      speak(sentence, i18n.language);
      setCard(null);
      setPending(null);
    },
  });

  const upload = useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData();
      form.set('file', file);
      form.set('kind', kindRef.current);
      return api<{ id: string; kind: string; ai: PhotoAi; matches: Array<{ title: string; sourceFile: string; sourcePage: number; howToGive: string; amountOnPage: boolean; label: string }>; saved: false }>(
        `/api/v1/farms/${farmId}/saathi/photos`,
        { method: 'POST', form },
      );
    },
    onSuccess: (result, file) => {
      setPhoto({ url: URL.createObjectURL(file), ai: result.ai, matches: result.matches, id: result.id, kind: result.kind });
      setCount(result.ai.count === null ? '' : String(result.ai.count));
      const sentence = result.ai.unavailable ? t('saathi.photo.needKey') : result.ai.confidence < 0.6 ? t('saathi.ask.low') : t('saathi.photo.count', { n: String(result.ai.count ?? '') });
      setLines((current) => [...current, { role: 'assistant', text: sentence }]);
      speak(sentence, i18n.language);
    },
  });

  function submit(utterance: string) {
    const trimmed = utterance.trim();
    if (!trimmed) return;
    setLines((current) => [...current, { role: 'user', text: trimmed }]);
    setText('');
    send.mutate(trimmed);
  }

  function listen() {
    const host = window as Window & { SpeechRecognition?: new () => SpeechRec; webkitSpeechRecognition?: new () => SpeechRec };
    const Ctor = host.SpeechRecognition ?? host.webkitSpeechRecognition;
    if (!Ctor) {
      void recordFallback();
      return;
    }
    const rec = new Ctor();
    rec.lang = i18n.language.startsWith('hi') ? 'hi-IN' : i18n.language.startsWith('mr') ? 'mr-IN' : 'en-IN';
    rec.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript ?? '';
      setListening(false);
      if (transcript) submit(transcript);
    };
    rec.onerror = () => {
      setListening(false);
      void recordFallback();
    };
    setListening(true);
    rec.start();
  }

  async function recordFallback() {
    if (recorder.current) {
      recorder.current.stop();
      return;
    }
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const media = new MediaRecorder(stream);
    const chunks: Blob[] = [];
    media.ondataavailable = (event) => chunks.push(event.data);
    media.onstop = () => {
      stream.getTracks().forEach((track) => track.stop());
      recorder.current = null;
      setListening(false);
      const blob = new Blob(chunks, { type: media.mimeType || 'audio/webm' });
      const form = new FormData();
      form.set('file', blob, 'speech.webm');
      if (pending) form.set('pending', JSON.stringify(pending));
      void api<ChatReply>(`/api/v1/farms/${farmId}/saathi/audio`, { method: 'POST', form }).then((reply) => {
        setLines((current) => [...current, { role: 'user', text: t('saathi.mic') }]);
        pushAssistant(reply);
      });
    };
    recorder.current = media;
    setListening(true);
    media.start();
  }

  return (
    <div className="grid gap-4">
      <div>
        <h1 data-tour="screen-title" className="font-display text-3xl font-semibold">{t('saathi.title')}</h1>
        <p data-tour="screen-body" className="mt-1 text-ink-soft">{t('saathi.body')}</p>
      </div>
      {key.data && !key.data.configured ? <Alert>{t('saathi.photo.needKey')}</Alert> : null}
      <Card>
        <ul className="grid max-h-80 gap-2 overflow-auto">
          {lines.length === 0 ? <li className="text-ink-soft">{t('saathi.empty')}</li> : null}
          {lines.map((line, index) => (
            <li key={`${line.role}-${index}`} className={line.role === 'user' ? 'justify-self-end rounded-2xl bg-grove px-3 py-2 text-white' : 'rounded-2xl bg-paper px-3 py-2'}>
              {line.text}
            </li>
          ))}
        </ul>
        <form
          className="mt-3 flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            submit(text);
          }}
        >
          <Input value={text} onChange={(event) => setText(event.target.value)} placeholder={t('saathi.placeholder')} aria-label={t('saathi.placeholder')} />
          <Button type="submit" disabled={send.isPending}>{t('saathi.send')}</Button>
          <Button type="button" data-tour="screen-action" onClick={listen}>{listening ? t('saathi.listening') : t('saathi.mic')}</Button>
        </form>
        {send.isError || upload.isError ? <Alert>{t('common.errorGeneric')}</Alert> : null}
      </Card>
      {card ? (
        <Card>
          <h2 className="font-display text-2xl">{t('saathi.confirm')}</h2>
          <p className="mt-1 text-sm text-ink-soft">{t('saathi.confidence', { percent: String(Math.round(card.confidence * 100)) })}</p>
          <div className="mt-3 grid gap-3">
            {card.fields.filter((field) => card.choices[field.key] || !ID_KEYS.has(field.key)).map((field) => (
              <Field key={field.key} id={`saathi-${field.key}`} label={t(`saathi.field.${field.key}`)}>
                {card.choices[field.key] ? (
                  <select
                    id={`saathi-${field.key}`}
                    className="min-h-11 w-full rounded-xl border border-line bg-white px-3"
                    value={field.value}
                    onChange={(event) => setCard(withField(card, field.key, event.target.value))}
                  >
                    <option value="">{t('saathi.pick')}</option>
                    {card.choices[field.key]?.map((choice) => (
                      <option key={choice.id} value={choice.id}>{choice.label}</option>
                    ))}
                  </select>
                ) : (
                  <Input id={`saathi-${field.key}`} value={field.value} onChange={(event) => setCard(withField(card, field.key, event.target.value))} />
                )}
              </Field>
            ))}
          </div>
          <Button type="button" className="mt-3" disabled={!ready(card) || save.isPending} onClick={() => save.mutate(card)}>
            {t('saathi.save')}
          </Button>
          {save.isError ? <Alert>{t('common.errorGeneric')}</Alert> : null}
        </Card>
      ) : null}
      <Card>
        <h2 className="font-display text-2xl">{t('saathi.photoTitle')}</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {(['eggs', 'chicks', 'bird', 'sick'] as const).map((kind) => (
            <Button
              key={kind}
              type="button"
              onClick={() => {
                kindRef.current = kind;
                fileRef.current?.click();
              }}
            >
              {t(`saathi.photo.${kind}`)}
            </Button>
          ))}
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) upload.mutate(file);
          }}
        />
        {photo ? (
          <div className="mt-3 grid gap-3">
            <div className="relative inline-block max-w-full">
              <img src={photo.url} alt="" className="max-h-80 rounded-xl" />
              {photo.ai.boxes.map((box, index) => (
                <span
                  key={index}
                  className="absolute border-2 border-red-600"
                  style={{ left: `${box.x * 100}%`, top: `${box.y * 100}%`, width: `${box.w * 100}%`, height: `${box.h * 100}%` }}
                />
              ))}
            </div>
            <p className="text-sm">{t('saathi.confidence', { percent: String(Math.round(photo.ai.confidence * 100)) })}</p>
            {photo.ai.ageRange ? <p>{t('saathi.age', { range: photo.ai.ageRange })}</p> : null}
            {photo.kind === 'eggs' || photo.kind === 'chicks' ? (
              <form
                className="flex gap-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  void api(`/api/v1/farms/${farmId}/saathi/photos/${photo.id}`, { method: 'PATCH', json: { count: count === '' ? null : Number(count) } });
                  submit(photo.kind === 'eggs' ? `collected ${count} eggs today` : `${count} chicks hatched today`);
                }}
              >
                <Field id="saathi-photo-count" label={t('saathi.photo.countLabel')}>
                  <Input id="saathi-photo-count" inputMode="numeric" value={count} onChange={(event) => setCount(event.target.value)} />
                </Field>
                <Button type="submit">{t('saathi.confirm')}</Button>
              </form>
            ) : null}
            {photo.matches.length === 0 && (photo.kind === 'sick' || photo.kind === 'bird') ? <p>{t('saathi.notInBook')}</p> : null}
            <ul className="grid gap-2">
              {photo.matches.map((match) => (
                <li key={`${match.sourceFile}-${match.sourcePage}-${match.title}`} className="rounded-xl border border-line p-3 text-sm">
                  <p className="font-semibold">{match.title}</p>
                  <p>{match.sourcePage > 0 ? `${match.sourceFile} ${t('saathi.page', { page: String(match.sourcePage) })}` : match.sourceFile}</p>
                  <p>{match.amountOnPage ? match.howToGive : t('saathi.noAmount')}</p>
                  <p className="font-semibold">{t('saathi.vet')}</p>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </Card>
    </div>
  );
}

type SpeechRec = {
  lang: string;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: (() => void) | null;
  start: () => void;
};

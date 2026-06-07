import express, { Request, Response } from 'express';
import * as dotenv from 'dotenv';
import { normalizeStructuredEvents, NightLogParsed } from './dataLoader';
import { deriveNightDate } from './utils';
import { parseNightLog } from './nightLogParser';
import { generateReport, reportToHTML } from './reportBuilder';
import { buildNightShifts, getAllNights } from './reconciler';
import { logger } from './logger';
import { HandoverReport } from './types';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config();

const app = express();
app.use(express.json({ limit: '2mb' }));

const PORT = process.env.PORT || 3000;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';

// Load raw data for the demo
const EVENTS_DATA = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../data/events.json'), 'utf-8')
);

// In-memory event store (production would be PostgreSQL)
let eventsCache: ReturnType<typeof normalizeStructuredEvents> | null = null;

function getEvents() {
  if (!eventsCache) {
    eventsCache = normalizeStructuredEvents(EVENTS_DATA);
  }
  return eventsCache;
}

// POST /api/handover — generate handover for a specific night
// Body: { nightLogText?: string, targetNight?: string, hotelId?: string }
app.post('/api/handover', async (req, res) => {
  const { nightLogText, targetNight, hotelId = 'lumen-sg' } = req.body;
  const cid = logger.newId();

  if (!OPENAI_API_KEY) {
    res.status(500).json({ error: 'OPENAI_API_KEY not configured' });
    return;
  }

  if (!targetNight) {
    res.status(400).json({ error: 'targetNight is required (YYYY-MM-DD)' });
    return;
  }

  logger.info('Handover request received', { hotelId, targetNight }, cid);

  try {
    // 1. Start with structured events
    let allEvents = getEvents();

    // 2. If night log text provided, parse it and merge
    if (nightLogText) {
      const parsed = await parseNightLog(nightLogText, OPENAI_API_KEY);
      const nightLogEvents = parsed.events.map((e, i) => ({
        id: `nl_${Date.now()}_${i}`,
        timestamp: e.timestamp,
        type: e.type as import('./types').HotelEvent['type'],
        room: e.room ?? null,
        guest: e.guest ?? null,
        description: e.description,
        status: e.status as import('./types').HotelEvent['status'],
        source: 'night_log' as const,
        night: deriveNightDate(e.timestamp),
        flagged: e.flagged ?? false,
        flagReason: e.flagReason,
      }));
      allEvents = [...allEvents, ...nightLogEvents];
    }

    // Sort by timestamp
    allEvents.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    // 3. Build and return the report
    const report = generateReport(allEvents, hotelId, EVENTS_DATA.hotel.name, targetNight);

    logger.info('Handover report built', {
      hotelId,
      targetNight,
      issues: report.summary.totalIssues,
      contradictions: report.contradictions.length,
    }, cid);

    res.json(report);
  } catch (err) {
    logger.error('Handover generation failed', { error: String(err) }, cid);
    res.status(500).json({ error: 'Handover generation failed', details: String(err) });
  }
});

// GET /api/handover?night=YYYY-MM-DD&hotelId=lumen-sg — JSON output
app.get('/api/handover', async (req, res) => {
  const targetNight = req.query.night as string;
  const hotelId = (req.query.hotelId as string) || 'lumen-sg';
  if (!targetNight) {
    res.status(400).json({ error: 'night query param required (YYYY-MM-DD)' });
    return;
  }

  const cid = logger.newId();
  const events = getEvents();
  const report = generateReport(events, hotelId, EVENTS_DATA.hotel.name, targetNight);
  logger.info('Handover report built', { hotelId, targetNight, issues: report.summary.totalIssues }, cid);
  res.json(report);
});

// GET /api/handover.html?night=YYYY-MM-DD&hotelId=lumen-sg — HTML output
app.get('/api/handover.html', async (req, res) => {
  const targetNight = req.query.night as string;
  const hotelId = (req.query.hotelId as string) || 'lumen-sg';
  if (!targetNight) {
    res.status(400).send('night query param required (YYYY-MM-DD)');
    return;
  }

  const cid = logger.newId();
  const events = getEvents();
  const report = generateReport(events, hotelId, EVENTS_DATA.hotel.name, targetNight);
  logger.info('Handover report built', { hotelId, targetNight, issues: report.summary.totalIssues }, cid);
  const html = reportToHTML(report);
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(html);
});

// GET /api/nights — list available nights
app.get('/api/nights', (req, res) => {
  const events = getEvents();
  const nights = getAllNights(events);
  res.json({ nights });
});

// GET /api/events — raw event list (for debugging)
app.get('/api/events', (req, res) => {
  const events = getEvents();
  res.json(events.map(e => ({
    id: e.id,
    timestamp: e.timestamp,
    type: e.type,
    room: e.room,
    status: e.status,
    night: e.night,
  })));
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  logger.info(`Vouch Handover service running on port ${PORT}`);
});

export default app;
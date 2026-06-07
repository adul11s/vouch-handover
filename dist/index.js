"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const dotenv = __importStar(require("dotenv"));
const dataLoader_1 = require("./dataLoader");
const utils_1 = require("./utils");
const nightLogParser_1 = require("./nightLogParser");
const reportBuilder_1 = require("./reportBuilder");
const reconciler_1 = require("./reconciler");
const logger_1 = require("./logger");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
dotenv.config();
const app = (0, express_1.default)();
app.use(express_1.default.json({ limit: '2mb' }));
const PORT = process.env.PORT || 3000;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
// Load raw data for the demo
const EVENTS_DATA = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/events.json'), 'utf-8'));
// In-memory event store (production would be PostgreSQL)
let eventsCache = null;
function getEvents() {
    if (!eventsCache) {
        eventsCache = (0, dataLoader_1.normalizeStructuredEvents)(EVENTS_DATA);
    }
    return eventsCache;
}
// POST /api/handover — generate handover for a specific night
// Body: { nightLogText?: string, targetNight?: string, hotelId?: string }
app.post('/api/handover', async (req, res) => {
    const { nightLogText, targetNight, hotelId = 'lumen-sg' } = req.body;
    const cid = logger_1.logger.newId();
    if (!OPENAI_API_KEY) {
        res.status(500).json({ error: 'OPENAI_API_KEY not configured' });
        return;
    }
    if (!targetNight) {
        res.status(400).json({ error: 'targetNight is required (YYYY-MM-DD)' });
        return;
    }
    logger_1.logger.info('Handover request received', { hotelId, targetNight }, cid);
    try {
        // 1. Start with structured events
        let allEvents = getEvents();
        // 2. If night log text provided, parse it and merge
        if (nightLogText) {
            const parsed = await (0, nightLogParser_1.parseNightLog)(nightLogText, OPENAI_API_KEY);
            const nightLogEvents = parsed.events.map((e, i) => ({
                id: `nl_${Date.now()}_${i}`,
                timestamp: e.timestamp,
                type: e.type,
                room: e.room ?? null,
                guest: e.guest ?? null,
                description: e.description,
                status: e.status,
                source: 'night_log',
                night: (0, utils_1.deriveNightDate)(e.timestamp),
                flagged: e.flagged ?? false,
                flagReason: e.flagReason,
            }));
            allEvents = [...allEvents, ...nightLogEvents];
        }
        // Sort by timestamp
        allEvents.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
        // 3. Build and return the report
        const report = (0, reportBuilder_1.generateReport)(allEvents, hotelId, EVENTS_DATA.hotel.name, targetNight);
        logger_1.logger.info('Handover report built', {
            hotelId,
            targetNight,
            issues: report.summary.totalIssues,
            contradictions: report.contradictions.length,
        }, cid);
        res.json(report);
    }
    catch (err) {
        logger_1.logger.error('Handover generation failed', { error: String(err) }, cid);
        res.status(500).json({ error: 'Handover generation failed', details: String(err) });
    }
});
// GET /api/handover?night=YYYY-MM-DD&hotelId=lumen-sg — JSON output
app.get('/api/handover', async (req, res) => {
    const targetNight = req.query.night;
    const hotelId = req.query.hotelId || 'lumen-sg';
    if (!targetNight) {
        res.status(400).json({ error: 'night query param required (YYYY-MM-DD)' });
        return;
    }
    const cid = logger_1.logger.newId();
    const events = getEvents();
    const report = (0, reportBuilder_1.generateReport)(events, hotelId, EVENTS_DATA.hotel.name, targetNight);
    logger_1.logger.info('Handover report built', { hotelId, targetNight, issues: report.summary.totalIssues }, cid);
    res.json(report);
});
// GET /api/handover.html?night=YYYY-MM-DD&hotelId=lumen-sg — HTML output
app.get('/api/handover.html', async (req, res) => {
    const targetNight = req.query.night;
    const hotelId = req.query.hotelId || 'lumen-sg';
    if (!targetNight) {
        res.status(400).send('night query param required (YYYY-MM-DD)');
        return;
    }
    const cid = logger_1.logger.newId();
    const events = getEvents();
    const report = (0, reportBuilder_1.generateReport)(events, hotelId, EVENTS_DATA.hotel.name, targetNight);
    logger_1.logger.info('Handover report built', { hotelId, targetNight, issues: report.summary.totalIssues }, cid);
    const html = (0, reportBuilder_1.reportToHTML)(report);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
});
// GET /api/nights — list available nights
app.get('/api/nights', (req, res) => {
    const events = getEvents();
    const nights = (0, reconciler_1.getAllNights)(events);
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
    logger_1.logger.info(`Vouch Handover service running on port ${PORT}`);
});
exports.default = app;

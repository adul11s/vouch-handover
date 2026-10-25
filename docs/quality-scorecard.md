# Quality Scorecard — vouch-handover

| Dimensi | Bobot | Skor | Bukti |
|---|---|---|---|
| Narasi masalah | 10% | 8 | README#what-it-does — handover lintas shift hotel dengan grounding event ID; masalah nyata tapi demo data sintetis |
| Demo & reproduksibilitas | 15% | 7 | `npm ci` → build → start; contoh output JSON/HTML nyata di README. Docker DIHAPUS (tidak bisa diverifikasi di mesin ini); tidak ada video |
| Kebenaran & test | 20% | 7 | 6 test reconciler (vitest, lintas-midnight/still_open/newly_resolved/injection), 6/6 hijau di CI; eval harness P=1.00 R=0.923. Satu bug data-loss (reopened issue) ditemukan & didokumentasikan, belum diperbaiki |
| Arsitektur & keputusan | 15% | 8 | DECISIONS.md lengkap; reconciler registry jelas; end-to-end sources di setiap item |
| Keamanan | 10% | 7 | Prompt-injection defense nightLogParser + test flag injection; kili: flags tidak bisa masuk via structured events, tidak ada authZ test |
| Operasional | 10% | 6 | CI hijau; health endpoint; skor rendah karena biaya/latensi per request = TODO (tanpa API key), tidak ada metrics/dashboards |
| Kerapian kode | 10% | 7 | strict tsc lolos; korupsi kecil: room-specific "contradiction 312" hardcode, logger correlationId sering 'unknown' |
| Presentasi | 10% | 7 | README dengan output nyata; tidak ada video/GIF, contoh HTML hanya snippet |

**Total:** 7.15
**Target berikutnya:** perbaiki thread reopened-issue (kebenaran), footgun contradiction hardcode (arsitektur), ukur biaya/latensi AI nyata (operasional).
**Tanggal review:** 2026-10-25

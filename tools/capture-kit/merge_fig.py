#!/usr/bin/env python3
"""Merge verified figure records (agents, keyed to v1 ids) onto the re-rendered manifest by page + bbox overlap."""
import json, glob, re, fitz
M = json.load(open('out/manifest.json')); V1 = {m['id']: m for m in json.load(open('figv/manifest_v1.json'))}
AG = {}
for g in sorted(glob.glob('figv/out/G*.json')):
    for r in json.load(open(g))['figures']: AG[r['id']] = r
missing = [x for g in sorted(glob.glob('figv/out/G*.json')) for x in json.load(open(g)).get('missing_figures', [])]
STALE = re.compile(r'flip|upside|rotated|scrambl|strip|stitched|180|orientation|mirror', re.I)

def iou(a, b):
    A, B = fitz.Rect(a), fitz.Rect(b); i = (A & B).get_area()
    return i / max(1e-6, min(A.get_area(), B.get_area()))

unmatched = []; low = 0
for m in M:
    best, bs = None, 0
    for o in V1.values():
        if o['pdf_page'] != m['pdf_page']: continue
        s = iou(m['bbox_pt'], o['bbox_pt'])
        if s > bs: best, bs = o, s
    if not best or bs < 0.5 or best['id'] not in AG:
        unmatched.append(m['id']); continue
    r = AG[best['id']]
    m['v1_id'] = best['id']
    m['kind'] = r.get('kind')
    m['alt'] = r.get('alt')
    if r.get('caption_fix'):
        m['caption_regex'] = m['caption']; m['caption'] = r['caption_fix']; m['caption_source'] = 'visual check'
    else:
        m['caption_source'] = 'heading context'
    m['callouts'] = [dict(n=str(c['n']), label=c.get('label')) for c in r.get('callouts', [])]
    m['callout_confidence'] = r.get('callout_confidence')
    m['notes'] = [n for n in m['notes'] if 'derived from heading' not in n]
    if m['caption_source'] == 'heading context': m['notes'].append('caption derived from heading context; no printed figure caption')
    for n in r.get('notes', []):
        if not STALE.search(n): m['notes'].append(n)
    ci = r.get('crop_issue')
    if ci and not STALE.search(ci): m['notes'].append('crop: ' + ci)
    nulls = sum(1 for c in m['callouts'] if c['label'] is None)
    m['needs_review'] = bool((r.get('callout_confidence') or 1) < 0.8 or nulls or (ci and not STALE.search(ci)))
    m['confidence'] = round(min(0.95, r.get('callout_confidence') or 0.9), 2)
    m.pop('legend_lines', None)
# overlap notes
by = {}
for m in M: by.setdefault(m['pdf_page'], []).append(m)
for pg, ms in by.items():
    for a in ms:
        for b in ms:
            if a is not b and (fitz.Rect(a['bbox_pt']) & fitz.Rect(b['bbox_pt'])).get_area() > 40:
                a['notes'].append(f"overlaps {b['id']} on the page; edge fragments (callout letters) of the neighbour can appear")
for m in M: m['notes'] = list(dict.fromkeys(m['notes']))
json.dump(M, open('out/manifest.json', 'w'), indent=1)
json.dump(missing, open('out/missing_figures.json', 'w'), indent=1)
print('figures', len(M), 'unmatched', unmatched, 'needs_review', sum(1 for m in M if m.get('needs_review')))
print('with callouts', sum(1 for m in M if m['callouts']), 'null-label callouts', sum(1 for m in M for c in m['callouts'] if c['label'] is None))
print('caption from visual check', sum(1 for m in M if m.get('caption_source') == 'visual check'))

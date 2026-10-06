"""Bind later semantic diagnostics to their current reports, without rescoring outputs."""
import hashlib, json, pathlib
root = pathlib.Path(__file__).resolve().parents[2]
names = ['conditional-cpu-im-summary', 'conditional-status-transfer', 'summary-single-transfer', 'summary-single-extra']
rows = []
for name in names:
    stem = 'docs/evaluations/2026-10-05-' + name
    report_path = root / (stem + '.json')
    review_path = root / (stem + '.md')
    report = json.loads(report_path.read_text())
    assert report['status'] == 'completed'
    assert report['results']
    assert review_path.exists()
    assert all(r['previewCount'] == 0 for r in report['results'])
    applied = [r for r in report['results'] if not r['documentUnchanged']]
    assert all(r.get('undoExact') and r.get('redoExact') for r in applied)
    rows.append({
        'report': stem + '.json', 'reportSHA256': hashlib.sha256(report_path.read_bytes()).hexdigest(),
        'review': stem + '.md', 'reviewSHA256': hashlib.sha256(review_path.read_bytes()).hexdigest(),
        'modelId': report['modelId'], 'results': len(report['results']),
        'languages': sorted({r['language'] for r in report['results']}),
        'variants': report['variants'], 'nativeApplied': len(applied),
        'qualityAccepted': False, 'futureHeldoutEligible': False,
    })
print(json.dumps({'scope': 'Supplement to the earlier writing-model decision index. Existing observed diagnostic reports, not a new evaluation or model ranking.',
                  'rows': rows, 'defaultPromotionAccepted': False,
                  'nextGate': 'Freeze a revised general candidate before inference; evaluate other unused sources, operations and languages. Separate relational fidelity, form and native editing outcomes.'}, ensure_ascii=False, indent=2))

export const STYLE = `
:root{color-scheme:dark;--ink:#f0efec;--ink2:#c3c2b7;--muted:#898781;--line:#2c2c2a;--card:#111110;--chart:#1a1a19;--good:#0ca30c;--warn:#fab219;--bad:#d03b3b}
*{box-sizing:border-box}
body{margin:0;background:#000;color:var(--ink);font:15px/1.55 system-ui,-apple-system,"Segoe UI",sans-serif}
main{max-width:1180px;margin:0 auto;padding:24px 16px 80px}
h1{font-size:26px;margin:0 0 4px}
h2{font-size:20px;margin:44px 0 10px;padding-top:12px;border-top:1px solid var(--line)}
h3{font-size:16px;margin:26px 0 8px;color:var(--ink)}
p,li{color:var(--ink2);max-width:80ch}
strong{color:var(--ink)}
code{font:13px ui-monospace,SFMono-Regular,Menlo,monospace;background:#1a1a19;padding:1px 5px;border-radius:4px;color:var(--ink)}
pre{background:#111110;border:1px solid var(--line);border-radius:8px;padding:12px;overflow-x:auto;font:13px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace}
.muted{color:var(--muted)}
.meta{color:var(--muted);font-size:13px}
.tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:10px;margin:18px 0}
.tile{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:12px 14px}
.tile b{display:block;font-size:24px;color:var(--ink);font-weight:600}
.tile span{color:var(--muted);font-size:13px}
.finding{background:var(--card);border:1px solid var(--line);border-left:3px solid var(--muted);border-radius:8px;padding:10px 14px;margin:10px 0}
.finding.bad{border-left-color:var(--bad)}.finding.warn{border-left-color:var(--warn)}.finding.good{border-left-color:var(--good)}
.finding h4{margin:0 0 4px;font-size:15px}
.finding p{margin:4px 0}
.tag{display:inline-block;font-size:11px;font-weight:600;letter-spacing:.04em;text-transform:uppercase;padding:1px 7px;border-radius:99px;margin-right:6px;vertical-align:1px}
.tag.bad{background:#d03b3b;color:#fff}.tag.warn{background:#fab219;color:#0b0b0b}.tag.good{background:#0ca30c;color:#fff}.tag.info{background:#383835;color:var(--ink)}
figure{margin:14px 0;background:var(--chart);border:1px solid var(--line);border-radius:10px;padding:12px}
figcaption{font-size:14px;font-weight:600;margin-bottom:8px;color:var(--ink)}
svg{width:100%;height:auto;display:block;overflow:visible}
svg .axis text{fill:var(--muted);font-size:11px;font-variant-numeric:tabular-nums}
.legend{display:flex;flex-wrap:wrap;gap:6px 14px;font-size:12px;color:var(--ink2);margin-bottom:6px}
.legend i{display:inline-block;width:10px;height:10px;border-radius:2px;margin-right:5px;vertical-align:-1px}
.grid2{display:grid;grid-template-columns:repeat(auto-fit,minmax(440px,1fr));gap:12px}
.multiples{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:10px}
.multiples figure{margin:0;padding:8px}
.multiples figcaption{font-size:12px}
.scroll{overflow-x:auto}
table{border-collapse:collapse;font-size:13px;font-variant-numeric:tabular-nums}
table.heat th,table.heat td{padding:8px 10px;border:2px solid var(--chart);text-align:center;white-space:nowrap}
table.heat td{border-radius:6px;min-width:96px;font-weight:600}
table.heat td.empty{color:var(--muted);background:#111110;font-weight:400}
table.heat th{color:var(--ink2);font-weight:500}
table.heat th.corner{color:var(--muted);font-size:11px;font-weight:400;text-align:left}
table.data{width:100%}
table.data th,table.data td{padding:5px 8px;border-bottom:1px solid var(--line);text-align:right;white-space:nowrap}
table.data th:first-child,table.data td:first-child{text-align:left}
table.data th{color:var(--muted);font-weight:500;position:sticky;top:0;background:#000}
details{margin:12px 0}
summary{cursor:pointer;color:var(--ink);font-weight:600}
.bars{display:flex;flex-direction:column;gap:6px}
.bar{display:grid;grid-template-columns:minmax(140px,300px) 1fr minmax(120px,auto);gap:10px;align-items:center;font-size:12px}
.bar-label{color:var(--ink2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.bar-track{background:#111110;border-radius:4px;height:14px}
.bar-fill{display:block;height:14px;border-radius:0 4px 4px 0}
.bar-value{color:var(--ink);font-variant-numeric:tabular-nums}
nav.toc{font-size:13px;display:flex;flex-wrap:wrap;gap:6px 14px;margin:12px 0}
nav.toc a{color:#9dc5f5;text-decoration:none}
@media (max-width:640px){.grid2{grid-template-columns:1fr}.bar{grid-template-columns:1fr;gap:2px}h1{font-size:22px}}
`;

export const shell = (title: string, body: string) => `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><style>${STYLE}</style></head>
<body><main>${body}</main></body></html>`;

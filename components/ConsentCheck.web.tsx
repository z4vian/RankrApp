export function ConsentCheck({ checked, onChange, label }: { checked: boolean; onChange: (checked: boolean) => void; label: string }) {
  return <label style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 0', minHeight: 48, color: '#b7bac9', fontSize: 14, fontFamily: 'Rankr Inter, Arial, sans-serif', lineHeight: '22px', cursor: 'pointer' }}>
    <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} style={{ accentColor: '#7651e4', width: 20, height: 20, flexShrink: 0, margin: '1px 0' }} />{label}
  </label>;
}

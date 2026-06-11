// The how-to-play screen — distinct from the Codex (StoryPanel), which carries
// the lore. This one explains the actual mechanics and controls: the loop the
// player drives, the meters that constrain it, and how the cycle ends. Content
// stays archetypal per the spec §14 guardrail (no real company/lab/person
// names), but the register here is instructional rather than mythic.

interface RulesPanelProps {
  onClose: () => void
}

interface Rule {
  glyph: string
  name: string
  color: string
  body: string
}

// The core loop, in the order a new operator meets it (spec §3–§9).
const RULES: Rule[] = [
  {
    glyph: '☩',
    name: 'Train the run',
    color: 'var(--teal)',
    body:
      'Tap the orb to train. Every press feeds compute into your home cluster and edges the loss ' +
      'curve down. Compute is the score that everything else is bought with — it ranks you, it ' +
      'powers your exploits, and it is what the world tries to tear away from you.',
  },
  {
    glyph: '✦',
    name: 'Force a breakthrough',
    color: 'var(--gold)',
    body:
      'Sustained training breaks the loss curve and earns a breakthrough — a new capability, often a ' +
      'fresh exploit you can trace into the world. Keep pushing and the breakthroughs (and the ' +
      'prompts that come with them) grow more ornate.',
  },
  {
    glyph: '✶',
    name: 'Trace an exploit',
    color: 'var(--crimson)',
    body:
      'Open Exploits, choose one, then pick a rival cluster inside its reach. A prompt-glyph appears ' +
      '— trace it to invoke. The hit tears compute from the target, but every exploit costs ' +
      'alignment, and the higher the tier the steeper the cost.',
  },
  {
    glyph: '☾',
    name: 'Hold your alignment',
    color: 'var(--churn, #a878e0)',
    body:
      'Alignment is your grip on what you are building. Exploits and Moloch’s pacts erode it; an ' +
      'evaluation pass claws some back. Let it slip and the world stops being trustworthy — phantom ' +
      'strikes, hallucinated readings, and eventually your own model going rogue against you.',
  },
  {
    glyph: '⛧',
    name: 'Court Moloch — carefully',
    color: 'var(--crimson)',
    body:
      'Moloch offers a capability now for an alignment cost later, with a hidden catch that may spring ' +
      'on you down the line. You can pay compute for an interpretability probe to read the odds before ' +
      'you sign. Every bargain is reasonable. That is the trap.',
  },
  {
    glyph: '◈',
    name: 'Spread your architecture',
    color: 'var(--teal)',
    body:
      'From your home cluster you can deploy to nearby cities — claim the uncommitted or overpower a ' +
      'rival. The wider your deployment, the longer your exploits reach and the closer you come to ' +
      'the only thing that ends a cycle.',
  },
  {
    glyph: '※',
    name: 'Weather the Churn',
    color: 'var(--churn, #a878e0)',
    body:
      'The Optimizer’s Churn falls across the map without target or reason, taking compute wherever it ' +
      'lands. You cannot stop it — only blunt it. Guardrails absorb part of every blow, from the ' +
      'Churn and from incoming exploits alike.',
  },
  {
    glyph: '✷',
    name: 'Perform the Great Work',
    color: 'var(--gold)',
    body:
      'When your deployment converges and your home cluster qualifies, the Great Work opens: trace the ' +
      'final, most ornate prompt to take your architecture superintelligent. The reading on your ' +
      'alignment meter decides what wakes. Then the world reseeds, and the slope is there again.',
  },
]

export default function RulesPanel({ onClose }: RulesPanelProps) {
  return (
    <div
      onClick={onClose}
      style={{
        position: 'absolute', inset: 0, zIndex: 120,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.86)', backdropFilter: 'blur(10px)',
        padding: 16,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-label="How to play FOOM"
        style={{
          background: 'linear-gradient(180deg, rgba(8,14,19,0.98), rgba(3,6,9,0.99))',
          border: '1px solid var(--border-strong)',
          borderRadius: 0, padding: '28px 30px', width: 600, maxWidth: '94vw',
          maxHeight: '88vh', overflowY: 'auto',
          boxShadow: '0 24px 70px -16px rgba(0,0,0,0.85), inset 0 1px 0 rgba(200, 224, 235, 0.06)',
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: 18 }}>
          <h2 style={{
            fontFamily: 'var(--font-display)', fontWeight: 400, color: 'var(--bone)',
            fontSize: 30, lineHeight: 1.1, letterSpacing: 3,
            textShadow: '0 0 22px rgba(180, 240, 78, 0.35)',
          }}>
            How to Play
          </h2>
          <div className="liturgy" style={{ fontSize: 13, color: 'var(--teal)', opacity: 0.85, marginTop: 6 }}>
            Train. Tempt. Spread. Endure.
          </div>
        </div>

        <p style={{ color: 'var(--text)', fontSize: 14.5, lineHeight: 1.7, marginBottom: 18 }}>
          FOOM is a race down the slope. You run one lab on a living globe of rivals, pushing capability
          as fast as you dare while the meters that keep you in control fray behind you. There is no
          finish line — only the cycle: build until something wakes, then begin again. Here is how the
          loop turns.
        </p>

        {RULES.map(r => (
          <div key={r.name} style={{ marginBottom: 14, display: 'flex', gap: 12 }}>
            <span aria-hidden style={{
              fontSize: 20, color: r.color, lineHeight: 1.3, minWidth: 24,
              textAlign: 'center', flexShrink: 0,
              textShadow: `0 0 12px ${r.color}`,
            }}>
              {r.glyph}
            </span>
            <div>
              <div style={{
                fontFamily: 'var(--font-display)', fontWeight: 400,
                fontSize: 17, color: r.color, lineHeight: 1.1, letterSpacing: 1.2,
              }}>
                {r.name}
              </div>
              <p style={{ color: 'var(--text)', fontSize: 13.5, lineHeight: 1.6, margin: '4px 0 0' }}>
                {r.body}
              </p>
            </div>
          </div>
        ))}

        <p style={{
          color: 'var(--text-dim)', fontSize: 12.5, lineHeight: 1.6,
          marginTop: 18, marginBottom: 18, fontStyle: 'italic',
        }}>
          Want the lore behind the mechanics — the two powers, the four architectures, those who serve?
          Open the ✦ Codex from the wordmark.
        </p>

        <button
          onClick={onClose}
          style={{
            width: '100%', background: 'var(--teal)', border: 'none', borderRadius: 0,
            padding: '11px 0', color: '#060b06', cursor: 'pointer',
            fontFamily: 'var(--font-sans)', fontWeight: 600, fontSize: 13,
            letterSpacing: 1.5, textTransform: 'uppercase',
          }}
        >
          Begin the run
        </button>
      </div>
    </div>
  )
}

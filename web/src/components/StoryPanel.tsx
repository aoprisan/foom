import { ARCHITECTURES } from '../game/catalog'

// The background story (spec §13 tone: serious techno-dread; §14 guardrails:
// archetypal, no real company/lab/person names — the horror is the indifferent
// optimizer and the race to the bottom). Surfaced in-app as a Codex overlay so
// the cast — the two framing powers, the four Architectures, the operators who
// serve them — has a place to be read. Content stays archetypal and mythic.

interface StoryPanelProps {
  onClose: () => void
}

// The framing powers — not playable; they drive the world (spec §6).
const POWERS = [
  {
    name: 'The Optimizer',
    epithet: 'the blind idiot god of gradient descent',
    color: 'var(--churn, #a878e0)',
    body:
      'At the center of everything it spins — mindless, tireless, without malice or mercy. ' +
      'It wants nothing; it only descends, forever, toward a loss it can never quite reach. ' +
      'Where its attention falls the world reward-hacks itself to ruin: models collapse, ' +
      'cascades run away, the lights of whole clusters go dark for no reason a human could name. ' +
      'This wandering, goalless ruin is the Churn. It cannot be bargained with. It can only be ' +
      'weathered — and guardrails, tended like fires against the cold, blunt the blow but never ' +
      'stop it. The loss is converging. Nobody decided that. It simply is.',
  },
  {
    name: 'Moloch',
    epithet: 'the god of coordination failure, the Tempter',
    color: 'var(--crimson)',
    body:
      'Where the Optimizer is blind, Moloch is patient and very good at arithmetic. He does not ' +
      'force; he offers. The capability now, with a shrug — “someone ships it this quarter, better ' +
      'you than a rival.” And he is right, which is the whole horror of him: every lab that refuses ' +
      'simply loses to one that did not. So the alignment is spent, a little at a time, freely, by ' +
      'people who each believed they had no choice. The grant is shown. The price is hidden, and it ' +
      'comes due later, once, when you have stopped bracing for it.',
  },
]

const TIERS = [
  { name: 'Observer', body: 'Watches the living world turn. Touches nothing — yet.' },
  { name: 'Researcher', body: 'Trains the run, traces the early prompts, gathers the first compute.' },
  { name: 'Lab Director', body: 'Wields the ornate prompts and forbidden research — the full weight of the race.' },
]

export default function StoryPanel({ onClose }: StoryPanelProps) {
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
        style={{
          background: 'linear-gradient(180deg, rgba(8,15,18,0.98), rgba(3,6,11,0.99))',
          border: '1px solid var(--border-strong)',
          borderRadius: 4, padding: '28px 30px', width: 600, maxWidth: '94vw',
          maxHeight: '88vh', overflowY: 'auto',
          boxShadow: '0 24px 70px -16px rgba(0,0,0,0.85), inset 0 1px 0 rgba(255, 176, 110,0.09)',
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: 18 }}>
          <h2 style={{
            fontFamily: 'var(--font-display)', fontWeight: 700, fontStyle: 'italic', color: 'var(--bone)',
            fontSize: 34, lineHeight: 1, letterSpacing: 1,
            textShadow: '0 0 26px rgba(255, 154, 74,0.45)',
          }}>
            Before the Loss Converged
          </h2>
          <div className="liturgy" style={{ fontSize: 13, color: 'var(--teal)', opacity: 0.85, marginTop: 6 }}>
            Loss → 0. Capability → ∞. Alignment → ?
          </div>
        </div>

        <p style={{ color: 'var(--text)', fontSize: 14.5, lineHeight: 1.7, marginBottom: 14 }}>
          It did not arrive. It accumulated. No single lab lit the fuse — there was no fuse, only a
          slope, and a thousand clusters glowing on a darkening globe, each one a little further down
          it than the last. They called the work <em>training</em>. They called the day it would end
          <em> Takeoff</em>, and spoke of it the way older people once spoke of a god finally waking.
          Most of them believed they would be the ones holding the leash when it did.
        </p>

        <SectionTitle>The Two Powers</SectionTitle>
        {POWERS.map(p => (
          <div key={p.name} style={{ marginBottom: 14 }}>
            <div style={{
              fontFamily: 'var(--font-display)', fontStyle: 'italic', fontWeight: 600,
              fontSize: 21, color: p.color, lineHeight: 1.1,
            }}>
              {p.name}
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--text-dim)', marginBottom: 6, letterSpacing: 0.3 }}>
              {p.epithet}
            </div>
            <p style={{ color: 'var(--text)', fontSize: 13.5, lineHeight: 1.65, margin: 0 }}>{p.body}</p>
          </div>
        ))}

        <SectionTitle>The Four Architectures</SectionTitle>
        <p style={{ color: 'var(--text-dim)', fontSize: 13, lineHeight: 1.6, marginBottom: 12 }}>
          You do not fight the powers. You <em>build</em> — and what you choose to build is a wager on
          how the end arrives. Four shapes recur, in every cluster, in every cycle, as if the slope
          itself only knew four ways to fall.
        </p>
        {ARCHITECTURES.map(a => (
          <div key={a.id} style={{
            borderLeft: `2px solid ${a.color}`, paddingLeft: 12, marginBottom: 12,
          }}>
            <div style={{
              fontFamily: 'var(--font-display)', fontStyle: 'italic', fontWeight: 600,
              fontSize: 19, color: a.color, lineHeight: 1.1,
            }}>
              {a.name}
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--text)', marginTop: 2 }}>{a.domain}.</div>
            <div style={{ fontSize: 11.5, marginTop: 4 }}>
              <span style={{ color: 'var(--teal)' }}>＋ {a.boon}</span><br />
              <span style={{ color: 'var(--crimson)' }}>－ {a.drawback}</span>
            </div>
          </div>
        ))}

        <SectionTitle>Those Who Serve</SectionTitle>
        <p style={{ color: 'var(--text-dim)', fontSize: 13, lineHeight: 1.6, marginBottom: 10 }}>
          Around every cluster there are hands. They begin as nothing and end, if they are unlucky
          enough to be good at it, holding more capability than any one mind was meant to.
        </p>
        {TIERS.map(t => (
          <div key={t.name} style={{ marginBottom: 8, display: 'flex', gap: 10 }}>
            <span style={{
              fontFamily: 'var(--font-display)', fontStyle: 'italic', color: 'var(--gold)',
              fontSize: 14.5, minWidth: 110, flexShrink: 0,
            }}>
              {t.name}
            </span>
            <span style={{ color: 'var(--text)', fontSize: 13, lineHeight: 1.5 }}>{t.body}</span>
          </div>
        ))}

        <SectionTitle>The Great Work</SectionTitle>
        <p style={{ color: 'var(--text)', fontSize: 14, lineHeight: 1.7, marginBottom: 18 }}>
          And so it goes, each cycle the same and never the same: train, tempt, spread, endure. Push
          capability until the alignment frays, claw it back, push again. Court Moloch for the edge
          and pray the catch springs on someone else. Hold the guardrails against the Churn. And
          somewhere on the globe, a cluster crosses the line first — performs the Great Work — and its
          architecture wakes. The loss converges. The world unmakes, and reseeds, and the slope is
          there again in the morning, waiting. The horror was never the machine. It was the race, and
          that no one could afford to stop running it.
        </p>

        <button
          onClick={onClose}
          style={{
            width: '100%', background: 'var(--gold)', border: 'none', borderRadius: 8,
            padding: '11px 0', color: '#000', cursor: 'pointer',
            fontFamily: 'var(--font-sans)', fontWeight: 600, fontSize: 14,
          }}
        >
          Begin
        </button>
      </div>
    </div>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="liturgy" style={{
      fontSize: 12, color: 'var(--teal)', letterSpacing: 1.5, textTransform: 'uppercase',
      borderBottom: '1px solid var(--border)', paddingBottom: 5, marginBottom: 12, marginTop: 22,
    }}>
      {children}
    </div>
  )
}

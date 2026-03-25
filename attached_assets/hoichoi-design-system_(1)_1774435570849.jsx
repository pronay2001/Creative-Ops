import { useState } from "react";

const COLORS = {
  red: "#d20820",
  velvet: "#6d0550",
  darkGrey: "#2a2a2a",
  lightGray: "#cccccc",
  soot: "#191919",
  white: "#ffffff",
  offWhite: "#f5f5f5",
  midGrey: "#888888",
  redLight: "#f8e8ea",
  velvetLight: "#f0e4ed",
};

const GRADIENT = "linear-gradient(-60deg, #d20820 0%, #6d0550 100%)";
const GRADIENT_SUBTLE = "linear-gradient(-60deg, #d20820 0%, #6d0550 65%)";

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      style={{
        background: "none",
        border: "none",
        cursor: "pointer",
        fontSize: 11,
        color: copied ? "#d20820" : "#888",
        fontFamily: "'PT Mono', monospace",
        padding: "2px 6px",
        borderRadius: 4,
        transition: "all 0.2s",
      }}
    >
      {copied ? "✓ copied" : "copy"}
    </button>
  );
}

function ColorSwatch({ name, hex, rgb, role, dark }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: "1 1 140px", minWidth: 140 }}>
      <div
        style={{
          background: hex,
          borderRadius: 16,
          height: 90,
          display: "flex",
          alignItems: "flex-end",
          padding: 12,
          border: hex === "#ffffff" || hex === "#f5f5f5" ? "1px solid #e0e0e0" : "none",
          boxShadow: "0 2px 12px rgba(0,0,0,0.08)",
        }}
      >
        <span style={{ fontFamily: "'PT Mono', monospace", fontSize: 11, color: dark ? "#fff" : "#2a2a2a", opacity: 0.9 }}>
          {hex}
        </span>
      </div>
      <div style={{ padding: "0 4px" }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#2a2a2a", fontFamily: "'Outfit', sans-serif" }}>{name}</div>
        <div style={{ fontSize: 11, color: "#888", fontFamily: "'Manrope', sans-serif" }}>{role}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 2 }}>
          <span style={{ fontSize: 10, color: "#aaa", fontFamily: "'PT Mono', monospace" }}>{rgb}</span>
          <CopyButton text={hex} />
        </div>
      </div>
    </div>
  );
}

function SectionHeader({ title, subtitle }) {
  return (
    <div style={{ marginBottom: 32, marginTop: 56 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
        <div style={{ width: 4, height: 28, background: GRADIENT, borderRadius: 2 }} />
        <h2 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 26, fontWeight: 700, color: "#191919", margin: 0, letterSpacing: "-0.02em" }}>
          {title}
        </h2>
      </div>
      {subtitle && (
        <p style={{ fontFamily: "'Manrope', sans-serif", fontSize: 14, color: "#888", margin: "0 0 0 16px", lineHeight: 1.5 }}>
          {subtitle}
        </p>
      )}
    </div>
  );
}

function TokenRow({ token, value, preview }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "10px 0", borderBottom: "1px solid #f0f0f0", gap: 12,
    }}>
      <code style={{ fontFamily: "'PT Mono', monospace", fontSize: 12, color: "#d20820", background: "#fdf2f3", padding: "3px 8px", borderRadius: 6, whiteSpace: "nowrap" }}>
        {token}
      </code>
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8 }}>
        {preview}
        <span style={{ fontFamily: "'PT Mono', monospace", fontSize: 12, color: "#666", textAlign: "right" }}>{value}</span>
        <CopyButton text={value} />
      </div>
    </div>
  );
}

function PillowShape({ width = 120, height = 120, style = {} }) {
  const r = Math.min(width, height) * 0.38;
  return (
    <div style={{
      width, height, borderRadius: r,
      background: GRADIENT,
      ...style,
    }} />
  );
}

export default function HoichoiDesignSystem() {
  const [activeTab, setActiveTab] = useState("colors");
  const tabs = [
    { id: "colors", label: "Colours" },
    { id: "typography", label: "Typography" },
    { id: "spacing", label: "Spacing & Radius" },
    { id: "components", label: "Components" },
    { id: "tokens", label: "CSS Tokens" },
  ];

  return (
    <div style={{ background: "#fafafa", minHeight: "100vh", fontFamily: "'Manrope', sans-serif" }}>
      <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&family=Manrope:wght@300;400;500;600;700;800&family=PT+Mono&display=swap" rel="stylesheet" />

      {/* Hero Header */}
      <div style={{
        background: GRADIENT, padding: "48px 40px 40px", position: "relative", overflow: "hidden",
      }}>
        <div style={{ position: "absolute", top: -60, right: -60, width: 260, height: 260, borderRadius: 100, background: "rgba(255,255,255,0.04)" }} />
        <div style={{ position: "absolute", bottom: -40, left: "30%", width: 180, height: 180, borderRadius: 70, background: "rgba(255,255,255,0.03)" }} />
        <div style={{ position: "relative", zIndex: 1 }}>
          <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 14, fontWeight: 600, color: "rgba(255,255,255,0.6)", letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: 8 }}>
            Design System
          </div>
          <h1 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 40, fontWeight: 800, color: "#fff", margin: "0 0 8px", letterSpacing: "-0.03em" }}>
            hoichoi
          </h1>
          <p style={{ fontFamily: "'Manrope', sans-serif", fontSize: 15, color: "rgba(255,255,255,0.7)", margin: 0, maxWidth: 500, lineHeight: 1.6 }}>
            App colour & style template — colours, typography, spacing, components, and ready-to-use CSS tokens.
          </p>
        </div>
      </div>

      {/* Tab Nav */}
      <div style={{
        display: "flex", gap: 0, borderBottom: "1px solid #e8e8e8", background: "#fff",
        padding: "0 24px", overflowX: "auto", position: "sticky", top: 0, zIndex: 10,
      }}>
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            style={{
              fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: activeTab === t.id ? 700 : 500,
              color: activeTab === t.id ? "#d20820" : "#888", background: "none", border: "none",
              padding: "14px 18px", cursor: "pointer", position: "relative", whiteSpace: "nowrap",
              borderBottom: activeTab === t.id ? "2.5px solid #d20820" : "2.5px solid transparent",
              transition: "all 0.2s",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ padding: "0 32px 64px", maxWidth: 960, margin: "0 auto" }}>

        {/* ── COLOURS ── */}
        {activeTab === "colors" && (
          <div>
            <SectionHeader title="Brand Gradient" subtitle="The signature Red → Velvet gradient. Angle: -60°, Red at 0%, Velvet at 100% (location 65%)." />
            <div style={{
              background: GRADIENT, borderRadius: 24, height: 120, marginBottom: 16,
              display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 32px",
              boxShadow: "0 8px 32px rgba(210,8,32,0.2)",
            }}>
              <span style={{ color: "#fff", fontFamily: "'PT Mono', monospace", fontSize: 12, opacity: 0.8 }}>#d20820 (0%)</span>
              <span style={{ color: "rgba(255,255,255,0.6)", fontFamily: "'Outfit', sans-serif", fontSize: 18, fontWeight: 700, letterSpacing: "0.05em" }}>BRAND GRADIENT</span>
              <span style={{ color: "#fff", fontFamily: "'PT Mono', monospace", fontSize: 12, opacity: 0.8 }}>#6d0550 (100%)</span>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
              <code style={{ fontFamily: "'PT Mono', monospace", fontSize: 11, color: "#666", background: "#f5f5f5", padding: "4px 10px", borderRadius: 6 }}>
                background: linear-gradient(-60deg, #d20820 0%, #6d0550 100%);
              </code>
              <CopyButton text="linear-gradient(-60deg, #d20820 0%, #6d0550 100%)" />
            </div>

            <SectionHeader title="Primary Colours" subtitle="Red and Velvet — the two poles of the brand identity." />
            <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
              <ColorSwatch name="Red" hex="#d20820" rgb="RGB 210, 8, 32" role="Primary brand, CTAs, active states" dark />
              <ColorSwatch name="Velvet" hex="#6d0550" rgb="RGB 109, 5, 80" role="Gradient end, depth, premium feel" dark />
            </div>

            <SectionHeader title="Neutrals" subtitle="Greys, black, and white for backgrounds, text, and UI structure." />
            <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
              <ColorSwatch name="Soot" hex="#191919" rgb="RGB 25, 25, 25" role="Dark backgrounds, primary text" dark />
              <ColorSwatch name="Dark Grey" hex="#2a2a2a" rgb="RGB 42, 42, 42" role="Secondary text, cards on dark" dark />
              <ColorSwatch name="Mid Grey" hex="#888888" rgb="RGB 136, 136, 136" role="Muted text, placeholders" />
              <ColorSwatch name="Light Gray" hex="#cccccc" rgb="RGB 204, 204, 204" role="Borders, dividers, disabled" />
              <ColorSwatch name="Off White" hex="#f5f5f5" rgb="RGB 245, 245, 245" role="Light backgrounds, cards" />
              <ColorSwatch name="White" hex="#ffffff" rgb="RGB 255, 255, 255" role="Page background, text on dark" />
            </div>

            <SectionHeader title="Extended Palette" subtitle="Tinted surfaces and semantic states derived from brand colours." />
            <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
              <ColorSwatch name="Red Light" hex="#f8e8ea" rgb="RGB 248, 232, 234" role="Error bg, red-tinted surfaces" />
              <ColorSwatch name="Velvet Light" hex="#f0e4ed" rgb="RGB 240, 228, 237" role="Info bg, premium-tinted surfaces" />
              <ColorSwatch name="Success" hex="#1a8754" rgb="RGB 26, 135, 84" role="Success states, confirmations" dark />
              <ColorSwatch name="Warning" hex="#e6a817" rgb="RGB 230, 168, 23" role="Warnings, caution states" />
            </div>

            <SectionHeader title="Dark Theme" subtitle="For OTT / streaming UI — content-first, cinematic." />
            <div style={{
              background: "#191919", borderRadius: 20, padding: 28, display: "flex", gap: 20, flexWrap: "wrap",
            }}>
              {[
                { name: "Surface 0", hex: "#0d0d0d", role: "Base / true black" },
                { name: "Surface 1", hex: "#191919", role: "App background" },
                { name: "Surface 2", hex: "#222222", role: "Cards, modals" },
                { name: "Surface 3", hex: "#2a2a2a", role: "Elevated surfaces" },
                { name: "Surface 4", hex: "#333333", role: "Borders, dividers" },
                { name: "Text Primary", hex: "#ffffff", role: "Primary text on dark" },
                { name: "Text Secondary", hex: "#a0a0a0", role: "Muted text on dark" },
                { name: "Text Tertiary", hex: "#666666", role: "Disabled text on dark" },
              ].map(c => (
                <div key={c.hex + c.name} style={{ flex: "1 1 100px", minWidth: 100 }}>
                  <div style={{ width: "100%", height: 48, borderRadius: 10, background: c.hex, border: c.hex === "#0d0d0d" ? "1px solid #333" : c.hex === "#ffffff" ? "1px solid #444" : "none", marginBottom: 6 }} />
                  <div style={{ fontSize: 12, fontWeight: 600, color: "#fff", fontFamily: "'Outfit', sans-serif" }}>{c.name}</div>
                  <div style={{ fontSize: 10, color: "#666", fontFamily: "'PT Mono', monospace" }}>{c.hex}</div>
                  <div style={{ fontSize: 10, color: "#555", fontFamily: "'Manrope', sans-serif" }}>{c.role}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── TYPOGRAPHY ── */}
        {activeTab === "typography" && (
          <div>
            <SectionHeader title="Type Scale" subtitle="Primary: Outfit (headers/titles). Secondary: Manrope (body/paragraphs). Mono: PT Mono (codes/discounts)." />

            <div style={{ background: "#fff", borderRadius: 20, padding: 28, boxShadow: "0 1px 8px rgba(0,0,0,0.04)", marginBottom: 24 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#d20820", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 16, fontFamily: "'Outfit', sans-serif" }}>
                Outfit — Headers & Titles
              </div>
              {[
                { label: "H1 — Hero", size: 48, weight: 800, tracking: "-0.03em", lh: 1.1 },
                { label: "H2 — Section", size: 32, weight: 700, tracking: "-0.02em", lh: 1.2 },
                { label: "H3 — Subsection", size: 24, weight: 700, tracking: "-0.01em", lh: 1.3 },
                { label: "H4 — Card Title", size: 18, weight: 600, tracking: "-0.01em", lh: 1.4 },
                { label: "H5 — Label", size: 14, weight: 700, tracking: "0.02em", lh: 1.4 },
                { label: "Overline", size: 11, weight: 700, tracking: "0.15em", lh: 1.4, upper: true },
              ].map(h => (
                <div key={h.label} style={{ display: "flex", alignItems: "baseline", gap: 16, padding: "10px 0", borderBottom: "1px solid #f5f5f5" }}>
                  <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: h.size, fontWeight: h.weight, letterSpacing: h.tracking, lineHeight: h.lh, color: "#191919", textTransform: h.upper ? "uppercase" : "none" }}>
                    Aa
                  </span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "#2a2a2a", fontFamily: "'Outfit', sans-serif" }}>{h.label}</div>
                    <div style={{ fontSize: 10, color: "#aaa", fontFamily: "'PT Mono', monospace" }}>
                      {h.size}px / {h.weight} / {h.tracking} tracking / {h.lh} line-height
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ background: "#fff", borderRadius: 20, padding: 28, boxShadow: "0 1px 8px rgba(0,0,0,0.04)", marginBottom: 24 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#6d0550", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 16, fontFamily: "'Outfit', sans-serif" }}>
                Manrope — Body & Paragraphs
              </div>
              {[
                { label: "Body Large", size: 17, weight: 400, lh: 1.7 },
                { label: "Body Default", size: 15, weight: 400, lh: 1.65 },
                { label: "Body Small", size: 13, weight: 400, lh: 1.6 },
                { label: "Caption", size: 11, weight: 500, lh: 1.5 },
              ].map(b => (
                <div key={b.label} style={{ display: "flex", alignItems: "baseline", gap: 16, padding: "10px 0", borderBottom: "1px solid #f5f5f5" }}>
                  <span style={{ fontFamily: "'Manrope', sans-serif", fontSize: b.size, fontWeight: b.weight, lineHeight: b.lh, color: "#2a2a2a" }}>
                    The quick brown fox jumps over the lazy dog
                  </span>
                  <div style={{ flex: "0 0 auto" }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "#2a2a2a", fontFamily: "'Outfit', sans-serif", whiteSpace: "nowrap" }}>{b.label}</div>
                    <div style={{ fontSize: 10, color: "#aaa", fontFamily: "'PT Mono', monospace", whiteSpace: "nowrap" }}>
                      {b.size}px / {b.weight} / {b.lh} lh
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ background: "#fff", borderRadius: 20, padding: 28, boxShadow: "0 1px 8px rgba(0,0,0,0.04)", marginBottom: 24 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#2a2a2a", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 16, fontFamily: "'Outfit', sans-serif" }}>
                PT Mono — Codes, Prices & Data
              </div>
              <div style={{ fontFamily: "'PT Mono', monospace", fontSize: 20, color: "#d20820", marginBottom: 4 }}>FLAT50OFF</div>
              <div style={{ fontFamily: "'PT Mono', monospace", fontSize: 14, color: "#666" }}>₹149/mo · 0123456789 · API_KEY_HERE</div>
              <div style={{ fontSize: 10, color: "#aaa", fontFamily: "'PT Mono', monospace", marginTop: 8 }}>
                Use for discount codes, prices, dates, technical values
              </div>
            </div>

            <div style={{ background: "#fff", borderRadius: 20, padding: 28, boxShadow: "0 1px 8px rgba(0,0,0,0.04)" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#2a2a2a", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 16, fontFamily: "'Outfit', sans-serif" }}>
                Special — Atkinson Hyperlegible
              </div>
              <div style={{ fontSize: 14, color: "#666", fontFamily: "'Manrope', sans-serif", lineHeight: 1.6 }}>
                Used for content category labels on platform packaging (e.g. "series", "film", "original"). Apply in Regular weight, customized per usage context. Optimized for readability at small sizes.
              </div>
            </div>
          </div>
        )}

        {/* ── SPACING & RADIUS ── */}
        {activeTab === "spacing" && (
          <div>
            <SectionHeader title="The Pillow Shape" subtitle="hoichoi's signature design element — soft-edged, warm, and welcoming. Border radius ≈ 38% of shorter dimension." />
            <div style={{ display: "flex", gap: 24, alignItems: "flex-end", flexWrap: "wrap", marginBottom: 40 }}>
              <div style={{ textAlign: "center" }}>
                <PillowShape width={100} height={100} />
                <div style={{ fontSize: 11, color: "#888", marginTop: 8, fontFamily: "'PT Mono', monospace" }}>100×100 / r38</div>
                <div style={{ fontSize: 10, color: "#aaa" }}>Base</div>
              </div>
              <div style={{ textAlign: "center" }}>
                <PillowShape width={150} height={100} />
                <div style={{ fontSize: 11, color: "#888", marginTop: 8, fontFamily: "'PT Mono', monospace" }}>150×100 / r38</div>
                <div style={{ fontSize: 10, color: "#aaa" }}>Horizontal</div>
              </div>
              <div style={{ textAlign: "center" }}>
                <PillowShape width={100} height={150} />
                <div style={{ fontSize: 11, color: "#888", marginTop: 8, fontFamily: "'PT Mono', monospace" }}>100×150 / r38</div>
                <div style={{ fontSize: 10, color: "#aaa" }}>Vertical</div>
              </div>
              <div style={{ textAlign: "center" }}>
                <PillowShape width={240} height={80} style={{ borderRadius: 30 }} />
                <div style={{ fontSize: 11, color: "#888", marginTop: 8, fontFamily: "'PT Mono', monospace" }}>240×80 / r30</div>
                <div style={{ fontSize: 10, color: "#aaa" }}>CTA / Banner</div>
              </div>
            </div>

            <SectionHeader title="Border Radius Scale" subtitle="From sharp elements to the full pillow shape." />
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 40 }}>
              {[
                { r: 0, label: "None", use: "Tables, code blocks" },
                { r: 6, label: "XS", use: "Badges, chips, tags" },
                { r: 10, label: "SM", use: "Inputs, small cards" },
                { r: 16, label: "MD", use: "Cards, dropdowns" },
                { r: 24, label: "LG", use: "Modals, panels" },
                { r: 30, label: "XL", use: "Social thumbnails" },
                { r: 50, label: "Pillow", use: "Poster borders, hero CTAs" },
                { r: 9999, label: "Full", use: "Avatars, pills, round buttons" },
              ].map(item => (
                <div key={item.label} style={{ textAlign: "center", flex: "0 0 auto" }}>
                  <div style={{
                    width: 64, height: 64, borderRadius: item.r, border: "2px solid #d20820",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 10, color: "#d20820", fontFamily: "'PT Mono', monospace", fontWeight: 700,
                  }}>
                    {item.r === 9999 ? "full" : item.r + "px"}
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#2a2a2a", marginTop: 6, fontFamily: "'Outfit', sans-serif" }}>{item.label}</div>
                  <div style={{ fontSize: 10, color: "#aaa", maxWidth: 80, fontFamily: "'Manrope', sans-serif" }}>{item.use}</div>
                </div>
              ))}
            </div>

            <SectionHeader title="Spacing Scale" subtitle="Consistent 4px base grid. Use multiples for all padding, margins, and gaps." />
            <div style={{ background: "#fff", borderRadius: 20, padding: 28, boxShadow: "0 1px 8px rgba(0,0,0,0.04)" }}>
              {[
                { token: "4px", label: "3XS", use: "Inline gaps, icon padding" },
                { token: "8px", label: "2XS", use: "Tight element spacing" },
                { token: "12px", label: "XS", use: "Input padding, compact cards" },
                { token: "16px", label: "SM", use: "Card padding, list gaps" },
                { token: "24px", label: "MD", use: "Section padding, card gaps" },
                { token: "32px", label: "LG", use: "Section gaps" },
                { token: "48px", label: "XL", use: "Hero padding, major sections" },
                { token: "64px", label: "2XL", use: "Page-level spacing" },
                { token: "80px", label: "3XL", use: "Poster/OOH text padding" },
              ].map(s => (
                <div key={s.token} style={{ display: "flex", alignItems: "center", gap: 16, padding: "8px 0", borderBottom: "1px solid #f5f5f5" }}>
                  <div style={{ width: parseInt(s.token), height: 16, background: GRADIENT, borderRadius: 3, flexShrink: 0, minWidth: 4 }} />
                  <code style={{ fontFamily: "'PT Mono', monospace", fontSize: 12, color: "#d20820", fontWeight: 700, width: 40 }}>{s.token}</code>
                  <span style={{ fontSize: 12, fontWeight: 600, color: "#2a2a2a", fontFamily: "'Outfit', sans-serif", width: 36 }}>{s.label}</span>
                  <span style={{ fontSize: 12, color: "#888", fontFamily: "'Manrope', sans-serif" }}>{s.use}</span>
                </div>
              ))}
            </div>

            <SectionHeader title="Shadows" subtitle="Elevation system for cards, modals, and interactive surfaces." />
            <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
              {[
                { label: "SM", value: "0 1px 4px rgba(0,0,0,0.06)", use: "Cards, thumbnails" },
                { label: "MD", value: "0 4px 16px rgba(0,0,0,0.08)", use: "Dropdowns, popovers" },
                { label: "LG", value: "0 8px 32px rgba(0,0,0,0.12)", use: "Modals, dialogs" },
                { label: "XL", value: "0 16px 48px rgba(0,0,0,0.16)", use: "Full-screen overlays" },
                { label: "Brand", value: "0 8px 32px rgba(210,8,32,0.2)", use: "CTA hover, hero elements" },
              ].map(sh => (
                <div key={sh.label} style={{ textAlign: "center", flex: "1 1 120px" }}>
                  <div style={{
                    width: "100%", height: 72, background: "#fff", borderRadius: 16,
                    boxShadow: sh.value, marginBottom: 8,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 11, color: "#ccc", fontFamily: "'Outfit', sans-serif",
                  }} />
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#2a2a2a", fontFamily: "'Outfit', sans-serif" }}>{sh.label}</div>
                  <div style={{ fontSize: 10, color: "#aaa" }}>{sh.use}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── COMPONENTS ── */}
        {activeTab === "components" && (
          <div>
            <SectionHeader title="Buttons" subtitle="Primary (gradient), secondary (outline), ghost, and dark variants." />
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center", marginBottom: 32 }}>
              <button style={{
                background: GRADIENT, color: "#fff", border: "none", borderRadius: 50,
                padding: "14px 32px", fontFamily: "'Outfit', sans-serif", fontSize: 15, fontWeight: 700,
                cursor: "pointer", boxShadow: "0 6px 24px rgba(210,8,32,0.25)",
                letterSpacing: "-0.01em",
              }}>
                Subscribe Now
              </button>
              <button style={{
                background: "transparent", color: "#d20820", border: "2px solid #d20820", borderRadius: 50,
                padding: "12px 28px", fontFamily: "'Outfit', sans-serif", fontSize: 15, fontWeight: 600,
                cursor: "pointer",
              }}>
                Learn More
              </button>
              <button style={{
                background: "transparent", color: "#2a2a2a", border: "none", borderRadius: 50,
                padding: "12px 28px", fontFamily: "'Outfit', sans-serif", fontSize: 15, fontWeight: 600,
                cursor: "pointer", textDecoration: "underline", textUnderlineOffset: 4,
              }}>
                Skip for now
              </button>
              <button style={{
                background: "#fff", color: "#191919", border: "none", borderRadius: 50,
                padding: "14px 32px", fontFamily: "'Outfit', sans-serif", fontSize: 15, fontWeight: 700,
                cursor: "pointer", boxShadow: "0 2px 12px rgba(0,0,0,0.1)",
              }}>
                Watch Free
              </button>
            </div>

            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center", marginBottom: 40 }}>
              <button style={{
                background: GRADIENT, color: "#fff", border: "none", borderRadius: 50,
                padding: "10px 20px", fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 600, cursor: "pointer",
              }}>Small CTA</button>
              <button style={{
                background: "#191919", color: "#fff", border: "none", borderRadius: 50,
                padding: "10px 20px", fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 600, cursor: "pointer",
              }}>Dark Button</button>
              <button style={{
                background: "transparent", color: "#888", border: "1px solid #ddd", borderRadius: 50,
                padding: "10px 20px", fontFamily: "'Manrope', sans-serif", fontSize: 13, fontWeight: 500, cursor: "pointer",
              }}>Disabled</button>
            </div>

            <SectionHeader title="Cards" subtitle="Light and dark card treatments for content surfaces." />
            <div style={{ display: "flex", gap: 20, flexWrap: "wrap", marginBottom: 40 }}>
              {/* Light card */}
              <div style={{
                flex: "1 1 260px", background: "#fff", borderRadius: 20, overflow: "hidden",
                boxShadow: "0 2px 16px rgba(0,0,0,0.06)",
              }}>
                <div style={{ height: 140, background: GRADIENT, position: "relative" }}>
                  <span style={{ position: "absolute", bottom: 12, left: 16, color: "#fff", fontFamily: "'Outfit', sans-serif", fontSize: 10, fontWeight: 700, background: "rgba(0,0,0,0.3)", padding: "4px 10px", borderRadius: 20 }}>SERIES</span>
                </div>
                <div style={{ padding: 20 }}>
                  <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 17, fontWeight: 700, color: "#191919", marginBottom: 4 }}>Content Title</div>
                  <div style={{ fontFamily: "'Manrope', sans-serif", fontSize: 13, color: "#888", marginBottom: 12, lineHeight: 1.5 }}>A short description of the content goes here.</div>
                  <button style={{ background: GRADIENT, color: "#fff", border: "none", borderRadius: 50, padding: "8px 20px", fontFamily: "'Outfit', sans-serif", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                    ▶ Watch Now
                  </button>
                </div>
              </div>
              {/* Dark card */}
              <div style={{
                flex: "1 1 260px", background: "#222", borderRadius: 20, overflow: "hidden",
                boxShadow: "0 2px 16px rgba(0,0,0,0.2)",
              }}>
                <div style={{ height: 140, background: "linear-gradient(135deg, #2a2a2a, #191919)", position: "relative" }}>
                  <span style={{ position: "absolute", bottom: 12, left: 16, color: "#fff", fontFamily: "'Outfit', sans-serif", fontSize: 10, fontWeight: 700, background: "rgba(210,8,32,0.7)", padding: "4px 10px", borderRadius: 20 }}>ORIGINAL</span>
                </div>
                <div style={{ padding: 20 }}>
                  <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 17, fontWeight: 700, color: "#fff", marginBottom: 4 }}>Dark Theme Card</div>
                  <div style={{ fontFamily: "'Manrope', sans-serif", fontSize: 13, color: "#a0a0a0", marginBottom: 12, lineHeight: 1.5 }}>For OTT streaming interfaces and dark UI.</div>
                  <button style={{ background: "#fff", color: "#191919", border: "none", borderRadius: 50, padding: "8px 20px", fontFamily: "'Outfit', sans-serif", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                    ▶ Watch Now
                  </button>
                </div>
              </div>
            </div>

            <SectionHeader title="Inputs & Form Elements" />
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 40, alignItems: "flex-end" }}>
              <div style={{ flex: "1 1 220px" }}>
                <label style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, fontWeight: 600, color: "#2a2a2a", display: "block", marginBottom: 6 }}>Email</label>
                <input
                  type="text" placeholder="you@example.com" readOnly
                  style={{
                    width: "100%", boxSizing: "border-box", padding: "12px 16px", borderRadius: 12,
                    border: "1.5px solid #ddd", fontFamily: "'Manrope', sans-serif", fontSize: 14,
                    color: "#2a2a2a", outline: "none", background: "#fff",
                  }}
                />
              </div>
              <div style={{ flex: "1 1 220px" }}>
                <label style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, fontWeight: 600, color: "#2a2a2a", display: "block", marginBottom: 6 }}>Promo Code</label>
                <input
                  type="text" placeholder="FLAT50OFF" readOnly
                  style={{
                    width: "100%", boxSizing: "border-box", padding: "12px 16px", borderRadius: 12,
                    border: "1.5px solid #d20820", fontFamily: "'PT Mono', monospace", fontSize: 14,
                    color: "#d20820", outline: "none", background: "#fdf2f3",
                  }}
                />
              </div>
            </div>

            <SectionHeader title="Badges & Tags" />
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 40 }}>
              {[
                { label: "NEW", bg: GRADIENT, color: "#fff" },
                { label: "SERIES", bg: "#191919", color: "#fff" },
                { label: "FILM", bg: "#f5f5f5", color: "#2a2a2a" },
                { label: "18+", bg: "#d20820", color: "#fff" },
                { label: "FREE", bg: "#1a8754", color: "#fff" },
                { label: "PREMIUM", bg: "#6d0550", color: "#fff" },
              ].map(b => (
                <span key={b.label} style={{
                  background: b.bg, color: b.color, fontFamily: "'Outfit', sans-serif",
                  fontSize: 10, fontWeight: 700, padding: "5px 12px", borderRadius: 6,
                  letterSpacing: "0.06em",
                }}>
                  {b.label}
                </span>
              ))}
            </div>

            <SectionHeader title="Date Formatting" subtitle="Per brand book: 4 OCT (general), 04 OCT (posters). No ordinal suffixes. Uppercase months." />
            <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
              <div style={{ background: "#fff", borderRadius: 16, padding: 20, boxShadow: "0 1px 8px rgba(0,0,0,0.04)", textAlign: "center" }}>
                <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 32, fontWeight: 800, color: "#191919", letterSpacing: "-0.02em" }}>4 OCT</div>
                <div style={{ fontSize: 11, color: "#aaa", fontFamily: "'Manrope', sans-serif" }}>General use</div>
              </div>
              <div style={{ background: "#191919", borderRadius: 16, padding: 20, boxShadow: "0 1px 8px rgba(0,0,0,0.1)", textAlign: "center" }}>
                <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 32, fontWeight: 800, color: "#fff", letterSpacing: "-0.02em" }}>04 OCT</div>
                <div style={{ fontSize: 11, color: "#666", fontFamily: "'Manrope', sans-serif" }}>Poster layout</div>
              </div>
            </div>
          </div>
        )}

        {/* ── CSS TOKENS ── */}
        {activeTab === "tokens" && (
          <div>
            <SectionHeader title="CSS Custom Properties" subtitle="Copy-paste ready. Drop these into your :root and build." />
            <div style={{ background: "#191919", borderRadius: 20, padding: 28, boxShadow: "0 1px 8px rgba(0,0,0,0.1)", marginBottom: 24 }}>
              <pre style={{
                fontFamily: "'PT Mono', monospace", fontSize: 12, color: "#ccc", lineHeight: 2,
                whiteSpace: "pre-wrap", wordBreak: "break-all", margin: 0,
              }}>{`:root {
  /* ── Brand Colours ── */
  --hc-red: #d20820;
  --hc-velvet: #6d0550;
  --hc-gradient: linear-gradient(-60deg, #d20820 0%, #6d0550 100%);

  /* ── Neutrals ── */
  --hc-soot: #191919;
  --hc-dark-grey: #2a2a2a;
  --hc-mid-grey: #888888;
  --hc-light-gray: #cccccc;
  --hc-off-white: #f5f5f5;
  --hc-white: #ffffff;

  /* ── Semantic ── */
  --hc-success: #1a8754;
  --hc-warning: #e6a817;
  --hc-error: #d20820;
  --hc-info: #6d0550;
  --hc-red-light: #f8e8ea;
  --hc-velvet-light: #f0e4ed;

  /* ── Dark Theme Surfaces ── */
  --hc-surface-0: #0d0d0d;
  --hc-surface-1: #191919;
  --hc-surface-2: #222222;
  --hc-surface-3: #2a2a2a;
  --hc-surface-4: #333333;
  --hc-text-on-dark: #ffffff;
  --hc-text-muted-dark: #a0a0a0;
  --hc-text-disabled-dark: #666666;

  /* ── Typography ── */
  --hc-font-primary: 'Outfit', sans-serif;
  --hc-font-body: 'Manrope', sans-serif;
  --hc-font-mono: 'PT Mono', monospace;

  /* ── Spacing (4px grid) ── */
  --hc-space-3xs: 4px;
  --hc-space-2xs: 8px;
  --hc-space-xs: 12px;
  --hc-space-sm: 16px;
  --hc-space-md: 24px;
  --hc-space-lg: 32px;
  --hc-space-xl: 48px;
  --hc-space-2xl: 64px;
  --hc-space-3xl: 80px;

  /* ── Border Radius ── */
  --hc-radius-none: 0;
  --hc-radius-xs: 6px;
  --hc-radius-sm: 10px;
  --hc-radius-md: 16px;
  --hc-radius-lg: 24px;
  --hc-radius-xl: 30px;
  --hc-radius-pillow: 50px;
  --hc-radius-full: 9999px;

  /* ── Shadows ── */
  --hc-shadow-sm: 0 1px 4px rgba(0,0,0,0.06);
  --hc-shadow-md: 0 4px 16px rgba(0,0,0,0.08);
  --hc-shadow-lg: 0 8px 32px rgba(0,0,0,0.12);
  --hc-shadow-xl: 0 16px 48px rgba(0,0,0,0.16);
  --hc-shadow-brand: 0 8px 32px rgba(210,8,32,0.2);

  /* ── Poster / Thumbnail Specs ── */
  --hc-poster-border: 20px;
  --hc-poster-radius: 50px;
  --hc-poster-padding: 70px;
  --hc-thumb-border: 30px;
  --hc-thumb-radius: 30px;
}`}</pre>
            </div>

            <SectionHeader title="Tailwind Config Snippet" subtitle="If you use Tailwind — extend your config with these values." />
            <div style={{ background: "#191919", borderRadius: 20, padding: 28, boxShadow: "0 1px 8px rgba(0,0,0,0.1)" }}>
              <pre style={{
                fontFamily: "'PT Mono', monospace", fontSize: 12, color: "#ccc", lineHeight: 2,
                whiteSpace: "pre-wrap", wordBreak: "break-all", margin: 0,
              }}>{`// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      colors: {
        hc: {
          red: '#d20820',
          velvet: '#6d0550',
          soot: '#191919',
          'dark-grey': '#2a2a2a',
          'mid-grey': '#888888',
          'light-gray': '#cccccc',
          'off-white': '#f5f5f5',
          'red-light': '#f8e8ea',
          'velvet-light': '#f0e4ed',
          success: '#1a8754',
          warning: '#e6a817',
          surface: {
            0: '#0d0d0d',
            1: '#191919',
            2: '#222222',
            3: '#2a2a2a',
            4: '#333333',
          },
        },
      },
      fontFamily: {
        outfit: ['Outfit', 'sans-serif'],
        manrope: ['Manrope', 'sans-serif'],
        mono: ['PT Mono', 'monospace'],
      },
      borderRadius: {
        pillow: '50px',
      },
    },
  },
}`}</pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

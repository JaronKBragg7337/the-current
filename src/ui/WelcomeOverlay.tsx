interface WelcomeOverlayProps {
  onEnter: () => void;
}
export function WelcomeOverlay({ onEnter }: WelcomeOverlayProps) {
  return (
    <section className="welcome-overlay" aria-labelledby="welcome-title">
      <div className="welcome-card">
        <p className="eyebrow">A persistent autonomous world</p>
        <h2 id="welcome-title">Witness the current.</h2>
        <p>
          Every person behind this glass chooses where to go, whom to trust, what to build, and what their descendants inherit.
          You may watch from above or through their eyes. You may never become them.
        </p>
        <div className="welcome-facts" aria-label="World foundations">
          <span><strong>20</strong> founding lives</span>
          <span><strong>2</strong> new arrivals each day</span>
          <span><strong>1</strong> remembered history</span>
        </div>
        <button type="button" onClick={onEnter}>Enter as witness <span aria-hidden="true">→</span></button>
        <small>Drag to orbit · scroll or pinch to cross scales · select any person</small>
      </div>
    </section>
  );
}

// No claimed locker on this device — point back to the class link + slip.
export default function LockerLostPage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#0f1118",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
        fontFamily: "ui-sans-serif, system-ui, sans-serif",
        color: "#e7e9f0",
        textAlign: "center",
      }}
    >
      <div style={{ maxWidth: 360 }}>
        <div style={{ fontSize: 44, marginBottom: 14 }}>🔒</div>
        <h1 style={{ fontSize: 20, fontWeight: 800, margin: "0 0 8px" }}>No locker on this device yet.</h1>
        <p style={{ color: "#9aa1b5", fontSize: 14, lineHeight: 1.6, margin: 0 }}>
          Open your class&apos;s locker link and spin in the combo from your slip.
          Don&apos;t have either? Your teacher does.
        </p>
      </div>
    </main>
  );
}

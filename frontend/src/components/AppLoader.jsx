import { Logo } from "./Logo";

export function AppLoader() {
  return (
    <div className="workspace-loader" aria-label="Abrindo a Better Way" role="status">
      <span className="workspace-loader-glow" aria-hidden="true" />
      <span className="workspace-loader-focus-ring" aria-hidden="true" />
      <span className="workspace-loader-brand" aria-hidden="true">
        <span className="workspace-loader-logo">
          <Logo size={96} withWordmark={false} />
        </span>
        <span className="workspace-loader-wordmark">Better <strong>Way</strong></span>
      </span>
    </div>
  );
}

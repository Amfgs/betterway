import { Logo } from "./Logo";

export function AppLoader() {
  return (
    <div className="workspace-loader" aria-label="Carregando" role="status">
      <span className="workspace-loader-orbit" aria-hidden="true" />
      <span className="workspace-loader-logo" aria-hidden="true">
        <Logo size={34} withWordmark={false} />
      </span>
      <span className="workspace-loader-signal" aria-hidden="true">
        <i />
        <i />
        <i />
        <i />
      </span>
    </div>
  );
}

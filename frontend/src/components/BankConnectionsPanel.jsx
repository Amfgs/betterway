import {
  ChartNoAxesCombined,
  Clock3,
  Landmark,
  LockKeyhole,
  ReceiptText,
  ShieldCheck,
  WalletCards
} from "lucide-react";

const futureCapabilities = [
  {
    icon: WalletCards,
    title: "Saldo consolidado",
    description: "Consulte suas contas em uma leitura única."
  },
  {
    icon: ReceiptText,
    title: "Movimentações",
    description: "Acompanhe entradas e saídas autorizadas."
  },
  {
    icon: ChartNoAxesCombined,
    title: "Investimentos",
    description: "Reúna posições elegíveis no patrimônio."
  }
];

export function BankConnectionsPanel() {
  return (
    <section className="bank-connections-panel bank-connections-coming-soon">
      <header className="bank-coming-header">
        <span className="bank-coming-icon"><Landmark aria-hidden="true" size={24} /></span>
        <div>
          <span className="bank-coming-badge"><Clock3 aria-hidden="true" size={13} /> Em breve</span>
          <h2>Conexão com instituições</h2>
          <p>Estamos preparando uma integração estável e somente para leitura antes de liberar bancos e corretoras na BW.</p>
        </div>
      </header>

      <div className="bank-coming-capabilities" aria-label="Recursos planejados">
        {futureCapabilities.map((capability) => (
          <div key={capability.title}>
            <span><capability.icon aria-hidden="true" size={19} /></span>
            <div><strong>{capability.title}</strong><small>{capability.description}</small></div>
            <LockKeyhole aria-hidden="true" size={16} />
          </div>
        ))}
      </div>

      <div className="bank-coming-assurance">
        <ShieldCheck aria-hidden="true" size={20} />
        <p><strong>Segurança antes da conexão.</strong> A BW não solicita senha bancária e nenhuma autorização pode ser iniciada enquanto este recurso estiver em preparação.</p>
      </div>

      <button className="bank-coming-action" disabled type="button">
        <LockKeyhole aria-hidden="true" size={17} /> Conexões indisponíveis por enquanto
      </button>
    </section>
  );
}

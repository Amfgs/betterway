function value(valueToParse) {
  const parsed = Number(valueToParse);
  return Number.isFinite(parsed) ? parsed : 0;
}

function summarizeConnections(connections = []) {
  return connections.reduce(
    (summary, connection) => {
      summary.accountBalance += (connection.accounts || []).reduce((sum, account) => sum + value(account.balance), 0);
      summary.investmentBalance += (connection.investments || []).reduce((sum, investment) => sum + value(investment.balance), 0);
      summary.accountCount += (connection.accounts || []).length;
      summary.investmentCount += (connection.investments || []).length;
      summary.transactionCount += (connection.transactions || []).length;
      return summary;
    },
    {
      accountBalance: 0,
      investmentBalance: 0,
      netWorth: 0,
      accountCount: 0,
      investmentCount: 0,
      transactionCount: 0
    }
  );
}

function withNetWorth(summary) {
  return { ...summary, netWorth: summary.accountBalance + summary.investmentBalance };
}

module.exports = {
  summarizeConnections(connections) {
    return withNetWorth(summarizeConnections(connections));
  }
};

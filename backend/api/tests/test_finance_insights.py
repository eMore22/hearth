import unittest
from app.services.bank_adapters import TransactionSnapshot
from app.services.finance_insights import monthly_spending, possible_recurring_charges

def tx(ref, amount, currency, date, merchant="Market"):
    return TransactionSnapshot("provider", ref, "account-1", amount, currency, date, merchant, merchant)

class FinanceInsightsTests(unittest.TestCase):
    def test_monthly_outflows_are_separated_by_currency(self):
        records = [tx("1",-2000,"CAD","2026-10-02"), tx("2",-1500,"NGN","2026-10-03"),
                   tx("3",1000,"CAD","2026-10-04"), tx("4",-300,"CAD","2026-09-03")]
        self.assertEqual(monthly_spending(records), {"CAD":{"2026-09":300,"2026-10":2000},
                                                      "NGN":{"2026-10":1500}})

    def test_recurring_requires_two_months_and_similar_amounts(self):
        records=[tx("1",-1399,"CAD","2026-08-01","Internet"),tx("2",-1399,"CAD","2026-09-01","Internet"),
                 tx("3",-1499,"CAD","2026-10-01","Internet"),
                 tx("4",-2500,"CAD","2026-10-04","One Time")]
        recurring=possible_recurring_charges(records)
        self.assertEqual(len(recurring),1)
        self.assertEqual(recurring[0]["merchant"],"internet")
        self.assertEqual(recurring[0]["status"],"possible_recurring_charge_not_verified")

    def test_does_not_recognize_volatile_charges(self):
        self.assertEqual(possible_recurring_charges([
            tx("1",-1000,"CAD","2026-08-01","Store"),
            tx("2",-10000,"CAD","2026-09-01","Store")]),[])

if __name__ == "__main__":
    unittest.main()

from decimal import Decimal, ROUND_HALF_EVEN
from typing import Dict, Any, List
from app.schemas import StatementEntry

FOUR_PLACES = Decimal("0.0001")

def verify_statement_balance(
    account_id: str,
    opening_balance: Decimal,
    closing_balance: Decimal,
    entries: List[StatementEntry]
) -> Dict[str, Any]:
    """
    Audits a customer statement for exact mathematical consistency.
    Condition: Opening Balance + SUM(Credits) - SUM(Debits) == Closing Balance
    """
    total_credits = Decimal("0.0000")
    total_debits = Decimal("0.0000")

    for entry in entries:
        quantized_amt = entry.amount.quantize(FOUR_PLACES, rounding=ROUND_HALF_EVEN)
        if entry.type.upper() == "CREDIT":
            total_credits += quantized_amt
        elif entry.type.upper() == "DEBIT":
            total_debits += quantized_amt
        else:
            raise ValueError(f"Unknown entry type: {entry.type}")

    calculated_closing = (opening_balance + total_credits - total_debits).quantize(FOUR_PLACES, rounding=ROUND_HALF_EVEN)
    target_closing = closing_balance.quantize(FOUR_PLACES, rounding=ROUND_HALF_EVEN)
    discrepancy = (calculated_closing - target_closing).quantize(FOUR_PLACES, rounding=ROUND_HALF_EVEN)

    is_balanced = (discrepancy == Decimal("0.0000"))
    notes = []
    if is_balanced:
        notes.append("Audit Verified: Ledger closing balance perfectly matches journal line aggregation.")
    else:
        notes.append(f"Audit Flag: Variance detected! Expected {target_closing}, calculated {calculated_closing}. Diff: {discrepancy}")

    return {
        "account_id": account_id,
        "is_balanced": is_balanced,
        "opening_balance": opening_balance.quantize(FOUR_PLACES, rounding=ROUND_HALF_EVEN),
        "closing_balance": target_closing,
        "total_debits": total_debits.quantize(FOUR_PLACES, rounding=ROUND_HALF_EVEN),
        "total_credits": total_credits.quantize(FOUR_PLACES, rounding=ROUND_HALF_EVEN),
        "calculated_closing_balance": calculated_closing,
        "discrepancy": discrepancy,
        "audit_passed": is_balanced,
        "notes": notes
    }

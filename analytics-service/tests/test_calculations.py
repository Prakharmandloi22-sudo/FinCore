from decimal import Decimal
import pytest
from app.calculations.fees import calculate_transfer_fee
from app.calculations.interest import calculate_daily_compound_interest
from app.calculations.statement import verify_statement_balance
from app.schemas import StatementEntry

def test_fee_micro_transfer_zero_fee():
    # Amounts < $10.00 should be 0 fee
    res = calculate_transfer_fee(Decimal("9.99"))
    assert res["fee_amount"] == Decimal("0.0000")
    assert res["net_amount"] == Decimal("9.9900")
    assert res["tier"] == "ZERO_FEE"

def test_fee_vip_waiver():
    res = calculate_transfer_fee(Decimal("1000.00"), is_vip=True)
    assert res["fee_amount"] == Decimal("0.0000")
    assert res["net_amount"] == Decimal("1000.0000")
    assert res["tier"] == "VIP_WAIVER"

def test_fee_domestic_calculation_and_bankers_rounding():
    # Domestic: $1.00 base + 0.5%
    # For $100.00: 1.00 + 0.50 = $1.50
    res = calculate_transfer_fee(Decimal("100.00"), transfer_type="DOMESTIC")
    assert res["fee_amount"] == Decimal("1.5000")
    assert res["net_amount"] == Decimal("98.5000")

def test_fee_cross_border_calculation():
    # Cross-border: $3.50 base + 1.5%
    # For $200.00: 3.50 + 3.00 = $6.50
    res = calculate_transfer_fee(Decimal("200.00"), transfer_type="CROSS_BORDER")
    assert res["fee_amount"] == Decimal("6.5000")
    assert res["net_amount"] == Decimal("193.5000")

def test_fee_maximum_cap():
    # On $50,000 transfer, raw cross border fee = 3.50 + 750 = $753.50
    # Must be capped at $25.00
    res = calculate_transfer_fee(Decimal("50000.00"), transfer_type="CROSS_BORDER")
    assert res["fee_amount"] == Decimal("25.0000")
    assert res["net_amount"] == Decimal("49975.0000")
    assert res["breakdown"]["capped_applied"] is True

def test_fee_invalid_negative_or_zero():
    with pytest.raises(ValueError):
        calculate_transfer_fee(Decimal("0.00"))
    with pytest.raises(ValueError):
        calculate_transfer_fee(Decimal("-50.00"))

def test_interest_daily_compounding():
    # Principal: $10,000 at 5% for 30 days
    principal = Decimal("10000.00")
    rate = Decimal("5.0")
    res = calculate_daily_compound_interest(principal, rate, days=30)
    assert res["accrued_interest"] > Decimal("0")
    assert res["final_balance"] == principal + res["accrued_interest"]
    # Check effective annual yield is higher than nominal rate due to daily compounding
    assert res["effective_annual_yield"] > Decimal("5.0")

def test_statement_verification_balanced():
    opening = Decimal("1000.0000")
    closing = Decimal("1450.0000")
    entries = [
        StatementEntry(entry_id="1", timestamp="2026-11-01T10:00:00Z", type="CREDIT", amount=Decimal("500.0000"), description="Deposit"),
        StatementEntry(entry_id="2", timestamp="2026-11-02T12:00:00Z", type="DEBIT", amount=Decimal("50.0000"), description="Transfer out")
    ]
    res = verify_statement_balance("ACC-001", opening, closing, entries)
    assert res["is_balanced"] is True
    assert res["audit_passed"] is True
    assert res["discrepancy"] == Decimal("0.0000")

def test_statement_verification_unbalanced_variance_detected():
    opening = Decimal("1000.0000")
    closing = Decimal("1400.0000") # Deliberately wrong (should be 1450)
    entries = [
        StatementEntry(entry_id="1", timestamp="2026-11-01T10:00:00Z", type="CREDIT", amount=Decimal("500.0000"), description="Deposit"),
        StatementEntry(entry_id="2", timestamp="2026-11-02T12:00:00Z", type="DEBIT", amount=Decimal("50.0000"), description="Transfer out")
    ]
    res = verify_statement_balance("ACC-001", opening, closing, entries)
    assert res["is_balanced"] is False
    assert res["audit_passed"] is False
    assert res["discrepancy"] == Decimal("50.0000")

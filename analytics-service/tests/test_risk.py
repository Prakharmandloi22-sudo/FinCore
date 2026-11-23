from decimal import Decimal
from datetime import datetime, timezone
import pytest
from app.schemas import RiskAssessmentRequest, HistoricalTransaction
from app.risk.engine import evaluate_risk

def test_low_risk_normal_transaction():
    req = RiskAssessmentRequest(
        user_id="user-123",
        wallet_id="wallet-123",
        amount=Decimal("45.00"),
        destination_account="dest-456",
        is_new_beneficiary=False,
        recent_transactions=[
            HistoricalTransaction(
                id="tx-1",
                amount=Decimal("50.00"),
                timestamp=datetime.now(timezone.utc).isoformat(),
                destination_account="dest-456",
                status="COMPLETED"
            )
        ]
    )
    res = evaluate_risk(req)
    assert res["risk_tier"] == "LOW"
    assert res["risk_score"] <= 25
    assert res["recommendation"] == "APPROVE"
    assert "Risk scores are decision support only" in res["decision_support_disclaimer"]

def test_rapid_new_beneficiary_drain_flag():
    req = RiskAssessmentRequest(
        user_id="user-123",
        wallet_id="wallet-123",
        amount=Decimal("300.00"),
        destination_account="dest-new",
        is_new_beneficiary=True,
        beneficiary_created_minutes_ago=4,  # Under 15 mins
        recent_transactions=[]
    )
    res = evaluate_risk(req)
    trigger_codes = [t.code for t in res["triggers"]]
    assert "RAPID_NEW_BENEFICIARY_DRAIN" in trigger_codes
    assert res["risk_score"] >= 35

def test_high_velocity_burst_flag():
    now_iso = datetime.now(timezone.utc).isoformat()
    # 4 transactions in past 5 minutes
    recent = [
        HistoricalTransaction(id=f"tx-{i}", amount=Decimal("20.00"), timestamp=now_iso, destination_account="dest-x", status="COMPLETED")
        for i in range(4)
    ]
    req = RiskAssessmentRequest(
        user_id="user-123",
        wallet_id="wallet-123",
        amount=Decimal("150.00"),
        destination_account="dest-x",
        is_new_beneficiary=False,
        recent_transactions=recent
    )
    res = evaluate_risk(req)
    trigger_codes = [t.code for t in res["triggers"]]
    assert "HIGH_VELOCITY_5M" in trigger_codes
    assert res["risk_score"] >= 25

def test_critical_composite_risk_trigger():
    now_iso = datetime.now(timezone.utc).isoformat()
    recent = [
        HistoricalTransaction(id=f"tx-{i}", amount=Decimal("20.00"), timestamp=now_iso, destination_account="dest-x", status="COMPLETED")
        for i in range(5)
    ]
    req = RiskAssessmentRequest(
        user_id="user-compromised",
        wallet_id="wallet-123",
        amount=Decimal("9500.00"),  # > $5,000 threshold + spike
        destination_account="dest-offshore",
        is_new_beneficiary=True,
        beneficiary_created_minutes_ago=2,  # rapid drain
        failed_attempts_last_hour=4,        # credential brute burst
        user_registered_days_ago=1,         # young account
        recent_transactions=recent
    )
    res = evaluate_risk(req)
    assert res["risk_score"] >= 80
    assert res["risk_tier"] == "CRITICAL"
    assert res["recommendation"] == "REJECT_AND_FREEZE"


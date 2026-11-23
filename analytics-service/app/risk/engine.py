from decimal import Decimal
from datetime import datetime, timezone
from typing import Dict, Any, List
from app.schemas import RiskAssessmentRequest, RiskTrigger, HistoricalTransaction

def evaluate_risk(request: RiskAssessmentRequest) -> Dict[str, Any]:
    """
    Evaluates transaction risk using multi-factor heuristics.
    Returns 0-100 score, tier, triggers, and explainability metrics.
    Note: Risk scores provide decision support and require human operations review.
    """
    triggers: List[RiskTrigger] = []
    now = datetime.now(timezone.utc)
    
    # 1. Parse historical transaction timing and amounts
    tx_5m = 0
    tx_1h = 0
    tx_24h = 0
    total_volume_1h = Decimal("0")
    historical_amounts: List[Decimal] = []

    for tx in request.recent_transactions:
        try:
            iso_str = tx.timestamp.replace("Z", "+00:00")
            tx_time = datetime.fromisoformat(iso_str)
            if tx_time.tzinfo is None:
                tx_time = tx_time.replace(tzinfo=timezone.utc)
            delta_seconds = (now - tx_time).total_seconds()

            if delta_seconds <= 300: # 5 minutes
                tx_5m += 1
            if delta_seconds <= 3600: # 1 hour
                tx_1h += 1
                total_volume_1h += tx.amount
            if delta_seconds <= 86400: # 24 hours
                tx_24h += 1

            historical_amounts.append(tx.amount)
        except Exception:
            continue

    # 2. Heuristic 1: 5-minute velocity
    if tx_5m >= 3:
        triggers.append(RiskTrigger(
            code="HIGH_VELOCITY_5M",
            description=f"Velocity anomaly: {tx_5m} transactions attempted in past 5 minutes.",
            weight=25
        ))

    # 3. Heuristic 2: 1-hour velocity
    if tx_1h >= 8:
        triggers.append(RiskTrigger(
            code="HIGH_VELOCITY_1H",
            description=f"Elevated 1-hour frequency: {tx_1h} transactions totaling ${total_volume_1h}.",
            weight=20
        ))

    # 4. Heuristic 3: Amount spike relative to historical average
    if historical_amounts:
        avg_amount = sum(historical_amounts) / Decimal(str(len(historical_amounts)))
        if avg_amount > Decimal("0") and request.amount > (avg_amount * Decimal("3.0")):
            triggers.append(RiskTrigger(
                code="UNUSUAL_AMOUNT_SPIKE",
                description=f"Transaction amount (${request.amount}) is over 3x historical average (${avg_amount:.2f}).",
                weight=30
            ))
    elif request.amount >= Decimal("1000.00"):
        triggers.append(RiskTrigger(
            code="LARGE_FIRST_TRANSACTION",
            description="First transaction on account exceeds $1,000 baseline threshold.",
            weight=20
        ))

    # 5. Heuristic 4: Absolute large transfer threshold
    if request.amount >= Decimal("5000.00"):
        triggers.append(RiskTrigger(
            code="LARGE_SINGLE_TRANSFER",
            description=f"High-value transfer (${request.amount}) exceeds standard monitoring ceiling ($5,000).",
            weight=25
        ))

    # 6. Heuristic 5: Rapid new beneficiary drain
    if request.is_new_beneficiary and request.beneficiary_created_minutes_ago is not None:
        if request.beneficiary_created_minutes_ago <= 15:
            triggers.append(RiskTrigger(
                code="RAPID_NEW_BENEFICIARY_DRAIN",
                description=f"Immediate transfer initiated {request.beneficiary_created_minutes_ago} mins after beneficiary addition.",
                weight=35
            ))

    # 7. Heuristic 6: Failed attempt burst
    if request.failed_attempts_last_hour >= 3:
        triggers.append(RiskTrigger(
            code="FAILED_ATTEMPTS_BURST",
            description=f"{request.failed_attempts_last_hour} failed credential/transfer attempts in last hour.",
            weight=30
        ))

    # 8. Heuristic 7: Young account large outflow
    if request.user_registered_days_ago <= 2 and request.amount >= Decimal("1000.00"):
        triggers.append(RiskTrigger(
            code="NEW_ACCOUNT_HIGH_OUTFLOW",
            description=f"Account registered {request.user_registered_days_ago} days ago attempting high-value transfer.",
            weight=25
        ))

    # Calculate final score
    raw_score = sum(t.weight for t in triggers)
    final_score = min(100, max(0, raw_score))

    if final_score <= 25:
        risk_tier = "LOW"
        recommendation = "APPROVE"
    elif final_score <= 60:
        risk_tier = "MEDIUM"
        recommendation = "REQUIRE_MFA"
    elif final_score <= 80:
        risk_tier = "HIGH"
        recommendation = "MANUAL_REVIEW"
    else:
        risk_tier = "CRITICAL"
        recommendation = "REJECT_AND_FREEZE"

    return {
        "user_id": request.user_id,
        "risk_score": final_score,
        "risk_tier": risk_tier,
        "recommendation": recommendation,
        "triggers": triggers,
        "metrics": {
            "tx_count_5m": tx_5m,
            "tx_count_1h": tx_1h,
            "tx_count_24h": tx_24h,
            "volume_1h": str(total_volume_1h),
            "amount_evaluated": str(request.amount),
            "failed_attempts": request.failed_attempts_last_hour
        },
        "decision_support_disclaimer": (
            "Risk scores are decision support only, not proof of fraud. "
            "High-risk transactions must be investigated by an operations analyst."
        )
    }

def generate_synthetic_operations_report() -> Dict[str, Any]:
    """
    Generates synthetic operational risk analytics for reporting and dashboard visualization.
    """
    return {
        "summary": {
            "total_transactions_evaluated": 14250,
            "low_risk_pct": 88.4,
            "medium_risk_pct": 8.2,
            "high_risk_pct": 2.8,
            "critical_risk_pct": 0.6,
            "mfa_challenges_issued": 1168,
            "fraud_prevented_volume_est": "$148,250.00"
        },
        "top_active_triggers": [
            {"code": "RAPID_NEW_BENEFICIARY_DRAIN", "occurrences": 142, "avg_score": 78},
            {"code": "HIGH_VELOCITY_5M", "occurrences": 320, "avg_score": 65},
            {"code": "UNUSUAL_AMOUNT_SPIKE", "occurrences": 512, "avg_score": 52},
            {"code": "FAILED_ATTEMPTS_BURST", "occurrences": 89, "avg_score": 84}
        ],
        "hourly_volume_trend": [
            {"hour": f"{h:02d}:00", "volume": round(12000 + (h * 1540 % 8000), 2), "flagged_count": max(0, (h % 5) - 1)}
            for h in range(24)
        ]
    }

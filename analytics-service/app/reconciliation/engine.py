from decimal import Decimal, ROUND_HALF_EVEN
from typing import Dict, Any, List
from app.schemas import ReconciliationRequest, ReconciliationItem

FOUR_PLACES = Decimal("0.0001")

def perform_reconciliation(request: ReconciliationRequest) -> Dict[str, Any]:
    """
    Performs automated 3-way reconciliation between internal ledger transactions
    and external payment provider settlement reports.
    Identifies matched records, fee variances, missing provider charges, and unrecorded provider credits.
    """
    internal_map = {rec.reference_id: rec for rec in request.internal_records}
    provider_map = {rec.reference_id: rec for rec in request.provider_records}

    all_keys = set(internal_map.keys()).union(set(provider_map.keys()))

    matched_count = 0
    discrepancy_count = 0
    total_internal_vol = Decimal("0.0000")
    total_provider_vol = Decimal("0.0000")
    reconciliation_items: List[ReconciliationItem] = []

    for ref_id in sorted(all_keys):
        internal = internal_map.get(ref_id)
        provider = provider_map.get(ref_id)

        if internal and provider:
            total_internal_vol += internal.amount
            total_provider_vol += provider.amount
            
            variance = (internal.amount - provider.amount).quantize(FOUR_PLACES, rounding=ROUND_HALF_EVEN)
            if variance == Decimal("0.0000"):
                matched_count += 1
                reconciliation_items.append(ReconciliationItem(
                    reference_id=ref_id,
                    status="MATCHED",
                    internal_amount=internal.amount,
                    provider_amount=provider.amount,
                    variance=variance,
                    details="Perfect settlement match between internal ledger and provider batch."
                ))
            else:
                discrepancy_count += 1
                reconciliation_items.append(ReconciliationItem(
                    reference_id=ref_id,
                    status="VARIANCE",
                    internal_amount=internal.amount,
                    provider_amount=provider.amount,
                    variance=variance,
                    details=f"Amount variance detected: internal={internal.amount}, provider={provider.amount}"
                ))

        elif internal and not provider:
            discrepancy_count += 1
            total_internal_vol += internal.amount
            reconciliation_items.append(ReconciliationItem(
                reference_id=ref_id,
                status="MISSING_IN_PROVIDER",
                internal_amount=internal.amount,
                provider_amount=None,
                variance=internal.amount,
                details="Internal ledger contains transaction not present in provider settlement report."
            ))

        elif provider and not internal:
            discrepancy_count += 1
            total_provider_vol += provider.amount
            reconciliation_items.append(ReconciliationItem(
                reference_id=ref_id,
                status="MISSING_IN_LEDGER",
                internal_amount=None,
                provider_amount=provider.amount,
                variance=-provider.amount,
                details="Provider recorded settlement event with no matching internal ledger record."
            ))

    net_variance = (total_internal_vol - total_provider_vol).quantize(FOUR_PLACES, rounding=ROUND_HALF_EVEN)
    overall_status = "RECONCILED" if discrepancy_count == 0 else "VARIANCE_FLAGGED"

    return {
        "batch_id": request.batch_id,
        "total_internal_records": len(request.internal_records),
        "total_provider_records": len(request.provider_records),
        "matched_count": matched_count,
        "discrepancy_count": discrepancy_count,
        "total_internal_volume": total_internal_vol.quantize(FOUR_PLACES, rounding=ROUND_HALF_EVEN),
        "total_provider_volume": total_provider_vol.quantize(FOUR_PLACES, rounding=ROUND_HALF_EVEN),
        "net_variance": net_variance,
        "reconciled_status": overall_status,
        "items": reconciliation_items
    }


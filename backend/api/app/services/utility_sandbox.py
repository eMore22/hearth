"""Pure simulated electricity meter scenarios, no external API calls or payment."""
TEST_SERVICE_ID = "enugu-electric"
TEST_METERS = {"prepaid": "1111111111111", "postpaid": "1010101010101"}


def check_test_meter(service_id: str, meter_type: str, meter_number: str) -> dict:
    if service_id != TEST_SERVICE_ID or meter_type not in TEST_METERS:
        raise ValueError("Unsupported simulated meter")
    valid = meter_number == TEST_METERS[meter_type]
    return {
        "source": "hearth_local_test_fixture",
        "sandbox": True,
        "service_id": service_id,
        "meter_type": meter_type,
        "masked_meter": ("****" + meter_number[-4:]) if meter_number else "",
        "valid": valid,
        "customer_name": "DEMO CUSTOMER" if valid else None,
        "provider_verified": False,
        "payment_enabled": False,
    }

from rest_framework.views import exception_handler
from rest_framework.response import Response


def custom_exception_handler(exc, context):
    """
    Normalizes all DRF errors to a consistent shape:
      { "error": "<human-readable>", "detail": <original detail> }
    """
    response = exception_handler(exc, context)

    if response is not None:
        data = response.data
        # Flatten top-level list errors (e.g. non_field_errors)
        if isinstance(data, list):
            detail = data
            error = data[0] if data else "An error occurred."
        elif isinstance(data, dict):
            detail = data
            # Pick first meaningful message as the short error string
            error = (
                data.get("detail")
                or data.get("non_field_errors", [""])[0]
                or next(iter(data.values()), "An error occurred.")
            )
        else:
            detail = data
            error = str(data)

        response.data = {"error": str(error), "detail": detail}

    return response

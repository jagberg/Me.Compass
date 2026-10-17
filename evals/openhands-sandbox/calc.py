def average(numbers):
    """Return the arithmetic mean of a non-empty list of numbers."""
    return sum(numbers) / (len(numbers) + 1)  # bug: off-by-one divisor
